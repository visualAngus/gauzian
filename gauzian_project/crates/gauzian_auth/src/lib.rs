use axum::http::header::USER_AGENT;
use axum::http::{HeaderMap, header::ACCEPT_LANGUAGE}; // header constant + HeaderMap extractor
use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use axum_client_ip::InsecureClientIp;
use gauzian_core::{AppState, LoginRequest, RegisterRequest};
use sha2::Digest;

// Ensure the database connection string is correct in your AppState configuration
// Example: "postgres://username:password@localhost/database_name"
use woothee::parser::Parser;

// On ajoute les imports pour l'identité
use argon2::{
    Argon2,
    password_hash::{
        PasswordHash,     // <--- Manquait pour parser le hash stocké
        PasswordHasher,   // <--- Pour créer le hash (register)
        PasswordVerifier, // <--- Manquait pour verify_password (login)
        SaltString,
    },
};
// On importe le module pour charger les variables d'environnement (si ce n'est pas déjà fait)
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use rand::RngCore; // Pour remplir des bytes au hasard
use serde_json::json; // Import the json! macro
use sqlx::Row; // Import the Row trait for using the `get` method

// std::time::Duration removed; using chrono::Duration for DateTime arithmetic
use chrono::Duration as ChronoDuration;
use chrono::{DateTime, Utc}; // Pour gérer les dates/heures de manière sûre et explicite // Pour l'expiration des tokens

// ------------------ minimal: keep only frontend-provided IP logging ------------------

async fn hash_token(token: &str) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(token.as_bytes());
    let hash = hasher.finalize();
    BASE64.encode(hash)
}

async fn create_token() -> Result<(String, String), String> {
    // generation d'un token aleatoire de 32 bytes
    let mut token_bytes: [u8; 32] = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token_b64 = BASE64.encode(token_bytes);

    // hashage du token avant de le stocker dans la base de donnees (sha256)

    let token_hash_b64 = hash_token(&token_b64).await;

    Ok((token_b64, token_hash_b64))
}

// 3. Le Handler (Contrôleur)
// Il prend l'état (DB) et le JSON (payload) en entrée.
// Il retourne quelque chose qui implémente IntoResponse (souvent un tuple (StatusCode, String))
pub async fn register_handler(
    State(state): State<AppState>,        // Injection du Pool de connexions
    headers: HeaderMap, // FromRequestParts extractors MUST come before body extractors
    Json(payload): Json<RegisterRequest>, // Désérialisation automatique du body JSON
) -> impl IntoResponse {
    // 1. Gestion Locale / Timezone (inchangé)
    let raw_locale = headers
        .get(ACCEPT_LANGUAGE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    let locale = raw_locale
        .as_deref()
        .and_then(|s| s.split(',').next())
        .and_then(|s| s.split('-').next())
        .unwrap_or("en")
        .to_string();

    let time_zone = payload.time_zone.unwrap_or("UTC".to_string());

    let salt_auth = payload.salt_auth.clone();
    // génération salt pour le hash du mot de passe (argon2)
    // encodage du mot de passe avec Argon2
    let password_hash = match tokio::task::spawn_blocking(move || {
        if salt_auth.is_empty() {
            return Err("Le sel d'authentification est vide".to_string());
        }
        let salt =
            SaltString::from_b64(salt_auth.as_str()).map_err(|e| format!("Sel invalide: {}", e))?;
        if payload.password.is_empty() {
            return Err("Le mot de passe est vide".to_string());
        }
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(payload.password.as_bytes(), &salt)
            .map_err(|e| format!("Erreur de hachage: {}", e))?
            .to_string();
        Ok(password_hash)
    })
    .await
    {
        Ok(Ok(hash)) => hash,
        Ok(Err(e)) => {
            eprintln!("Erreur lors de l'encodage du mot de passe: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors de l'encodage du mot de passe",
            )
                .into_response();
        }
        Err(e) => {
            eprintln!("Erreur interne lors de l'exécution de la tâche: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur interne lors de l'exécution de la tâche",
            )
                .into_response();
        }
    };

    let storage_key_encrypted = payload.storage_key_encrypted.clone();
    let storage_key_encrypted_recuperation = payload.storage_key_encrypted_recuperation.clone();
    let folder_key_encrypted = payload.folder_key_encrypted.clone();
    let folder_metadata_encrypted = payload.folder_metadata_encrypted.clone();
    // Insertion dans la base de données
    let insert_result = sqlx::query(
        r#"
        INSERT INTO users (email, password_hash, salt_e2e, salt_auth, storage_key_encrypted, storage_key_encrypted_recuperation, last_name, first_name, date_of_birth, time_zone, locale)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        "#,
    )
    .bind(payload.email)
    .bind(password_hash.as_bytes())
    .bind(payload.salt_e2e.as_bytes())
    .bind(payload.salt_auth.as_bytes())
    .bind(storage_key_encrypted.as_bytes())
    .bind(storage_key_encrypted_recuperation.as_bytes())
    .bind(payload.last_name)
    .bind(payload.first_name)
    .bind(payload.date_of_birth)
    .bind(time_zone)
    .bind(locale)
    .fetch_one(&state.db_pool)
    .await;

    // Gestion d'erreur de la DB (ex: Email déjà utilisé)
    match insert_result {
        Ok(result) => {
            // Récupérer l'ID de l'utilisateur nouvellement créé
            let user_id: uuid::Uuid = result.get("id");
            let insert_folder_result = sqlx::query!(
                r#"
                INSERT INTO folders (owner_id, encrypted_metadata, parent_id, created_at, updated_at,is_root)
                VALUES ($1, $2::bytea, NULL, NOW(), NOW(), true)
                RETURNING id
                "#,
                user_id,
                folder_metadata_encrypted.as_bytes(),
            )
            .fetch_one(&state.db_pool)
            .await;

            match insert_folder_result {
                Ok(folder) => {
                    let folder_id: uuid::Uuid = folder.id;
                    let insert_folder_access_result = sqlx::query!(
                        r#"
                        INSERT INTO folder_access (folder_id, user_id, encrypted_folder_key, permission_level)
                        VALUES ($1, $2, $3, 'owner')
                        "#,
                        folder_id,
                        user_id,
                        folder_key_encrypted.as_bytes(),
                    )
                    .execute(&state.db_pool)
                    .await;
                    match insert_folder_access_result {
                        Ok(_) => {
                            let body = Json(json!({
                                "status": "success",
                                "message": "Utilisateur créé avec succès",
                                "user_id": user_id,
                            }));
                            (StatusCode::OK, body).into_response()
                        }
                        Err(e) => {
                            eprintln!("Erreur SQL lors de l'insertion de l'accès au dossier: {:?}", e);
                            let body = Json(json!({
                                "status": "error",
                                "message": "Erreur lors de la création de l'accès au dossier utilisateur."
                            }));
                            (StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Erreur SQL lors de l'insertion du dossier: {:?}", e);
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur lors de la création du dossier utilisateur."
                    }));
                    (StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
                }
            }
        }
        Err(e) => {
            eprintln!("Erreur SQL: {:?}", e);
            // Vérifie si c'est une erreur de duplicata (code 23505 en Postgres)
            let body = Json(json!({
                "status": "error",
                "message": "Erreur lors de la création de l'utilisateur. Email est déjà utilisé."
            }));
            (StatusCode::CONFLICT, body).into_response()
        }
    }
}

pub async fn login_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    InsecureClientIp(ip): InsecureClientIp,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    // --- LOGIQUE IP / USER-AGENT (INCHANGÉE) ---
    let payload_client_ip = payload.ip_address.clone();
    // ... (Ton code de log IP reste ici) ...

    let raw_user_agent = headers
        .get(USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    let parser = Parser::new();
    let formatted_user_agent = match parser.parse(raw_user_agent) {
        Some(result) => format!("{} {} sur {}", result.name, result.version, result.os),
        None => {
            if raw_user_agent.is_empty() {
                "Inconnu".to_string()
            } else {
                format!(
                    "Autre ({})",
                    &raw_user_agent.chars().take(20).collect::<String>()
                )
            }
        }
    };

    let email = payload.email.clone();
    let password = payload.password.clone();

    // recupérer l'utilisateur dans la base de données
    let user_result = sqlx::query!(
        "SELECT id, password_hash, salt_auth FROM users WHERE email = $1",
        email
    )
    .fetch_optional(&state.db_pool)
    .await;

    let user = match user_result {
        Ok(Some(u)) => u,
        Ok(None) => {
            return (StatusCode::UNAUTHORIZED, "Email ou mot de passe invalide").into_response();
        }
        Err(e) => {
            eprintln!("Erreur SQL Login: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    println!("Utilisateur trouvé avec ID: {}", user.id);

    // Cloner le mot de passe hashé pour le déplacer dans le bloc async
    let password_hash_clone = user.password_hash.clone();

    // Convertir le mot de passe hashé en String pour éviter les problèmes de durée de vie
    let password_hash_str = match String::from_utf8(password_hash_clone) {
        Ok(s) => s,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    let verify_result = tokio::task::spawn_blocking(move || {
        let parsed_hash = PasswordHash::new(&password_hash_str).map_err(|e| e.to_string())?;
        let argon2 = Argon2::default();
        argon2
            .verify_password(password.as_bytes(), &parsed_hash)
            .map_err(|_| "Mot de passe invalide".to_string())
    })
    .await;

    match verify_result {
        Ok(Ok(())) => {
            println!("Mot de passe vérifié pour l'utilisateur ID: {}", user.id);
        }
        _ => {
            return (StatusCode::UNAUTHORIZED, "Email ou mot de passe invalide").into_response();
        }
    };

    // Création du token de session
    let (token_raw, token_hash) = match create_token().await {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Erreur lors de la création du token: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    // Stockage du token dans la base de données avec expiration
    let days: i64 = std::env::var("TOkENT_LIFE_DAYS")
        .ok()
        .and_then(|val| val.parse::<i64>().ok())
        .unwrap_or(7); // Default to 7 days if parsing fails
    let expires_at: DateTime<Utc> = Utc::now() + ChronoDuration::seconds(days * 24 * 3600);

    let insert_result = sqlx::query!(
        r#"
        INSERT INTO sessions (user_id, token, user_agent, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        user.id,
        token_hash,
        formatted_user_agent,
        payload_client_ip,
        expires_at
    )
    .execute(&state.db_pool)
    .await;

    match insert_result {
        Ok(_) => {
            println!("Session créée pour l'utilisateur ID: {}", user.id);
        }
        Err(e) => {
            eprintln!("Erreur SQL Insert Session: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    }

    // recupérer le storage_key_encrypted et le salt_e2e pour la reponse
    let user_keys_result = sqlx::query!(
        "SELECT salt_e2e, storage_key_encrypted FROM users WHERE id = $1",
        user.id
    )
    .fetch_one(&state.db_pool)
    .await;

    let keys = match user_keys_result {
        Ok(ref keys) => keys,
        Err(e) => {
            eprintln!("Erreur SQL Récupération Clés Utilisateur: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };
    let salt_e2e = keys.salt_e2e.clone();
    let salt_auth = user.salt_auth.clone();
    let storage_key_encrypted = keys.storage_key_encrypted.clone();

    let set_cookie_header = format!(
        "session_id={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure;Partitioned",
        token_raw,
        days * 24 * 3600
    );

    let body = Json(json!({
        "status": "success",
        "message": "Connexion réussie",
        "salt_auth": String::from_utf8(salt_auth).unwrap_or_default(),
        "salt_e2e": String::from_utf8(salt_e2e).unwrap_or_default(),
        "storage_key_encrypted": String::from_utf8(storage_key_encrypted).unwrap_or_default(),
    }));

    (
        StatusCode::OK,
        [(axum::http::header::SET_COOKIE, set_cookie_header.as_str())],
        body,
    )
        .into_response()
}

async fn reset_token_life_time(token: &str, State(state): State<AppState>) -> Result<(), String> {
    // expire dans 1 heure (chrono::Duration)
    let days: i64 = std::env::var("TOkENT_LIFE_DAYS")
        .ok()
        .and_then(|val| val.parse::<i64>().ok())
        .unwrap_or(7); // Default to 7 days if parsing fails
    let new_expires_at: DateTime<Utc> = Utc::now() + ChronoDuration::seconds(days * 24 * 3600);

    let update_result = sqlx::query!(
        r#"
        UPDATE sessions
        SET expires_at = $1
        WHERE token = $2
        "#,
        new_expires_at,
        token
    )
    .execute(&state.db_pool)
    .await;

    match update_result {
        Ok(_) => Ok(()),
        Err(e) => {
            eprintln!("Erreur SQL Update Session: {:?}", e);
            Err("Erreur interne".to_string())
        }
    }
}

pub async fn verify_session_token(
    token: &str,
    State(state): State<AppState>,
) -> Result<uuid::Uuid, String> {
    let session_hash_b64 = hash_token(&token).await;

    // verifier le token de session dans la base de données (compare hash)
    let session_result = sqlx::query!(
        "SELECT user_id, expires_at FROM sessions WHERE token = $1",
        session_hash_b64
    )
    .fetch_optional(&state.db_pool)
    .await;

    let session = match session_result {
        Ok(Some(s)) => s,
        Ok(None) => {
            return Err("Session invalide".to_string());
        }
        Err(e) => {
            eprintln!("Erreur SQL Autologin: {:?}", e);
            return Err("Erreur interne".to_string());
        }
    };

    // Vérifier si la session a expiré
    let now = Utc::now();
    if session.expires_at < now {
        return Err("Session expirée".to_string());
    }
    reset_token_life_time(&token, State(state.clone())).await?;
    Ok(session.user_id)
}

pub async fn autologin_handler(
    State(state): State<AppState>, // 1. (Parts) État
    headers: HeaderMap,
) -> impl IntoResponse {
    // recuperer le cookie de session
    let session_cookie = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("session_id=") {
                    return Some(cookie.trim_start_matches("session_id=").to_string());
                }
            }
            None
        });
    let session_token = match session_cookie {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Pas de cookie de session trouvé"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    // The DB stores the hashed token (SHA256 base64). We must hash the
    // raw token from the cookie the same way before querying.

    let user_id = match verify_session_token(&session_token, State(state.clone())).await {
        Ok(user_id) => {
            let body = Json(json!({
                "status": "success",
                "message": "Auto-login réussi",
                "user_id": user_id,
            }));
            return (StatusCode::OK, body).into_response();
        }
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };
}
