// Handlers HTTP pour l'authentification
// Chaque handler accepte State<AppState> et orchestre services + repo

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{response::ApiResponse, state::AppState};

use super::{repo, services};

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
    // Ajouter d'autres champs selon tes besoins
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
            crate::metrics::track_auth_attempt("login", false);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("JWT error: {}", e))
        })?;

    crate::metrics::track_auth_attempt("login", true);

    Ok(ApiResponse::ok(LoginResponse {
        token: token.clone(),
        user_id: user.id.to_string(),
    })
    .with_token(token)) // 10 jours
}

/// POST /register - Crée un nouvel utilisateur
pub async fn register_handler(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<ApiResponse<String>, (StatusCode, String)> {
    // 1. Hash le mot de passe avec Argon2
    let password_hash = services::hash_password(&payload.password)
        .map_err(|e| {
            crate::metrics::track_auth_attempt("register", false);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Hashing error: {}", e))
        })?;

    // 2. Générer un salt (pour compatibilité legacy)
    let auth_salt = Some(services::generate_salt());

    // 3. Créer l'utilisateur en DB
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
            crate::metrics::track_auth_attempt("register", false);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e))
        })?;

    // creation du jwt pour le nouvel utilisateur (auto-login après inscription)
    let token = services::create_jwt(user_id, "user", state.jwt_secret.as_bytes())
        .map_err(|e| {
            crate::metrics::track_auth_attempt("register", false);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("JWT error: {}", e))
        })?;

    crate::metrics::track_auth_attempt("register", true);

    Ok(ApiResponse::ok(format!("User created with ID: {}", user_id)).with_token(token))
}

/// POST /logout - Révoque le token JWT
pub async fn logout_handler(
    State(state): State<AppState>,
    claims: services::Claims, // Extrait automatiquement depuis le token
) -> Result<ApiResponse<String>, (StatusCode, String)> {
    // Ajouter le token à la blacklist Redis
    let mut redis_conn = state.redis_manager.clone();
    services::blacklist_token(&mut redis_conn, &claims.jti, 10 * 24 * 3600)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Redis error: {}", e)))?;

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
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB error: {}", e)))?;

    Ok(ApiResponse::ok(user_info))
}

/// GET /contacts/get_public_key/:email - Récupère la clé publique d'un utilisateur
pub async fn get_public_key_handler(
    State(state): State<AppState>,
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
