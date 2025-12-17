use std::f32::consts::E;

use axum::http::header::USER_AGENT;
use axum::http::{HeaderMap, header::ACCEPT_LANGUAGE}; // header constant + HeaderMap extractor
use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use axum_client_ip::InsecureClientIp;
use gauzian_core::{AppState, Claims, LoginRequest, RegisterRequest};

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
use chrono::Utc; // Pour gérer les dates/heures de manière sûre et explicite // Pour l'expiration des tokens

use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};

use bigdecimal::BigDecimal;
use tracing::{debug, error, info};
use sha2::{Sha256, Digest};

// ------------------ minimal: keep only frontend-provided IP logging ------------------

fn get_secret_key() -> Vec<u8> {
    BASE64
        .decode(std::env::var("JWT_SECRET_KEY").unwrap_or_default())
        .expect("Échec du décodage de JWT_SECRET_KEY depuis Base64")
}

// Génère un refresh token aléatoire sécurisé
pub fn generate_refresh_token() -> String {
    let mut random_bytes = [0u8; 32];
    getrandom::getrandom(&mut random_bytes)
        .expect("Erreur lors de la génération de nombres aléatoires");
    hex::encode(random_bytes)
}

// Hash le refresh token pour le stocker en BDD
fn hash_refresh_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

// Crée un Access Token JWT de courte durée (5 minutes)
pub fn create_access_token(user_id: &Uuid) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let expire = now + ChronoDuration::minutes(5);

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expire.timestamp() as usize,
        iat: now.timestamp() as usize,
    };

    let secret_key = get_secret_key();
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&secret_key),
    )
}

// Sauvegarde le refresh token en BDD
async fn save_refresh_token(
    pool: &sqlx::PgPool,
    user_id: &Uuid,
    token: &str,
) -> Result<(), sqlx::Error> {
    let token_hash = hash_refresh_token(token);
    let expires_at = Utc::now() + ChronoDuration::days(7);

    sqlx::query!(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        "#,
        user_id,
        token_hash,
        expires_at
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Vérifie et rafraîchit la session (Rolling Refresh Token)
pub async fn refresh_session(
    pool: &sqlx::PgPool,
    old_refresh_token: &str,
) -> Result<(String, String), String> {
    let token_hash = hash_refresh_token(old_refresh_token);

    // 1. Chercher le token en BDD avec vérification d'expiration
    let db_token = sqlx::query!(
        r#"
        SELECT user_id, expires_at
        FROM refresh_tokens
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Erreur BDD: {}", e))?;

    // 2. Vérifications de sécurité
    let token_data = db_token.ok_or("Token invalide ou révoqué")?;

    if token_data.expires_at < Utc::now() {
        // Nettoyer le token expiré
        let _ = sqlx::query!(
            "DELETE FROM refresh_tokens WHERE token_hash = $1",
            token_hash
        )
        .execute(pool)
        .await;

        return Err("Token expiré, veuillez vous reconnecter".to_string());
    }

    let user_id = token_data.user_id;

    // 3. Rotation : suppression de l'ancien token
    sqlx::query!(
        "DELETE FROM refresh_tokens WHERE token_hash = $1",
        token_hash
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Erreur lors de la suppression: {}", e))?;

    // 4. Génération de la nouvelle paire
    let new_access_token = create_access_token(&user_id)
        .map_err(|e| format!("Erreur création access token: {}", e))?;
    let new_refresh_token = generate_refresh_token();

    // 5. Sauvegarde du nouveau refresh token
    save_refresh_token(pool, &user_id, &new_refresh_token)
        .await
        .map_err(|e| format!("Erreur sauvegarde refresh token: {}", e))?;

    Ok((new_access_token, new_refresh_token))
}

// Révoque le refresh token (logout)
pub async fn logout(pool: &sqlx::PgPool, refresh_token: &str) -> Result<(), sqlx::Error> {
    let token_hash = hash_refresh_token(refresh_token);

    sqlx::query!(
        "DELETE FROM refresh_tokens WHERE token_hash = $1",
        token_hash
    )
    .execute(pool)
    .await?;

    Ok(())
}

// Vérifie l'Access Token JWT (inchangé)
pub fn verify_session_token(token: &str) -> Result<Uuid, jsonwebtoken::errors::Error> {
    let validation = Validation::default();
    let secret_key = get_secret_key();

    let token_data = decode::<Claims>(token, &DecodingKey::from_secret(&secret_key), &validation)?;
    let user_id = token_data.claims.sub;

    match Uuid::parse_str(&user_id) {
        Ok(uuid) => Ok(uuid),
        Err(_e) => Err(jsonwebtoken::errors::Error::from(
            jsonwebtoken::errors::ErrorKind::InvalidToken,
        )),
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
    info!(client_ip = %client_ip, "register request received");

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
            error!(error = %e, "password hashing failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors de l'encodage du mot de passe",
            )
                .into_response();
        }
        Err(e) => {
            error!(error = %e, "password hashing task join error");
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
                            error!(error = ?e, "insert folder_access failed");
                            let body = Json(json!({
                                "status": "error",
                                "message": "Erreur lors de la création de l'accès au dossier utilisateur."
                            }));
                            (StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
                        }
                    }
                }
                Err(e) => {
                    error!(error = ?e, "insert root folder failed");
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur lors de la création du dossier utilisateur."
                    }));
                    (StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
                }
            }
        }
        Err(e) => {
            error!(error = ?e, "insert user failed");
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
            error!(error = ?e, "login query failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    debug!(user_id = %user.id, "user found for login");

    let password_hash_clone = user.password_hash.clone();
    let password_hash_str = match String::from_utf8(password_hash_clone) {
        Ok(s) => s,
        Err(e) => {
            error!(error = ?e, "Erreur lors de la conversion du hash de mot de passe en String");
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
            debug!(user_id = %user.id, "password verified");
        }
        _ => {
            return (StatusCode::UNAUTHORIZED, "Email ou mot de passe invalide").into_response();
        }
    };

    // Création de l'Access Token (JWT - 5 minutes)
    let access_token = match create_access_token(&user.id) {
        Ok(t) => t,
        Err(e) => {
            error!(error = %e, "access token creation failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    // Création du Refresh Token (Opaque - 7 jours)
    let refresh_token = generate_refresh_token();

    // Sauvegarde du refresh token en BDD
    if let Err(e) = save_refresh_token(&state.db_pool, &user.id, &refresh_token).await {
        error!(error = ?e, "refresh token save failed");
        return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
    }

    // Récupérer les clés de l'utilisateur
    let user_keys_result = sqlx::query!(
        "SELECT salt_e2e, storage_key_encrypted FROM users WHERE id = $1",
        user.id
    )
    .fetch_one(&state.db_pool)
    .await;

    let keys = match user_keys_result {
        Ok(ref keys) => keys,
        Err(e) => {
            error!(error = ?e, "fetch user keys failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    let salt_e2e = keys.salt_e2e.clone();
    let salt_auth = user.salt_auth.clone();
    let storage_key_encrypted = keys.storage_key_encrypted.clone();

    // Cookie HttpOnly pour l'Access Token (court)
    let access_cookie = format!(
        "access_token={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned",
        access_token,
        5 * 60 // 5 minutes
    );

    // Cookie HttpOnly pour le Refresh Token (long)
    let refresh_cookie = format!(
        "refresh_token={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned",
        refresh_token,
        7 * 24 * 3600 // 7 jours
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
        [
            (axum::http::header::SET_COOKIE, access_cookie.as_str()),
            (axum::http::header::SET_COOKIE, refresh_cookie.as_str()),
        ],
        body,
    )
        .into_response()
}

// Nouveau handler pour le refresh
pub async fn refresh_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Récupérer le refresh token depuis les cookies
    let refresh_token = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("refresh_token=") {
                    return Some(cookie.trim_start_matches("refresh_token=").to_string());
                }
            }
            None
        });

    let refresh_token = match refresh_token {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Refresh token manquant"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    // Rafraîchir la session
    match refresh_session(&state.db_pool, &refresh_token).await {
        Ok((new_access_token, new_refresh_token)) => {
            // Nouveaux cookies
            let access_cookie = format!(
                "access_token={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned",
                new_access_token,
                5 * 60
            );

            let refresh_cookie = format!(
                "refresh_token={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned",
                new_refresh_token,
                7 * 24 * 3600
            );

            let body = Json(json!({
                "status": "success",
                "message": "Session rafraîchie avec succès"
            }));

            (
                StatusCode::OK,
                [
                    (axum::http::header::SET_COOKIE, access_cookie.as_str()),
                    (axum::http::header::SET_COOKIE, refresh_cookie.as_str()),
                ],
                body,
            )
                .into_response()
        }
        Err(e) => {
            let body = Json(json!({
                "status": "error",
                "message": e
            }));
            (StatusCode::UNAUTHORIZED, body).into_response()
        }
    }
}

// Handler de logout
pub async fn logout_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let refresh_token = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("refresh_token=") {
                    return Some(cookie.trim_start_matches("refresh_token=").to_string());
                }
            }
            None
        });

    if let Some(token) = refresh_token {
        if let Err(e) = logout(&state.db_pool, &token).await {
            error!(error = ?e, "logout failed");
        }
    }

    // Supprimer les cookies
    let clear_access = "access_token=; Max-Age=0; Path=/; HttpOnly; SameSite=None; Secure; Partitioned";
    let clear_refresh = "refresh_token=; Max-Age=0; Path=/; HttpOnly; SameSite=None; Secure; Partitioned";

    let body = Json(json!({
        "status": "success",
        "message": "Déconnexion réussie"
    }));

    (
        StatusCode::OK,
        [
            (axum::http::header::SET_COOKIE, clear_access),
            (axum::http::header::SET_COOKIE, clear_refresh),
        ],
        body,
    )
        .into_response()
}

pub async fn info_handler(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
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

    let storage_param = get_storage_usage_handler(user_id, &state).await;
    let (storage_used, nb_folder, nb_file, storage_limit) = storage_param.unwrap_or((0, 0, 0, 0));

    let media_type_usage = get_storage_usage_by_file_type_handler(user_id, &state).await;

    // Fetch user info from the database
    let user_info_result = sqlx::query!(
        "SELECT email, first_name, last_name, date_of_birth, time_zone, locale , created_at, updated_at
        FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(&state.db_pool)
    .await;
    match user_info_result {
        Ok(user) => {
            // Déstructure storage_param une seule fois pour éviter les appels multiples à .map()
            let body = Json(json!({
                "status": "success",
                "user_info": {
                    "email": user.email,
                    "firstName": user.first_name,
                    "lastName": user.last_name,
                    "date_of_birth": user.date_of_birth,
                    "time_zone": user.time_zone,
                    "locale": user.locale,
                    "createdAt": user.created_at,
                    "updatedAt": user.updated_at,
                    "storageLimit": storage_limit,
                    "storageUsed": storage_used,
                    "nbFolders": nb_folder,
                    "nbFiles": nb_file,
                    "storageByFileType": media_type_usage.unwrap_or_default()
                }
            }));
            (StatusCode::OK, body).into_response()
        }
        Err(e) => {
            error!(error = ?e, "fetch user info failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur lors de la récupération des informations utilisateur"
            }));
            (StatusCode::INTERNAL_SERVER_ERROR, body).into_response()
        }
    }
}

pub async fn get_storage_usage_handler(
    user_id: Uuid,
    state: &AppState,
) -> Option<(i64, i64, i64, i32)> {
    let storage_usage_result = sqlx::query!(
        r#"
        SELECT 
            COALESCE(SUM(vf.file_size), 0)::int8 AS total_storage, 
            COUNT(DISTINCT fa.folder_id ) as nb_folders, 
            COUNT(DISTINCT fa2.file_id ) as nb_files, u.storage_limit
        FROM folder_access fa 
        LEFT JOIN file_access fa2 ON fa2.folder_id = fa.folder_id 
        LEFT JOIN vault_files vf ON fa2.file_id = vf.id 
        inner join users u on u.id = fa.user_id 
        WHERE fa.user_id = $1
        group by u.id
        "#,
        user_id,
    )
    .fetch_one(&state.db_pool)
    .await;

    match storage_usage_result {
        Ok(row) => Some((
            row.total_storage.unwrap_or(0),
            row.nb_folders.unwrap_or(0),
            row.nb_files.unwrap_or(0),
            row.storage_limit,
        )),
        Err(e) => {
            error!(error = ?e, "fetch user storage usage failed");
            None
        }
    }
}

pub async fn get_storage_usage_by_file_type_handler(
    user_id: Uuid,
    state: &AppState,
) -> Option<Vec<(String, i64, BigDecimal)>> {
    let storage_usage_result = sqlx::query!(
        r#"
        SELECT 
            CASE 
                WHEN "media_type" IN ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain') THEN 'Document'
                WHEN "media_type" LIKE 'image/%' THEN 'Image'
                WHEN "media_type" LIKE 'video/%' THEN 'Vidéo'
                ELSE 'Autre'
            END AS "Groupe",
            COUNT(*) AS "Nombre_de_fichiers",
            SUM(vf.file_size ) AS "Taille_totale"
        FROM vault_files vf
        Where vf.owner_id = $1
        GROUP BY "Groupe"
        ORDER BY "Nombre_de_fichiers" DESC;
        "#,
        user_id,
    )
    .fetch_all(&state.db_pool)
    .await;

    match storage_usage_result {
        Ok(rows) => {
            let result = rows
                .into_iter()
                .map(|row| {
                    (
                        row.Groupe.unwrap_or_else(|| "Inconnu".to_string()),
                        row.Nombre_de_fichiers.unwrap_or(0),
                        row.Taille_totale.unwrap_or(bigdecimal::BigDecimal::from(0)),
                    )
                })
                .collect();
            Some(result)
        }
        Err(e) => {
            error!(error = ?e, "fetch storage usage by type failed");
            None
        }
    }
}


pub async fn autologin_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    // Récupérer le refresh token depuis les cookies
    let refresh_token = headers
        .get(axum::http::header::COOKIE)
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            for cookie in cookies.split(';') {
                let cookie = cookie.trim();
                if cookie.starts_with("refresh_token=") {
                    return Some(cookie.trim_start_matches("refresh_token=").to_string());
                }
            }
            None
        });

    let refresh_token = match refresh_token {
        Some(token) => token,
        None => {
            let body = Json(json!({
                "status": "error",
                "message": "Non authentifié"
            }));
            return (StatusCode::UNAUTHORIZED, body).into_response();
        }
    };

    // Vérifier le refresh token et générer une nouvelle paire
    match refresh_session(&state.db_pool, &refresh_token).await {
        Ok((new_access_token, new_refresh_token)) => {
            // Récupérer l'user_id depuis le nouveau access token
            let user_id = match verify_session_token(&new_access_token) {
                Ok(id) => id,
                Err(_) => {
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur lors de la vérification du token"
                    }));
                    return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
                }
            };

            // Récupérer les informations de l'utilisateur
            let user_result = sqlx::query!(
                "SELECT salt_e2e, storage_key_encrypted, salt_auth FROM users WHERE id = $1",
                user_id
            )
            .fetch_one(&state.db_pool)
            .await;

            let user = match user_result {
                Ok(u) => u,
                Err(e) => {
                    error!(error = ?e, "fetch user failed in autologin");
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur interne"
                    }));
                    return (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
                }
            };

            // Nouveaux cookies
            let access_cookie = format!(
                "access_token={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned",
                new_access_token,
                5 * 60
            );

            let refresh_cookie = format!(
                "refresh_token={}; Max-Age={}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned",
                new_refresh_token,
                7 * 24 * 3600
            );

            let body = Json(json!({
                "status": "success",
                "message": "Connexion automatique réussie",
                "salt_auth": String::from_utf8(user.salt_auth).unwrap_or_default(),
                "salt_e2e": String::from_utf8(user.salt_e2e).unwrap_or_default(),
                "storage_key_encrypted": String::from_utf8(user.storage_key_encrypted).unwrap_or_default(),
            }));

            (
                StatusCode::OK,
                [
                    (axum::http::header::SET_COOKIE, access_cookie.as_str()),
                    (axum::http::header::SET_COOKIE, refresh_cookie.as_str()),
                ],
                body,
            )
                .into_response()
        }
        Err(e) => {
            debug!("autologin failed: {}", e);
            let body = Json(json!({
                "status": "error",
                "message": "Session expirée, veuillez vous reconnecter"
            }));
            (StatusCode::UNAUTHORIZED, body).into_response()
        }
    }
}
