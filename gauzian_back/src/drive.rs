use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use base64::Engine; // Add this import for .encode()
use uuid::Uuid;
use sqlx::PgPool;

pub struct AuthError(pub StatusCode, pub String);

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({"error": self.1}))).into_response()
    }
}

pub async fn get_drive_info(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(i64, i64, i64), sqlx::Error> {
    let (used_space, file_count, folder_count) = sqlx::query_as::<_, (i64, i64, i64)>(
        "
        select 
            COALESCE(SUM(f.size),0)::BIGINT as used_space,
            COUNT(f.id)::BIGINT as file_count,
            COUNT(fa.id)::BIGINT as folder_count
        from users u 
        left join folder_access fa on fa.user_id = u.id
        left join file_access fa2 on fa2.user_id = u.id 
        left join files f on f.id = fa2.file_id
        where u.id = $1
        ",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok((used_space, file_count, folder_count))
}

pub async fn get_files_and_folders_list(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    let folders = sqlx::query_as::<_, (Uuid, Vec<u8>, Option<Uuid>)>(
        "
        SELECT fa.folder_id, f.encrypted_metadata, fa.parent_folder_id
        FROM folder_access fa
        JOIN folders f ON f.id = fa.folder_id
        WHERE fa.user_id = $1
        ",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let files = sqlx::query_as::<_, (Option<Uuid>, Uuid, Vec<u8>, i64, Option<String>, Option<chrono::NaiveDateTime>, Option<chrono::NaiveDateTime>, Option<String>, Option<Vec<u8>>)>(
        "
        select fa2.folder_id , fa2.id as file_id, f.encrypted_metadata ,f.size as file_size, f.mime_type ,f.created_at, f.updated_at, fa2.access_level ,fa2.encrypted_file_key  
        from users u 
        left join file_access fa2 on fa2.user_id = u.id 
        left join files f on f.id = fa2.file_id
        where u.id = $1
        ",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(serde_json::json!({
        "folders": folders.iter().map(|(folder_id, encrypted_metadata, parent_folder_id)| {
            serde_json::json!({
                "folder_id": folder_id,
                "encrypted_metadata": base64::engine::general_purpose::STANDARD.encode(encrypted_metadata),
                "parent_folder_id": parent_folder_id,
            })
        }).collect::<Vec<_>>(),
        "files": files.iter().map(|(folder_id, file_id, encrypted_metadata, file_size, mime_type, created_at, updated_at, access_level, encrypted_file_key)| {
            serde_json::json!({
                "folder_id": folder_id,
                "file_id": file_id,
                "encrypted_metadata": base64::engine::general_purpose::STANDARD.encode(encrypted_metadata),
                "file_size": file_size,
                "mime_type": mime_type,
                "created_at": created_at,
                "updated_at": updated_at,
                "access_level": access_level,
                "encrypted_file_key": encrypted_file_key.as_ref().map(|key| base64::engine::general_purpose::STANDARD.encode(key)),
            })
        }).collect::<Vec<_>>(),
    }))
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


