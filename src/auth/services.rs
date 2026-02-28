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
use rand::RngCore;
use base64::{engine::general_purpose, Engine as _};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Validation};
use chrono::{Duration, Utc};

use crate::state::AppState;


use lettre::message::header::ContentType;
use lettre::{Message, SmtpTransport, Transport};
use lettre::message::Mailbox;

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
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]

pub struct TempClaims {
    pub email: String,
    pub exp: usize,
    pub jti: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct SendOtpRequest {
    pub email: String,
}
#[derive(Debug, serde::Deserialize)]

pub struct VerifyOtpRequest {
    pub email: String,
    pub otp: String,
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

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    validation.leeway = 0;
    validation.algorithms = vec![Algorithm::HS256];

    let token_data = decode::<Claims>(token, &key, &validation)?;
    Ok(token_data.claims)
}

// ========== Token Extraction & Blacklist ==========

/// Extrait le JWT depuis le header Authorization: Bearer <token>
fn extract_token_from_headers(parts: &Parts) -> Option<String> {
    parts
        .headers
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|t| t.to_string())
}

fn revoked_key(jti: &str) -> String {
    format!("revoked:{jti}")
}

/// Vérifie si un token est révoqué.
/// FAIL-CLOSED: si Redis est indisponible, on bloque l'accès par sécurité.
async fn is_token_blacklisted(manager: &mut redis::aio::ConnectionManager, jti: &str) -> Result<bool, AuthError> {
    let exists: bool = manager.exists(revoked_key(jti)).await.map_err(|e| {
        tracing::error!("Redis query failed (fail-closed): {}", e);
        crate::metrics::track_redis_operation("get", false);
        AuthError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Authentication service temporarily unavailable".into(),
        )
    })?;

    crate::metrics::track_redis_operation("get", true);
    Ok(exists)
}

/// Ajoute un token à la blacklist Redis
pub async fn blacklist_token(
    manager: &mut redis::aio::ConnectionManager,
    jti: &str,
    ttl_seconds: usize,
) -> Result<(), redis::RedisError> {
    let result = manager.set_ex(revoked_key(jti), "revoked", ttl_seconds as u64)
        .await;

    crate::metrics::track_redis_operation("set", result.is_ok());
    result
}

// ========== Rate Limiting (Anti-Brute-Force) ==========

const MAX_LOGIN_ATTEMPTS: u32 = 5;
const RATE_LIMIT_WINDOW_SECONDS: u64 = 15 * 60; // 15 minutes

fn rate_limit_key(email: &str) -> String {
    format!("ratelimit:login:{}", email.trim().to_ascii_lowercase())
}

/// Vérifie si un email est rate-limité (trop de tentatives échouées)
pub async fn is_rate_limited(
    manager: &mut redis::aio::ConnectionManager,
    email: &str,
) -> Result<bool, redis::RedisError> {
    let key = rate_limit_key(email);
    let attempts: Option<u32> = manager.get(&key).await?;

    crate::metrics::track_redis_operation("get", true);
    Ok(attempts.unwrap_or(0) >= MAX_LOGIN_ATTEMPTS)
}

/// Incrémente le compteur d'échecs de login (après une tentative échouée)
pub async fn increment_failed_login(
    manager: &mut redis::aio::ConnectionManager,
    email: &str,
) -> Result<(), redis::RedisError> {
    let key = rate_limit_key(email);

    // Incrémente ou initialise à 1
    manager.incr::<&str, u32, u32>(&key, 1).await?;

    // Définir l'expiration uniquement sur la première tentative
    let ttl: i64 = manager.ttl(&key).await?;
    if ttl == -1 {
        // Pas de TTL défini → première tentative
        manager.expire::<&str, i32>(&key, RATE_LIMIT_WINDOW_SECONDS as i64).await?;
    }

    crate::metrics::track_redis_operation("incr", true);
    Ok(())
}

/// Reset le compteur d'échecs (après un login réussi)
pub async fn reset_failed_login(
    manager: &mut redis::aio::ConnectionManager,
    email: &str,
) -> Result<(), redis::RedisError> {
    let key = rate_limit_key(email);
    let _: () = manager.del(&key).await?;

    crate::metrics::track_redis_operation("del", true);
    Ok(())
}

// ========== Rate Limiting inscription ==========

fn register_rate_limit_key(ip: &str) -> String {
    format!("ratelimit:register:{}", ip.trim())
}

/// Vérifie si une IP est rate-limitée pour l'inscription
pub async fn is_register_rate_limited(
    manager: &mut redis::aio::ConnectionManager,
    ip: &str,
) -> Result<bool, redis::RedisError> {
    let key = register_rate_limit_key(ip);
    let attempts: Option<u32> = manager.get(&key).await?;

    crate::metrics::track_redis_operation("get", true);
    Ok(attempts.unwrap_or(0) >= MAX_LOGIN_ATTEMPTS)
}

/// Incrémente le compteur de tentatives d'inscription par IP
pub async fn increment_register_attempt(
    manager: &mut redis::aio::ConnectionManager,
    ip: &str,
) -> Result<(), redis::RedisError> {
    let key = register_rate_limit_key(ip);

    manager.incr::<&str, u32, u32>(&key, 1).await?;

    let ttl: i64 = manager.ttl(&key).await?;
    if ttl == -1 {
        manager.expire::<&str, i32>(&key, RATE_LIMIT_WINDOW_SECONDS as i64).await?;
    }

    crate::metrics::track_redis_operation("incr", true);
    Ok(())
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
        let mut redis_conn = state.redis_manager.clone();
        if is_token_blacklisted(&mut redis_conn, &claims.jti).await? {
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

// /// Hash SHA256 legacy - NE PAS UTILISER POUR LES NOUVEAUX UTILISATEURS
// fn hash_password_sha256_legacy(password: &str, salt: &str) -> String {
//     let mut hasher = Sha256::new();
//     hasher.update(salt.as_bytes());
//     hasher.update(password.as_bytes());
//     let result = hasher.finalize();
//     general_purpose::STANDARD.encode(result)
// }

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
pub fn verify_password(password: &str, password_hash: &str, _salt: &str) -> bool {
    // Argon2 verification (le salt est inclus dans le hash PHC)
    match PasswordHash::new(password_hash) {
        Ok(parsed_hash) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok(),
        Err(_) => false,
    }
}

pub async fn send_otp(email: &str, otp: &str, mailer: &SmtpTransport) -> Result<(), String> {
    tracing::info!("Sending OTP to email {}", email);

    let message = Message::builder()
        .from("Expediteur <gauzian@pupin.fr>"
            .parse::<Mailbox>()
            .map_err(|e| e.to_string())?)
        .to(format!("Destinataire <{}>", email)
            .parse::<Mailbox>()
            .map_err(|e| e.to_string())?)
        .subject("Votre code OTP pour Gauzian")
        .header(ContentType::TEXT_PLAIN)
        .body(format!(
            "Bonjour,\n\nVoici votre code OTP pour finaliser votre inscription sur Gauzian:\n\n{}\n\nCe code est valide pendant 10 minutes.\n\nMerci,\nL'équipe Gauzian",
            otp
        ))
        .map_err(|e| e.to_string())?;

    match mailer.send(&message) {
        Ok(_) => {
            tracing::info!("Email sent successfully to {}", email);
            Ok(())
        }
        Err(e) => {
            tracing::error!("Failed to send email to {}: {}", email, e);
            Err(e.to_string())
        }
    }
}
// store dans le redis l'OTP avec une TTL de 10 minutes 
pub async fn store_otp(manager: &mut redis::aio::ConnectionManager, email: String, otp: String) -> Result<(), redis::RedisError> {
    let key = format!("otp:{}", email.trim().to_ascii_lowercase());
    let hased_otp = hash_password(&otp).map_err(|e| {
        tracing::error!("Failed to hash OTP: {}", e);
        redis::RedisError::from(std::io::Error::new(std::io::ErrorKind::Other, "Failed to hash OTP"))
    })?;
    manager.set_ex(key, hased_otp, 600).await
}

pub async fn cooldown_otp(manager: &mut redis::aio::ConnectionManager, email: String) -> Result<(), redis::RedisError> {
    let key = format!("otp_cooldown:{}", email.trim().to_ascii_lowercase());
    manager.set_ex(key, "cooldown", 30).await
}

pub async fn counter_otp_attempts(manager: &mut redis::aio::ConnectionManager, email: String) -> Result<u32, redis::RedisError> {
    let key = format!("otp_attempts:{}", email.trim().to_ascii_lowercase());
    let attempts: u32 = manager.incr::<&str, u32, u32>(&key, 1).await?;
    if attempts == 1 {
        manager.expire::<&str, i32>(&key, 600).await?;
    }
    Ok(attempts)
}

pub async fn verify_otp(manager: &mut redis::aio::ConnectionManager, email: String, otp: String) -> Result<bool, redis::RedisError> {
    let key = format!("otp:{}", email.trim().to_ascii_lowercase());
    let stored_otp: Option<String> = manager.get(&key).await?;
    if let Some(stored_otp) = stored_otp {
        Ok(verify_password(&otp, &stored_otp, ""))
    } else {
        Ok(false)
    }
}

pub async fn get_otp_attempts(manager: &mut redis::aio::ConnectionManager, email: String) -> Result<u32, redis::RedisError> {
    let key = format!("otp_attempts:{}", email.trim().to_ascii_lowercase());
    let attempts: Option<u32> = manager.get(&key).await?;
    Ok(attempts.unwrap_or(0))
}

pub async fn is_otp_cooldown(manager: &mut redis::aio::ConnectionManager, email: String) -> Result<bool, redis::RedisError> {
    let key = format!("otp_cooldown:{}", email.trim().to_ascii_lowercase());
    let exists: bool = manager.exists(key).await?;
    Ok(exists)
}

pub async fn delete_otp(manager: &mut redis::aio::ConnectionManager, email: &str) -> Result<(), redis::RedisError> {
    let key = format!("otp:{}", email.trim().to_ascii_lowercase());
    manager.del(key).await
}

pub async fn delete_otp_attempts(manager: &mut redis::aio::ConnectionManager, email: &str) -> Result<(), redis::RedisError> {
    let key = format!("otp_attempts:{}", email.trim().to_ascii_lowercase());
    manager.del(key).await
}
pub async fn delete_otp_cooldown(manager: &mut redis::aio::ConnectionManager, email: &str) -> Result<(), redis::RedisError> {
    let key = format!("otp_cooldown:{}", email.trim().to_ascii_lowercase());
    manager.del(key).await
}
    
pub async fn store_temp_token(manager: &mut redis::aio::ConnectionManager, email: String, temp_token: String) -> Result<(), redis::RedisError> {
    let key = format!("temp_token:{}", email.trim().to_ascii_lowercase());
    manager.set_ex(key, temp_token, 600).await // 10 minutes TTL (aligné avec JWT exp)
}

pub async fn delete_temp_token(manager: &mut redis::aio::ConnectionManager, email: &str) -> Result<(), redis::RedisError> {
    let key = format!("temp_token:{}", email.trim().to_ascii_lowercase());
    manager.del(key).await
}

pub async fn get_temp_token(manager: &mut redis::aio::ConnectionManager, email: String) -> Result<Option<String>, redis::RedisError> {
    let key = format!("temp_token:{}", email.trim().to_ascii_lowercase());
    manager.get(key).await
}

pub async fn create_temp_token(
    email: &str,
    secret: &[u8],
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::minutes(10))
        .expect("valid timestamp")
        .timestamp() as usize;  

    
    // let claims = jsonwebtoken::claims::Claims::new(email, expiration);
    let claims = TempClaims {
        email: email.to_string(),
        exp: expiration,
        jti: Uuid::new_v4().to_string(),
    };
    let header = jsonwebtoken::Header::default();
    let key = EncodingKey::from_secret(secret);
    jsonwebtoken::encode(&header, &claims, &key)
}

pub async fn verify_temp_token(token: &str, email: &str, secret: &[u8]) -> Result<TempClaims, jsonwebtoken::errors::Error> {
    let key = DecodingKey::from_secret(secret);

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    validation.leeway = 0;
    validation.algorithms = vec![Algorithm::HS256];

    let token_data = decode::<TempClaims>(token, &key, &validation)?;
    let claims = token_data.claims;
    
    if claims.email != email {
        return Err(jsonwebtoken::errors::ErrorKind::InvalidToken.into());
    }
    
    Ok(claims)
}