// Tests unitaires pour auth/services.rs
// Teste: JWT (create_jwt, decode_jwt), password hashing (hash_password, verify_password)

use base64::{engine::general_purpose, Engine};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey};
use uuid::Uuid;

use crate::auth::services;

// ========== Tests JWT ==========

#[test]
fn test_create_jwt_generates_valid_token() {
    let user_id = Uuid::new_v4();
    let role = "admin";
    let secret = b"test-secret-key-for-testing-only";

    let token = services::create_jwt(user_id, role, secret).expect("JWT creation should succeed");

    // Le token doit être une chaîne non vide
    assert!(!token.is_empty());
    assert!(token.matches('.').count() == 2, "JWT should have 2 dots (header.payload.signature)");
}

#[test]
fn test_decode_jwt_valid_token() {
    let user_id = Uuid::new_v4();
    let role = "user";
    let secret = b"test-secret-key-for-testing-only";

    let token = services::create_jwt(user_id, role, secret).expect("JWT creation should succeed");

    let claims = services::decode_jwt(&token, secret).expect("JWT decoding should succeed");

    assert_eq!(claims.id, user_id);
    assert_eq!(claims.role, role);
    assert_eq!(claims.jti.len(), 36); // UUID string length
}

#[test]
fn test_decode_jwt_wrong_secret_fails() {
    let user_id = Uuid::new_v4();
    let role = "user";
    let correct_secret = b"correct-secret";
    let wrong_secret = b"wrong-secret";

    let token = services::create_jwt(user_id, role, correct_secret).expect("JWT creation should succeed");

    let result = services::decode_jwt(&token, wrong_secret);

    assert!(result.is_err(), "Decoding with wrong secret should fail");
}

#[test]
fn test_decode_jwt_expired_token_fails() {
    // Créer manuellement un token expiré pour tester
    let user_id = Uuid::new_v4();
    let secret = b"test-secret";

    let expired_claims = crate::auth::services::Claims {
        id: user_id,
        role: "user".to_string(),
        exp: (Utc::now() - Duration::hours(1)).timestamp() as usize,
        jti: Uuid::new_v4().to_string(),
    };

    let key = EncodingKey::from_secret(secret);
    let header = jsonwebtoken::Header::new(Algorithm::HS256);
    let token = encode(&header, &expired_claims, &key).expect("Failed to create expired token");

    let result = services::decode_jwt(&token, secret);

    assert!(result.is_err(), "Expired token should fail validation");
}

#[test]
fn test_jwt_has_expected_structure() {
    let user_id = Uuid::new_v4();
    let secret = b"test-secret";

    let token = services::create_jwt(user_id, "user", secret).expect("JWT creation should succeed");

    // Vérifier la structure du JWT (3 parties séparées par des points)
    let parts: Vec<&str> = token.split('.').collect();
    assert_eq!(parts.len(), 3, "JWT should have 3 parts");
    assert!(!parts[0].is_empty(), "Header should not be empty");
    assert!(!parts[1].is_empty(), "Payload should not be empty");
    assert!(!parts[2].is_empty(), "Signature should not be empty");
}

// ========== Tests Password Hashing ==========

#[test]
fn test_hash_password_generates_valid_argon2_hash() {
    let password = "MySuperSecurePassword123!";

    let hash = services::hash_password(password).expect("Hashing should succeed");

    // Les hash Argon2 commencent par "$argon2"
    assert!(hash.starts_with("$argon2"), "Hash should start with $argon2");
    assert!(!hash.is_empty());
}

#[test]
fn test_verify_password_correct_argon2() {
    let password = "MySuperSecurePassword123!";
    let hash = services::hash_password(password).expect("Hashing should succeed");

    let valid = services::verify_password(password, &hash, "");

    assert!(valid, "Correct password should verify successfully");
}

#[test]
fn test_verify_password_wrong_password() {
    let password = "MySuperSecurePassword123!";
    let hash = services::hash_password(password).expect("Hashing should succeed");

    let valid = services::verify_password("WrongPassword456!", &hash, "");

    assert!(!valid, "Wrong password should not verify");
}

#[test]
fn test_verify_password_empty_password() {
    let password = "";
    let hash = services::hash_password(password).expect("Hashing should succeed");

    let valid = services::verify_password(password, &hash, "");

    assert!(valid, "Empty password should verify against itself");
}

#[test]
fn test_verify_password_different_salt_legacy_sha256() {
    // Test de compatibilité avec les anciens hash SHA256
    let password = "legacy_password";
    let salt = "dGVzdC1zYWx0LTEyMzQ="; // "test-salt-1234" en base64

    // Créer un hash SHA256 legacy manuellement
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    let legacy_hash = general_purpose::STANDARD.encode(result);

    let valid = services::verify_password(password, &legacy_hash, salt);

    assert!(valid, "Legacy SHA256 password should verify");
}

#[test]
fn test_verify_password_invalid_legacy_hash_format() {
    // Si le hash ne commence pas par $argon2 et n'est pas un SHA256 valide, échoue
    let password = "some_password";
    let invalid_hash = "not-a-valid-hash-at-all";
    let salt = "some-salt";

    let valid = services::verify_password(password, invalid_hash, salt);

    assert!(!valid, "Invalid hash format should not verify");
}
