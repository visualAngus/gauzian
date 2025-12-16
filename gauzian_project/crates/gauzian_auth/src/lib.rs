use axum::http::header::USER_AGENT;
use axum::http::{HeaderMap, header::ACCEPT_LANGUAGE}; // header constant + HeaderMap extractor
use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use axum_client_ip::InsecureClientIp;
use gauzian_core::{AppState, LoginRequest, RegisterRequest,Claims};

use uuid::Uuid;
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
use serde_json::json; // Import the json! macro
use sqlx::Row; // Import the Row trait for using the `get` method

// std::time::Duration removed; using chrono::Duration for DateTime arithmetic
use chrono::Duration as ChronoDuration;
use chrono::{Utc}; // Pour gérer les dates/heures de manière sûre et explicite // Pour l'expiration des tokens

use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

// ------------------ minimal: keep only frontend-provided IP logging ------------------

fn get_secret_key() -> Vec<u8> {
    BASE64
        .decode(std::env::var("JWT_SECRET_KEY").unwrap_or_default())
        .expect("Échec du décodage de JWT_SECRET_KEY depuis Base64")
}

pub fn create_token(user_id: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    // Calcul de la date d'expiration : Maintenant + 7 jours
    let expire = now + ChronoDuration::days(7);

    let claims = Claims {
        sub: user_id.to_owned(),
        exp: expire.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    // Encodage du token avec l'algorithme HS256 par défaut
    let secret_key = get_secret_key();
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&secret_key),
    )
}

pub fn validate_and_refresh_token(token: &str) -> Result<String, jsonwebtoken::errors::Error> {
    // 1. Validation du token existant
    let validation = Validation::default();
    let secret_key = get_secret_key();

    // Si le token est expiré ou que la signature est fausse, decode renverra une erreur
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(&secret_key),
        &validation,
    )?;

    // 2. Si on est ici, le token est valide.
    // On récupère l'ID utilisateur (sub) du token décodé
    let user_id = token_data.claims.sub;

    // 3. On crée un NOUVEAU token pour cet utilisateur (ce qui remet le compteur à 7 jours)
    create_token(&user_id)
}

pub fn verify_session_token(token: &str) -> Result<Uuid, jsonwebtoken::errors::Error> {
    // 1. Validation du token existant
    let validation = Validation::default();
    let secret_key = get_secret_key();

    // Si le token est expiré ou que la signature est fausse, decode renverra une erreur
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(&secret_key),
        &validation,
    )?;

    // 2. Si on est ici, le token est valide.
    // On récupère l'ID utilisateur (sub) du token décodé
    let user_id = token_data.claims.sub;

    // Convertir le String en Uuid avant de retourner
    match Uuid::parse_str(&user_id) {
        Ok(uuid) => Ok(uuid),
        Err(_e) => Err(jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidToken)),
    }
}

// 3. Le Handler (Contrôleur)
// Il prend l'état (DB) et le JSON (payload) en entrée.
// Il retourne quelque chose qui implémente IntoResponse (souvent un tuple (StatusCode, String))
pub async fn register_handler(
    State(state): State<AppState>,        // Injection du Pool de connexions
    headers: HeaderMap, // FromRequestParts extractors MUST come before body extractors
    Json(payload): Json<RegisterRequest>, // Désérialisation automatique du body JSON
) -> impl IntoResponse {

    let client_ip = headers
        .get("x-real-ip")
        .and_then(|val| val.to_str().ok())
        .unwrap_or("IP Inconnue"); // Fallback si le header est absent

    // 2. LOG POUR VÉRIFICATION
    // Regarde ta console serveur quand tu fais une requête
    println!("🔍 DEBUG IP CLIENT: {}", client_ip);
    
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
    let payload_client_ip = headers
        .get("x-real-ip")
        .and_then(|val| val.to_str().ok())
        .unwrap_or("IP Inconnue"); // Fallback si le header est absent
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
    let token_raw = match create_token(&user.id.to_string()) {
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

pub async fn autologin_handler(
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

    match validate_and_refresh_token(&session_token) {
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
    }
}


pub async fn info_handler(
    State(state): State<AppState>,
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


    // Validate the token and get the user ID
    let user_id = match verify_session_token(&session_token) {
        Ok(user_id) => user_id,
        Err(_) => {
            let body = Json(json!({
                "status": "error",
                "message": "Session invalide ou expirée"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    // Fetch user info from the database
    let user_info_result = sqlx::query!(
        "SELECT email, first_name, last_name, date_of_birth, time_zone, locale FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&state.db_pool)
    .await;

    match user_info_result {
        Ok(user) => {
            let body = Json(json!({
                "status": "success",
                "user_info": {
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "date_of_birth": user.date_of_birth,
                    "time_zone": user.time_zone,
                    "locale": user.locale,
                }
            }));
            (StatusCode::OK, body).into_response()
        }
        Err(e) => {
            eprintln!("Erreur SQL Récupération Infos Utilisateur: {:?}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Erreur lors de la récupération des informations utilisateur"
            }));
            (StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
        }
    }
}