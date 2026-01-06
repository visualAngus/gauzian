use axum::{
    extract::FromRequestParts,
    http::{
        header::AUTHORIZATION,
        request::Parts,
        StatusCode,
    },
    response::{IntoResponse, Response},
    Json,
};

use redis::AsyncCommands;
use uuid::Uuid;
use sqlx::PgPool;
use serde::Deserialize;
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::{jwt, state::AppState};

pub struct AuthError(pub StatusCode, pub String);

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({"error": self.1}))).into_response()
    }
}

fn extract_token_from_headers(parts: &Parts) -> Option<String> {
    if let Some(cookie_val) = parts.headers.get(axum::http::header::COOKIE) {
        if let Ok(s) = cookie_val.to_str() {
            for pair in s.split(';') {
                let pair = pair.trim();
                if let Some(t) = pair.strip_prefix("auth_token=") {
                    return Some(t.to_string());
                }
            }
        }
    }

    if let Some(h) = parts.headers.get(AUTHORIZATION) {
        if let Ok(s) = h.to_str() {
            if let Some(t) = s.strip_prefix("Bearer ") {
                return Some(t.to_string());
            }
        }
    }

    None
}

fn revoked_key(jti: &str) -> String {
    format!("revoked:{jti}")
}

async fn is_token_blacklisted(client: &redis::Client, jti: &str) -> bool {
    // On récupère une connexion async
    if let Ok(mut con) = client.get_multiplexed_async_connection().await {
        // La commande EXISTS renvoie true si la clé existe
        let exists: bool = con.exists(revoked_key(jti)).await.unwrap_or(false);
        return exists;
    }
    false // Si Redis est down, on laisse passer (ou on bloque, selon ta politique de sécu)
}

impl FromRequestParts<AppState> for jwt::Claims {
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = extract_token_from_headers(parts).ok_or(AuthError(
            StatusCode::UNAUTHORIZED,
            "No valid token found".into(),
        ))?;

        let claims = jwt::decode_jwt(&token, state.jwt_secret.as_bytes()).map_err(|e| {
            tracing::warn!("JWT Error: {:?}", e);
            AuthError(StatusCode::UNAUTHORIZED, "Invalid token".into())
        })?;

        if is_token_blacklisted(&state.redis_client, &claims.jti).await {
            return Err(AuthError(
                StatusCode::UNAUTHORIZED,
                "Token has been revoked".into(),
            ));
        }

        Ok(claims)
    }
}

pub async fn blacklist_token(
    client: &redis::Client,
    jti: &str,
    ttl_seconds: usize,
) -> Result<(), redis::RedisError> {
    let mut con = client.get_multiplexed_async_connection().await?;
    con.set_ex(revoked_key(jti), "revoked", ttl_seconds as u64).await
}

#[derive(sqlx::FromRow)]
struct User {
    id: Uuid,
    username: String,
    password_hash: String,
}

async fn get_user(pool: &PgPool, user_id: Uuid) -> Result<User, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

#[derive(Deserialize, Debug)]
pub struct NewUser {
    pub username: String,
    pub password: String,
    pub password_hash: Option<String>,
    pub encrypted_private_key: String,
    pub public_key: String,
    pub email: String,
    pub encrypted_settings: Option<String>,
    pub private_key_salt: String,
    pub iv: String,
    pub auth_salt: Option<String>,
}

pub async fn generate_salt() -> String {
    let mut salt = [0u8; 16];
    rand::rng().fill_bytes(&mut salt);
    base64::encode(salt)
}
pub fn hash_password(password: &str, salt: &str) -> String {

    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    base64::encode(result)
}

pub async fn create_user(
    pool: &PgPool,
    new_user: NewUser,
) -> Result<Uuid, sqlx::Error> {
    let rec = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO users (id, username, password_hash, encrypted_private_key, public_key, email, encrypted_settings, private_key_salt, iv, auth_salt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id"
    )
    .bind(Uuid::new_v4())
    .bind(new_user.username)
    .bind(new_user.password_hash)
    .bind(new_user.encrypted_private_key)
    .bind(new_user.public_key)
    .bind(new_user.email)
    .bind(new_user.encrypted_settings)
    .bind(new_user.private_key_salt)
    .bind(new_user.iv)
    .bind(new_user.auth_salt)
    .fetch_one(pool)
    .await?;

    Ok(rec)
}

pub async fn get_user_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<User, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, salt FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_one(pool)
    .await?;

    Ok(user)
}