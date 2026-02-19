// Repository - Accès aux données du drive
// Queries SQL pour files, folders, file_access, folder_access

use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use serde_json::json;
use base64::Engine;

// ========== Helper Functions ==========
    
fn bytes_to_text_or_b64(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) if !s.trim().is_empty() => s.to_string(),
        _ => base64::engine::general_purpose::STANDARD.encode(bytes),
    }
}

// ========== Queries ==========

/// Vérifier l'existence d'un dossier et l'accès de l'utilisateur
pub async fn user_has_folder_access(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND is_deleted = FALSE)",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(has_access)
}

/// Vérifier si un utilisateur est owner d'un fichier
pub async fn user_is_file_owner(
    pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner')",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(is_owner)
}

/// Vérifier si un utilisateur a accès à un chunk S3
pub async fn user_has_chunk_access(
    pool: &PgPool,
    user_id: Uuid,
    s3_key: &str,
) -> Result<bool, sqlx::Error> {
    let has_access = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM s3_keys sk
            JOIN file_access fa ON fa.file_id = sk.file_id
            WHERE sk.s3_key = $1
              AND fa.user_id = $2
        )
        "#,
    )
    .bind(s3_key)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(has_access)
}

/// Récupérer la taille d'un fichier
pub async fn get_file_size(
    pool: &PgPool,
    file_id: Uuid,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("SELECT size FROM files WHERE id = $1")
        .bind(file_id)
        .fetch_one(pool)
        .await
}

/// Vérifier la connectivité PostgreSQL
pub async fn health_check_db(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT 1")
        .fetch_one(pool)
        .await
        .map(|_| ())
}

/// Récupérer les informations du drive (espace utilisé, nombre de fichiers et dossiers)
pub async fn get_drive_info(pool: &PgPool, user_id: Uuid) -> Result<(i64, i64, i64), sqlx::Error> {
    let (used_space, file_count, folder_count) = sqlx::query_as::<_, (i64, i64, i64)>(
        "
        WITH file_stats AS (
            SELECT 
                u.id as user_id,
                COALESCE(SUM(f.size), 0) as used_space,
                COUNT(f.id) as file_count
            FROM users u
            JOIN file_access fa2 ON fa2.user_id = u.id
            JOIN files f ON f.id = fa2.file_id
            WHERE u.id = $1 
            AND fa2.access_level = 'owner'
            GROUP BY u.id
        ),
        folder_stats AS (
            SELECT 
                u.id as user_id,
                COUNT(fa.id) as folder_count
            FROM users u
            JOIN folder_access fa ON fa.user_id = u.id
            WHERE u.id = $1 
            AND fa.access_level = 'owner'
            GROUP BY u.id
        )
        SELECT 
            COALESCE(fs.used_space, 0)::BIGINT as used_space,
            COALESCE(fs.file_count, 0)::BIGINT as file_count,
            COALESCE(fld.folder_count, 0)::BIGINT as folder_count
        FROM (SELECT $1::uuid as id) u
        LEFT JOIN file_stats fs ON fs.user_id = u.id
        LEFT JOIN folder_stats fld ON fld.user_id = u.id;
        ",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok((used_space, file_count, folder_count))
}

/// Récupérer la liste des fichiers et dossiers dans un dossier parent
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
        folder_size: Option<i64>,
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
            'folder'::text as file_type,
            (select COALESCE(SUM(fi.size),0) from files fi
                join file_access fia on fia.file_id = fi.id
                where fia.folder_id = f.id and fia.user_id = $1 and fia.is_deleted is false and fi.is_fully_uploaded = true
            )::BIGINT as folder_size
        from folder_access fa
        join folders f on f.id = fa.folder_id
                where fa.user_id = $1
                    and (
                        ($2::uuid is null and (f.parent_folder_id is null or fa.is_root_anchor = true))
                        or f.parent_folder_id = $2::uuid
                    )
                    and fa.is_deleted is false
                    and fa.is_accepted = true
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
                    and fa2.is_accepted = true
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
                "folder_size": row.folder_size,
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

/// Récupérer seulement les dossiers d'un dossier parent
pub async fn get_folder_contents(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Option<Uuid>,
) -> Result<serde_json::Value, sqlx::Error> {
    let contents = get_files_and_folders_list(pool, user_id, folder_id).await?;
    let folders = contents
        .get("folders")
        .cloned()
        .unwrap_or_else(|| serde_json::json!([]));
    Ok(folders)
}

/// Initialiser un fichier dans la base de données
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
        INSERT INTO file_access (id, file_id, user_id, folder_id, access_level, created_at, encrypted_file_key, is_accepted)
        VALUES ($1, $2, $3, $4, 'owner', NOW(), $5, TRUE)
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

/// Créer un dossier dans la base de données
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
        INSERT INTO folder_access (id, folder_id, user_id, access_level, created_at, encrypted_folder_key, is_accepted, is_root_anchor)
        VALUES ($1, $2, $3, 'owner', NOW(), $4, TRUE, TRUE)
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
    encrypted_metadata: Vec<u8>,
    encrypted_folder_key: Option<Vec<u8>>,
}

/// Récupérer le chemin complet d'un dossier
pub async fn get_full_path(
    db_pool: &PgPool,
    user_id: Uuid,
    start_folder_id: Option<Uuid>,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let Some(folder_id) = start_folder_id else {
        return Ok(Vec::new());
    };

    let rows = sqlx::query_as::<_, FolderPathRow>(
        "
        WITH RECURSIVE breadcrumb AS (
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
            b.path_index DESC;
        ",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_all(db_pool)
    .await?;

    let path: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|row| {
            let metadata_str = bytes_to_text_or_b64(&row.encrypted_metadata);
            let key_str = row.encrypted_folder_key.as_ref().map(|k| bytes_to_text_or_b64(k));

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

/// Annuler un upload de fichier (supprimer le fichier et ses chunks)
pub async fn abort_file_upload(
    db_pool: &PgPool,
    storage_client: &crate::storage::StorageClient,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let access_users: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM file_access WHERE file_id = $1 FOR UPDATE",
    )
    .bind(file_id)
    .fetch_all(&mut *tx)
    .await?;

    if !access_users.contains(&user_id) {
        return Err(sqlx::Error::RowNotFound);
    }

    let other_users_still_have_access = access_users.iter().any(|u| *u != user_id);
    if other_users_still_have_access {
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

    for s3_key in s3_keys.iter() {
        storage_client.delete_line(s3_key).await.map_err(|e| {
            sqlx::Error::Protocol(format!("Failed to delete from storage: {}", e))
        })?;
    }

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

/// Supprimer un fichier (soft delete pour owner, hard delete pour non-owner)
pub async fn delete_file(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let user_access_level: Option<String> = sqlx::query_scalar(
        "SELECT access_level FROM file_access WHERE file_id = $1 AND user_id = $2 FOR UPDATE",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    let access_level = match user_access_level {
        Some(level) => level,
        None => return Err(sqlx::Error::RowNotFound),
    };

    let is_owner = access_level == "owner";

    if is_owner {
        sqlx::query(
            "UPDATE file_access
             SET is_deleted = TRUE, updated_at = NOW()
             WHERE file_id = $1 AND user_id = $2",
        )
        .bind(file_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "DELETE FROM file_access
             WHERE file_id = $1 AND user_id != $2",
        )
        .bind(file_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE files
             SET is_deleted = TRUE, updated_at = NOW()
             WHERE id = $1",
        )
        .bind(file_id)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            "DELETE FROM file_access
             WHERE file_id = $1 AND user_id = $2",
        )
        .bind(file_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Supprimer un dossier et son contenu (soft delete pour owner, hard delete pour non-owner)
pub async fn delete_folder(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let user_access_level: Option<String> = sqlx::query_scalar(
        "SELECT access_level FROM folder_access WHERE folder_id = $1 AND user_id = $2 FOR UPDATE",
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    let access_level = match user_access_level {
        Some(level) => level,
        None => return Err(sqlx::Error::RowNotFound),
    };

    let is_owner = access_level == "owner";

    if is_owner {
        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
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

        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
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

        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
                JOIN folder_tree ft ON f.parent_folder_id = ft.id
            )
            DELETE FROM folder_access fa
            USING folder_tree ft
            WHERE fa.folder_id = ft.id AND fa.user_id != $2
            ",
        )
        .bind(folder_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
                JOIN folder_tree ft ON f.parent_folder_id = ft.id
            )
            DELETE FROM file_access fa
            USING folder_tree ft
            WHERE fa.folder_id = ft.id AND fa.user_id != $2
            ",
        )
        .bind(folder_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
                JOIN folder_tree ft ON f.parent_folder_id = ft.id
            )
            UPDATE files f
            SET is_deleted = TRUE, updated_at = NOW()
            WHERE f.id IN (
                SELECT fa.file_id FROM file_access fa
                JOIN folder_tree ft ON fa.folder_id = ft.id
            )
            ",
        )
        .bind(folder_id)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
                JOIN folder_tree ft ON f.parent_folder_id = ft.id
            )
            DELETE FROM folder_access fa
            USING folder_tree ft
            WHERE fa.folder_id = ft.id AND fa.user_id = $2
            ",
        )
        .bind(folder_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "
            WITH RECURSIVE folder_tree AS (
                SELECT id FROM folders WHERE id = $1
                UNION ALL
                SELECT f.id FROM folders f
                JOIN folder_tree ft ON f.parent_folder_id = ft.id
            )
            DELETE FROM file_access fa
            USING folder_tree ft
            WHERE fa.folder_id = ft.id AND fa.user_id = $2
            ",
        )
        .bind(folder_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Renommer un fichier (modifier encrypted_metadata)
pub async fn rename_file(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
    new_encrypted_metadata: &str,
) -> Result<(), sqlx::Error> {
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

    sqlx::query("UPDATE files SET encrypted_metadata = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_encrypted_metadata.as_bytes())
        .bind(file_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

/// Renommer un dossier (modifier encrypted_metadata)
pub async fn rename_folder(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    new_encrypted_metadata: &str,
) -> Result<(), sqlx::Error> {
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

    sqlx::query("UPDATE folders SET encrypted_metadata = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_encrypted_metadata.as_bytes())
        .bind(folder_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

/// Déplacer un fichier vers un autre dossier
pub async fn move_file(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
    new_folder_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
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

    sqlx::query("UPDATE file_access SET folder_id = $1 WHERE file_id = $2 AND user_id = $3")
        .bind(new_folder_id)
        .bind(file_id)
        .bind(user_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

/// Déplacer un dossier vers un autre parent
pub async fn move_folder(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    new_parent_folder_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
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

    sqlx::query("UPDATE folders SET parent_folder_id = $1, is_root = $2 WHERE id = $3")
        .bind(new_parent_folder_id)
        .bind(new_parent_folder_id.is_none())
        .bind(folder_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

/// Récupérer les infos d'un fichier avec ses chunks
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

/// Récupérer tous les IDs et clés chiffrées d'un dossier récursivement
pub async fn get_folder_contents_recursive(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Option<Uuid>,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    #[derive(FromRow)]
    struct FolderItem {
        folder_id: Uuid,
        encrypted_folder_key: Vec<u8>,
    }

    #[derive(FromRow)]
    struct FileItem {
        file_id: Uuid,
        encrypted_file_key: Vec<u8>,
    }

    let folders: Vec<FolderItem> = sqlx::query_as::<_, FolderItem>(
        r#"
WITH RECURSIVE folder_tree AS (
    SELECT f.id as folder_id
    FROM folders f
    JOIN folder_access fa ON fa.folder_id = f.id
    WHERE fa.user_id = $1
        AND fa.is_deleted = FALSE
        AND (
            ($2::uuid IS NULL AND f.parent_folder_id IS NULL)
            OR f.parent_folder_id = $2::uuid
        )

    UNION ALL

    SELECT f.id as folder_id
    FROM folders f
    JOIN folder_tree ft ON f.parent_folder_id = ft.folder_id
    JOIN folder_access fa ON fa.folder_id = f.id AND fa.user_id = $1
    WHERE fa.is_deleted = FALSE
)
SELECT
    ft.folder_id,
    fa.encrypted_folder_key
FROM folder_tree ft
JOIN folder_access fa ON fa.folder_id = ft.folder_id AND fa.user_id = $1
        "#,
    )
    .bind(user_id)
    .bind(folder_id)
    .fetch_all(pool)
    .await?;

    let files: Vec<FileItem> = sqlx::query_as::<_, FileItem>(
        r#"
WITH RECURSIVE folder_tree AS (
    SELECT f.id as folder_id
    FROM folders f
    WHERE ($1::uuid IS NULL AND f.parent_folder_id IS NULL)
       OR f.id = $1::uuid

    UNION ALL

    SELECT f.id as folder_id
    FROM folders f
    JOIN folder_tree ft ON f.parent_folder_id = ft.folder_id
)
SELECT
    fa.file_id,
    fa.encrypted_file_key
FROM folder_tree ft
JOIN file_access fa ON fa.folder_id = ft.folder_id AND fa.user_id = $2
JOIN files ON files.id = fa.file_id
WHERE fa.is_deleted = FALSE
  AND files.is_fully_uploaded = TRUE
        "#,
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut results = Vec::new();

    for folder in folders {
        results.push(json!({
            "type": "folder",
            "folder_id": folder.folder_id,
            "encrypted_folder_key": bytes_to_text_or_b64(&folder.encrypted_folder_key),
        }));
    }

    for file in files {
        results.push(json!({
            "type": "file",
            "file_id": file.file_id,
            "encrypted_file_key": bytes_to_text_or_b64(&file.encrypted_file_key),
        }));
    }

    Ok(results)
}

/// Finaliser un upload de fichier
pub async fn finalize_file_upload(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
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

    sqlx::query("UPDATE files SET updated_at = NOW(), is_fully_uploaded = TRUE WHERE id = $1")
        .bind(file_id)
        .execute(db_pool)
        .await?;

    Ok(())
}

/// Récupérer les infos de la corbeille
pub async fn get_corbeille_info(
    db_pool: &PgPool,
    user_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    #[derive(FromRow)]
    struct CorbeilleStats {
        deleted_files_count: i64,
        total_deleted_size: Option<i64>,
    }

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

/// Récupérer le contenu de la corbeille
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

/// Restaurer un fichier de la corbeille
pub async fn restore_file_from_corbeille(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

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

    let folder_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT folder_id FROM file_access WHERE file_id = $1 AND user_id = $2",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if let Some(fid) = folder_id {
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

        for parent_id in parent_folders {
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
        }
    }

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

/// Restaurer un dossier de la corbeille
pub async fn restore_folder_from_corbeille(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

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

    for parent_id in parent_folders {
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
    }

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

/// Vider la corbeille (suppression définitive)
pub async fn empty_corbeille(
    db_pool: &PgPool,
    storage_client: &crate::storage::StorageClient,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let file_ids: Vec<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "
        SELECT file_id FROM file_access
        WHERE user_id = $1 AND is_deleted = TRUE
        ",
    )
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    for file_id in file_ids.iter() {
        let s3_keys: Vec<String> = sqlx::query_scalar::<_, String>(
            "SELECT s3_key FROM s3_keys WHERE file_id = $1",
        )
        .bind(file_id)
        .fetch_all(&mut *tx)
        .await?;

        for s3_key in s3_keys.iter() {
            storage_client.delete_line(s3_key).await.map_err(|e| {
                sqlx::Error::Protocol(format!("Failed to delete from storage: {}", e))
            })?;
        }

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
    }

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

/// Partager un dossier avec un contact (avec clés rechiffrées)
pub async fn share_folder_batch(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    contact_user_id: Uuid,
    access_level: &str,
    folder_keys: Vec<(Uuid, String)>,
    file_keys: Vec<(Uuid, String)>,
) -> Result<(), sqlx::Error> {
    let access_level = match access_level {
        "owner" => "owner",
        "editor" => "editor",
        "viewer" => "viewer",
        _ => return Err(sqlx::Error::Protocol("Invalid access level".into())),
    };

    if contact_user_id == user_id {
        return Err(sqlx::Error::Protocol("Cannot share folder with oneself".into()));
    }

    let mut tx = db_pool.begin().await?;

    let contact_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)"
    )
    .bind(contact_user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !contact_exists {
        return Err(sqlx::Error::RowNotFound);
    }

    let has_owner_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND access_level = 'owner')"
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !has_owner_access {
        return Err(sqlx::Error::RowNotFound);
    }

    for (fid, encrypted_key) in folder_keys {
        sqlx::query(
            "
            INSERT INTO folder_access (id, folder_id, user_id, encrypted_folder_key, access_level, created_at, updated_at, is_deleted, is_accepted, is_root_anchor)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), FALSE, FALSE, FALSE)
            ON CONFLICT (folder_id, user_id) DO UPDATE
            SET encrypted_folder_key = EXCLUDED.encrypted_folder_key,
                access_level = EXCLUDED.access_level,
                updated_at = NOW(),
                is_deleted = FALSE,
                is_accepted = FALSE,
                is_root_anchor = FALSE
            ",
        )
        .bind(Uuid::new_v4())
        .bind(fid)
        .bind(contact_user_id)
        .bind(encrypted_key.as_bytes())
        .bind(access_level)
        .execute(&mut *tx)
        .await?;
    }

    for (file_id, encrypted_key) in file_keys {
        let folder_id_for_file: Option<Uuid> = sqlx::query_scalar(
            "
            SELECT folder_id
            FROM file_access
            WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner'
            "
        )
        .bind(file_id)
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(folder_id_val) = folder_id_for_file {
            sqlx::query(
                "
                INSERT INTO file_access (id, file_id, user_id, folder_id, encrypted_file_key, access_level, created_at, updated_at, is_deleted, is_accepted)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), FALSE, FALSE)
                ON CONFLICT (file_id, user_id) DO UPDATE
                SET encrypted_file_key = EXCLUDED.encrypted_file_key,
                    access_level = EXCLUDED.access_level,
                    updated_at = NOW(),
                    is_deleted = FALSE,
                    is_accepted = FALSE
                ",
            )
            .bind(Uuid::new_v4())
            .bind(file_id)
            .bind(contact_user_id)
            .bind(folder_id_val)
            .bind(encrypted_key.as_bytes())
            .bind(access_level)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    Ok(())
}

/// Partager un dossier avec un contact (version simple, sans propagation aux enfants)
pub async fn share_folder_with_contact(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    contact_user_id: Uuid,
    encrypted_folder_key: &str,
    access_level: &str,
) -> Result<(), sqlx::Error> {
    let access_level = match access_level {
        "owner" => "owner",
        "editor" => "editor",
        "viewer" => "viewer",
        _ => return Err(sqlx::Error::Protocol("Invalid access level".into())),
    };

    if contact_user_id == user_id {
        return Err(sqlx::Error::Protocol("Cannot share folder with oneself".into()));
    }

    let mut tx = db_pool.begin().await?;

    let contact_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)"
    )
    .bind(contact_user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !contact_exists {
        return Err(sqlx::Error::RowNotFound);
    }

    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND access_level = 'owner')"
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query(
        "
        INSERT INTO folder_access (id, folder_id, user_id, encrypted_folder_key, access_level, created_at, updated_at, is_deleted, is_accepted, is_root_anchor)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), FALSE, FALSE, FALSE)
        ON CONFLICT (folder_id, user_id) DO UPDATE
        SET encrypted_folder_key = EXCLUDED.encrypted_folder_key,
            access_level = EXCLUDED.access_level,
            updated_at = NOW(),
            is_deleted = FALSE,
            is_accepted = FALSE,
            is_root_anchor = FALSE
        ",
    )
    .bind(Uuid::new_v4())
    .bind(folder_id)
    .bind(contact_user_id)
    .bind(encrypted_folder_key.as_bytes())
    .bind(access_level)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Partager un fichier avec un contact
pub async fn share_file_with_contact(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
    contact_user_id: Uuid,
    encrypted_file_key: &str,
    access_level: &str,
) -> Result<(), sqlx::Error> {
    let access_level = match access_level {
        "owner" => "owner",
        "editor" => "editor",
        "viewer" => "viewer",
        _ => return Err(sqlx::Error::Protocol("Invalid access level".into())),
    };

    if contact_user_id == user_id {
        return Err(sqlx::Error::Protocol("Cannot share file with oneself".into()));
    }

    let mut tx = db_pool.begin().await?;

    let contact_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)"
    )
    .bind(contact_user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !contact_exists {
        return Err(sqlx::Error::RowNotFound);
    }

    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner')"
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query(
        "
        INSERT INTO file_access (id, file_id, user_id, folder_id, encrypted_file_key, access_level, created_at, updated_at, is_deleted, is_accepted)
        VALUES ($1, $2, $3, NULL, $4, $5, NOW(), NOW(), FALSE, FALSE)
        ON CONFLICT (file_id, user_id) DO UPDATE
        SET encrypted_file_key = EXCLUDED.encrypted_file_key,
            access_level = EXCLUDED.access_level,
            updated_at = NOW(),
            is_deleted = FALSE,
            is_accepted = FALSE
        ",
    )
    .bind(Uuid::new_v4())
    .bind(file_id)
    .bind(contact_user_id)
    .bind(encrypted_file_key.as_bytes())
    .bind(access_level)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Récupérer la liste des utilisateurs ayant accès à un dossier
pub async fn get_folder_shared_users(
    db_pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
) -> Result<Vec<(Uuid, String)>, sqlx::Error> {
    #[derive(FromRow)]
    struct SharedUser {
        user_id: Uuid,
        access_level: String,
    }

    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2)"
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }

    let shared_users = sqlx::query_as::<_, SharedUser>(
        "
        SELECT user_id, access_level
        FROM folder_access
        WHERE folder_id = $1 AND user_id != $2 AND is_deleted = FALSE
        "
    )
    .bind(folder_id)
    .bind(user_id)
    .fetch_all(db_pool)
    .await?;

    Ok(shared_users.into_iter().map(|u| (u.user_id, u.access_level)).collect())
}

/// Récupérer la liste des utilisateurs ayant accès à un fichier
pub async fn get_file_shared_users(
    db_pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<Vec<(Uuid, String)>, sqlx::Error> {
    #[derive(FromRow)]
    struct SharedUser {
        user_id: Uuid,
        access_level: String,
    }

    let has_access = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND is_deleted = FALSE)"
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_one(db_pool)
    .await?;

    if !has_access {
        return Err(sqlx::Error::RowNotFound);
    }
    let shared_users = sqlx::query_as::<_, SharedUser>(
        "
        SELECT user_id, access_level
        FROM file_access
        WHERE file_id = $1 AND user_id != $2 AND is_deleted = FALSE
        "
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_all(db_pool)
    .await?;

    Ok(shared_users.into_iter().map(|u| (u.user_id, u.access_level)).collect())
}

/// Propager les permissions d'un fichier nouvellement créé
pub async fn propagate_file_access(
    db_pool: &PgPool,
    owner_id: Uuid,
    file_id: Uuid,
    user_keys: Vec<(Uuid, String, String)>,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner')"
    )
    .bind(file_id)
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await?;

    if !is_owner {
        return Err(sqlx::Error::RowNotFound);
    }

    let folder_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT folder_id FROM file_access WHERE file_id = $1 AND user_id = $2"
    )
    .bind(file_id)
    .bind(owner_id)
    .fetch_optional(&mut *tx)
    .await?;

    for (user_id, encrypted_key, access_level) in user_keys {
        let access_level = match access_level.as_str() {
            "owner" => "owner",
            "editor" => "editor",
            "viewer" => "viewer",
            _ => continue,
        };

        sqlx::query(
            "
            INSERT INTO file_access (id, file_id, user_id, folder_id, encrypted_file_key, access_level, created_at, updated_at, is_deleted, is_accepted)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), FALSE, TRUE)
            ON CONFLICT (file_id, user_id) DO UPDATE
            SET encrypted_file_key = EXCLUDED.encrypted_file_key,
                access_level = EXCLUDED.access_level,
                updated_at = NOW(),
                is_deleted = FALSE,
                is_accepted = TRUE
            "
        )
        .bind(Uuid::new_v4())
        .bind(file_id)
        .bind(user_id)
        .bind(folder_id)
        .bind(encrypted_key.as_bytes())
        .bind(access_level)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Propager les permissions d'un dossier nouvellement créé
pub async fn propagate_folder_access(
    db_pool: &PgPool,
    owner_id: Uuid,
    folder_id: Uuid,
    user_keys: Vec<(Uuid, String, String)>,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND access_level = 'owner')"
    )
    .bind(folder_id)
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await?;

    if !is_owner {
        return Err(sqlx::Error::RowNotFound);
    }

    for (user_id, encrypted_key, access_level) in user_keys {
        let access_level = match access_level.as_str() {
            "owner" => "owner",
            "editor" => "editor",
            "viewer" => "viewer",
            _ => continue,
        };

        sqlx::query(
            "
            INSERT INTO folder_access (id, folder_id, user_id, encrypted_folder_key, access_level, created_at, updated_at, is_deleted, is_accepted, is_root_anchor)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), FALSE, TRUE, FALSE)
            ON CONFLICT (folder_id, user_id) DO UPDATE
            SET encrypted_folder_key = EXCLUDED.encrypted_folder_key,
                access_level = EXCLUDED.access_level,
                updated_at = NOW(),
                is_deleted = FALSE,
                is_accepted = TRUE
            "
        )
        .bind(Uuid::new_v4())
        .bind(folder_id)
        .bind(user_id)
        .bind(encrypted_key.as_bytes())
        .bind(access_level)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

/// Révoquer l'accès à un fichier pour un utilisateur
pub async fn revoke_file_access(
    db_pool: &PgPool,
    owner_id: Uuid,
    file_id: Uuid,
    target_user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner')"
    )
    .bind(file_id)
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await?;

    if !is_owner {
        return Err(sqlx::Error::RowNotFound);
    }

    sqlx::query(
        "
        DELETE FROM file_access
        WHERE file_id = $1 AND user_id = $2
        "
    )
    .bind(file_id)
    .bind(target_user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Révoquer l'accès à un dossier pour un utilisateur (incluant enfants)
pub async fn revoke_folder_access(
    db_pool: &PgPool,
    owner_id: Uuid,
    folder_id: Uuid,
    target_user_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = db_pool.begin().await?;

    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM folder_access WHERE folder_id = $1 AND user_id = $2 AND access_level = 'owner')"
    )
    .bind(folder_id)
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await?;

    if !is_owner {
        return Err(sqlx::Error::RowNotFound);
    }

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
        DELETE FROM folder_access
        WHERE folder_id IN (SELECT id FROM folder_tree) AND user_id = $2
        "
    )
    .bind(folder_id)
    .bind(target_user_id)
    .execute(&mut *tx)
    .await?;

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
        DELETE FROM file_access
        WHERE folder_id IN (SELECT id FROM folder_tree) AND user_id = $2
        "
    )
    .bind(folder_id)
    .bind(target_user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Récupérer tous les fichiers accessibles par un utilisateur (tous dossiers confondus)
pub async fn get_files_list(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    #[derive(Debug, sqlx::FromRow)]
    struct FileRow {
        file_id: Uuid,
        encrypted_metadata: Vec<u8>,
        file_size: i64,
        mime_type: String,
        created_at: Option<String>,
        updated_at: Option<String>,
        encrypted_file_key: Vec<u8>,
        access_level: String,
        folder_id: Option<Uuid>,
    }

    let files: Vec<FileRow> = sqlx::query_as::<_, FileRow>(
        r#"
        SELECT
            f.id as file_id,
            f.encrypted_metadata,
            f.size as file_size,
            f.mime_type,
            f.created_at::text as created_at,
            f.updated_at::text as updated_at,
            fa.encrypted_file_key,
            fa.access_level,
            fa.folder_id
        FROM file_access fa
        JOIN files f ON f.id = fa.file_id
        WHERE fa.user_id = $1
            AND fa.is_deleted = false
            AND f.is_fully_uploaded = true
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(serde_json::json!(
        files.iter().map(|row| {
            serde_json::json!({
                "id": row.file_id,
                "file_id": row.file_id,
                "encrypted_metadata": bytes_to_text_or_b64(&row.encrypted_metadata),
                "size": row.file_size,
                "file_size": row.file_size,
                "mime_type": row.mime_type,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "encrypted_file_key": bytes_to_text_or_b64(&row.encrypted_file_key),
                "access_level": row.access_level,
                "folder_id": row.folder_id,
                "type": "file",
            })
        }).collect::<Vec<_>>()
    ))
}


/// Récupérer les éléments partagés avec l'utilisateur qui n'ont pas encore été acceptés
pub async fn get_shared_with_me_contents(
    db_pool: &PgPool,
    user_id: Uuid,
) -> Result<serde_json::Value, sqlx::Error> {
    #[derive(Debug, sqlx::FromRow)]
    struct SharedFolderRow {
        folder_id: Uuid,
        encrypted_metadata: Vec<u8>,
        encrypted_folder_key: Vec<u8>,
        created_at: Option<String>,
        updated_at: Option<String>,
        is_root: bool,
        parent_folder_id: Option<Uuid>,
        file_type: String,
        folder_size: Option<i64>,
    }

    #[derive(Debug, sqlx::FromRow)]
    struct SharedFileRow {
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

    // Dossiers en attente d'acceptation : uniquement les racines des arbres partagés
    // (ceux dont le parent n'est pas lui-même accessible à cet utilisateur)
    let folders: Vec<SharedFolderRow> = sqlx::query_as::<_, SharedFolderRow>(
        r#"
        SELECT
            f.id as folder_id,
            f.encrypted_metadata,
            fa.encrypted_folder_key,
            f.created_at::text as created_at,
            f.updated_at::text as updated_at,
            f.is_root,
            f.parent_folder_id,
            'folder'::text as file_type,
            0::BIGINT as folder_size
        FROM folder_access fa
        JOIN folders f ON f.id = fa.folder_id
        WHERE fa.user_id = $1
            AND fa.is_accepted = FALSE
            AND fa.is_deleted = FALSE
            AND fa.access_level != 'owner'
            AND NOT EXISTS (
                SELECT 1 FROM folder_access fa2
                WHERE fa2.folder_id = f.parent_folder_id
                  AND fa2.user_id = $1
                  AND fa2.is_deleted = FALSE
            )
        "#,
    )
    .bind(user_id)
    .fetch_all(db_pool)
    .await?;

    // Fichiers en attente d'acceptation (partagés directement, sans dossier parent partagé)
    let files: Vec<SharedFileRow> = sqlx::query_as::<_, SharedFileRow>(
        r#"
        SELECT
            fa.folder_id,
            fa.file_id,
            f.encrypted_metadata,
            f.size as file_size,
            f.mime_type,
            f.created_at::text as created_at,
            f.updated_at::text as updated_at,
            fa.access_level,
            fa.encrypted_file_key,
            'file'::text as file_type
        FROM file_access fa
        JOIN files f ON f.id = fa.file_id
        WHERE fa.user_id = $1
            AND fa.is_accepted = FALSE
            AND fa.is_deleted = FALSE
            AND fa.access_level != 'owner'
            AND f.is_fully_uploaded = TRUE
        "#,
    )
    .bind(user_id)
    .fetch_all(db_pool)
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
                "folder_size": row.folder_size,
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

/// Accepter un fichier partagé (l'ancre à la racine du drive de l'utilisateur)
pub async fn accept_shared_file(
    pool: &PgPool,
    user_id: Uuid,
    file_id: Uuid,
) -> Result<(), sqlx::Error> {
    let rows_affected = sqlx::query(
        "
        UPDATE file_access
        SET is_accepted = TRUE,
            updated_at = NOW(),
            -- Si le dossier parent n'est pas accessible à cet utilisateur, placer le fichier à la racine
            folder_id = CASE
                WHEN folder_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM folder_access fa
                    WHERE fa.folder_id = file_access.folder_id
                      AND fa.user_id = $2
                      AND fa.is_accepted = TRUE
                      AND fa.is_deleted = FALSE
                ) THEN folder_id
                ELSE NULL
            END
        WHERE file_id = $1
          AND user_id = $2
          AND is_deleted = FALSE
          AND access_level != 'owner'
        "
    )
    .bind(file_id)
    .bind(user_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(sqlx::Error::RowNotFound);
    }
    Ok(())
}

/// Accepter un dossier partagé : l'ancre à la racine + propage aux enfants récursivement
pub async fn accept_shared_folder(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    // 1. Marquer le dossier racine comme accepté et ancré
    let rows_affected = sqlx::query(
        "
        UPDATE folder_access
        SET is_accepted = TRUE, is_root_anchor = TRUE, updated_at = NOW()
        WHERE folder_id = $1
          AND user_id = $2
          AND is_deleted = FALSE
          AND access_level != 'owner'
        "
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(sqlx::Error::RowNotFound);
    }

    // 2. Accepter récursivement tous les sous-dossiers partagés
    sqlx::query(
        "
        WITH RECURSIVE folder_tree AS (
            SELECT id FROM folders WHERE parent_folder_id = $1
            UNION ALL
            SELECT f.id FROM folders f
            JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        UPDATE folder_access
        SET is_accepted = TRUE, updated_at = NOW()
        WHERE folder_id IN (SELECT id FROM folder_tree)
          AND user_id = $2
          AND is_deleted = FALSE
        "
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    // 3. Accepter tous les fichiers dans l'arbre de dossiers
    sqlx::query(
        "
        WITH RECURSIVE folder_tree AS (
            SELECT id FROM folders WHERE id = $1
            UNION ALL
            SELECT f.id FROM folders f
            JOIN folder_tree ft ON f.parent_folder_id = ft.id
        )
        UPDATE file_access
        SET is_accepted = TRUE, updated_at = NOW()
        WHERE user_id = $2
          AND folder_id IN (SELECT id FROM folder_tree)
          AND is_deleted = FALSE
        "
    )
    .bind(folder_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}