use axum::extract::{Json, State};
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::{info, instrument};
use uuid::Uuid;

use crate::{auth, jwt, response::ApiResponse, state::AppState};

#[derive(Serialize)]
pub struct LoginResponse {
    pub message: String,
    pub user_id: Uuid,
    pub encrypted_private_key: String,
    pub private_key_salt: String,
    pub iv: String,
    pub public_key: String,
}
#[derive(Serialize)]
pub struct RegisterResponse {
    pub message: String,
    pub user_id: Uuid,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub encrypted_private_key: String,
    pub public_key: String,
    pub email: String,
    pub private_key_salt: String,
    pub iv: String,
    pub encrypted_record_key: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>
)-> Response {   
    let user = match auth::get_user_by_email(&state.db_pool, &req.email).await {
        Ok(user) => user,
        Err(_) => {
            tracing::warn!("Email not found: {}", req.email);
            return ApiResponse::unauthorized("Invalid email or password").into_response();
        }
    };

    match auth::verify_password(&req.password, &user.password_hash, &user.auth_salt.unwrap_or_default()) {
        true => {
            let token = jwt::create_jwt(user.id, "user", state.jwt_secret.as_bytes()).unwrap();
            info!(%user.id, "Login successful, setting cookie");
            return ApiResponse::ok(LoginResponse {
                message: "Login successful".to_string(),
                user_id: user.id,
                encrypted_private_key: user.encrypted_private_key,
                private_key_salt: user.private_key_salt,
                iv: user.iv,
                public_key: user.public_key,
            })
            .with_token(token)
            .into_response();
        }
        false => {
            tracing::warn!("Login failed for email: {}", req.email);
            return ApiResponse::unauthorized("Invalid email or password").into_response();
        }
    }
}

pub async fn register_handler(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Response {
    // hash the password
    let salt = auth::generate_salt().await; // Await the future
    let password_hash = auth::hash_password(&req.password, &salt);

    let new_user = auth::NewUser {
        username: req.username,
        password: req.password,
        password_hash: Some(password_hash),
        encrypted_private_key: req.encrypted_private_key,
        public_key: req.public_key,
        email: req.email,
        encrypted_settings: None,
        private_key_salt: req.private_key_salt,
        auth_salt: Some(salt),
        iv: req.iv,
        encrypted_record_key: req.encrypted_record_key,
    };

    let user_id = match auth::create_user(&state.db_pool, new_user).await {
        Ok(id) => id,
        Err(e) => {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.message().contains("duplicate") || db_err.message().contains("unique") {
                    tracing::warn!("Duplicate user attempted");
                    return ApiResponse::conflict("Username or email already exists")
                        .into_response();
                }
            }
            tracing::error!("Database error: {:?}", e);
            return ApiResponse::internal_error("Failed to create user").into_response();
        }
    };

    println!("Created user with ID: {}", user_id);
    let token = jwt::create_jwt(user_id, "user", state.jwt_secret.as_bytes()).unwrap();

    info!(%user_id, "Registration successful, setting cookie");
    ApiResponse::ok(RegisterResponse {
        message: "Registration successful".to_string(),
        user_id,
    })
    .with_token(token)
    .into_response()
}
#[instrument]
pub async fn protected_handler(claims: jwt::Claims) -> ApiResponse<String> {
    info!(user_id = %claims.id, "Access granted via cookie");

    ApiResponse::ok(format!(
        "Bienvenue {} ! Tu es authentifié via Cookie.",
        claims.id
    ))
}

pub async fn auto_login_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
) -> ApiResponse<String> {
    info!(user_id = %claims.id, "Access granted via Authorization header");

    // générer un nouveau token
    let token = jwt::create_jwt(claims.id, &claims.role, state.jwt_secret.as_bytes()).unwrap();

    ApiResponse::ok(format!(
        "Bienvenue {} ! Tu es authentifié via Authorization header.",
        claims.id
    ))
    .with_token(token)
}

pub async fn logout_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
) -> ApiResponse<String> {
    let now = Utc::now().timestamp() as usize;
    let ttl_seconds = claims.exp.saturating_sub(now);

    if ttl_seconds > 0 {
        if let Err(e) = auth::blacklist_token(&state.redis_client, &claims.jti, ttl_seconds).await {
            tracing::warn!("Failed to blacklist token in Redis: {e}");
        }
    }

    ApiResponse::ok("Logged out".to_string())
}



pub async fn info_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
) -> Response {
    match auth::get_user_by_id(&state.db_pool, claims.id).await {
        Ok(user_info) => ApiResponse::ok(user_info).into_response(),
        Err(sqlx::Error::RowNotFound) => {
            tracing::warn!(user_id = %claims.id, "User info not found");
            ApiResponse::not_found("User not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to retrieve user info: {:?}", e);
            ApiResponse::internal_error("Failed to retrieve user info").into_response()
        }
    }
}