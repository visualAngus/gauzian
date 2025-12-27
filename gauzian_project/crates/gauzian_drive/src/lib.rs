use async_stream::try_stream;
use axum::{
    body::Body,
    extract::{Json, Query, State}, // Utiliser Query pour l'entrée, Json pour la sortie
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use base64::{Engine as _, engine::general_purpose};
use bytes::Bytes;
use futures::StreamExt; // Important pour utiliser .map() sur le stream SQLx
use gauzian_auth::{ensure_session, get_storage_usage_handler, AuthSession};
use gauzian_core::{
    AppState, CancelStreamingUploadRequest, DeleteFileRequest, DeleteFolderRequest, DownloadQuery,
    DownloadRequest, FileRenameRequest, FinishStreamingUploadRequest, FolderCreationRequest,
    FolderRecord, FolderRenameRequest, FolderRequest, FullPathRequest, OpenStreamingUploadRequest,
    USER_STORAGE_LIMIT, UploadRequest, UploadStreamingRequest,MoveFileToFolderRequest,ShareFileRequest,
    PrepareShareFileRequest,
};
use serde_json::json;

use futures::stream::Stream; // Nécessaire pour le trait object
use std::io;
use std::pin::Pin;
use tracing::error;

fn respond_with_cookies<T: IntoResponse>(resp: T, cookies: &[HeaderValue]) -> Response {
    let mut response = resp.into_response();
    for cookie in cookies {
        response
            .headers_mut()
            .append(axum::http::header::SET_COOKIE, cookie.clone());
    }
    response
}

async fn require_auth(headers: &HeaderMap, state: &AppState) -> Result<AuthSession, Response> {
    match ensure_session(headers, state).await {
        Ok(ctx) => Ok(ctx),
        Err(err) => Err(err.to_response()),
    }
}

pub async fn upload_handler(
    State(state): State<AppState>,
    headers: HeaderMap,                 // <--- D'ABORD les headers
    Json(payload): Json<UploadRequest>, // <--- ENSUITE le Body (Json) à la toute fin
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    if payload.encrypted_blob.is_empty()
        || payload.encrypted_metadata.is_empty()
        || payload.encrypted_file_key.is_empty()
        || payload.media_type.is_empty()
        || payload.file_size == 0
    {
        return respond_with_cookies(StatusCode::BAD_REQUEST, &cookies);
    }

    // verifier que le user a encode de la place pour le fichier
    let storage_usage = get_storage_usage_handler(user_id, &state).await.unwrap_or((0, 0, 0, 0));
    let used = storage_usage.0;
    if used + payload.file_size as i64 > USER_STORAGE_LIMIT as i64 {
        let body = Json(json!({
            "status": "error",
            "message": "Espace de stockage insuffisant"
        }));
        return respond_with_cookies((StatusCode::BAD_REQUEST, body), &cookies);
    }

    // requet sql pour rajouter le fichier dans la bdd associée à user_id

    let vault_file_insert_result = sqlx::query!(
        r#"
        INSERT INTO vault_files (owner_id, encrypted_blob, encrypted_metadata,media_type,file_size,is_shared, created_at, updated_at,is_compressed)
        VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW(), false)
        RETURNING id
        "#,
        user_id,
        payload.encrypted_blob.as_bytes(),
        payload.encrypted_metadata.as_bytes(), 
        payload.media_type,
        payload.file_size as i64,
    );

    match vault_file_insert_result.fetch_one(&state.db_pool).await {
        Ok(record) => {
            let file_access_insert_result = sqlx::query!(
                r#"
                INSERT INTO file_access (file_id, user_id, encrypted_file_key,permission_level,joined_at,folder_id)
                VALUES ($1, $2, $3, 'owner', NOW(), $4)
                "#,
                record.id,
                user_id,
                payload.encrypted_file_key.as_bytes(),
                payload.parent_folder_id,
            ).execute(&state.db_pool).await;
            match file_access_insert_result {
                Ok(_) => {
                    let body = Json(json!({
                        "status": "success",
                        "file_id": record.id,
                    }));
                    return respond_with_cookies((StatusCode::OK, body), &cookies);
                }
                Err(e) => {
                    error!(error = ?e, "file_access insert failed");
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur serveur lors de l'insertion de l'accès au fichier"
                    }));
                    return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
                }
            }
        }
        Err(e) => {
            error!(error = ?e, "vault_files insert failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de l'insertion du fichier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

// Pareil ici : si tu transformes ça en POST plus tard, garde Json à la fin
pub async fn download_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<DownloadRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    // requet sql pour récupérer le fichier dans la bdd associée à user_id et payload.file_id
    let vault_file_query_result = sqlx::query!(
        r#"
        SELECT vf.encrypted_blob, vf.encrypted_metadata, fa.encrypted_file_key, vf.media_type, vf.file_size,vf.is_compressed
        FROM vault_files vf
        JOIN file_access fa ON vf.id = fa.file_id
        WHERE vf.id = $1 AND fa.user_id = $2 AND fa.permission_level IN ('owner', 'read', 'write')
        "#,
        payload.file_id,
        user_id,
    ).fetch_one(&state.db_pool).await;

    match vault_file_query_result {
        Ok(record) => {
            let body = Json(json!({
                "status": "success",
                "encrypted_blob": record.encrypted_blob
                    .and_then(|data| String::from_utf8(data).ok())
                    .unwrap_or_default(),
                "encrypted_metadata": String::from_utf8(record.encrypted_metadata).unwrap_or_default(),
                "encrypted_file_key": String::from_utf8(record.encrypted_file_key).unwrap_or_default(),
                "is_compressed": record.is_compressed,
                "media_type": record.media_type,
                "file_size": record.file_size,
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "vault_file fetch failed");
            let body = Json(json!({
                "status": "error",
                "message": "Fichier non trouvé ou accès refusé"
            }));
            return respond_with_cookies((StatusCode::NOT_FOUND, body), &cookies);
        }
    };
}

pub async fn folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<FolderRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let parent_folder_id = payload.parent_folder_id;
    let folder_query_result = if let Some(parent_id) = parent_folder_id {
        // Cas 1 : Dossier enfant
        sqlx::query_as!(
            FolderRecord,
            r#"
            WITH RECURSIVE folder_tree AS (
                SELECT 
                    f.id,
                    f.parent_id
                FROM folders f
                WHERE f.id = $1

                UNION ALL
                SELECT 
                    f.id,
                    f.parent_id
                FROM folders f
                INNER JOIN folder_tree ft ON f.parent_id = ft.id
            ),
            folder_size AS (
                SELECT 
                    ft.id AS folder_id,
                    COALESCE(SUM(vf.file_size), 0)::int8 AS total_size
                FROM folder_tree ft
                LEFT JOIN file_access fa ON fa.folder_id = ft.id
                LEFT JOIN vault_files vf ON vf.id = fa.file_id
                WHERE fa.user_id = $2
                GROUP BY ft.id
            )

            SELECT 
                f.is_root,
                f.id,
                f.encrypted_metadata,
                f.updated_at,
                fa.encrypted_folder_key,
                fs.total_size,
                CASE 
                    WHEN f.owner_id = fa.user_id THEN 'vous'
                    ELSE CONCAT(u.first_name, ' ', u.last_name)
                END AS "owner"
            FROM folders f
            INNER JOIN folder_access fa ON f.id = fa.folder_id
            LEFT JOIN folder_size fs ON fs.folder_id = f.id
            inner join users u on u.id = f.owner_id 
            WHERE 
                f.parent_id = $1
                AND fa.user_id = $2
            ORDER BY f.updated_at DESC;

            "#,
            parent_id,
            user_id,
        )
        .fetch_all(&state.db_pool)
        .await
    } else {
        sqlx::query_as!(
            FolderRecord,
            r#"
            WITH RECURSIVE folder_tree AS (
                SELECT 
                    f.id,
                    f.parent_id
                FROM folders f
                WHERE f.id IN (
                    SELECT folder_id 
                    FROM folder_access 
                    WHERE user_id = $1
                ) AND f.parent_id IS NULL

                UNION ALL
                SELECT 
                    f.id,
                    f.parent_id
                FROM folders f
                INNER JOIN folder_tree ft ON f.parent_id = ft.id
            ),
            folder_size AS (
                SELECT 
                    ft.id AS folder_id,
                    COALESCE(SUM(vf.file_size), 0)::int8 AS total_size
                FROM folder_tree ft
                LEFT JOIN file_access fa ON fa.folder_id = ft.id
                LEFT JOIN vault_files vf ON vf.id = fa.file_id
                WHERE fa.user_id = $1
                GROUP BY ft.id
            )
            SELECT 
                f.is_root,
                f.id,
                f.encrypted_metadata,
                f.updated_at,
                fa.encrypted_folder_key,
                fs.total_size,
                CASE 
                    WHEN f.owner_id = fa.user_id THEN 'vous'
                    ELSE CONCAT(u.first_name, ' ', u.last_name)
                END AS "owner"
            FROM folders f
            INNER JOIN folder_access fa ON f.id = fa.folder_id
            LEFT JOIN folder_size fs ON fs.folder_id = f.id
            inner join users u on u.id = f.owner_id 
            WHERE 
                f.parent_id IS NULL
                AND fa.user_id = $1
            ORDER BY f.updated_at DESC;
            "#,
            user_id,
        )
        .fetch_all(&state.db_pool)
        .await
    };

    match folder_query_result {
        Ok(records) => {
            let folders: Vec<_> = records.into_iter().map(|record| {
                json!({
                    "folder_id": record.id,
                    "encrypted_metadata": String::from_utf8(record.encrypted_metadata).unwrap_or_default(),
                    "updated_at": record.updated_at,
                    "encrypted_folder_key": String::from_utf8(record.encrypted_folder_key).unwrap_or_default(),
                    "is_root": record.is_root,
                    "total_size": record.total_size.unwrap_or(0),
                    "owner": record.owner.unwrap_or_default(),
                })
            }).collect();
            let storage_usage = get_storage_usage_handler(user_id, &state).await.unwrap_or((0, 0, 0, 0));
            let used = storage_usage.0;

            let body = Json(json!({
                "status": "success",
                "folders": folders,
                "storage_limit": USER_STORAGE_LIMIT,
                "storage_used": used,
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "folders fetch failed");
            let body = Json(json!({
                "status": "error",
                "message": "Dossier non trouvé ou accès refusé"
            }));
            return respond_with_cookies((StatusCode::NOT_FOUND, body), &cookies);
        }
    };
}

pub async fn files_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<FolderRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let parent_folder_id = payload.parent_folder_id;

    let select_file_result = sqlx::query!(
        r#"
        SELECT vf.id, vf.encrypted_metadata, vf.updated_at, fa.encrypted_file_key, vf.is_chunked, vf.file_size, vf.media_type, vf.is_compressed, vf.created_at,
        CASE WHEN vf.owner_id = fa.user_id THEN 'vous'
                ELSE CONCAT(u.first_name, ' ', u.last_name)
            END AS "owner"
        FROM file_access fa
        JOIN vault_files vf ON fa.file_id = vf.id
        inner join users u on u.id = vf.owner_id 
        WHERE fa.folder_id = $1 AND fa.user_id = $2
        ORDER BY vf.updated_at DESC
        "#,
        parent_folder_id,
        user_id,
    )
    .fetch_all(&state.db_pool)
    .await;

    match select_file_result {
        Ok(records) => {
            let files: Vec<_> = records.into_iter().map(|record| {
                json!({
                    "file_id": record.id,
                    "encrypted_metadata": String::from_utf8(record.encrypted_metadata).unwrap_or_default(),
                    "updated_at": record.updated_at,
                    "encrypted_file_key": String::from_utf8(record.encrypted_file_key).unwrap_or_default(),
                    "is_chunked": record.is_chunked,
                    "file_size": record.file_size,
                    "media_type": record.media_type,
                    "is_compressed": record.is_compressed,
                    "created_at": record.created_at,
                    "owner": record.owner.unwrap_or_default(),
                })
            }).collect();

            let body = Json(json!({
                "status": "success",
                "files": files,
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "files fetch failed");
            let body = Json(json!({
                "status": "error",
                "message": "Fichier non trouvé ou accès refusé"
            }));
            return respond_with_cookies((StatusCode::NOT_FOUND, body), &cookies);
        }
    };
}

pub async fn create_folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<FolderCreationRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let parent_folder_id = payload.parent_folder_id;

    let insert_folder_result = sqlx::query!(
        r#"
        INSERT INTO folders (owner_id, parent_id, encrypted_metadata, is_root, created_at, updated_at)
        VALUES ($1, $2, $3, false, NOW(), NOW())
        RETURNING id
        "#,
        user_id,
        parent_folder_id,
        payload.encrypted_metadata.as_bytes(),
    ).fetch_one(&state.db_pool).await;

    match insert_folder_result {
        Ok(record) => {
            let folder_access_insert_result = sqlx::query!(
                r#"
                INSERT INTO folder_access (folder_id, user_id, encrypted_folder_key, permission_level)
                VALUES ($1, $2, $3, 'owner')
                "#,
                record.id,
                user_id,
                payload.encrypted_folder_key.as_bytes(),
            ).execute(&state.db_pool).await;
            match folder_access_insert_result {
                Ok(_) => {
                    let body = Json(json!({
                        "status": "success",
                        "folder_id": record.id,
                    }));
                    return respond_with_cookies((StatusCode::OK, body), &cookies);
                }
                Err(e) => {
                    error!(error = ?e, "folder_access insert failed");
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur serveur lors de l'insertion de l'accès au dossier"
                    }));
                    return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
                }
            }
        }
        Err(e) => {
            error!(error = ?e, "folder creation failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la création du dossier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    };
}

pub async fn full_path_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(payload): Query<FullPathRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let select_full_path_result = sqlx::query!(
        r#"
        WITH RECURSIVE folder_path AS (
            SELECT id, parent_id, encrypted_metadata, fa.encrypted_folder_key , is_root, 0 AS depth
            FROM folders
            inner join folder_access fa on fa.folder_id = folders.id 
            WHERE id = $1 AND fa.user_id = $2
            UNION ALL
            
            SELECT f.id, f.parent_id, f.encrypted_metadata, fa.encrypted_folder_key , f.is_root, fp.depth + 1
            FROM folders f
            inner join folder_access fa on fa.folder_id = f.id 
            INNER JOIN folder_path fp ON f.id = fp.parent_id
        )
        SELECT id, parent_id, encrypted_metadata, encrypted_folder_key , is_root 
        FROM folder_path
        ORDER BY depth DESC
        "#,
        payload.folder_id,
        user_id,
    )
    .fetch_all(&state.db_pool)
    .await;

    match select_full_path_result {
        Ok(records) => {
            let full_path: Vec<_> = records
                .into_iter()
                .map(|record| {
                    json!({
                        "folder_id": record.id,
                        "encrypted_metadata": record.encrypted_metadata
                            .and_then(|data| String::from_utf8(data).ok())
                            .unwrap_or_default(),
                        "encrypted_folder_key": record.encrypted_folder_key
                            .and_then(|data| String::from_utf8(data).ok())
                            .unwrap_or_default(),
                        "is_root": record.parent_id.is_none(),
                    })
                })
                .collect();

            let body = Json(json!({
                "status": "success",
                "full_path": full_path,
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "full path fetch failed");
            let body = Json(json!({
                "status": "error",
                "message": "Chemin non trouvé ou accès refusé"
            }));
            return respond_with_cookies((StatusCode::NOT_FOUND, body), &cookies);
        }
    };
}

pub async fn rename_folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<FolderRenameRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let update_folder_result = sqlx::query!(
        r#"
        UPDATE folders
        SET encrypted_metadata = $1, updated_at = NOW()
        WHERE id = $2 AND owner_id = $3
        "#,
        payload.new_encrypted_metadata.as_bytes(),
        payload.folder_id,
        user_id,
    )
    .execute(&state.db_pool)
    .await;
    match update_folder_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Dossier renommé avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "folder rename failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors du renommage du dossier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    };
}

pub async fn open_streaming_upload_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<OpenStreamingUploadRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    // verifier que le user a encode de la place pour le fichier
    
    let storage_usage = get_storage_usage_handler(user_id, &state).await.unwrap_or((0, 0, 0, 0));
    let used = storage_usage.0;
    if let Some(usage) = Some(used) {
        if usage + payload.file_size as i64 > USER_STORAGE_LIMIT as i64 {
            let body = Json(json!({
                "status": "error",
                "message": "Espace de stockage insuffisant"
            }));
            return respond_with_cookies((StatusCode::BAD_REQUEST, body), &cookies);
        }
    } else {
        let body = Json(json!({
            "status": "error",
            "message": "Impossible de vérifier l'espace de stockage"
        }));
        return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
    }

    // Création de l'entrée temporaire pour l'upload streaming
    let temp_upload_insert_result = sqlx::query!(
        r#"
        INSERT INTO streaming_file (owner_id, encrypted_metadata, media_type, file_size, created_at, folder_id)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        RETURNING id
        "#,
        user_id,
        payload.encrypted_metadata.as_bytes(),
        payload.media_type,
        payload.file_size as i64,
        payload.parent_folder_id
    )
    .fetch_one(&state.db_pool)
    .await;

    match temp_upload_insert_result {
        Ok(record) => {
            let body = Json(json!({
                "status": "success",
                "temp_upload_id": record.id,
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "temp upload creation failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la création de l'upload streaming"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    };
}
pub async fn upload_streaming_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UploadStreamingRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let cookies = auth.set_cookies;

    // --- CORRECTION : Décodage Base64 ---
    // Le frontend envoie une string Base64. On doit la transformer en octets bruts
    // pour que Sodium puisse la lire correctement au téléchargement.
    let chunk_data = match general_purpose::STANDARD.decode(&payload.encrypted_chunk) {
        Ok(bytes) => bytes,
        Err(e) => {
            error!(error = ?e, "chunk base64 decode failed");
            let body = Json(json!({
                "status": "error",
                "message": "Format de chunk invalide (Base64 incorrect)"
            }));
            return respond_with_cookies((StatusCode::BAD_REQUEST, body), &cookies);
        }
    };

    let insert_chunk_result = sqlx::query!(
        r#"
        INSERT INTO streaming_file_chunks (temp_upload_id, chunk_index, encrypted_chunk, uploaded_at)
        VALUES ($1, $2, $3, NOW())
        "#,
        payload.temp_upload_id,
        payload.chunk_index as i64,
        chunk_data, // <--- On utilise le Vec<u8> décodé, pas le String
    )
    .execute(&state.db_pool)
    .await;

    match insert_chunk_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Chunk uploadé avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "insert streaming chunk failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de l'insertion du chunk"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

pub async fn finish_streaming_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<FinishStreamingUploadRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let vault_file_insert_result = sqlx::query!(
        r#"
        INSERT INTO vault_files (owner_id, encrypted_metadata,media_type,file_size,is_shared, created_at, updated_at,is_compressed,streaming_upload_id,is_chunked)
        VALUES ($1, $2, $3, $4, false, NOW(), NOW(), false, $5, $6)
        RETURNING id
        "#,
        user_id,
        payload.encrypted_metadata.as_bytes(),
        payload.media_type,
        payload.file_size as i64,
        payload.temp_upload_id,
        true,
    )
    .fetch_one(&state.db_pool)
    .await;

    match vault_file_insert_result {
        Ok(_) => {
            let create_access_result = sqlx::query!(
                r#"
                INSERT INTO file_access (file_id, user_id, encrypted_file_key,permission_level,joined_at,folder_id)
                VALUES ($1, $2, $3, 'owner', NOW(), $4)
                "#,
                vault_file_insert_result.unwrap().id,
                user_id,
                payload.encrypted_file_key.as_bytes(),
                payload.parent_folder_id,
            )
            .execute(&state.db_pool)
            .await;

            match create_access_result {
                Ok(_) => {}
                Err(e) => {
                    error!(error = ?e, "file_access insert failed (finish streaming)");
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur serveur lors de l'insertion de l'accès au fichier"
                    }));
                    return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
                }
            }
            let body = Json(json!({
                "status": "success",
                "message": "Upload streaming finalisé avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "finalize streaming upload failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la finalisation de l'upload streaming"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

// ... imports

pub async fn download_raw_handler(
    State(state): State<AppState>,
    Query(query): Query<DownloadQuery>,
    // headers...
) -> impl IntoResponse {
    // 1. Auth...

    // 2. Préparation
    let pool = state.db_pool.clone();
    let id_file = query.id_file;

    // 3. Création du stream avec la BONNE REQUÊTE SQL (JOIN)
    let stream: Pin<Box<dyn Stream<Item = Result<Bytes, io::Error>> + Send>> =
        Box::pin(try_stream! {
            // On utilise la jointure pour partir de l'ID du fichier (vf.id)
            // et récupérer les chunks associés (sfc.encrypted_chunk)
            let mut cursor = sqlx::query!(
                r#"
            SELECT sfc.encrypted_chunk 
            FROM streaming_file_chunks sfc
            INNER JOIN streaming_file sf ON sf.id = sfc.temp_upload_id 
            INNER JOIN vault_files vf ON sf.id = vf.streaming_upload_id 
            WHERE vf.id = $1 AND vf.is_chunked = true
            ORDER BY sfc.chunk_index ASC
            "#,
                id_file
            )
            .fetch(&pool);

            while let Some(result) = cursor.next().await {
                match result {
                    Ok(record) => {
                        yield Bytes::from(record.encrypted_chunk.unwrap_or_default());
                    }
                    Err(e) => {
                        error!(error = ?e, "streaming chunk fetch failed");
                        Err(io::Error::new(io::ErrorKind::Other, e))?;
                    }
                }
            }
        });

    // 4. Création du body
    let body = Body::from_stream(stream);

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"download.enc\"",
        )
        .body(body)
        .unwrap()
}


pub async fn delete_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<DeleteFileRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let delete_file_result = sqlx::query!(
        r#"
        DELETE FROM vault_files
        WHERE id = $1 AND owner_id = $2
        "#,
        payload.file_id,
        user_id,
    )
    .execute(&state.db_pool)
    .await;

    match delete_file_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Fichier supprimé avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "delete file failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la suppression du fichier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

pub async fn delete_folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<DeleteFolderRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let delete_folder_result = sqlx::query!(
        r#"
        DELETE FROM folders
        WHERE id = $1 AND owner_id = $2
        "#,
        payload.folder_id,
        user_id,
    )
    .execute(&state.db_pool)
    .await;

    match delete_folder_result {
        Ok(_) => {

            // supprimer les vault_files orphelins
            let delete_orphaned_files_result = sqlx::query!(
                r#"
                DELETE FROM vault_files
                WHERE owner_id = $1
                AND id NOT IN (
                    SELECT fa.file_id
                    FROM file_access fa
                    WHERE fa.user_id = $1
                )
                "#,
                user_id,
            )
            .execute(&state.db_pool)
            .await;

            match delete_orphaned_files_result {
                Ok(_) => {}
                Err(e) => {
                    error!(error = ?e, "delete orphaned files failed");
                }
            }


            let body = Json(json!({
                "status": "success",
                "message": "Dossier et fichiers orphelins supprimés avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "delete folder failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la suppression du dossier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

pub async fn rename_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<FileRenameRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let update_file_result = sqlx::query!(
        r#"
        UPDATE vault_files
        SET encrypted_metadata = $1, updated_at = NOW()
        WHERE id = $2 AND owner_id = $3
        "#,
        payload.new_encrypted_metadata.as_bytes(),
        payload.file_id,
        user_id,
    )
    .execute(&state.db_pool)
    .await;
    match update_file_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Fichier renommé avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "file rename failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors du renommage du fichier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    };
}

// anulation of upload streaming
pub async fn cancel_streaming_upload_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CancelStreamingUploadRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let cookies = auth.set_cookies;

    let delete_chunks_result = sqlx::query!(
        r#"
        DELETE FROM streaming_file_chunks
        WHERE temp_upload_id = $1
        "#,
        payload.temp_upload_id,
    )
    .execute(&state.db_pool)
    .await;

    match delete_chunks_result {
        Ok(_) => {
            let delete_upload_result = sqlx::query!(
                r#"
                DELETE FROM streaming_file
                WHERE id = $1
                "#,
                payload.temp_upload_id,
            )
            .execute(&state.db_pool)
            .await;

            match delete_upload_result {
                Ok(_) => {
                    let body = Json(json!({
                        "status": "success",
                        "message": "Upload streaming annulé avec succès",
                    }));
                    return respond_with_cookies((StatusCode::OK, body), &cookies);
                }
                Err(e) => {
                    error!(error = ?e, "delete streaming upload failed");
                    let body = Json(json!({
                        "status": "error",
                        "message": "Erreur serveur lors de la suppression de l'upload streaming"
                    }));
                    return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
                }
            }
        }
        Err(e) => {
            error!(error = ?e, "delete streaming chunks failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la suppression des chunks de l'upload streaming"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

pub async fn move_file_to_folder_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<MoveFileToFolderRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let update_file_folder_result = sqlx::query!(
        r#"
        UPDATE file_access
        SET folder_id = $1
        WHERE file_id = $2 AND user_id = $3
        "#,
        payload.target_folder_id,
        payload.file_id,
        user_id,
    )
    .execute(&state.db_pool)
    .await;

    match update_file_folder_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Fichier déplacé avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "move file to folder failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors du déplacement du fichier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

pub async fn prepare_share_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<PrepareShareFileRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let cookies = auth.set_cookies;

    let select_id_and_public_key_result = sqlx::query!(
        r#"
        SELECT id, public_key
        FROM users
        WHERE email = $1
        "#,
        payload.reciver_email,
    )
    .fetch_one(&state.db_pool)
    .await;

    match select_id_and_public_key_result {
        Ok(record) => {
            let body = Json(json!({
                "status": "success",
                "user_id": record.id,
                "public_key": String::from_utf8(record.public_key).unwrap_or_default(),
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "prepare share file failed");
            let body = Json(json!({
                "status": "error",
                "message": "Utilisateur non trouvé"
            }));
            return respond_with_cookies((StatusCode::NOT_FOUND, body), &cookies);
        }
    }
}
    

pub async fn share_file_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ShareFileRequest>,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    // permission_level text NOT NULL CHECK (permission_level IN ('viewer', 'editor', 'admin')),

    let share_file_insert_result = sqlx::query!(
        r#"
        INSERT INTO file_share_invites (file_id, sender_id, receiver_id, encrypted_file_key, created_at, expires_at,permission_level)
        VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '7 days','viewer')
        "#,
        payload.file_id,
        user_id,
        payload.receiver_id,
        payload.encrypted_file_key.as_bytes(),
    )
    .execute(&state.db_pool)
    .await;

    match share_file_insert_result {
        Ok(_) => {
            let body = Json(json!({
                "status": "success",
                "message": "Fichier partagé avec succès",
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "share file failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors du partage du fichier"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}

pub async fn get_share_invites_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let auth = match require_auth(&headers, &state).await {
        Ok(ctx) => ctx,
        Err(resp) => return resp,
    };
    let user_id = auth.user_id;
    let cookies = auth.set_cookies;

    let select_invites_result = sqlx::query!(
        r#"
        SELECT fsi.id, fsi.file_id, fsi.sender_id, fsi.encrypted_file_key, fsi.created_at, fsi.expires_at, CONCAT(u.first_name, ' ', u.last_name) AS sender_name,
        u.email AS sender_email, vf.encrypted_metadata
        FROM file_share_invites fsi
        INNER JOIN users u ON fsi.sender_id = u.id
        INNER JOIN vault_files vf ON fsi.file_id = vf.id
        WHERE fsi.receiver_id = $1 AND fsi.expires_at > NOW()
        "#,
        user_id,
    )
    .fetch_all(&state.db_pool)
    .await;

    match select_invites_result {
        Ok(records) => {
            let invites: Vec<_> = records.into_iter().map(|record| {
                json!({
                    "invite_id": record.id,
                    "file_id": record.file_id,
                    "sender_id": record.sender_id,
                    "sender_email": record.sender_email,
                    "encrypted_file_key": String::from_utf8(record.encrypted_file_key).unwrap_or_default(),
                    "encrypted_metadata": String::from_utf8(record.encrypted_metadata).unwrap_or_default(),
                    "created_at": record.created_at,
                    "expires_at": record.expires_at,
                    "sender_name": record.sender_name.unwrap_or_default(),
                })
            }).collect();

            let body = Json(json!({
                "status": "success",
                "invites": invites,
            }));
            return respond_with_cookies((StatusCode::OK, body), &cookies);
        }
        Err(e) => {
            error!(error = ?e, "get share invites failed");
            let body = Json(json!({
                "status": "error",
                "message": "Erreur serveur lors de la récupération des invitations de partage"
            }));
            return respond_with_cookies((StatusCode::INTERNAL_SERVER_ERROR, body), &cookies);
        }
    }
}