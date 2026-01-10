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

    // // ajouter dans le S3 avec upload_line
    // let data = vec![]; // données vides pour l'instant
    // let storage_client = crate::storage::StorageClient::new(
    //     std::env::var("S3_BUCKET").unwrap_or_else(|_| "gauzian".to_string())
    // ).await
    // .map_err(|e| {
    //     sqlx::Error::Protocol(format!("Failed to initialize StorageClient: {}", e).into())
    // })?;
    // storage_client.upload_line(&data, file_id.to_string()).await
    //     .map_err(|e| sqlx::Error::Protocol(format!("Failed to upload to storage: {}", e).into()))?;

    Ok(rec)
}

/// Enregistrer les metadatas d'un chunk S3 dans la table s3_keys
pub async fn save_chunk_metadata(
    db_pool: &PgPool,
    file_id: Uuid,
    index: i32,
    s3_key: &str,
) -> Result<Uuid, sqlx::Error> {
    let id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO s3_keys (id, s3_key, file_id, index, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        "#,
    )
    .bind(id)
    .bind(s3_key)
    .bind(file_id)
    .bind(index)
    .execute(db_pool)
    .await?;

    Ok(id)
}