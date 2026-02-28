// Handlers HTTP pour l'authentification
// Chaque handler accepte State<AppState> et orchestre services + repo

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use rand::distr::{Alphanumeric, SampleString};

use crate::{response::ApiResponse, state::AppState};

use super::{repo, services};

// ========== Validation ==========

fn validate_password(password: &str) -> Result<(), &'static str> {
    if password.len() < 10 {
        return Err("Le mot de passe doit contenir au moins 10 caractères");
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err("Le mot de passe doit contenir au moins une majuscule");
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err("Le mot de passe doit contenir au moins un chiffre");
    }
    if !password.chars().any(|c| "!@#$%^&*()_+-=[]{};\':\"\\|,.<>/?".contains(c)) {
        return Err("Le mot de passe doit contenir au moins un caractère spécial");
    }
    Ok(())
}

fn validate_email_format(email: &str) -> bool {
    if email.is_empty() || email.len() > 254 {
        return false;
    }
    let mut parts = email.splitn(2, '@');
    let local = parts.next().unwrap_or("");
    let domain = match parts.next() {
        Some(d) => d,
        None => return false,
    };
    !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && domain.len() > 2
}

// ========== Structures de requêtes/réponses ==========

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user_id: String,
    // Champs crypto nécessaires pour déchiffrer la clé privée côté client
    pub encrypted_private_key: String,
    pub private_key_salt: String,
    pub iv: String,
    pub public_key: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub token: String,
    pub user_id: String,
    pub encrypted_private_key: String,
    pub private_key_salt: String,
    pub iv: String,
    pub public_key: String,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub username: String,
    pub password: String,
    pub encrypted_private_key: String,
    pub public_key: String,
    pub private_key_salt: String,
    pub iv: String,
    pub encrypted_record_key: String,
    pub temp_token: String, // Token temporaire obtenu après vérification OTP
}

// ========== Handlers ==========

/// POST /login - Authentifie un utilisateur
pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<ApiResponse<LoginResponse>, (StatusCode, String)> {

    let mut redis = state.redis_manager.clone();
    if services::is_rate_limited(&mut redis, &payload.email).await.map_err(|e| {
        tracing::error!("Redis error during rate limit check: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
    })? {
        crate::metrics::track_auth_attempt("login", false);
        return Err((StatusCode::TOO_MANY_REQUESTS, "Too many failed login attempts. Please try again later.".to_string()));
    }

    // 1. Récupérer l'utilisateur depuis la DB
    let user = repo::get_user_by_email(&state.db_pool, &payload.email)
        .await
        .map_err(|_| {
            crate::metrics::track_auth_attempt("login", false);
            (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
        })?;

    // 2. Vérifier le mot de passe
    let salt = user.auth_salt.as_deref().unwrap_or("");
    if !services::verify_password(&payload.password, &user.password_hash, salt) {
        services::increment_failed_login(&mut redis, &payload.email).await.map_err(|e| {
            tracing::error!("Redis error during incrementing failed login: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
        })?;

        crate::metrics::track_auth_attempt("login", false);
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }

    services::reset_failed_login(&mut redis, &payload.email).await.map_err(|e| {
        tracing::error!("Redis error during resetting failed login: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
    })?;

    // 3. Créer un JWT
    let token = services::create_jwt(user.id, "user", state.jwt_secret.as_bytes())
        .map_err(|e| {
            tracing::error!("Failed to create JWT during login: {}", e);
            crate::metrics::track_auth_attempt("login", false);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal authentication error".to_string(),
            )
        })?;

    crate::metrics::track_auth_attempt("login", true);

    Ok(ApiResponse::ok(LoginResponse {
        token: token.clone(),
        user_id: user.id.to_string(),
        // Champs crypto pour permettre au frontend de déchiffrer la clé privée
        encrypted_private_key: user.encrypted_private_key,
        private_key_salt: user.private_key_salt,
        iv: user.iv,
        public_key: user.public_key,
    }))
}

/// POST /register - Crée un nouvel utilisateur
// pub async fn register_handler(
//     State(state): State<AppState>,
//     headers: HeaderMap,
//     Json(payload): Json<RegisterRequest>,
// ) -> Result<ApiResponse<RegisterResponse>, (StatusCode, String)> {
//     // 0. Rate limit par IP avant tout traitement coûteux (Argon2)
//     let ip = headers
//         .get("X-Real-IP")
//         .or_else(|| headers.get("X-Forwarded-For"))
//         .and_then(|h| h.to_str().ok())
//         .unwrap_or("unknown");

//     let mut redis = state.redis_manager.clone();
//     if services::is_register_rate_limited(&mut redis, ip).await.map_err(|e| {
//         tracing::error!("Redis error during register rate limit check: {:?}", e);
//         (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
//     })? {
//         crate::metrics::track_auth_attempt("register", false);
//         return Err((StatusCode::TOO_MANY_REQUESTS, "Too many registration attempts. Please try again later.".to_string()));
//     }

//     services::increment_register_attempt(&mut redis, ip).await.map_err(|e| {
//         tracing::error!("Redis error during register attempt increment: {:?}", e);
//         (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
//     })?;

//     // 0b. Valider le format de l'email
//     if !validate_email_format(&payload.email) {
//         return Err((StatusCode::BAD_REQUEST, "Format d'email invalide".to_string()));
//     }

//     // 0c. Valider le mot de passe
//     if let Err(msg) = validate_password(&payload.password) {
//         return Err((StatusCode::BAD_REQUEST, msg.to_string()));
//     }

//     // 1. Hash le mot de passe avec Argon2
//     let password_hash = services::hash_password(&payload.password)
//         .map_err(|e| {
//             tracing::error!("Failed to hash password during register: {}", e);
//             crate::metrics::track_auth_attempt("register", false);
//             (
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "Internal authentication error".to_string(),
//             )
//         })?;

//     // 2. Générer un salt (pour compatibilité legacy)
//     let auth_salt = Some(services::generate_salt());

//     // 3. Stocker les champs crypto pour la réponse (avant move)
//     let encrypted_private_key = payload.encrypted_private_key.clone();
//     let private_key_salt = payload.private_key_salt.clone();
//     let iv = payload.iv.clone();
//     let public_key = payload.public_key.clone();

//     // 4. Créer l'utilisateur en DB
//     let new_user = repo::NewUser {
//         username: payload.username,
//         password_hash,
//         encrypted_private_key: payload.encrypted_private_key,
//         public_key: payload.public_key,
//         email: payload.email,
//         encrypted_settings: None,
//         private_key_salt: payload.private_key_salt,
//         iv: payload.iv,
//         auth_salt,
//         encrypted_record_key: payload.encrypted_record_key,
//     };

//     let user_id = repo::create_user(&state.db_pool, new_user)
//         .await
//         .map_err(|e| {
//             tracing::error!("Failed to create user: {}", e);
//             crate::metrics::track_auth_attempt("register", false);
//             // Détecter violation de contrainte unique PostgreSQL (code 23505)
//             if let sqlx::Error::Database(ref db_err) = e {
//                 if db_err.code().as_deref() == Some("23505") {
//                     let msg = db_err.message();
//                     if msg.contains("email") {
//                         return (StatusCode::CONFLICT, "Cette adresse email est déjà utilisée".to_string());
//                     } else if msg.contains("username") {
//                         return (StatusCode::CONFLICT, "Ce nom d'utilisateur est déjà pris".to_string());
//                     }
//                     return (StatusCode::CONFLICT, "Ce compte existe déjà".to_string());
//                 }
//             }
//             (
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "Erreur serveur, veuillez réessayer".to_string(),
//             )
//         })?;

//     // 5. Créer JWT pour auto-login après inscription
//     let token = services::create_jwt(user_id, "user", state.jwt_secret.as_bytes())
//         .map_err(|e| {
//             tracing::error!("Failed to create JWT during register: {}", e);
//             crate::metrics::track_auth_attempt("register", false);
//             (
//                 StatusCode::INTERNAL_SERVER_ERROR,
//                 "Internal authentication error".to_string(),
//             )
//         })?;

//     crate::metrics::track_auth_attempt("register", true);

//     Ok(ApiResponse::ok(RegisterResponse {
//         token: token.clone(),
//         user_id: user_id.to_string(),
//         encrypted_private_key,
//         private_key_salt,
//         iv,
//         public_key,
//     }))
// }

/// POST /logout - Révoque le token JWT
pub async fn logout_handler(
    State(state): State<AppState>,
    claims: services::Claims, // Extrait automatiquement depuis le token
) -> Result<ApiResponse<String>, (StatusCode, String)> {
    // Ajouter le token à la blacklist Redis
    let mut redis_conn = state.redis_manager.clone();
    services::blacklist_token(&mut redis_conn, &claims.jti, 10 * 24 * 3600)
        .await
        .map_err(|e| {
            tracing::error!("Failed to blacklist JWT: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal authentication error".to_string(),
            )
        })?;

    Ok(ApiResponse::ok("Logged out successfully".to_string()))
}

/// GET /autologin - Vérifie si le token est toujours valide
pub async fn auto_login_handler(
    State(_state): State<AppState>,
    claims: services::Claims,
) -> Result<ApiResponse<String>, (StatusCode, String)> {
    Ok(ApiResponse::ok(format!("Authenticated as user {}", claims.id)))
}

/// GET /protected - Endpoint protégé (exemple)
pub async fn protected_handler(
    State(_state): State<AppState>,
    claims: services::Claims,
) -> Result<ApiResponse<String>, (StatusCode, String)> {
    Ok(ApiResponse::ok(format!(
        "Hello user {} with role {}",
        claims.id, claims.role
    )))
}

/// GET /info - Récupère les infos de l'utilisateur connecté
pub async fn info_handler(
    State(state): State<AppState>,
    claims: services::Claims,
) -> Result<ApiResponse<repo::UserInfo>, (StatusCode, String)> {
    let user_info = repo::get_user_by_id(&state.db_pool, claims.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch user info: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;

    Ok(ApiResponse::ok(user_info))
}

/// GET /contacts/get_public_key/:email - Récupère la clé publique d'un utilisateur (authentifié)
pub async fn get_public_key_handler(
    State(state): State<AppState>,
    _claims: services::Claims,
    Path(email): Path<String>,
) -> Result<ApiResponse<serde_json::Value>, (StatusCode, String)> {
    let (user_id, public_key) = repo::get_public_key_by_email(&state.db_pool, &email)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    Ok(ApiResponse::ok(serde_json::json!({
        "user_id": user_id,
        "public_key": public_key
    })))
}

pub async fn send_otp_handler(
    State(state): State<AppState>,
    Json(payload): Json<services::SendOtpRequest>,
) -> Result<ApiResponse<String>, (StatusCode, String)> {
    if !validate_email_format(&payload.email) {
        return Err((StatusCode::BAD_REQUEST, "Format d'email invalide".to_string()));
    }
    let mut redis = state.redis_manager.clone();

    // verifier le cooldown
    if services::is_otp_cooldown(&mut redis, payload.email.clone()).await.map_err(|e| {
        tracing::error!("Failed to check OTP cooldown in Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })? {
        return Err((StatusCode::TOO_MANY_REQUESTS, "OTP recently sent. Please wait before requesting another one.".to_string()));
    }

    // veririfier le counter
    let attempts = services::get_otp_attempts(&mut redis, payload.email.clone()).await.map_err(|e| {
        tracing::error!("Failed to get OTP attempts from Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    if attempts >= 5 {
        return Err((StatusCode::TOO_MANY_REQUESTS, "Too many OTP requests. Please try again later.".to_string()));
    }

    // verifier que l'email existe en DB
    let exists = repo::check_email_exists(&state.db_pool, &payload.email)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check email existence: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;

    if exists {
        return Err((StatusCode::BAD_REQUEST, "Email already registered".to_string()));
    }
    let otp = Alphanumeric.sample_string(&mut rand::rng(), 6).to_uppercase();
    services::send_otp(&payload.email, &otp, &state.mailer).await.map_err(|e| {
        tracing::error!("Failed to send OTP: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to send OTP".to_string(),
        )
    })?;

    // mettre dans redis avec TTL de 5 minutes
    services::store_otp(&mut redis, payload.email.clone(), otp.clone()).await.map_err(|e| {
        tracing::error!("Failed to store OTP in Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    // cooldown
    services::cooldown_otp(&mut redis, payload.email.clone()).await.map_err(|e| {
        tracing::error!("Failed to set OTP cooldown in Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    Ok(ApiResponse::ok("OTP sent successfully".to_string()))
}

pub async fn verify_otp_handler(
    State(state): State<AppState>,
    Json(payload): Json<services::VerifyOtpRequest>,
) -> Result<ApiResponse<String>, (StatusCode, String)> {
    let mut redis = state.redis_manager.clone();

    // verifier le counter 
    let attempts = services::get_otp_attempts(&mut redis, payload.email.clone()).await.map_err(|e| {
        tracing::error!("Failed to get OTP attempts from Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    if attempts >= 5 {
        return Err((StatusCode::TOO_MANY_REQUESTS, "Too many OTP verification attempts. Please try again later.".to_string()));
    }

    let is_valid = services::verify_otp(&mut redis, payload.email.clone(), payload.otp.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify OTP: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;

    if !is_valid {

        // augmenter le compteur d'échecs
        services::counter_otp_attempts(&mut redis, payload.email.clone()).await.map_err(|e| {
            tracing::error!("Failed to increment OTP attempts in Redis: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?;


        return Err((StatusCode::UNAUTHORIZED, "Invalid or expired OTP".to_string()));
    }

    // générer un token temporaire pour permettre à l'utilisateur d'accéder à l'étape finale de l'inscription
    let temp_token = services::create_temp_token(&payload.email, state.jwt_secret.as_bytes())
        .await
        .map_err(|e| {
            tracing::error!("Failed to create temp token: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal authentication error".to_string(),
            )
        })?;

    // suprimer l'OTP de Redis
    services::delete_otp(&mut redis, payload.email.as_str()).await.map_err(|e| {
        tracing::error!("Failed to delete OTP from Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;
    // ajouter le token temporaire dans Redis avec un TTL de 15 minutes
    services::store_temp_token(&mut redis, payload.email.clone(), temp_token.clone()).await.map_err(|e| {
        tracing::error!("Failed to store temp token in Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    Ok(ApiResponse::ok(temp_token))
}


pub async fn finalize_registration_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,
) -> Result<ApiResponse<RegisterResponse>, (StatusCode, String)> {
    // 0. Rate limit par IP avant tout traitement coûteux (Argon2)
    let ip = headers
        .get("X-Real-IP")
        .or_else(|| headers.get("X-Forwarded-For"))
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown");

    let mut redis = state.redis_manager.clone();
    if services::is_register_rate_limited(&mut redis, ip).await.map_err(|e| {
        tracing::error!("Redis error during register rate limit check: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
    })? {
        crate::metrics::track_auth_attempt("register", false);
        return Err((StatusCode::TOO_MANY_REQUESTS, "Too many registration attempts. Please try again later.".to_string()));
    }

    services::increment_register_attempt(&mut redis, ip).await.map_err(|e| {
        tracing::error!("Redis error during register attempt increment: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Internal error".to_string())
    })?;

    // 0b. Valider le format de l'email
    if !validate_email_format(&payload.email) {
        return Err((StatusCode::BAD_REQUEST, "Format d'email invalide".to_string()));
    }


    // verification que le token temporaire est valide
    if payload.temp_token.is_empty() {
        return Err((StatusCode::UNAUTHORIZED, "OTP verification required".to_string()));
    }
    // verifier que le token temporaire correspond à celui stocké dans Redis pour cet email
    services::verify_temp_token(
        &payload.temp_token,
        &payload.email,
        state.jwt_secret.as_bytes(),
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to verify temp token: {}", e);
        (StatusCode::UNAUTHORIZED, "Invalid or expired temp token".to_string())
    })?;
    // valider le token temporaire
    let stored_token = services::get_temp_token(&mut redis, payload.email.clone()).await.map_err(|e| {
        tracing::error!("Failed to get temp token from Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    if stored_token.is_none() {
        return Err((StatusCode::UNAUTHORIZED, "OTP verification required".to_string()));
    }
    if stored_token.unwrap() != payload.temp_token {
        return Err((StatusCode::UNAUTHORIZED, "Invalid temp token".to_string()));
    }
    // 0c. Valider le mot de passe
    if let Err(msg) = validate_password(&payload.password) {
        return Err((StatusCode::BAD_REQUEST, msg.to_string()));
    }

    // 1. Hash le mot de passe avec Argon2
    let password_hash = services::hash_password(&payload.password)
        .map_err(|e| {
            tracing::error!("Failed to hash password during register: {}", e);
            crate::metrics::track_auth_attempt("register", false);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal authentication error".to_string(),
            )
        })?;

    // 2. Générer un salt (pour compatibilité legacy)
    let auth_salt = Some(services::generate_salt());

    // 3. Stocker les champs crypto pour la réponse (avant move)
    let encrypted_private_key = payload.encrypted_private_key.clone();
    let private_key_salt = payload.private_key_salt.clone();
    let iv = payload.iv.clone();
    let public_key = payload.public_key.clone();
    let email_for_otp_cleanup = payload.email.clone();

    // 4. Créer l'utilisateur en DB
    let new_user = repo::NewUser {
        username: payload.username,
        password_hash,
        encrypted_private_key: payload.encrypted_private_key,
        public_key: payload.public_key,
        email: payload.email,
        encrypted_settings: None,
        private_key_salt: payload.private_key_salt,
        iv: payload.iv,
        auth_salt,
        encrypted_record_key: payload.encrypted_record_key,
    };

    let user_id = repo::create_user(&state.db_pool, new_user)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create user: {}", e);
            crate::metrics::track_auth_attempt("register", false);
            // Détecter violation de contrainte unique PostgreSQL (code 23505)
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.code().as_deref() == Some("23505") {
                    let msg = db_err.message();
                    if msg.contains("email") {
                        return (StatusCode::CONFLICT, "Cette adresse email est déjà utilisée".to_string());
                    } else if msg.contains("username") {
                        return (StatusCode::CONFLICT, "Ce nom d'utilisateur est déjà pris".to_string());
                    }
                    return (StatusCode::CONFLICT, "Ce compte existe déjà".to_string());
                }
            }
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur serveur, veuillez réessayer".to_string(),
            )
        })?;

    // 5. Créer JWT pour auto-login après inscription
    let token = services::create_jwt(user_id, "user", state.jwt_secret.as_bytes())
        .map_err(|e| {
            tracing::error!("Failed to create JWT during register: {}", e);
            crate::metrics::track_auth_attempt("register", false);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal authentication error".to_string(),
            )
        })?;

    crate::metrics::track_auth_attempt("register", true);

    // suprimer le compteur d'OTP de Redis
    services::delete_otp_attempts(&mut redis, email_for_otp_cleanup.as_str()).await.map_err(|e| {
        tracing::error!("Failed to reset OTP attempts in Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    // suprimer le cooldown d'OTP de Redis
    services::delete_otp_cooldown(&mut redis, email_for_otp_cleanup.as_str()).await.map_err(|e| {
        tracing::error!("Failed to delete OTP cooldown from Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    // suprimer le token temporaire de Redis
    services::delete_temp_token(&mut redis, email_for_otp_cleanup.as_str()).await.map_err(|e| {
        tracing::error!("Failed to delete temp token from Redis: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error".to_string(),
        )
    })?;

    Ok(ApiResponse::ok(RegisterResponse {
        token: token.clone(),
        user_id: user_id.to_string(),
        encrypted_private_key,
        private_key_salt,
        iv,
        public_key,
    }))
}
