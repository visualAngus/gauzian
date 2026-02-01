// Services - Logique métier pure (password hashing, JWT, token blacklist)
// Ce fichier ne fait PAS d'accès DB direct (c'est le rôle de repo.rs)

use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use redis::AsyncCommands;
use uuid::Uuid;
// use serde::Serialize;
use rand::RngCore;
use sha2::{Digest, Sha256};
use base64::{engine::general_purpose, Engine as _};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Validation};
use chrono::{Duration, Utc};

use crate::state::AppState;

// ========== Erreurs ==========

pub struct AuthError(pub StatusCode, pub String);

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({"error": self.1}))).into_response()
    }
}

// ========== JWT Claims ==========

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Claims {
    pub id: Uuid,
    pub role: String,
    pub exp: usize,
    pub jti: String, // JWT ID pour la révocation
}

/// Crée un JWT avec une durée de validité de 10 jours
pub fn create_jwt(
    user_id: Uuid,
    role: &str,
    secret: &[u8],
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::days(10))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        id: user_id,
        role: role.to_string(),
        exp: expiration,
        jti: Uuid::new_v4().to_string(),
    };

    let key = EncodingKey::from_secret(secret);
    encode(&jsonwebtoken::Header::default(), &claims, &key)
}

/// Décode et valide un JWT
pub fn decode_jwt(token: &str, secret: &[u8]) -> Result<Claims, jsonwebtoken::errors::Error> {
    let key = DecodingKey::from_secret(secret);
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(token, &key, &validation)?;
    Ok(token_data.claims)
}

// ========== Token Extraction & Blacklist ==========

fn extract_token_from_headers(parts: &Parts) -> Option<String> {
    // 1. Cherche dans les cookies
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

    // 2. Cherche dans Authorization: Bearer
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

/// Vérifie si un token est révoqué.
/// FAIL-CLOSED: si Redis est indisponible, on bloque l'accès par sécurité.
async fn is_token_blacklisted(client: &redis::Client, jti: &str) -> Result<bool, AuthError> {
    let mut con = client
        .get_multiplexed_async_connection()
        .await
        .map_err(|e| {
            tracing::error!("Redis connection failed (fail-closed): {}", e);
            AuthError(
                StatusCode::SERVICE_UNAVAILABLE,
                "Authentication service temporarily unavailable".into(),
            )
        })?;

    let exists: bool = con.exists(revoked_key(jti)).await.map_err(|e| {
        tracing::error!("Redis query failed (fail-closed): {}", e);
        AuthError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Authentication service temporarily unavailable".into(),
        )
    })?;

    Ok(exists)
}

/// Ajoute un token à la blacklist Redis
pub async fn blacklist_token(
    client: &redis::Client,
    jti: &str,
    ttl_seconds: usize,
) -> Result<(), redis::RedisError> {
    let mut con = client.get_multiplexed_async_connection().await?;
    con.set_ex(revoked_key(jti), "revoked", ttl_seconds as u64)
        .await
}

// ========== Extracteur Axum pour Claims ==========

impl FromRequestParts<AppState> for Claims {
    type Rejection = AuthError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = extract_token_from_headers(parts).ok_or(AuthError(
            StatusCode::UNAUTHORIZED,
            "No valid token found".into(),
        ))?;

        let claims = decode_jwt(&token, state.jwt_secret.as_bytes()).map_err(|e| {
            tracing::warn!("JWT Error: {:?}", e);
            AuthError(StatusCode::UNAUTHORIZED, "Invalid token".into())
        })?;

        // FAIL-CLOSED: si Redis est down, on refuse l'accès
        if is_token_blacklisted(&state.redis_client, &claims.jti).await? {
            return Err(AuthError(
                StatusCode::UNAUTHORIZED,
                "Token has been revoked".into(),
            ));
        }

        Ok(claims)
    }
}

// ========== Password Hashing ==========

/// Génère un salt aléatoire (legacy, pour rétrocompatibilité)
pub fn generate_salt() -> String {
    let mut salt = [0u8; 16];
    rand::rng().fill_bytes(&mut salt);
    general_purpose::STANDARD.encode(salt)
}

/// Hash SHA256 legacy - NE PAS UTILISER POUR LES NOUVEAUX UTILISATEURS
fn hash_password_sha256_legacy(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    general_purpose::STANDARD.encode(result)
}

/// Hash avec Argon2id (recommandé OWASP 2024)
/// Retourne un hash au format PHC (commence par $argon2id$)
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    Ok(argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

/// Vérifie le mot de passe.
/// Supporte Argon2 (nouveau) et SHA256 (legacy) pour la rétrocompatibilité.
pub fn verify_password(password: &str, password_hash: &str, salt: &str) -> bool {
    // Les hash Argon2 commencent par "$argon2"
    if password_hash.starts_with("$argon2") {
        // Argon2 verification (le salt est inclus dans le hash PHC)
        match PasswordHash::new(password_hash) {
            Ok(parsed_hash) => Argon2::default()
                .verify_password(password.as_bytes(), &parsed_hash)
                .is_ok(),
            Err(_) => false,
        }
    } else {
        // Legacy SHA256 verification
        let hashed_input = hash_password_sha256_legacy(password, salt);
        hashed_input == password_hash
    }
}
