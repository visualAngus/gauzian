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
use serde::{Deserialize, Serialize};
use rand::RngCore;
use sha2::{Digest, Sha256};
use base64::{engine::general_purpose, Engine as _};

use crate::{jwt, state::AppState};

pub struct AuthError(pub StatusCode, pub String);

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({"error": self.1}))).into_response()
    }
}


pub async  fn initialize_file_in_db(
    db_pool: &PgPool,
    user_id: Uuid,
    size: i64,
    encrypted_metadata: &str,
    mime_type: &str,
    folder_id: Option<Uuid>,
) -> Result<Uuid, sqlx::Error> {
    let file_id = Uuid::new_v4();
    let rec = sqlx::query_scalar::<_, Uuid>(
        "
        INSERT INTO files (id, size, encrypted_metadata, mime_type, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
        "
    )
    .bind(file_id)
    .bind(size)
    .bind(encrypted_metadata.as_bytes())
    .bind(mime_type)
    .fetch_one(db_pool)
    .await?;

    let file_access_id = Uuid::new_v4();
    sqlx::query(
        "
        INSERT INTO file_access (id, file_id, user_id, folder_id, access_level, created_at)
        VALUES ($1, $2, $3, $4, 'owner', NOW())
        "
    )
    .bind(file_access_id)
    .bind(file_id)
    .bind(user_id)
    .bind(folder_id)
    .execute(db_pool)
    .await?;
    Ok(rec)
}