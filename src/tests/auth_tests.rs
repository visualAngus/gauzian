// Tests unitaires pour auth/services.rs
// Teste: JWT (create_jwt, decode_jwt), password hashing (hash_password, verify_password)

use base64::{engine::general_purpose, Engine};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use rand::{rngs::StdRng, Rng, SeedableRng};
use std::collections::HashSet;
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

#[test]
fn test_decode_jwt_tampered_signature_fails() {
    let user_id = Uuid::new_v4();
    let secret = b"test-secret";

    let token = services::create_jwt(user_id, "user", secret).expect("JWT creation should succeed");
    let mut tampered = token.clone().into_bytes();
    let last_index = tampered.len() - 1;
    tampered[last_index] = if tampered[last_index] == b'a' { b'b' } else { b'a' };
    let tampered_token = String::from_utf8(tampered).expect("Tampered token should remain valid UTF-8");

    let result = services::decode_jwt(&tampered_token, secret);
    assert!(result.is_err(), "Tampered JWT signature must fail validation");
}

#[test]
fn test_decode_jwt_malformed_token_fails() {
    let secret = b"test-secret";
    let malformed = "this-is-not-a-jwt";

    let result = services::decode_jwt(malformed, secret);
    assert!(result.is_err(), "Malformed token must fail decoding");
}

#[test]
fn test_decode_jwt_wrong_algorithm_fails() {
    let user_id = Uuid::new_v4();
    let secret = b"test-secret";
    let claims = crate::auth::services::Claims {
        id: user_id,
        role: "user".to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
        jti: Uuid::new_v4().to_string(),
    };

    let token = encode(
        &Header::new(Algorithm::HS384),
        &claims,
        &EncodingKey::from_secret(secret),
    )
    .expect("JWT with HS384 should be created");

    let result = services::decode_jwt(&token, secret);
    assert!(result.is_err(), "Only HS256 should be accepted");
}

#[test]
fn test_create_jwt_generates_unique_jti() {
    let user_id = Uuid::new_v4();
    let secret = b"test-secret";

    let token_1 = services::create_jwt(user_id, "user", secret).expect("First JWT should be created");
    let token_2 = services::create_jwt(user_id, "user", secret).expect("Second JWT should be created");

    let claims_1 = services::decode_jwt(&token_1, secret).expect("First token should decode");
    let claims_2 = services::decode_jwt(&token_2, secret).expect("Second token should decode");

    assert_ne!(claims_1.jti, claims_2.jti, "JWT IDs should be unique per token");
}

#[test]
fn test_jwt_roundtrip_stress_200_iterations() {
    let user_id = Uuid::new_v4();
    let secret = b"stress-secret";
    let mut seen_jti = HashSet::new();

    for _ in 0..200 {
        let token = services::create_jwt(user_id, "user", secret).expect("JWT creation should succeed");
        let claims = services::decode_jwt(&token, secret).expect("JWT decode should succeed");

        assert_eq!(claims.id, user_id);
        assert_eq!(claims.role, "user");
        assert!(seen_jti.insert(claims.jti), "JTI collision detected in stress test");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_jwt_generation_concurrent_uniqueness() {
    let user_id = Uuid::new_v4();
    let secret = b"concurrency-secret";

    let mut tasks = Vec::new();
    for _ in 0..120 {
        tasks.push(tokio::spawn(async move {
            services::create_jwt(user_id, "user", secret).expect("JWT creation should succeed")
        }));
    }

    let mut seen_jti = HashSet::new();
    for task in tasks {
        let token = task.await.expect("Task should complete successfully");
        let claims = services::decode_jwt(&token, secret).expect("JWT decode should succeed");
        assert!(seen_jti.insert(claims.jti), "Duplicate JTI in concurrent generation");
    }
}

#[test]
fn test_decode_jwt_fuzz_like_invalid_inputs_do_not_pass() {
    let user_id = Uuid::new_v4();
    let secret = b"fuzz-secret";
    let valid_token = services::create_jwt(user_id, "user", secret).expect("JWT creation should succeed");

    let mut rng = StdRng::seed_from_u64(42);

    for _ in 0..250 {
        let mut bytes = valid_token.as_bytes().to_vec();
        let mutation_count = rng.random_range(1..=5);

        for _ in 0..mutation_count {
            let idx = rng.random_range(0..bytes.len());
            bytes[idx] = rng.random_range(33u8..=126u8);
        }

        if let Ok(candidate) = String::from_utf8(bytes) {
            if candidate != valid_token {
                let result = services::decode_jwt(&candidate, secret);
                assert!(result.is_err(), "Mutated token unexpectedly validated");
            }
        }
    }
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

#[test]
fn test_generate_salt_is_valid_base64_and_16_bytes() {
    let salt = services::generate_salt();
    let decoded = general_purpose::STANDARD
        .decode(salt.as_bytes())
        .expect("Generated salt should be valid base64");

    assert_eq!(decoded.len(), 16, "Generated salt should decode to 16 bytes");
}

#[test]
fn test_generate_salt_uniqueness_over_128_samples() {
    let mut salts = HashSet::new();

    for _ in 0..128 {
        salts.insert(services::generate_salt());
    }

    assert_eq!(salts.len(), 128, "Generated salts should be unique over sample set");
}
