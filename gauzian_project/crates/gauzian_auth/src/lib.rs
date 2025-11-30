use axum::{
    extract::{Json, State}, // On ajoute Json et State ici
    http::StatusCode,
    response::IntoResponse,
};
use axum::http::{header::ACCEPT_LANGUAGE, HeaderMap}; // header constant + HeaderMap extractor
use axum::http::header::USER_AGENT;
use ipnetwork::IpNetwork; 
use axum::extract;

use std::net::SocketAddr;
use sha2::Digest;
use gauzian_core::{AppState, RegisterRequest};
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

    // get local time zone from Accept-Language header
    let raw_locale = headers
        .get(ACCEPT_LANGUAGE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Parse the locale to get the primary language code
    let locale = raw_locale
        .as_deref()
        .and_then(|s| s.split(',').next()) // Prend la première partie (la préférée)
        .and_then(|s| s.split('-').next()) // Prend le code principal (ex: 'fr')
        .unwrap_or("en") // La valeur par défaut (GAUZIAN est par défaut en anglais)
        .to_string();

    // Use the provided time_zone or default to "UTC"
    let time_zone = payload.time_zone.unwrap_or("UTC".to_string());

    // On change le type de retour du spawn_blocking : on veut Hash + Vault + Salt
    let password_clone = payload.password.clone();
    let crypto_result = tokio::task::spawn_blocking(move || {
        // A. Hachage pour l'authentification (ce qu'on faisait avant)
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let auth_hash = argon2
            .hash_password(password_clone.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| e.to_string())?;

        // B. Création du Vault (Nouveau !)
        let (vault, vault_salt) = create_user_vault(&password_clone)?;

        Ok::<(String, String, String), String>((auth_hash, vault, vault_salt))
    })
    .await;

    // Récupération des données
    let (auth_hash, vault, vault_salt) = match crypto_result {
        Ok(Ok(res)) => res,
        Ok(Err(e)) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Crypto error: {}", e)).into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Thread error").into_response(),
    };

    
    // ... Insertion SQL mise à jour
    let insert_result = sqlx::query!(
        r#"
        INSERT INTO users (id, email, password_hash, vault, vault_salt, first_name, last_name, locale, time_zone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        Uuid::new_v4(),
        payload.email,
        auth_hash,
        vault,
        vault_salt,
        payload.first_name,
        payload.last_name,
        // CHAMPS AUTOMATIQUES
        locale,     // $8
        time_zone   // $9
    )
    .execute(&state.db_pool)
    .await;

    // Gestion d'erreur de la DB (ex: Email déjà utilisé)
    match insert_result {
        Ok(_) => {
            // Statut HTTP 201 CREATED
            (StatusCode::CREATED, "Utilisateur GAUZIAN créé.").into_response()
        }
        Err(e) => {
            eprintln!("Erreur SQL: {:?}", e);
            // Pour l'instant, on suppose que toute erreur est un conflit (DUPLICATE KEY)
            (
                StatusCode::CONFLICT,
                "L'email est déjà utilisé ou autre erreur de base de données.",
            )
                .into_response()
        }
    }
}

pub async fn login_handler(
    State(state): State<AppState>,
    extract::ConnectInfo(addr): extract::ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,
) -> impl IntoResponse {

    let ip_addr: std::net::IpAddr = addr.ip();
    println!("Tentative de connexion depuis l'IP: {}", ip_addr);
    let ip_network = IpNetwork::from(ip_addr);

    // User-Agent parsing
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
    println!("User-Agent lisible : {}", formatted_user_agent);

    // Avoid moving payload fields so we can use both email and password
    let email = payload.email.clone();
    let password_input = payload.password.clone();

    let user_result = sqlx::query!(
        "SELECT id, password_hash FROM users WHERE email = $1",
        email
    )
    .fetch_optional(&state.db_pool)
    .await;

    let user = match user_result {
        Ok(Some(u)) => u,
        Ok(None) => {
            return (StatusCode::UNAUTHORIZED, "Email ou mot de passe incorrect").into_response();
        }
        Err(e) => {
            eprintln!("Erreur SQL Login: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    let stored_hash = user.password_hash.clone();

    let is_valid = tokio::task::spawn_blocking(move || {
        let parsed_hash = match PasswordHash::new(&stored_hash) {
            Ok(h) => h,
            Err(_) => return false,
        };
        Argon2::default()
            .verify_password(password_input.as_bytes(), &parsed_hash)
            .is_ok()
    })
    .await
    .unwrap_or(false);

    if is_valid {
        let (session_token, session_hash) = match create_token().await {
            Ok(tuple) => tuple,
            Err(e) => {
                eprintln!("Erreur de génération de token: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur de token").into_response();
            }
        };

        let days: i64 = std::env::var("TOKEN_LIFE_DAYS")
            .ok()
            .and_then(|val| val.parse::<i64>().ok())
            .unwrap_or(7);
        let expires_at: DateTime<Utc> = Utc::now() + ChronoDuration::seconds(days * 24 * 3600);

        let insert_session_result = sqlx::query!(
            r#"
            INSERT INTO sessions (token, user_id, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            session_hash,
            user.id,
            expires_at,
            ip_network,
            formatted_user_agent
        )
        .execute(&state.db_pool)
        .await;

        match insert_session_result {
            Ok(_) => {
                let set_cookie_header = format!(
                    "session_id={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure;Partitioned",
                    session_token,
                    days * 24 * 3600
                );

                let body = Json(json!({
                    "status": "success",
                    "message": "Connexion réussie"
                }));

                return (
                    StatusCode::OK,
                    [(axum::http::header::SET_COOKIE, set_cookie_header)],
                    body,
                )
                    .into_response();
            }
            Err(e) => {
                eprintln!("Erreur SQL Insert Session: {:?}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
            }
        };
    } else {
        (StatusCode::UNAUTHORIZED, "Email ou mot de passe incorrect").into_response()
    }
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
            return (StatusCode::UNAUTHORIZED, "Pas de cookie de session").into_response();  
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