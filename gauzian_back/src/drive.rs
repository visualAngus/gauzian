use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use uuid::Uuid;
use sqlx::PgPool;

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
    encrypted_file_key:&str,
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
        INSERT INTO file_access (id, file_id, user_id, folder_id, access_level, created_at, encrypted_file_key)
        VALUES ($1, $2, $3, $4, 'owner', NOW(), $5)
        "
    )
    .bind(file_access_id)
    .bind(file_id)
    .bind(user_id)
    .bind(folder_id)
    .bind(encrypted_file_key.as_bytes())
    .execute(db_pool)
    .await?;
    Ok(rec)
}