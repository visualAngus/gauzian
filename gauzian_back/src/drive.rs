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
                    and fa.is_deleted is false
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
            fa2.file_id as file_id,
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
                    and fa2.is_deleted is false
                    and f.is_fully_uploaded = true
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

pub async fn get_folder_contents(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Option<Uuid>,
) -> Result<serde_json::Value, sqlx::Error> {
    let contents = get_files_and_folders_list(pool, user_id, folder_id).await?;
    // only return the "folders" field

    let folders = contents
        .get("folders")
        .cloned()
        .unwrap_or_else(|| serde_json::json!([]));

    Ok(folders)
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
    let mut tx = db_pool.begin().await?;

    if let Some(folder_id) = folder_id {
        // Ensure the folder exists AND the user has access to it.
        let has_access = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2)",
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        if !has_access {
            return Err(sqlx::Error::RowNotFound);
        }
    }

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
    .fetch_one(&mut *tx)
    .await?;

    let file_access_id = Uuid::new_v4();
    sqlx::query(
        "
        INSERT INTO file_access (id, file_id, user_id, folder_id, access_level, created_at, encrypted_file_key)
        VALUES ($1, $2, $3, $4, 'owner', NOW(), $5)
        ",
    )
    .bind(file_access_id)
    .bind(file_id)
    .bind(user_id)
    .bind(folder_id)
    .bind(encrypted_file_key.as_bytes())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

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

    let s3_keys: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT s3_key FROM s3_keys WHERE file_id = $1")
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
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    // Lock all access rows for this file to prevent races
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
    // Soft delete: mark the file_access as deleted for this user
    sqlx::query(
        "
        UPDATE file_access
        SET is_deleted = TRUE, updated_at = NOW()
        WHERE file_id = $1 AND user_id = $2
        ",
    )
    .bind(file_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Si aucun utilisateur n'a plus accès au fichier, on peut le marquer comme supprimé
    let remaining_access_count: i64 = sqlx::query_scalar::<_, i64>(
        "
        SELECT COUNT(*) FROM file_access
        WHERE file_id = $1 AND is_deleted = FALSE
        ",
    )
    .bind(file_id)
    .fetch_one(db_pool)
    .await?;

    if remaining_access_count == 0 {
        // Mark the file as deleted
        sqlx::query(
            "
            UPDATE files
            SET is_deleted = TRUE, updated_at = NOW()
            WHERE id = $1
            ",
        )
        .bind(file_id)
        .execute(db_pool)
        .await?;
    }
    
    Ok(())
}



// pub async fn delete_file(
//     db_pool: &PgPool,
//     storage_client: &crate::storage::StorageClient,
//     user_id: Uuid,
//     file_id: Uuid,
// ) -> Result<(), sqlx::Error> {
//     let mut tx = db_pool.begin().await?;

//     // Lock all access rows for this file to prevent races (share/unshare/delete).
//     let access_users: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
//         "SELECT user_id FROM file_access WHERE file_id = $1 FOR UPDATE",
//     )
//     .bind(file_id)
//     .fetch_all(&mut *tx)
//     .await?;

//     // Must have at least the caller's access.
//     if !access_users.iter().any(|u| *u == user_id) {
//         return Err(sqlx::Error::RowNotFound);
//     }

//     let other_users_still_have_access = access_users.iter().any(|u| *u != user_id);
//     if other_users_still_have_access {
//         // The file is shared: remove only the caller's access.
//         sqlx::query("DELETE FROM file_access WHERE file_id = $1 AND user_id = $2")
//             .bind(file_id)
//             .bind(user_id)
//             .execute(&mut *tx)
//             .await?;

//         tx.commit().await?;
//         return Ok(());
//     }

//     // Only this user has access: delete everything.
//     let s3_keys: Vec<String> =
//         sqlx::query_scalar::<_, String>("SELECT s3_key FROM s3_keys WHERE file_id = $1")
//             .bind(file_id)
//             .fetch_all(&mut *tx)
//             .await?;

//     // Supprimer les entrées dans minio
//     for s3_key in s3_keys.iter() {
//         storage_client.delete_line(s3_key).await.map_err(|e| {
//             sqlx::Error::Protocol(format!("Failed to delete from storage: {}", e).into())
//         })?;
//     }

//     // Delete DB rows (order matters because of FK constraints)
//     sqlx::query("DELETE FROM s3_keys WHERE file_id = $1")
//         .bind(file_id)
//         .execute(&mut *tx)
//         .await?;

//     sqlx::query("DELETE FROM file_access WHERE file_id = $1")
//         .bind(file_id)
//         .execute(&mut *tx)
//         .await?;

//     sqlx::query("DELETE FROM files WHERE id = $1")
//         .bind(file_id)
//         .execute(&mut *tx)
//         .await?;

//     tx.commit().await?;
//     Ok(())
// }

pub async fn delete_folder(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    // Lock all access rows for the root folder to prevent concurrent share/delete.
    let root_access_users: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM folder_access WHERE folder_id = $1 FOR UPDATE",
    )
    .bind(folder_id)
    .fetch_all(&mut *tx)
    .await?;

    // Must have at least the caller's access.
    if !root_access_users.iter().any(|u| *u == user_id) {
        return Err(sqlx::Error::RowNotFound);
    }

    // Soft delete: mark the folder_access as deleted for this user
    sqlx::query(
        "
        UPDATE folder_access
        SET is_deleted = TRUE, updated_at = NOW()
        WHERE folder_id = $1 AND user_id = $2
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // mettre tout les sous-dossiers et fichiers en is_deleted = true aussi
    sqlx::query(
        "
        WITH RECURSIVE folder_tree AS (
            SELECT id
            FROM folders
            WHERE id = $1
            UNION ALL
            SELECT f.id
            FROM folders f
            JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        UPDATE folder_access fa
        SET is_deleted = TRUE, updated_at = NOW()
        FROM folder_tree ft
        WHERE fa.folder_id = ft.id AND fa.user_id = $2
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Soft delete files in the subtree for this user
    sqlx::query(
        "
        WITH RECURSIVE folder_tree AS (
            SELECT id
            FROM folders
            WHERE id = $1
            UNION ALL
            SELECT f.id
            FROM folders f
            JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        UPDATE file_access fa
        SET is_deleted = TRUE, updated_at = NOW()
        FROM folder_tree ft
        WHERE fa.folder_id = ft.id AND fa.user_id = $2
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // check if any other user still has access to any folder or file in the subtree
    let others_exist = sqlx::query_scalar::<_, bool>(
        "
        WITH RECURSIVE folder_tree AS (
            SELECT id
            FROM folders
            WHERE id = $1
            UNION ALL
            SELECT f.id
            FROM folders f
            JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        SELECT EXISTS(
            SELECT 1 FROM folder_access fa
            JOIN folder_tree ft ON fa.folder_id = ft.id
            WHERE fa.user_id <> $2
            UNION
            SELECT 1 FROM file_access fa2
            JOIN folder_tree ft ON fa2.folder_id = ft.id
            WHERE fa2.user_id <> $2
        )
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !others_exist {
        // No other users anywhere in the subtree: mark everything as deleted.
        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id
                FROM folders
                WHERE id = $1
                UNION ALL
                SELECT f.id
                FROM folders f
                JOIN folder_tree ft ON f.parent_folder_id = ft.id
            )
            UPDATE files f
            SET is_deleted = TRUE, updated_at = NOW()
            WHERE f.id IN (
                SELECT fa.file_id
                FROM file_access fa
                JOIN folder_tree ft ON fa.folder_id = ft.id
            )
            ",
        )
        .bind(folder_id)
        .execute(&mut *tx)
        .await?;
    }


    tx.commit().await?;
    Ok(())
}


// pub async fn delete_folder(
//     db_pool: &PgPool,
//     storage_client: &crate::storage::StorageClient,
//     user_id: Uuid,
//     folder_id: Uuid,
// ) -> Result<(), sqlx::Error> {
//     let mut tx = db_pool.begin().await?;

//     // Build the subtree of folders starting from the target.
//     let folder_rows: Vec<(Uuid, i32)> = sqlx::query_as(
//         "
//         WITH RECURSIVE folder_tree AS (
//             SELECT id, parent_folder_id, 0 AS depth
//             FROM folders
//             WHERE id = $1

//             UNION ALL

//             SELECT f.id, f.parent_folder_id, ft.depth + 1
//             FROM folders f
//             JOIN folder_tree ft ON f.parent_folder_id = ft.id
//         )
//         SELECT id, depth FROM folder_tree
//         ",
//     )
//     .bind(folder_id)
//     .fetch_all(&mut *tx)
//     .await?;

//     if folder_rows.is_empty() {
//         return Err(sqlx::Error::RowNotFound);
//     }

//     let folder_ids: Vec<Uuid> = folder_rows.iter().map(|(id, _)| *id).collect();

//     // Lock all access rows for the root folder to prevent concurrent share/delete.
//     let root_access_users: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
//         "SELECT user_id FROM folder_access WHERE folder_id = $1 FOR UPDATE",
//     )
//     .bind(folder_id)
//     .fetch_all(&mut *tx)
//     .await?;

//     // Must have at least the caller's access.
//     if !root_access_users.iter().any(|u| *u == user_id) {
//         return Err(sqlx::Error::RowNotFound);
//     }

//     // Lock file access rows under this subtree to avoid races with concurrent share/delete.
//     sqlx::query("SELECT 1 FROM file_access WHERE folder_id = ANY($1) FOR UPDATE")
//         .bind(&folder_ids)
//         .execute(&mut *tx)
//         .await?;

//     // Determine if any other user still has access to any folder or file in the subtree.
//     let others_exist = sqlx::query_scalar::<_, bool>(
//         "
//         SELECT EXISTS(
//             SELECT 1 FROM folder_access WHERE folder_id = ANY($1) AND user_id <> $2
//             UNION
//             SELECT 1 FROM file_access WHERE folder_id = ANY($1) AND user_id <> $2
//         )
//         ",
//     )
//     .bind(&folder_ids)
//     .bind(user_id)
//     .fetch_one(&mut *tx)
//     .await?;

//     // Files in the subtree that the current user can see.
//     let file_ids_for_user: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
//         "SELECT DISTINCT file_id FROM file_access WHERE folder_id = ANY($1) AND user_id = $2",
//     )
//     .bind(&folder_ids)
//     .bind(user_id)
//     .fetch_all(&mut *tx)
//     .await?;

//     // Files where this user is the only accessor.
//     let files_owned_only_by_user: Vec<Uuid> = if file_ids_for_user.is_empty() {
//         Vec::new()
//     } else {
//         sqlx::query_scalar::<_, Uuid>(
//             "
//             SELECT file_id
//             FROM file_access
//             WHERE file_id = ANY($1)
//             GROUP BY file_id
//             HAVING COUNT(*) FILTER (WHERE user_id <> $2) = 0
//             ",
//         )
//         .bind(&file_ids_for_user)
//         .bind(user_id)
//         .fetch_all(&mut *tx)
//         .await?
//     };

//     // Files shared with someone else (the user only loses their access).
//     let files_shared: Vec<Uuid> = file_ids_for_user
//         .iter()
//         .filter(|id| !files_owned_only_by_user.contains(id))
//         .copied()
//         .collect();

//     // Delete files that only this user could access.
//     if !files_owned_only_by_user.is_empty() {
//         let s3_keys: Vec<String> =
//             sqlx::query_scalar::<_, String>("SELECT s3_key FROM s3_keys WHERE file_id = ANY($1)")
//                 .bind(&files_owned_only_by_user)
//                 .fetch_all(&mut *tx)
//                 .await?;

//         for s3_key in s3_keys.iter() {
//             storage_client.delete_line(s3_key).await.map_err(|e| {
//                 sqlx::Error::Protocol(format!("Failed to delete from storage: {}", e).into())
//             })?;
//         }

//         sqlx::query("DELETE FROM s3_keys WHERE file_id = ANY($1)")
//             .bind(&files_owned_only_by_user)
//             .execute(&mut *tx)
//             .await?;

//         sqlx::query("DELETE FROM file_access WHERE file_id = ANY($1)")
//             .bind(&files_owned_only_by_user)
//             .execute(&mut *tx)
//             .await?;

//         sqlx::query("DELETE FROM files WHERE id = ANY($1)")
//             .bind(&files_owned_only_by_user)
//             .execute(&mut *tx)
//             .await?;
//     }

//     if others_exist {
//         if !files_shared.is_empty() {
//             sqlx::query("DELETE FROM file_access WHERE user_id = $1 AND file_id = ANY($2)")
//                 .bind(user_id)
//                 .bind(&files_shared)
//                 .execute(&mut *tx)
//                 .await?;
//         }

//         sqlx::query("DELETE FROM folder_access WHERE user_id = $1 AND folder_id = ANY($2)")
//             .bind(user_id)
//             .bind(&folder_ids)
//             .execute(&mut *tx)
//             .await?;

//         tx.commit().await?;
//         return Ok(());
//     }

//     // No other users anywhere in the subtree: remove everything.
//     if !files_shared.is_empty() {
//         sqlx::query("DELETE FROM file_access WHERE user_id = $1 AND file_id = ANY($2)")
//             .bind(user_id)
//             .bind(&files_shared)
//             .execute(&mut *tx)
//             .await?;
//     }

//     sqlx::query("DELETE FROM folder_access WHERE folder_id = ANY($1)")
//         .bind(&folder_ids)
//         .execute(&mut *tx)
//         .await?;

//     // Delete folders bottom-up to satisfy FK constraints.
//     let mut folders_desc = folder_rows.clone();
//     folders_desc.sort_by(|a, b| b.1.cmp(&a.1));
//     for (folder_id, _) in folders_desc {
//         sqlx::query("DELETE FROM folders WHERE id = $1")
//             .bind(folder_id)
//             .execute(&mut *tx)
//             .await?;
//     }

//     tx.commit().await?;
//     Ok(())
// }

pub async fn rename_file(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
    new_encrypted_metadata: &str,
) -> Result<(), sqlx::Error> {
    // Verify user has access to the file
    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND (access_level = 'owner' OR access_level = 'editor'))",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    // Update the encrypted metadata
    sqlx::query("UPDATE files SET encrypted_metadata = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_encrypted_metadata.as_bytes())
        .bind(file_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

pub async fn rename_folder(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    new_encrypted_metadata: &str,
) -> Result<(), sqlx::Error> {
    // Verify user has access to the folder
    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND (access_level = 'owner' OR access_level = 'editor'))",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    // Update the encrypted metadata
    sqlx::query("UPDATE folders SET encrypted_metadata = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_encrypted_metadata.as_bytes())
        .bind(folder_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

pub async fn move_file(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
    new_folder_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    // Verify user has access to the file
    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND (access_level = 'owner' OR access_level = 'editor'))",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    // If new_folder_id is Some, verify user has access to the target folder
    if let Some(folder_id) = new_folder_id {
        let has_folder_access = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2)",
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_one(db_pool)
        .await?;

        if !has_folder_access {
            return Err(sqlx::Error::RowNotFound);
        }
    }

    // Update the folder_id in file_access
    sqlx::query("UPDATE file_access SET folder_id = $1 WHERE file_id = $2 AND user_id = $3")
        .bind(new_folder_id)
        .bind(file_id)
        .bind(user_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

pub async fn move_folder(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    new_parent_folder_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    // Verify user has access to the folder
    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND (access_level = 'owner' OR access_level = 'editor'))",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    // If new_parent_folder_id is Some, verify user has access to the target parent folder
    if let Some(parent_folder_id) = new_parent_folder_id {
        let has_parent_access = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2)",
        )
        .bind(parent_folder_id)
        .bind(user_id)
        .fetch_one(db_pool)
        .await?;

        if !has_parent_access {
            return Err(sqlx::Error::RowNotFound);
        }

        // Détection de cycle : vérifier que new_parent n'est pas un descendant de folder_id
        // (on ne peut pas déplacer un dossier dans un de ses sous-dossiers)
        let would_create_cycle = sqlx::query_scalar::<_, bool>(
            r#"
            WITH RECURSIVE descendants AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
                JOIN descendants d ON f.parent_folder_id = d.id
            )
            SELECT EXISTS(SELECT 1 FROM descendants WHERE id = $2)
            "#,
        )
        .bind(folder_id)
        .bind(parent_folder_id)
        .fetch_one(db_pool)
        .await?;

        if would_create_cycle {
            return Err(sqlx::Error::Protocol(
                "Cannot move folder into its own descendant".into(),
            ));
        }
    }

    // Update the parent_folder_id in folders
    sqlx::query("UPDATE folders SET parent_folder_id = $1, is_root = $2 WHERE id = $3")
        .bind(new_parent_folder_id)
        .bind(new_parent_folder_id.is_none())
        .bind(folder_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

// Récupérer les infos d'un fichier avec ses chunks
pub async fn get_file_info(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    #[derive(FromRow)]
    struct FileInfo {
        file_id: Uuid,
        encrypted_metadata: Vec<u8>,
        size: i64,
        mime_type: String,
        encrypted_file_key: Vec<u8>,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    #[derive(FromRow)]
    struct ChunkInfo {
        s3_key: String,
        index: i32,
        chunk_id: Uuid,
    }

    // Vérifier que l'utilisateur a accès au fichier
    let file_info = sqlx::query_as::<_, FileInfo>(
        r#"
        SELECT 
            f.id as file_id,
            f.encrypted_metadata,
            f.size,
            f.mime_type,
            fa.encrypted_file_key,
            f.created_at::text,
            f.updated_at::text
        FROM files f
        JOIN file_access fa ON fa.file_id = f.id
        WHERE f.id = $1 AND fa.user_id = $2
        "#,
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    // Récupérer tous les chunks ordonnés par index
    let chunks = sqlx::query_as::<_, ChunkInfo>(
        r#"
        SELECT id as chunk_id, s3_key, index
        FROM s3_keys
        WHERE file_id = $1
        ORDER BY index ASC
        "#,
    )
    .bind(file_id)
    .fetch_all(db_pool)
    .await?;

    Ok(json!({
        "file_id": file_info.file_id,
        "encrypted_metadata": bytes_to_text_or_b64(&file_info.encrypted_metadata),
        "encrypted_file_key": bytes_to_text_or_b64(&file_info.encrypted_file_key),
        "size": file_info.size,
        "mime_type": file_info.mime_type,
        "created_at": file_info.created_at,
        "updated_at": file_info.updated_at,
        "chunk_count": chunks.len(),
        "chunks": chunks.iter().map(|c| json!({
            "s3_key": c.s3_key,
            "index": c.index,
            "chunk_id": c.chunk_id,
        })).collect::<Vec<_>>(),
    }))
}

// Récupérer tous les fichiers et dossiers d'un dossier de façon récursive avec CTE
pub async fn get_folder_contents_recursive(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Option<Uuid>,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    #[derive(FromRow)]
    struct FileItem {
        file_id: Uuid,
        encrypted_metadata: Vec<u8>,
        size: i64,
        mime_type: String,
        encrypted_file_key: Vec<u8>,
        s3_key: Option<String>,
        chunk_index: Option<i32>,
        chunk_id: Option<Uuid>,
        folder_path: String,
    }

    // Utiliser une CTE récursive pour récupérer toute la hiérarchie
    let items: Vec<FileItem> = sqlx::query_as::<_, FileItem>(
        r#"
WITH RECURSIVE folder_hierarchy AS (
    -- Cas de base: le dossier de départ
    SELECT 
        f.id as folder_id,
        f.encrypted_metadata,
        f.parent_folder_id,
        '' as path,
        0 as depth
    FROM folders f
    JOIN folder_access fa ON fa.folder_id = f.id
    WHERE fa.user_id = $1
        AND (
            ($2::uuid IS NULL AND f.parent_folder_id IS NULL)
            OR f.id = $2::uuid
        )
    
    UNION ALL
    
    -- Cas récursif: descendre dans les sous-dossiers
    SELECT 
        f.id as folder_id,
        f.encrypted_metadata,
        f.parent_folder_id,
        CASE 
            WHEN fh.path = '' THEN encode(fh.encrypted_metadata, 'base64')
            ELSE fh.path || '/' || encode(fh.encrypted_metadata, 'base64')
        END as path,
        fh.depth + 1 as depth
    FROM folder_hierarchy fh
    JOIN folders f ON f.parent_folder_id = fh.folder_id
    JOIN folder_access fa ON fa.folder_id = f.id AND fa.user_id = $1
)
-- Récupérer les fichiers de chaque dossier avec leurs chunks
SELECT 
    files.id as file_id,
    files.encrypted_metadata,
    files.size,
    files.mime_type,
    fa.encrypted_file_key,
    sk.s3_key,
    sk.index as chunk_index,
    sk.id as chunk_id,
    CASE 
        WHEN fh.path = '' THEN ''
        ELSE fh.path || '/'
    END as folder_path
FROM folder_hierarchy fh
JOIN file_access fa ON fa.folder_id = fh.folder_id AND fa.user_id = $1
JOIN files ON files.id = fa.file_id
LEFT JOIN s3_keys sk ON sk.file_id = files.id
ORDER BY files.id, sk.index ASC
        "#,
    )
    .bind(user_id)
    .bind(folder_id)
    .fetch_all(pool)
    .await?;

    // Grouper par fichier et construire les réponses
    let mut results = Vec::new();
    let mut current_file_id: Option<Uuid> = None;
    let mut current_chunks = Vec::new();
    let mut current_file_data: Option<(Uuid, Vec<u8>, i64, String, Vec<u8>, String)> = None;

    for item in items {
        let file_id = item.file_id;
        
        // Si c'est un nouveau fichier, sauvegarder le précédent
        if current_file_id.is_some() && current_file_id != Some(file_id) {
            if let Some((fid, metadata, size, mime_type, key, path)) = current_file_data.take() {
                results.push(json!({
                    "type": "file",
                    "file_id": fid,
                    "encrypted_metadata": bytes_to_text_or_b64(&metadata),
                    "encrypted_file_key": bytes_to_text_or_b64(&key),
                    "size": size,
                    "mime_type": mime_type,
                    "path": path,
                    "chunks": current_chunks.drain(..).collect::<Vec<_>>(),
                }));
            }
        }

        current_file_id = Some(file_id);

        if current_file_data.is_none() {
            current_file_data = Some((
                file_id,
                item.encrypted_metadata.clone(),
                item.size,
                item.mime_type.clone(),
                item.encrypted_file_key.clone(),
                item.folder_path.clone(),
            ));
        }

        // Ajouter le chunk s'il existe
        if let Some(s3_key) = item.s3_key {
            current_chunks.push(json!({
                "s3_key": s3_key,
                "index": item.chunk_index,
                "chunk_id": item.chunk_id,
            }));
        }
    }

    // Ajouter le dernier fichier
    if let Some((fid, metadata, size, mime_type, key, path)) = current_file_data {
        results.push(json!({
            "type": "file",
            "file_id": fid,
            "encrypted_metadata": bytes_to_text_or_b64(&metadata),
            "encrypted_file_key": bytes_to_text_or_b64(&key),
            "size": size,
            "mime_type": mime_type,
            "path": path,
            "chunks": current_chunks,
        }));
    }

    Ok(results)
}


pub async fn finalize_file_upload(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    // Verify user has access to the file
    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner')",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    // Update the file to mark it as finalized (if there's such a field)
    sqlx::query("UPDATE files SET updated_at = NOW(), is_fully_uploaded = TRUE WHERE id = $1")
        .bind(file_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

pub async fn get_corbeille_info(
    db_pool: &PgPool,
    user_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    #[derive(FromRow)]
    struct CorbeilleStats {
        deleted_files_count: i64,
        total_deleted_size: Option<i64>,
    }

    // Count deleted files and total size
    let stats = sqlx::query_as::<_, CorbeilleStats>(
        "
        SELECT COUNT(*) as deleted_files_count, COALESCE(SUM(f.size), 0)::BIGINT as total_deleted_size
        FROM file_access
        LEFT JOIN files f ON f.id = file_access.file_id
        WHERE file_access.user_id = $1 AND file_access.is_deleted = TRUE
        ",
    )
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    // Count deleted folders
    let deleted_folders_count: i64 = sqlx::query_scalar::<_, i64>(
        "
        SELECT COUNT(*) FROM folder_access
        WHERE user_id = $1 AND is_deleted = TRUE
        ",
    )
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    Ok(json!({
        "deleted_files_count": stats.deleted_files_count,
        "deleted_folders_count": deleted_folders_count,
        "total_deleted_size": stats.total_deleted_size.unwrap_or(0),
    }))
}


// files and folders in corbeille
pub async fn get_corbeille_contents(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    #[derive(Debug, sqlx::FromRow)]
    struct DeletedFileRow {
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

    let files: Vec<DeletedFileRow> = sqlx::query_as::<_, DeletedFileRow>(
        r#"
        select 
            fa2.folder_id,
            fa2.file_id as file_id,
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
            and fa2.is_deleted is true
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(serde_json::json!({
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

pub async fn restore_file_from_corbeille(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    // Verify user has deleted access to the file
    let has_deleted_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND is_deleted = TRUE)",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !has_deleted_access {
        return Err(sqlx::Error::RowNotFound);
    }

    // Get the folder_id from file_access
    let folder_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT folder_id FROM file_access WHERE file_id = $1 AND user_id = $2",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    // If there's a folder_id, restore the entire folder hierarchy
    if let Some(fid) = folder_id {
        // Get all parent folders from the target folder up to the root that are deleted
        let parent_folders: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
            "
            WITH RECURSIVE folder_path AS (
                SELECT f.id, f.parent_folder_id
                FROM folders f
                WHERE f.id = $1
                
                UNION ALL
                
                SELECT f.id, f.parent_folder_id
                FROM folders f
                JOIN folder_path fp ON f.id = fp.parent_folder_id
            )
            SELECT DISTINCT fp.id 
            FROM folder_path fp
            JOIN folder_access fa ON fa.folder_id = fp.id
            WHERE fa.user_id = $2 AND fa.is_deleted = TRUE
            ",
        )
        .bind(fid)
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?;

        // Restore all deleted parent folders
        for parent_id in parent_folders {
            // Restore folder_access
            sqlx::query(
                "
                UPDATE folder_access
                SET is_deleted = FALSE, updated_at = NOW()
                WHERE folder_id = $1 AND user_id = $2
                ",
            )
            .bind(parent_id)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

            // Note: No need to update folders table as is_deleted doesn't exist there
        }
    }

    // Restore the file access
    sqlx::query(
        "
        UPDATE file_access
        SET is_deleted = FALSE, updated_at = NOW()
        WHERE file_id = $1 AND user_id = $2
        ",
    )
    .bind(file_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Update the file to mark it as not deleted
    sqlx::query(
        "
        UPDATE files
        SET is_deleted = FALSE, updated_at = NOW()
        WHERE id = $1
        ",
    )
    .bind(file_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn restore_folder_from_corbeille(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    // Verify user has deleted access to the folder
    let has_deleted_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND is_deleted = TRUE)",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !has_deleted_access {
        return Err(sqlx::Error::RowNotFound);
    }

    // Get all parent folders up to the root that are deleted
    let parent_folders: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "
        WITH RECURSIVE folder_path AS (
            SELECT f.id, f.parent_folder_id
            FROM folders f
            WHERE f.id = $1
            
            UNION ALL
            
            SELECT f.id, f.parent_folder_id
            FROM folders f
            JOIN folder_path fp ON f.id = fp.parent_folder_id
        )
        SELECT DISTINCT fp.id 
        FROM folder_path fp
        JOIN folder_access fa ON fa.folder_id = fp.id
        WHERE fa.user_id = $2 AND fa.is_deleted = TRUE
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    // Restore all deleted parent folders first
    for parent_id in parent_folders {
        // Restore folder_access
        sqlx::query(
            "
            UPDATE folder_access
            SET is_deleted = FALSE, updated_at = NOW()
            WHERE folder_id = $1 AND user_id = $2
            ",
        )
        .bind(parent_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        // Note: No need to update folders table as is_deleted doesn't exist there
    }

    // Now restore the target folder and all its children
    // Restore the folder access
    sqlx::query(
        "
        UPDATE folder_access
        SET is_deleted = FALSE, updated_at = NOW()
        WHERE folder_id = $1 AND user_id = $2
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Note: No need to update folders table as is_deleted doesn't exist there

    // Recursively restore all child folders and their accesses
    sqlx::query(
        "
        WITH RECURSIVE folder_tree AS (
            SELECT id
            FROM folders
            WHERE id = $1
            UNION ALL
            SELECT f.id
            FROM folders f
            JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        UPDATE folder_access fa
        SET is_deleted = FALSE, updated_at = NOW()
        FROM folder_tree ft
        WHERE fa.folder_id = ft.id AND fa.user_id = $2
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // Recursively restore all files in the folder and its subfolders
    sqlx::query(
        "
        WITH RECURSIVE folder_tree AS (
            SELECT id
            FROM folders
            WHERE id = $1
            UNION ALL
            SELECT f.id
            FROM folders f
            JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        UPDATE file_access fa
        SET is_deleted = FALSE, updated_at = NOW()
        FROM folder_tree ft
        WHERE fa.folder_id = ft.id AND fa.user_id = $2
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn empty_corbeille(
    db_pool: &PgPool,
    storage_client: &crate::storage::StorageClient,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    // Get all file_ids in the corbeille for this user
    let file_ids: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "
        SELECT file_id FROM file_access
        WHERE user_id = $1 AND is_deleted = TRUE
        ",
    )
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    // Delete files from storage and database
    for file_id in file_ids.iter() {
        // Get S3 keys
        let s3_keys: Vec<String> = sqlx::query_scalar::<_, String>(
            "SELECT s3_key FROM s3_keys WHERE file_id = $1",
        )
        .bind(file_id)
        .fetch_all(&mut *tx)
        .await?;

        // Here you would call your storage client to delete the files from storage.
        // For example:
        for s3_key in s3_keys.iter() {
            storage_client.delete_line(s3_key).await.map_err(|e| {
                sqlx::Error::Protocol(format!("Failed to delete from storage: {}", e).into())
            })?;
        }

        // Delete from s3_keys
        sqlx::query("DELETE FROM s3_keys WHERE file_id = $1")
            .bind(file_id)
            .execute(&mut *tx)
            .await?;

        // Delete from file_access
        sqlx::query("DELETE FROM file_access WHERE file_id = $1")
            .bind(file_id)
            .execute(&mut *tx)
            .await?;

        // Delete from files
        sqlx::query("DELETE FROM files WHERE id = $1")
            .bind(file_id)
            .execute(&mut *tx)
            .await?;
    }

    // Delete folder_access entries marked as deleted for this user
    sqlx::query(
        "
        DELETE FROM folder_access
        WHERE user_id = $1 AND is_deleted = TRUE
        ",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}