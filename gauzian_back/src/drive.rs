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
    #[derive(Debug, sqlx::FromRow)]
    struct FolderRow {
        folder_id: Uuid,
        encrypted_metadata: Vec<u8>,
        encrypted_folder_key: Vec<u8>,
        created_at: Option<String>,
        updated_at: Option<String>,
        is_root: bool,
        parent_folder_id: Option<Uuid>,
    }

    #[derive(Debug, sqlx::FromRow)]
    struct FileRow {
        folder_id: Option<Uuid>,
        file_id: Uuid,
        encrypted_metadata: Vec<u8>,
        file_size: i64,
        mime_type: String,
        created_at: Option<String>,
        updated_at: Option<String>,
        access_level: String,
        encrypted_file_key: Vec<u8>,
    }

    let folders: Vec<FolderRow> = sqlx::query_as::<_, FolderRow>(
        r#"
        select 
            f.id as folder_id,
            f.encrypted_metadata,
            fa.encrypted_folder_key,
            f.created_at::text as created_at,
            f.updated_at::text as updated_at,
            f.is_root,
            f.parent_folder_id
        from folder_access fa
        join folders f on f.id = fa.folder_id
        where fa.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let files: Vec<FileRow> = sqlx::query_as::<_, FileRow>(
        r#"
        select 
            fa2.folder_id,
            fa2.id as file_id,
            f.encrypted_metadata,
            f.size as file_size,
            f.mime_type,
            f.created_at::text as created_at,
            f.updated_at::text as updated_at,
            fa2.access_level,
            fa2.encrypted_file_key
        from file_access fa2
        join files f on f.id = fa2.file_id
        where fa2.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(serde_json::json!({
        "folders": folders.iter().map(|row| {
            serde_json::json!({
                "folder_id": row.folder_id,
                "encrypted_metadata": base64::engine::general_purpose::STANDARD.encode(&row.encrypted_metadata),
                "parent_folder_id": row.parent_folder_id,
                "encrypted_folder_key": base64::engine::general_purpose::STANDARD.encode(&row.encrypted_folder_key),
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "is_root": row.is_root,
            })
        }).collect::<Vec<_>>(),
        "files": files.iter().map(|row| {
            serde_json::json!({
                "folder_id": row.folder_id,
                "file_id": row.file_id,
                "encrypted_metadata": base64::engine::general_purpose::STANDARD.encode(&row.encrypted_metadata),
                "file_size": row.file_size,
                "mime_type": row.mime_type,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "access_level": row.access_level,
                "encrypted_file_key": base64::engine::general_purpose::STANDARD.encode(&row.encrypted_file_key),
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


