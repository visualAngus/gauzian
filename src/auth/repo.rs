// Repository - Accès aux données utilisateurs (queries SQL)
// Toutes les interactions avec la table `users`

use sqlx::PgPool;
use uuid::Uuid;
use serde::Serialize;

// ========== Types de données ==========

#[derive(sqlx::FromRow, Debug)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub auth_salt: Option<String>,
    pub encrypted_private_key: String,
    pub private_key_salt: String,
    pub iv: String,
    pub public_key: String,
}

#[derive(Debug)]
pub struct NewUser {
    pub username: String,
    pub password_hash: String,
    pub encrypted_private_key: String,
    pub public_key: String,
    pub email: String,
    pub encrypted_settings: Option<String>,
    pub private_key_salt: String,
    pub iv: String,
    pub auth_salt: Option<String>,
    pub encrypted_record_key: String,
}

#[derive(Serialize, Debug, sqlx::FromRow)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub encrypted_private_key: String,
    pub private_key_salt: String,
    pub iv: String,
    pub public_key: String,
}

// ========== Queries ==========

/// Crée un nouvel utilisateur
pub async fn create_user(pool: &PgPool, new_user: NewUser) -> Result<Uuid, sqlx::Error> {
    let user_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO users (
            id, username, password_hash, encrypted_private_key, public_key,
            email, encrypted_settings, private_key_salt, iv, auth_salt, encrypted_record_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        "#,
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
    .bind(new_user.encrypted_record_key)
    .fetch_one(pool)
    .await?;

    Ok(user_id)
}

/// Récupère un utilisateur par son email
pub async fn get_user_by_email(pool: &PgPool, email: &str) -> Result<User, sqlx::Error> {
    sqlx::query_as::<_, User>(
        r#"
        SELECT id, username, password_hash, auth_salt, encrypted_private_key,
               private_key_salt, iv, public_key
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(email)
    .fetch_one(pool)
    .await
}

/// Récupère les infos complètes d'un utilisateur par son ID
pub async fn get_user_by_id(pool: &PgPool, user_id: Uuid) -> Result<UserInfo, sqlx::Error> {
    sqlx::query_as::<_, UserInfo>(
        r#"
        SELECT id, username, email, encrypted_private_key,
               private_key_salt, iv, public_key
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
}

/// Récupère la clé publique d'un utilisateur par son email (pour le partage)
pub async fn get_public_key_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<(Uuid, String), sqlx::Error> {
    sqlx::query_as::<_, (Uuid, String)>(
        r#"
        SELECT id, public_key
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(email)
    .fetch_one(pool)
    .await
}
