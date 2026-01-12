use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use base64::Engine; // Add this import for .encode()
use serde_json::json;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

fn bytes_to_text_or_b64(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) if !s.trim().is_empty() => s.to_string(),
        _ => base64::engine::general_purpose::STANDARD.encode(bytes),
    }
}

pub struct AuthError(pub StatusCode, pub String);

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({"error": self.1}))).into_response()
    }
}

pub async fn get_drive_info(pool: &PgPool, user_id: Uuid) -> Result<(i64, i64, i64), sqlx::Error> {
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
    parent_id: Option<Uuid>,
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
        file_type: String,
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
        file_type: String,
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
            f.parent_folder_id,
            'folder'::text as file_type
        from folder_access fa
        join folders f on f.id = fa.folder_id
                where fa.user_id = $1
                    and (
                        ($2::uuid is null and f.parent_folder_id is null)
                        or f.parent_folder_id = $2::uuid
                    )
        "#,
    )
    .bind(user_id)
    .bind(parent_id)
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
            fa2.encrypted_file_key,
            'file'::text as file_type
        from file_access fa2
        join files f on f.id = fa2.file_id
                where fa2.user_id = $1
                    and (
                        ($2::uuid is null and fa2.folder_id is null)
                        or fa2.folder_id = $2::uuid
                    )
        "#,
    )
    .bind(user_id)
    .bind(parent_id)
    .fetch_all(pool)
    .await?;

    Ok(serde_json::json!({
        "folders": folders.iter().map(|row| {
            serde_json::json!({
                "folder_id": row.folder_id,
                "encrypted_metadata": bytes_to_text_or_b64(&row.encrypted_metadata),
                "parent_folder_id": row.parent_folder_id,
                "encrypted_folder_key": bytes_to_text_or_b64(&row.encrypted_folder_key),
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "is_root": row.is_root,
                "type": row.file_type,
            })
        }).collect::<Vec<_>>(),
        "files": files.iter().map(|row| {
            serde_json::json!({
                "folder_id": row.folder_id,
                "file_id": row.file_id,
                "encrypted_metadata": bytes_to_text_or_b64(&row.encrypted_metadata),
                "file_size": row.file_size,
                "mime_type": row.mime_type,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "access_level": row.access_level,
                "encrypted_file_key": bytes_to_text_or_b64(&row.encrypted_file_key),
                "type": row.file_type,
            })
        }).collect::<Vec<_>>(),
    }))
}

pub async fn initialize_file_in_db(
    db_pool: &PgPool,
    user_id: Uuid,
    size: i64,
    encrypted_metadata: &str,
    mime_type: &str,
    folder_id: Option<Uuid>,
    encrypted_file_key: &str,
) -> Result<Uuid, sqlx::Error> {
    let file_id = Uuid::new_v4();
    let rec = sqlx::query_scalar::<_, Uuid>(
        "
        INSERT INTO files (id, size, encrypted_metadata, mime_type, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
        ",
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

pub async fn create_folder_in_db(
    db_pool: &PgPool,
    user_id: Uuid,
    encrypted_metadata: &str,
    parent_folder_id: Option<Uuid>,
    encrypted_folder_key: &str,
) -> Result<Uuid, sqlx::Error> {
    let folder_id = Uuid::new_v4();
    let rec = sqlx::query_scalar::<_, Uuid>(
        "
        INSERT INTO folders (id, encrypted_metadata, parent_folder_id, is_root, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
        ",
    )
    .bind(folder_id)
    .bind(encrypted_metadata.as_bytes())
    .bind(parent_folder_id)
    .bind(parent_folder_id.is_none())
    .fetch_one(db_pool)
    .await?;

    let folder_access_id = Uuid::new_v4();
    sqlx::query(
        "
        INSERT INTO folder_access (id, folder_id, user_id, access_level, created_at, encrypted_folder_key)
        VALUES ($1, $2, $3, 'owner', NOW(), $4)
        "
    )
    .bind(folder_access_id)
    .bind(folder_id)
    .bind(user_id)
    .bind(encrypted_folder_key.as_bytes())
    .execute(db_pool)
    .await?;

    Ok(rec)
}

#[derive(FromRow)]
struct FolderPathRow {
    path_index: i32,
    id: Uuid,
    encrypted_metadata: Vec<u8>,           // Type BYTEA en base
    encrypted_folder_key: Option<Vec<u8>>, // Type BYTEA, peut être null
}

pub async fn get_full_path(
    db_pool: &PgPool,
    user_id: Uuid,
    start_folder_id: Option<Uuid>, // Renommé pour la clarté
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    // Si pas d'ID de départ, on renvoie une liste vide tout de suite
    let Some(folder_id) = start_folder_id else {
        return Ok(Vec::new());
    };

    // 2. On exécute la requête UNE SEULE FOIS avec fetch_all
    let rows = sqlx::query_as::<_, FolderPathRow>(
        "
        WITH RECURSIVE breadcrumb AS (
            -- 1. ANCRAGE
            SELECT 
                f.id, 
                f.parent_folder_id, 
                f.encrypted_metadata,
                0 AS path_index
            FROM 
                folders f
            WHERE 
                f.id = $1

            UNION ALL

            -- 2. RÉCURSION
            SELECT 
                parent.id, 
                parent.parent_folder_id, 
                parent.encrypted_metadata,
                child.path_index + 1
            FROM 
                folders parent
            INNER JOIN 
                breadcrumb child ON parent.id = child.parent_folder_id
        )
        -- 3. SÉLECTION FINALE
        SELECT 
            b.path_index,
            b.id,
            b.encrypted_metadata,
            fa.encrypted_folder_key
        FROM 
            breadcrumb b
        LEFT JOIN 
            folder_access fa ON b.id = fa.folder_id AND fa.user_id = $2
        ORDER BY 
            b.path_index DESC; -- DESC pour avoir Racine -> ... -> Enfant direct
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_all(db_pool) // <--- C'est ici que la magie opère : on récupère tout le tableau
    .await?;

    // 3. On transforme les résultats en JSON
    let path: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            // J'utilise ta fonction existante (supposée) pour convertir les bytes
            let metadata_str = bytes_to_text_or_b64(&row.encrypted_metadata);

            // Gestion de la clé optionnelle
            let key_str = match row.encrypted_folder_key {
                Some(k) => Some(bytes_to_text_or_b64(&k)),
                None => None,
            };

            json!({
                "folder_id": row.id,
                "path_index": row.path_index,
                "encrypted_metadata": metadata_str,
                "encrypted_folder_key": key_str
            })
        })
        .collect();

    Ok(path)
}

pub async fn abort_file_upload(
    db_pool: &PgPool,
    storage_client: &crate::storage::StorageClient,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    // Lock all access rows for this file to prevent races (share/unshare/delete).
    let access_users: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM file_access WHERE file_id = $1 FOR UPDATE",
    )
    .bind(file_id)
    .fetch_all(&mut *tx)
    .await?;

    // Must have at least the caller's access.
    if !access_users.iter().any(|u| *u == user_id) {
        return Err(sqlx::Error::RowNotFound);
    }

    let other_users_still_have_access = access_users.iter().any(|u| *u != user_id);
    if other_users_still_have_access {
        // Abort for this user only: remove their access, keep file for others.
        sqlx::query("DELETE FROM file_access WHERE file_id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        return Ok(());
    }

    let s3_keys: Vec<String> = sqlx::query_scalar::<_, String>(
        "SELECT s3_key FROM s3_keys WHERE file_id = $1",
    )
    .bind(file_id)
    .fetch_all(&mut *tx)
    .await?;

    // Supprimer les entrées dans minio
    for s3_key in s3_keys.iter() {
        storage_client.delete_line(s3_key).await.map_err(|e| {
            sqlx::Error::Protocol(format!("Failed to delete from storage: {}", e).into())
        })?;
    }

    // Delete DB rows (order matters because of FK constraints)
    sqlx::query("DELETE FROM s3_keys WHERE file_id = $1")
        .bind(file_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM file_access WHERE file_id = $1")
        .bind(file_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM files WHERE id = $1")
        .bind(file_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}


pub async fn delete_file(
    db_pool: &PgPool,
    storage_client: &crate::storage::StorageClient,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    // Lock all access rows for this file to prevent races (share/unshare/delete).
    let access_users: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM file_access WHERE file_id = $1 FOR UPDATE",
    )
    .bind(file_id)
    .fetch_all(&mut *tx)
    .await?;

    // Must have at least the caller's access.
    if !access_users.iter().any(|u| *u == user_id) {
        return Err(sqlx::Error::RowNotFound);
    }

    let other_users_still_have_access = access_users.iter().any(|u| *u != user_id);
    if other_users_still_have_access {
        // The file is shared: remove only the caller's access.
        sqlx::query("DELETE FROM file_access WHERE file_id = $1 AND user_id = $2")
            .bind(file_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        return Ok(());
    }

    // Only this user has access: delete everything.
    let s3_keys: Vec<String> = sqlx::query_scalar::<_, String>(
        "SELECT s3_key FROM s3_keys WHERE file_id = $1",
    )
    .bind(file_id)
    .fetch_all(&mut *tx)
    .await?;

    // Supprimer les entrées dans minio
    for s3_key in s3_keys.iter() {
        storage_client.delete_line(s3_key).await.map_err(|e| {
            sqlx::Error::Protocol(format!("Failed to delete from storage: {}", e).into())
        })?;
    }

    // Delete DB rows (order matters because of FK constraints)
    sqlx::query("DELETE FROM s3_keys WHERE file_id = $1")
        .bind(file_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM file_access WHERE file_id = $1")
        .bind(file_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM files WHERE id = $1")
        .bind(file_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}