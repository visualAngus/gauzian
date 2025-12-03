use axum::{
   extract::{Json, State}, http::StatusCode, response::IntoResponse
};
use axum::http::{header::ACCEPT_LANGUAGE, HeaderMap}; // header constant + HeaderMap extractor
use axum::http::header::USER_AGENT;
use sha2::Digest;
use gauzian_core::{AppState, RegisterRequest, LoginRequest};
use axum_client_ip::InsecureClientIp;
use serde::Deserialize;


// Ensure the database connection string is correct in your AppState configuration
// Example: "postgres://username:password@localhost/database_name"
use woothee::parser::Parser; 

// On ajoute les imports pour l'identité
use argon2::{
    Argon2,
    password_hash::{
        rand_core::OsRng,
        PasswordHash,     // <--- Manquait pour parser le hash stocké
        PasswordHasher,   // <--- Pour créer le hash (register)
        PasswordVerifier, // <--- Manquait pour verify_password (login)
        SaltString
    },
};
// verifier si la session est expirée
use uuid::Uuid;
// On importe le module pour charger les variables d'environnement (si ce n'est pas déjà fait)
use rand::RngCore; // Pour remplir des bytes au hasard
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit},
    XChaCha20Poly1305, Key
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde_json::json; // Import the json! macro

// std::time::Duration removed; using chrono::Duration for DateTime arithmetic
use chrono::{DateTime, Utc}; // Pour gérer les dates/heures de manière sûre et explicite
use chrono::Duration as ChronoDuration; // Pour l'expiration des tokens

// ------------------ minimal: keep only frontend-provided IP logging ------------------


/// Génère une Master Key (MK) et la chiffre avec le mot de passe de l'utilisateur.
fn create_user_vault(password: &str) -> Result<(String, String), String> {
    // 1. Générer la Master Key (MK) aléatoire (128 octets)
    let mut master_key: [u8; 128] = [0u8; 128];
    rand::thread_rng().fill_bytes(&mut master_key);

    // 2. Préparer le sel pour la clé de chiffrement (KEK)
    let salt = SaltString::generate(&mut OsRng);

    // 3. Dériver la clé de chiffrement (KEK) depuis le mot de passe
    // CORRECTION ICI : On utilise hash_password standard et on extrait les bytes
    let argon2 = Argon2::default();
    
    // On dérive une clé KEK de 32 octets (256 bits) à partir du mot de passe.
    // XChaCha20Poly1305 attend une clé de 32 octets, donc on utilise
    // `hash_password_into` pour remplir exactement 32 octets.
    let mut kek = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt.as_ref().as_bytes(), &mut kek)
        .map_err(|e| e.to_string())?;

    // 4. Chiffrement (Wrapping) de la MK avec la KEK
    let key = Key::from_slice(&kek);
    let cipher = XChaCha20Poly1305::new(key);
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);

    let ciphertext = cipher.encrypt(&nonce, master_key.as_ref())
        .map_err(|_| "Erreur de chiffrement".to_string())?;

    // 5. Packaging (Nonce + Ciphertext)
    let mut vault_bytes = nonce.to_vec();
    vault_bytes.extend_from_slice(&ciphertext);

    let vault_b64 = BASE64.encode(vault_bytes);
    let salt_b64 = salt.as_str().to_string(); // CORRECTION: as_str() avant to_string()

    Ok((vault_b64, salt_b64))
}


async fn hash_token(token: &str) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(token.as_bytes());
    let hash = hasher.finalize();
    BASE64.encode(hash)
}

async fn create_token() -> Result<(String,String), String> {
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
    headers: HeaderMap,                   // FromRequestParts extractors MUST come before body extractors
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
        let salt = SaltString::from_b64(salt_auth.as_str())
            .map_err(|e| format!("Sel invalide: {}", e))?;
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

    // Insertion dans la base de données
    let insert_result = sqlx::query!(
        r#"
        INSERT INTO users (email, password_hash, salt_e2e, salt_auth, storage_key_encrypted, storage_key_encrypted_recuperation, last_name, first_name, date_of_birth, time_zone, locale)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
        payload.email,
        password_hash.as_bytes(),
        payload.salt_e2e.as_bytes(),
        payload.salt_auth.as_bytes(),
        storage_key_encrypted.as_bytes(),
        storage_key_encrypted_recuperation.as_bytes(),
        payload.last_name,
        payload.first_name,
        payload.date_of_birth,
        time_zone,
        locale
    )
    .execute(&state.db_pool)
    .await;
    
    // Gestion d'erreur de la DB (ex: Email déjà utilisé)
    match insert_result {
        Ok(_) => {
            let body = Json(json!({
            "status": "success",
            "message": "Utilisateur GAUZIAN créé (E2EE Active)."
            }));
            (StatusCode::CREATED, body).into_response()
        }
        Err(e) => {
            eprintln!("Erreur SQL: {:?}", e);
            // Vérifie si c'est une erreur de duplicata (code 23505 en Postgres)
            let body = Json(json!({
                "status": "error",
                "message": "Erreur lors de la création de l'utilisateur. Email est déjà utilisé."
            }));
            (
                StatusCode::CONFLICT,
                body,
            )
            .into_response()
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
                format!("Autre ({})", &raw_user_agent.chars().take(20).collect::<String>())
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
        let parsed_hash = PasswordHash::new(&password_hash_str)
            .map_err(|e| e.to_string())?;
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

async fn reset_token_life_time(
    token: &str,
    State(state): State<AppState>,
    ) -> Result<(), String> {
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

    let session_hash_b64 = hash_token(&session_token).await;
    
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
            return (StatusCode::UNAUTHORIZED, "Session invalide").into_response();
        }
        Err(e) => {
            eprintln!("Erreur SQL Autologin: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };
    println!("Session pour user_id: {}", session.user_id);
    let now = Utc::now();
    if session.expires_at < now {
        let body = Json(json!({
                "status": "error",
                "message": "Session expirée"
            }));
        return (StatusCode::UNAUTHORIZED, body).into_response();
    } else {
        reset_token_life_time(&session_hash_b64, State(state)).await.unwrap_or_else(|e| {
            eprintln!("Erreur lors de la mise à jour de l'expiration du token: {}", e);
        });
        let body = Json(json!({
                "status": "success",
                "message": "Connexion réussie"
            }));
        return (StatusCode::OK, body).into_response();
    }
}