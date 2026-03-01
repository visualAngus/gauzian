use axum::extract::{Json, Multipart, Path, State};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use tracing::{info, instrument};
use uuid::Uuid;

use crate::{auth::Claims, response::ApiResponse, state::AppState};
use super::{repo, services};
use base64::Engine;
use sqlx;

use axum::body::{Body, Bytes};
use axum::http::header;
use futures::stream::StreamExt;

fn sanitize_content_disposition_filename(raw: &str) -> String {
    let sanitized = raw
        .chars()
        .filter(|c| *c != '\r' && *c != '\n' && *c != '"' && *c != '\\')
        .collect::<String>();

    if sanitized.trim().is_empty() {
        "download".to_string()
    } else {
        sanitized
    }
}

// ========== Request/Response Structures ==========

#[derive(Deserialize)]
pub struct InitializeFileRequest {
    size: i64,
    encrypted_metadata: String,
    mime_type: String,
    folder_id: String,
    encrypted_file_key: String,
}

// ========== Handlers ==========

pub async fn initialize_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<InitializeFileRequest>,
) -> Response {
    let folder_id = match services::parse_uuid_or_error(&body.folder_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    let drive_info = match repo::get_drive_info(&state.db_pool, claims.id).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to retrieve drive info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
        }
    };

    if drive_info.used_space + body.size > drive_info.storage_limit_bytes {
        return ApiResponse::insufficient_storage("Insufficient storage space").into_response();
    }

    let file_id = match repo::initialize_file_in_db(
        &state.db_pool,
        claims.id,
        body.size,
        &body.encrypted_metadata,
        &body.mime_type,
        folder_id,
        &body.encrypted_file_key,
    )
    .await
    {
        Ok(id) => id,
        Err(sqlx::Error::RowNotFound) => {
            return ApiResponse::not_found("Folder not found").into_response();
        }
        Err(e) => {
            tracing::error!("Failed to initialize file in DB: {:?}", e);
            return ApiResponse::internal_error("Failed to initialize file").into_response();
        }
    };
    ApiResponse::ok(serde_json::json!({ "file_id": file_id })).into_response()
}

#[instrument]
pub async fn protected_handler(claims: Claims) -> ApiResponse<String> {
    info!(user_id = %claims.id, "Access granted via cookie");

    ApiResponse::ok(format!(
        "Bienvenue {} ! Tu es authentifié via Cookie.",
        claims.id
    ))
}


pub async fn get_account_and_drive_info_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(parent_id): Path<String>,
) -> Response {
    let is_corbeille = parent_id.eq_ignore_ascii_case("corbeille");

    if is_corbeille {
        let corbeille_info = match repo::get_corbeille_info(&state.db_pool, claims.id).await {
            Ok(info) => info,
            Err(e) => {
                tracing::error!("Failed to retrieve corbeille info: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve corbeille info")
                    .into_response();
            }
        };

        let files_and_folders = match repo::get_corbeille_contents(&state.db_pool, claims.id).await
        {
            Ok(list) => list,
            Err(e) => {
                tracing::error!("Failed to retrieve corbeille contents: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve corbeille contents")
                    .into_response();
            }
        };

        let drive_info = match repo::get_drive_info(&state.db_pool, claims.id).await {
            Ok(info) => info,
            Err(e) => {
                tracing::error!("Failed to retrieve drive info: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
            }
        };

        return ApiResponse::ok(serde_json::json!({
            "corbeille_info": {
                "used_space": corbeille_info["total_deleted_size"],
                "file_count": corbeille_info["deleted_files_count"],
                "folder_count": corbeille_info["deleted_folders_count"],
            },
            "files_and_folders": files_and_folders,
            "drive_info": {
                "used_space": drive_info.used_space,
                "file_count": drive_info.file_count,
                "folder_count": drive_info.folder_count,
                "storage_limit_bytes": drive_info.storage_limit_bytes,
                "account_tier": drive_info.account_tier,
            },
            "full_path": [],

        }))
        .into_response();
    }

    let parent_id = match services::parse_uuid_or_error(&parent_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    tracing::info!("Requested parent folder ID: {:?}", parent_id);

    // user info
    let user_info = match crate::auth::repo::get_user_by_id(&state.db_pool, claims.id).await {
        Ok(user) => user,
        Err(e) => {
            tracing::error!("Failed to retrieve user info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve user info").into_response();
        }
    };

    let drive_info = match repo::get_drive_info(&state.db_pool, claims.id).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to retrieve drive info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
        }
    };

    let files_folder_liste =
        repo::get_files_and_folders_list(&state.db_pool, claims.id, parent_id).await;
    let files_and_folders = match files_folder_liste {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to retrieve files and folders list: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve files and folders list")
                .into_response();
        }
    };

    let full_path = match repo::get_full_path(&state.db_pool, claims.id, parent_id).await {
        Ok(path) => {
            tracing::info!("Full path retrieved: {:?}", path);
            path
        }
        Err(e) => {
            tracing::error!("Failed to retrieve full path: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve full path").into_response();
        }
    };

    ApiResponse::ok(serde_json::json!({
        "user_info": {
            "id": user_info.id,
            "username": user_info.username,
            "email": user_info.email,
        },
        "drive_info": {
            "used_space": drive_info.used_space,
            "file_count": drive_info.file_count,
            "folder_count": drive_info.folder_count,
            "storage_limit_bytes": drive_info.storage_limit_bytes,
            "account_tier": drive_info.account_tier,
        },
        "files_and_folders": files_and_folders,
        "full_path": full_path,
    }))
    .into_response()
}

#[derive(Deserialize)]
pub struct UploadChunkRequest {
    file_id: Uuid,
    index: i32,
    chunk_data: String, // base64 encoded
    iv: String,
}

pub async fn upload_chunk_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<UploadChunkRequest>,
) -> Response {
    // Acquérir un permit pour limiter les uploads concurrents
    let _permit = match state.upload_semaphore.try_acquire() {
        Ok(permit) => permit,
        Err(_) => {
            tracing::warn!("Upload rejected: too many concurrent uploads");
            return ApiResponse::bad_request("Server busy, please retry").into_response();
        }
    };

    // Vérifier que l'utilisateur a le droit d'uploader sur ce fichier
    let has_access = match repo::user_is_file_owner(&state.db_pool, claims.id, body.file_id).await {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Failed to check file access: {:?}", e);
            return ApiResponse::internal_error("Failed to verify access").into_response();
        }
    };

    if !has_access {
        return ApiResponse::not_found("File not found or access denied").into_response();
    }

    let chunk_data = match base64::engine::general_purpose::STANDARD.decode(&body.chunk_data) {
        Ok(data) => bytes::Bytes::from(data),
        Err(e) => {
            tracing::error!("Failed to decode chunk data: {:?}", e);
            return ApiResponse::bad_request("Invalid chunk data").into_response();
        }
    };

    let storage_client = &state.storage_client;

    // Mesurer la durée d'upload du chunk vers S3
    let upload_start = std::time::Instant::now();
    let meta_data_s3 = match storage_client
        .upload_line(chunk_data, body.index.to_string(), body.iv.clone())
        .await
    {
        Ok(meta) => {
            let upload_duration = upload_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_upload_duration(upload_duration, true);
            meta
        }
        Err(e) => {
            let upload_duration = upload_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_upload_duration(upload_duration, false);
            tracing::error!("Failed to upload chunk to storage: {:?}", e);
            return ApiResponse::internal_error("Failed to upload chunk").into_response();
        }
    };

    let s3_record_id = match repo::save_chunk_metadata(
        &state.db_pool,
        body.file_id,
        body.index,
        &meta_data_s3.s3_id,
    )
    .await
    {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Failed to insert S3 key into database: {:?}", e);
            return ApiResponse::internal_error("Failed to record chunk metadata").into_response();
        }
    };

    ApiResponse::ok(serde_json::json!({
        "s3_record_id": s3_record_id,
        "s3_id": meta_data_s3.s3_id,
        "index": meta_data_s3.index,
        "date_upload": meta_data_s3.date_upload,
        "data_hash": meta_data_s3.data_hash,
    }))
    .into_response()
}

pub async fn upload_chunk_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Response {
    let _permit = match state.upload_semaphore.try_acquire() {
        Ok(permit) => permit,
        Err(_) => {
            tracing::warn!("Upload rejected: too many concurrent uploads");
            return ApiResponse::bad_request("Server busy, please retry").into_response();
        }
    };

    let has_access = match repo::user_is_file_owner(&state.db_pool, claims.id, file_id).await {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Failed to check file access: {:?}", e);
            return ApiResponse::internal_error("Failed to verify access").into_response();
        }
    };

    if !has_access {
        return ApiResponse::not_found("File not found or access denied").into_response();
    }

    let drive_info = match repo::get_drive_info(&state.db_pool, claims.id).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to retrieve drive info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
        }
    };

    if drive_info.used_space >= drive_info.storage_limit_bytes {
        return ApiResponse::insufficient_storage("Insufficient storage space").into_response();
    }

    let mut chunk_bytes: Option<Bytes> = None;
    let mut chunk_index: Option<i32> = None;
    let mut iv: Option<String> = None;

    loop {
        let next_field = match multipart.next_field().await {
            Ok(field) => field,
            Err(e) => {
                tracing::error!("Failed to parse multipart field: {:?}", e);
                return ApiResponse::bad_request("Invalid multipart payload").into_response();
            }
        };

        let Some(field) = next_field else {
            break;
        };

        let field_name = field.name().unwrap_or_default().to_string();
        match field_name.as_str() {
            "chunk" => {
                let data = match field.bytes().await {
                    Ok(bytes) => bytes,
                    Err(e) => {
                        tracing::error!("Failed to read chunk bytes: {:?}", e);
                        return ApiResponse::bad_request("Invalid chunk data").into_response();
                    }
                };

                if data.is_empty() {
                    return ApiResponse::bad_request("Empty chunk body").into_response();
                }

                chunk_bytes = Some(data);
            }
            "chunk_index" | "index" => {
                let value = match field.text().await {
                    Ok(text) => text,
                    Err(e) => {
                        tracing::error!("Failed to read chunk index: {:?}", e);
                        return ApiResponse::bad_request("Invalid chunk index").into_response();
                    }
                };

                let parsed_index = match value.parse::<i32>() {
                    Ok(index) => index,
                    Err(_) => return ApiResponse::bad_request("Invalid chunk index").into_response(),
                };

                chunk_index = Some(parsed_index);
            }
            "iv" => {
                let value = match field.text().await {
                    Ok(text) => text,
                    Err(e) => {
                        tracing::error!("Failed to read chunk iv: {:?}", e);
                        return ApiResponse::bad_request("Invalid IV").into_response();
                    }
                };
                iv = Some(value);
            }
            _ => {}
        }
    }

    let Some(body) = chunk_bytes else {
        return ApiResponse::bad_request("Missing chunk file").into_response();
    };
    let Some(index) = chunk_index else {
        return ApiResponse::bad_request("Missing chunk index").into_response();
    };
    let Some(iv) = iv else {
        return ApiResponse::bad_request("Missing IV").into_response();
    };
    
    if drive_info.used_space + body.len() as i64 > drive_info.storage_limit_bytes {
        return ApiResponse::insufficient_storage("Insufficient storage space").into_response();
    } 

    let upload_start = std::time::Instant::now();
    let meta_data_s3 = match state
        .storage_client
        .upload_line(body, index.to_string(), iv)
        .await
    {
        Ok(meta) => {
            let upload_duration = upload_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_upload_duration(upload_duration, true);
            meta
        }
        Err(e) => {
            let upload_duration = upload_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_upload_duration(upload_duration, false);
            tracing::error!("Failed to upload chunk to storage: {:?}", e);
            return ApiResponse::internal_error("Failed to upload chunk").into_response();
        }
    };

    let s3_record_id = match repo::save_chunk_metadata(&state.db_pool, file_id, index, &meta_data_s3.s3_id).await {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Failed to insert S3 key into database: {:?}", e);
            return ApiResponse::internal_error("Failed to record chunk metadata").into_response();
        }
    };

    ApiResponse::ok(serde_json::json!({
        "s3_record_id": s3_record_id,
        "s3_id": meta_data_s3.s3_id,
        "index": meta_data_s3.index,
        "date_upload": meta_data_s3.date_upload,
        "data_hash": meta_data_s3.data_hash,
    }))
    .into_response()
}

// Finalize endpoints removed: transfer lifecycle now handled differently

#[derive(Deserialize)]
pub struct CreateFolderRequest {
    encrypted_metadata: String,
    parent_folder_id: String,
    encrypted_folder_key: String,
}
pub async fn create_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<CreateFolderRequest>,
) -> Response {
    let parent_folder_id = match services::parse_uuid_or_error(&body.parent_folder_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    let folder_id = match repo::create_folder_in_db(
        &state.db_pool,
        claims.id,
        &body.encrypted_metadata,
        parent_folder_id,
        &body.encrypted_folder_key,
    )
    .await
    {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Failed to create folder in DB: {:?}", e);
            return ApiResponse::internal_error("Failed to create folder").into_response();
        }
    };

    ApiResponse::ok(serde_json::json!({ "folder_id": folder_id })).into_response()
}

pub async fn get_file_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(parent_id): Path<String>,
) -> Response {
    let is_corbeille = parent_id.eq_ignore_ascii_case("corbeille");
    let is_shared_with_me = parent_id.eq_ignore_ascii_case("shared-with-me")
        || parent_id.eq_ignore_ascii_case("shared_with_me");

    if is_corbeille {
        let files_and_folders = match repo::get_corbeille_contents(&state.db_pool, claims.id).await
        {
            Ok(list) => list,
            Err(e) => {
                tracing::error!("Failed to retrieve corbeille contents: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve corbeille contents")
                    .into_response();
            }
        };

        let drive_info = match repo::get_drive_info(&state.db_pool, claims.id).await {
            Ok(info) => info,
            Err(e) => {
                tracing::error!("Failed to retrieve drive info: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
            }
        };

        let corbeille_info = match repo::get_corbeille_info(&state.db_pool, claims.id).await {
            Ok(info) => info,
            Err(e) => {
                tracing::error!("Failed to retrieve corbeille info: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve corbeille info")
                    .into_response();
            }
        };

        return ApiResponse::ok(serde_json::json!({
            "files_and_folders": files_and_folders,
            "corbeille_info": {
                "used_space": corbeille_info["total_deleted_size"],
                "file_count": corbeille_info["deleted_files_count"],
                "folder_count": corbeille_info["deleted_folders_count"],
            },
            "drive_info": {
                "used_space": drive_info.used_space,
                "file_count": drive_info.file_count,
                "folder_count": drive_info.folder_count,
                "storage_limit_bytes": drive_info.storage_limit_bytes,
                "account_tier": drive_info.account_tier,
            },
            "full_path": [],
        }))
        .into_response();
    }
    else if is_shared_with_me {
        let files_and_folders = match repo::get_shared_with_me_contents(&state.db_pool, claims.id).await {
            Ok(list) => list,
            Err(e) => {
                tracing::error!("Failed to retrieve shared with me contents: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve shared with me contents")
                    .into_response();
            }
        };

        let drive_info = match repo::get_drive_info(&state.db_pool, claims.id).await {
            Ok(info) => info,
            Err(e) => {
                tracing::error!("Failed to retrieve drive info: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
            }
        };

        return ApiResponse::ok(serde_json::json!({
            "files_and_folders": files_and_folders,
            "drive_info": {
                "used_space": drive_info.used_space,
                "file_count": drive_info.file_count,
                "folder_count": drive_info.folder_count,
                "storage_limit_bytes": drive_info.storage_limit_bytes,
                "account_tier": drive_info.account_tier,
            },
            "full_path": [],
        }))
        .into_response();
    }
    let parent_id = match services::parse_uuid_or_error(&parent_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    tracing::info!("Requested parent folder ID: {:?}", parent_id);

    let files_folder_liste =
        repo::get_files_and_folders_list(&state.db_pool, claims.id, parent_id).await;
    let files_and_folders = match files_folder_liste {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to retrieve files and folders list: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve files and folders list")
                .into_response();
        }
    };

    // full path
    let full_path = match repo::get_full_path(&state.db_pool, claims.id, parent_id).await {
        Ok(path) => {
            tracing::info!("Full path retrieved: {:?}", path);
            path
        }
        Err(e) => {
            tracing::error!("Failed to retrieve full path: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve full path").into_response();
        }
    };

    let drive_info = match repo::get_drive_info(&state.db_pool, claims.id).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to retrieve drive info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
        }
    };

    ApiResponse::ok(serde_json::json!({
        "files_and_folders": files_and_folders,
        "full_path": full_path,
        "drive_info": {
            "used_space": drive_info.used_space,
            "file_count": drive_info.file_count,
            "folder_count": drive_info.folder_count,
            "storage_limit_bytes": drive_info.storage_limit_bytes,
            "account_tier": drive_info.account_tier,
        },
    }))
    .into_response()
}

pub async fn get_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<String>,
) -> Response {
    if folder_id.eq_ignore_ascii_case("root") {
        let folder_contents =
            match repo::get_folder_contents(&state.db_pool, claims.id, None).await {
                Ok(list) => list,
                Err(e) => {
                    tracing::error!("Failed to retrieve root folder contents: {:?}", e);
                    return ApiResponse::internal_error("Failed to retrieve folder contents")
                        .into_response();
                }
            };

        return ApiResponse::ok(serde_json::json!({
            "folder_contents": folder_contents
        }))
        .into_response();
    }

    let folder_id_opt = match services::parse_uuid_or_error(&folder_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    let folder_id = match folder_id_opt {
        Some(id) => id,
        None => {
            return ApiResponse::bad_request("Invalid folder_id").into_response();
        }
    };

    let has_access = match repo::user_has_folder_access(&state.db_pool, claims.id, folder_id).await {
        Ok(access) => access,
        Err(e) => {
            tracing::error!("Failed to check folder access: {:?}", e);
            return ApiResponse::internal_error("Failed to verify folder access").into_response();
        }
    };

    if !has_access {
        return ApiResponse::not_found("Folder not found or access denied").into_response();
    }

    let folder_contents =
        match repo::get_folder_contents(&state.db_pool, claims.id, Some(folder_id)).await {
            Ok(list) => list,
            Err(e) => {
                tracing::error!("Failed to retrieve folder contents: {:?}", e);
                return ApiResponse::internal_error("Failed to retrieve folder contents")
                    .into_response();
            }
        };

    ApiResponse::ok(serde_json::json!({
        "folder_contents": folder_contents
    }))
    .into_response()
}

#[derive(Deserialize)]
pub struct AbortUploadRequest {
    file_id: Uuid,
}
pub async fn abort_upload_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<AbortUploadRequest>,
) -> Response {
    // transfer-tracking removed: no Redis decrement here

    match repo::abort_file_upload(
        &state.db_pool,
        &state.storage_client,
        claims.id,
        body.file_id,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("Upload aborted successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found or access denied").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to abort upload: {:?}", e);
            ApiResponse::internal_error("Failed to abort upload").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct DeleteFileRequest {
    file_id: Uuid,
}
pub async fn delete_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<DeleteFileRequest>,
) -> Response {
    // transfer-tracking removed: deletions no longer blocked by Redis
    match repo::delete_file(&state.db_pool, &state.storage_client, claims.id, body.file_id).await {
        Ok(_) => ApiResponse::ok("File deleted successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("File not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete file: {:?}", e);
            ApiResponse::internal_error("Failed to delete file").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct DeleteFolderRequest {
    folder_id: Uuid,
}
pub async fn delete_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<DeleteFolderRequest>,
) -> Response {
    // transfer-tracking removed: deletions no longer blocked by Redis
    match repo::delete_folder(&state.db_pool, claims.id, body.folder_id).await {
        Ok(_) => ApiResponse::ok("Folder deleted successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("Folder not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete folder: {:?}", e);
            ApiResponse::internal_error("Failed to delete folder").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct RenameFileRequest {
    file_id: Uuid,
    new_encrypted_metadata: String,
}
pub async fn rename_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<RenameFileRequest>,
) -> Response {
    match repo::rename_file(
        &state.db_pool,
        claims.id,
        body.file_id,
        &body.new_encrypted_metadata,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("File renamed successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("File not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to rename file: {:?}", e);
            ApiResponse::internal_error("Failed to rename file").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct RenameFolderRequest {
    folder_id: Uuid,
    new_encrypted_metadata: String,
}
pub async fn rename_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<RenameFolderRequest>,
) -> Response {
    // Validate folder_id is a valid UUID (prevents injection attempts)
    if body.folder_id.is_nil() {
        return ApiResponse::bad_request("Invalid folder_id").into_response();
    }

    // Validate encrypted_metadata is not empty
    if body.new_encrypted_metadata.trim().is_empty() {
        return ApiResponse::bad_request("Encrypted metadata cannot be empty").into_response();
    }

    match repo::rename_folder(
        &state.db_pool,
        claims.id,
        body.folder_id,
        &body.new_encrypted_metadata,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("Folder renamed successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("Folder not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to rename folder: {:?}", e);
            ApiResponse::internal_error("Failed to rename folder").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct MoveFileRequest {
    file_id: Uuid,
    new_parent_folder_id: String,
}
pub async fn move_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<MoveFileRequest>,
) -> Response {
    let new_parent_folder_id = match services::parse_uuid_or_error(&body.new_parent_folder_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    match repo::move_file(
        &state.db_pool,
        claims.id,
        body.file_id,
        new_parent_folder_id,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("File moved successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File or target folder not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to move file: {:?}", e);
            ApiResponse::internal_error("Failed to move file").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct MoveFolderRequest {
    folder_id: Uuid,
    new_parent_folder_id: String,
}
pub async fn move_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<MoveFolderRequest>,
) -> Response {
    let new_parent_folder_id = match services::parse_uuid_or_error(&body.new_parent_folder_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    match repo::move_folder(
        &state.db_pool,
        claims.id,
        body.folder_id,
        new_parent_folder_id,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("Folder moved successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder or target folder not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to move folder: {:?}", e);
            ApiResponse::internal_error("Failed to move folder").into_response()
        }
    }
}

pub async fn get_file_info_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<String>,
) -> Response {
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid file_id").into_response();
        }
    };

    match repo::get_file_info(&state.db_pool, claims.id, file_id).await {
        Ok(file_info) => ApiResponse::ok(file_info).into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found or access denied").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to get file info: {:?}", e);
            ApiResponse::internal_error("Failed to get file info").into_response()
        }
    }
}

pub async fn download_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<String>,
) -> Response {
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid file_id").into_response();
        }
    };

    // Récupérer les informations du fichier
    let file_info = match repo::get_file_info(&state.db_pool, claims.id, file_id).await {
        Ok(info) => info,
        Err(sqlx::Error::RowNotFound) => {
            crate::metrics::track_file_download(false);
            return ApiResponse::not_found("File not found or access denied").into_response();
        }
        Err(e) => {
            tracing::error!("Failed to get file info: {:?}", e);
            crate::metrics::track_file_download(false);
            return ApiResponse::internal_error("Failed to get file info").into_response();
        }
    };

    let chunks = match file_info.get("chunks").and_then(|c| c.as_array()) {
        Some(c) => c.clone(),
        None => {
            return ApiResponse::internal_error("Invalid file structure").into_response();
        }
    };

    // Track successful download (file exists and chunks are valid)
    crate::metrics::track_file_download(true);
    // Créer un stream qui télécharge et envoie chaque chunk
    // buffer_unordered(2) limite le nombre de chunks chargés en avance
    let stream = futures::stream::iter(chunks)
        .map(move |chunk_info| {
            let storage = state.storage_client.clone();
            async move {
                let s3_key = chunk_info.get("s3_key")?.as_str()?;

                match storage.download_line(s3_key).await {
                    Ok((bytes, _metadata)) => Some(Ok::<_, std::io::Error>(bytes)),
                    Err(e) => {
                        tracing::error!("Failed to download chunk {}: {:?}", s3_key, e);
                        None
                    }
                }
            }
        })
        .buffer_unordered(2) // Limite à 2 chunks chargés en avance pour réduire l'utilisation RAM
        .filter_map(|x| async move { x });

    let body = Body::from_stream(stream);

    let filename = file_info
        .get("encrypted_metadata")
        .and_then(|m| m.as_str())
        .unwrap_or("download");
    let safe_filename = sanitize_content_disposition_filename(filename);

    axum::response::Response::builder()
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", safe_filename),
        )
        .body(body)
        .unwrap()
}

pub async fn download_chunk_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(s3_key): Path<String>,
) -> Response {
    // Vérifier que l'utilisateur a accès au fichier associé à ce chunk
    let has_access = match repo::user_has_chunk_access(&state.db_pool, claims.id, &s3_key).await {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Failed to check chunk access: {:?}", e);
            return ApiResponse::internal_error("Failed to verify access").into_response();
        }
    };

    if !has_access {
        return ApiResponse::not_found("Chunk not found or access denied").into_response();
    }

    // Mesurer la durée de download du chunk depuis S3
    let download_start = std::time::Instant::now();
    match state.storage_client.download_line(&s3_key).await {
        Ok((data, metadata)) => {
            let download_duration = download_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_download_duration(download_duration, true);
            ApiResponse::ok(serde_json::json!({
                "data": base64::engine::general_purpose::STANDARD.encode(&data),
                "iv": metadata.iv,
                "index": metadata.index,
            }))
            .into_response()
        }
        Err(e) => {
            let download_duration = download_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_download_duration(download_duration, false);
            tracing::error!("Failed to download chunk: {:?}", e);
            ApiResponse::internal_error("Failed to download chunk").into_response()
        }
    }
}

pub async fn download_chunk_binary_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(s3_key): Path<String>,
) -> Response {
    // Vérifier que l'utilisateur a accès au fichier associé à ce chunk
    let has_access = match repo::user_has_chunk_access(&state.db_pool, claims.id, &s3_key).await {
        Ok(exists) => exists,
        Err(e) => {
            tracing::error!("Failed to check chunk access: {:?}", e);
            return ApiResponse::internal_error("Failed to verify access").into_response();
        }
    };

    if !has_access {
        return ApiResponse::not_found("Chunk not found or access denied").into_response();
    }

    // Mesurer la durée de download du chunk depuis S3
    let download_start = std::time::Instant::now();
    match state.storage_client.download_line(&s3_key).await {
        Ok((data, metadata)) => {
            let download_duration = download_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_download_duration(download_duration, true);

            axum::response::Response::builder()
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header("x-chunk-index", metadata.index)
                .header("x-chunk-iv", metadata.iv.unwrap_or_default())
                .body(Body::from(data))
                .unwrap()
        }
        Err(e) => {
            let download_duration = download_start.elapsed().as_secs_f64();
            crate::metrics::track_chunk_download_duration(download_duration, false);
            tracing::error!("Failed to download chunk: {:?}", e);
            ApiResponse::internal_error("Failed to download chunk").into_response()
        }
    }
}

pub async fn get_folder_contents_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<String>,
) -> Response {
    let folder_id = match services::parse_uuid_or_error(&folder_id) {
        Ok(id) => id,
        Err(err) => {
            return ApiResponse::bad_request(err).into_response();
        }
    };

    if let Some(fid) = folder_id {
        let has_access = match repo::user_has_folder_access(&state.db_pool, claims.id, fid).await {
            Ok(access) => access,
            Err(e) => {
                tracing::error!("Failed to check folder access: {:?}", e);
                return ApiResponse::internal_error("Failed to verify folder access").into_response();
            }
        };
        if !has_access {
            return ApiResponse::forbidden("Access denied").into_response();
        }
    }

    match repo::get_folder_contents_recursive(&state.db_pool, claims.id, folder_id).await {
        Ok(contents) => ApiResponse::ok(serde_json::json!({
            "folder_id": folder_id,
            "contents": contents,
        }))
        .into_response(),
        Err(e) => {
            tracing::error!("Failed to get folder contents: {:?}", e);
            ApiResponse::internal_error("Failed to get folder contents").into_response()
        }
    }
}

pub async fn finalize_upload_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path((file_id, etat)): Path<(String, String)>,
) -> Response {
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid file_id").into_response();
        }
    };

    match etat.as_str() {
        "aborted" => {
            // If upload was aborted, clean up
            match repo::abort_file_upload(
                &state.db_pool,
                &state.storage_client,
                claims.id,
                file_id,
            )
            .await
            {
                Ok(_) => {
                    crate::metrics::track_file_upload(false, 0);
                    ApiResponse::ok("File upload aborted successfully").into_response()
                }
                Err(e) => {
                    tracing::error!("Failed to abort file upload: {:?}", e);
                    ApiResponse::internal_error("Failed to abort file upload").into_response()
                }
            }
        }
        "completed" => {
            // proceed to finalize
            match repo::finalize_file_upload(&state.db_pool, claims.id, file_id).await {
                Ok(_) => {
                    // Récupérer la taille du fichier pour les métriques
                    let file_size = repo::get_file_size(&state.db_pool, file_id)
                        .await
                        .unwrap_or(0);

                    crate::metrics::track_file_upload(true, file_size as u64);
                    ApiResponse::ok("File upload finalized successfully").into_response()
                }
                Err(sqlx::Error::RowNotFound) => {
                    ApiResponse::not_found("File not found or access denied").into_response()
                }
                Err(e) => {
                    tracing::error!("Failed to finalize file upload: {:?}", e);
                    crate::metrics::track_file_upload(false, 0);
                    ApiResponse::internal_error("Failed to finalize file upload").into_response()
                }
            }
        }
        _ => {
            ApiResponse::bad_request(
                "Invalid etat value (expected 'aborted' or 'completed')",
            )
            .into_response()
        }
    }
}


#[derive(Deserialize)]
pub struct RestoreFileRequest {
    pub file_id: Uuid,
}

#[derive(Deserialize)]
pub struct RestoreFolderRequest {
    pub folder_id: Uuid,
}

pub async fn restore_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<RestoreFileRequest>,
) -> Response {
    match repo::restore_file_from_corbeille(&state.db_pool, claims.id, req.file_id).await {
        Ok(_) => ApiResponse::ok("File restored successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found in corbeille").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to restore file: {:?}", e);
            ApiResponse::internal_error("Failed to restore file").into_response()
        }
    }
}

pub async fn restore_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<RestoreFolderRequest>,
) -> Response {
    match repo::restore_folder_from_corbeille(&state.db_pool, claims.id, req.folder_id).await {
        Ok(_) => ApiResponse::ok("Folder restored successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder not found in corbeille").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to restore folder: {:?}", e);
            ApiResponse::internal_error("Failed to restore folder").into_response()
        }
    }
}

pub async fn empty_trash_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Response {
    match repo::empty_corbeille(&state.db_pool, &state.storage_client, claims.id).await {
        Ok(_) => ApiResponse::ok("Corbeille emptied successfully").into_response(),
        Err(e) => {
            tracing::error!("Failed to empty corbeille: {:?}", e);
            ApiResponse::internal_error("Failed to empty corbeille").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct ShareFolderRequest {
    pub folder_id: Uuid,
    pub contact_id: Uuid,
    pub encrypted_item_key: String,
    pub access_level: String,
}

#[derive(Deserialize)]
pub struct ShareFileRequest {
    pub file_id: Uuid,
    pub contact_id: Uuid,
    pub encrypted_item_key: String,
    pub access_level: String,
}

#[derive(Deserialize)]
pub struct FolderKeyBatch {
    pub folder_id: Uuid,
    pub encrypted_folder_key: String,
}

#[derive(Deserialize)]
pub struct FileKeyBatch {
    pub file_id: Uuid,
    pub encrypted_file_key: String,
}

#[derive(Deserialize)]
pub struct ShareFolderBatchRequest {
    pub folder_id: Uuid,
    pub contact_id: Uuid,
    pub access_level: String,
    pub folder_keys: Vec<FolderKeyBatch>,  // Toutes les clés des sous-dossiers rechiffrées
    pub file_keys: Vec<FileKeyBatch>,      // Toutes les clés des fichiers rechiffrées
}

pub async fn share_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<ShareFolderRequest>,
) -> Response {
    match repo::share_folder_with_contact(
        &state.db_pool,
        claims.id,
        body.folder_id,
        body.contact_id,
        &body.encrypted_item_key,
        &body.access_level,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("Folder shared successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder or contact not found").into_response()
        }
        Err(sqlx::Error::Protocol(msg)) => {
            ApiResponse::bad_request(&msg).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to share folder: {:?}", e);
            ApiResponse::internal_error("Failed to share folder").into_response()
        }
    }
}

pub async fn share_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<ShareFileRequest>,
) -> Response {
    match repo::share_file_with_contact(
        &state.db_pool,
        claims.id,
        body.file_id,
        body.contact_id,
        &body.encrypted_item_key,
        &body.access_level,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("File shared successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File or contact not found").into_response()
        }
        Err(sqlx::Error::Protocol(msg)) => {
            ApiResponse::bad_request(&msg).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to share file: {:?}", e);
            ApiResponse::internal_error("Failed to share file").into_response()
        }
    }
}

pub async fn share_folder_batch_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<ShareFolderBatchRequest>,
) -> Response {
    // Convertir les vecs en format attendu par repo::share_folder_batch
    let folder_keys: Vec<(Uuid, String)> = body.folder_keys
        .into_iter()
        .map(|fk| (fk.folder_id, fk.encrypted_folder_key))
        .collect();

    let file_keys: Vec<(Uuid, String)> = body.file_keys
        .into_iter()
        .map(|fk| (fk.file_id, fk.encrypted_file_key))
        .collect();

    match repo::share_folder_batch(
        &state.db_pool,
        claims.id,
        body.folder_id,
        body.contact_id,
        &body.access_level,
        folder_keys,
        file_keys,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("Folder and contents shared successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder or contact not found").into_response()
        }
        Err(sqlx::Error::Protocol(msg)) => {
            ApiResponse::bad_request(&msg).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to share folder batch: {:?}", e);
            ApiResponse::internal_error("Failed to share folder").into_response()
        }
    }
}


pub async fn get_public_key_handler_by_email(
    State(state): State<AppState>,
    _claims: Claims,
    Path(email): Path<String>,
) -> Response {
    let user_info = match crate::auth::repo::get_user_by_email(&state.db_pool, &email).await {
        Ok(user) => user,
        Err(sqlx::Error::RowNotFound) => {
            return ApiResponse::not_found("User not found").into_response();
        }
        Err(e) => {
            tracing::error!("Failed to retrieve user info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve user info").into_response();
        }
    };
    ApiResponse::ok(serde_json::json!({
        "id": user_info.id,
        "username": user_info.username,
        "public_key": user_info.public_key,
    })).into_response()
}

/// Récupère la liste des utilisateurs ayant accès à un dossier (pour le partage dynamique)
pub async fn get_folder_shared_users_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<String>,
) -> Response {
    let folder_id = match Uuid::parse_str(&folder_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid folder_id").into_response();
        }
    };

    match repo::get_folder_shared_users(&state.db_pool, claims.id, folder_id).await {
        Ok(users) => {
            // Récupérer les clés publiques pour chaque utilisateur
            let mut users_with_keys = Vec::new();
            for (user_id, access_level) in users {
                if let Ok(user_info) = crate::auth::repo::get_user_by_id(&state.db_pool, user_id).await {
                    users_with_keys.push(serde_json::json!({
                        "user_id": user_id,
                        "access_level": access_level,
                        "public_key": user_info.public_key,
                        "username": user_info.username,
                    }));
                }
            }
            ApiResponse::ok(serde_json::json!({
                "shared_users": users_with_keys
            })).into_response()
        }
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder not found or access denied").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to get folder shared users: {:?}", e);
            ApiResponse::internal_error("Failed to get folder shared users").into_response()
        }
    }
}

/// Récupère les informations de partage d'un fichier (pour le panneau InfoItem)
pub async fn get_file_info_item_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<String>,
) -> Response {
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid file_id").into_response();
        }
    };

    match repo::get_file_shared_users(&state.db_pool, claims.id, file_id).await {
        Ok(users) => {
            let mut shared_users_list: Vec<serde_json::Value> = Vec::new();

            for (user_id, access_level) in users {
                if let Ok(user_info) = crate::auth::repo::get_user_by_id(&state.db_pool, user_id).await {
                    // construire la liste enrichie ici
                    shared_users_list.push(serde_json::json!({
                        "user_id": user_id,
                        "permission": access_level,
                        "public_key": user_info.public_key,
                        "username": user_info.username,
                    }) );
                }
            }
            

            ApiResponse::ok(serde_json::json!({
                "shared_users": shared_users_list
            })).into_response()
        }
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found or access denied").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to get file shared users: {:?}", e);
            ApiResponse::internal_error("Failed to get file shared users").into_response()
        }
    }
}

/// Récupère les informations de partage d'un dossier (pour le panneau InfoItem)
pub async fn get_folder_info_item_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<String>,
) -> Response {
    let folder_id = match Uuid::parse_str(&folder_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid folder_id").into_response();
        }
    };

    match repo::get_folder_shared_users(&state.db_pool, claims.id, folder_id).await {
        Ok(users) => {
            let mut shared_users_list: Vec<serde_json::Value> = Vec::new();

            for (user_id, access_level) in users {
                if let Ok(user_info) = crate::auth::repo::get_user_by_id(&state.db_pool, user_id).await {
                    // construire la liste enrichie ici
                    shared_users_list.push(serde_json::json!({
                        "user_id": user_id,
                        "permission": access_level,
                        "public_key": user_info.public_key,
                        "username": user_info.username,
                    }) );
                }
            }
            ApiResponse::ok(serde_json::json!({
                "shared_users": shared_users_list
            })).into_response()
        }
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder not found or access denied").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to get folder shared users: {:?}", e);
            ApiResponse::internal_error("Failed to get folder shared users").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct PropagateFileAccessRequest {
    pub file_id: Uuid,
    pub user_keys: Vec<UserKey>,
}

#[derive(Deserialize)]
pub struct UserKey {
    pub user_id: Uuid,
    pub encrypted_key: String,
    pub access_level: String,
}

/// Propage les permissions d'un fichier nouvellement créé
pub async fn propagate_file_access_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<PropagateFileAccessRequest>,
) -> Response {
    let user_keys: Vec<(Uuid, String, String)> = body.user_keys
        .into_iter()
        .map(|uk| (uk.user_id, uk.encrypted_key, uk.access_level))
        .collect();

    match repo::propagate_file_access(&state.db_pool, claims.id, body.file_id, user_keys).await {
        Ok(_) => ApiResponse::ok("File access propagated successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found or access denied").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to propagate file access: {:?}", e);
            ApiResponse::internal_error("Failed to propagate file access").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct PropagateFolderAccessRequest {
    pub folder_id: Uuid,
    pub user_keys: Vec<UserKey>,
}

/// Propage les permissions d'un dossier nouvellement créé
pub async fn propagate_folder_access_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<PropagateFolderAccessRequest>,
) -> Response {
    let user_keys: Vec<(Uuid, String, String)> = body.user_keys
        .into_iter()
        .map(|uk| (uk.user_id, uk.encrypted_key, uk.access_level))
        .collect();

    match repo::propagate_folder_access(&state.db_pool, claims.id, body.folder_id, user_keys).await {
        Ok(_) => ApiResponse::ok("Folder access propagated successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder not found or access denied").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to propagate folder access: {:?}", e);
            ApiResponse::internal_error("Failed to propagate folder access").into_response()
        }
    }
}

/// Health check endpoint for Kubernetes readiness probe
/// Tests connectivity to PostgreSQL, Redis, and MinIO
#[instrument(skip(state))]
pub async fn health_check_handler(State(state): State<AppState>) -> Response {
    use std::time::Duration;

    // Test PostgreSQL
    let db_ok = tokio::time::timeout(
        Duration::from_secs(5),
        repo::health_check_db(&state.db_pool)
    )
    .await
    .is_ok();

    // Test Redis
    let redis_ok = tokio::time::timeout(
        Duration::from_secs(5),
        async {
            use redis::AsyncCommands;
            let mut con = state.redis_manager.clone();
            con.ping::<()>().await
        }
    )
    .await
    .is_ok();

    // Test MinIO/S3
    let s3_ok = tokio::time::timeout(
        Duration::from_secs(5),
        state.storage_client.health_check()
    )
    .await
    .is_ok();

    if db_ok && redis_ok && s3_ok {
        (axum::http::StatusCode::OK, "Ready").into_response()
    } else {
        info!("Health check failed - DB: {}, Redis: {}, S3: {}", db_ok, redis_ok, s3_ok);
        (axum::http::StatusCode::SERVICE_UNAVAILABLE, "Not ready").into_response()
    }
}

#[derive(Deserialize)]
pub struct RevokeAccessRequest {
    item_type: String,
    item_id: String,
    contact_id: String,
}

pub async fn revoke_access_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<RevokeAccessRequest>,
) -> Response {
    let item_uuid = match Uuid::parse_str(&body.item_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid item_id").into_response();
        }
    };
    let contact_uuid = match Uuid::parse_str(&body.contact_id) {
        Ok(id) => id,
        Err(_) => {
            return ApiResponse::bad_request("Invalid contact_id").into_response();
        }
    };

    let result = match body.item_type.as_str() {
        "file" => repo::revoke_file_access(&state.db_pool, claims.id, item_uuid, contact_uuid).await,
        "folder" => repo::revoke_folder_access(&state.db_pool, claims.id, item_uuid, contact_uuid).await,
        _ => {
            return ApiResponse::bad_request("Invalid item_type (expected 'file' or 'folder')").into_response();
        }
    };

    match result {
        Ok(_) => ApiResponse::ok("Access revoked successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Item or contact not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to revoke access: {:?}", e);
            ApiResponse::internal_error("Failed to revoke access").into_response()
        }
    }
}

// ========== RESTful Handlers (aliases pour API publique/tests) ==========

/// DELETE /files/{file_id} - Version RESTful de delete_file
pub async fn delete_file_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<Uuid>,
) -> Response {
    match repo::delete_file(&state.db_pool, &state.storage_client, claims.id, file_id).await {
        Ok(_) => ApiResponse::ok("File deleted successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("File not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete file: {:?}", e);
            ApiResponse::internal_error("Failed to delete file").into_response()
        }
    }
}

/// DELETE /folders/{folder_id} - Version RESTful de delete_folder
pub async fn delete_folder_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<Uuid>,
) -> Response {
    match repo::delete_folder(&state.db_pool, claims.id, folder_id).await {
        Ok(_) => ApiResponse::ok("Folder deleted successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("Folder not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to delete folder: {:?}", e);
            ApiResponse::internal_error("Failed to delete folder").into_response()
        }
    }
}

/// POST /files/{file_id}/share - Version RESTful de share_file
#[derive(Deserialize)]
pub struct ShareFileRestfulRequest {
    #[serde(rename = "contact_id")]
    pub recipient_user_id: Uuid,
    #[serde(rename = "encrypted_item_key")]
    pub encrypted_file_key: String,
    pub access_level: String,
}

pub async fn share_file_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<Uuid>,
    Json(body): Json<ShareFileRestfulRequest>,
) -> Response {
    match repo::share_file_with_contact(
        &state.db_pool,
        claims.id,
        file_id,
        body.recipient_user_id,
        &body.encrypted_file_key,
        &body.access_level,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("File shared successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File or contact not found").into_response()
        }
        Err(sqlx::Error::Protocol(msg)) => {
            ApiResponse::bad_request(&msg).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to share file: {:?}", e);
            ApiResponse::internal_error("Failed to share file").into_response()
        }
    }
}

/// POST /folders/{folder_id}/share - Version RESTful de share_folder
#[derive(Deserialize)]
pub struct ShareFolderRestfulRequest {
    #[serde(rename = "contact_id")]
    pub recipient_user_id: Uuid,
    #[serde(rename = "encrypted_item_key")]
    pub encrypted_folder_key: String,
    pub access_level: String,
}

pub async fn share_folder_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<Uuid>,
    Json(body): Json<ShareFolderRestfulRequest>,
) -> Response {
    match repo::share_folder_with_contact(
        &state.db_pool,
        claims.id,
        folder_id,
        body.recipient_user_id,
        &body.encrypted_folder_key,
        &body.access_level,
    )
    .await
    {
        Ok(_) => ApiResponse::ok("Folder shared successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder or contact not found").into_response()
        }
        Err(sqlx::Error::Protocol(msg)) => {
            ApiResponse::bad_request(&msg).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to share folder: {:?}", e);
            ApiResponse::internal_error("Failed to share folder").into_response()
        }
    }
}

/// DELETE /files/{file_id}/share/{user_id} - Révoquer accès fichier (RESTful)
pub async fn revoke_file_access_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path((file_id, user_id)): Path<(Uuid, Uuid)>,
) -> Response {
    match repo::revoke_file_access(&state.db_pool, claims.id, file_id, user_id).await {
        Ok(_) => ApiResponse::ok("File access revoked successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File or user not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to revoke file access: {:?}", e);
            ApiResponse::internal_error("Failed to revoke file access").into_response()
        }
    }
}

/// DELETE /folders/{folder_id}/share/{user_id} - Révoquer accès dossier (RESTful)
pub async fn revoke_folder_access_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path((folder_id, user_id)): Path<(Uuid, Uuid)>,
) -> Response {
    match repo::revoke_folder_access(&state.db_pool, claims.id, folder_id, user_id).await {
        Ok(_) => ApiResponse::ok("Folder access revoked successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder or user not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to revoke folder access: {:?}", e);
            ApiResponse::internal_error("Failed to revoke folder access").into_response()
        }
    }
}

// ========== PATCH Handlers for Rename ==========

#[derive(Deserialize)]
pub struct RenameItemRequest {
    pub new_encrypted_metadata: String,
}

/// PATCH /files/{file_id} - Renommer fichier
pub async fn rename_file_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<Uuid>,
    Json(body): Json<RenameItemRequest>,
) -> Response {
    match repo::rename_file(&state.db_pool, claims.id, file_id, &body.new_encrypted_metadata).await {
        Ok(_) => ApiResponse::ok("File renamed successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("File not found or access denied").into_response(),
        Err(e) => {
            tracing::error!("Failed to rename file {}: {:?}", file_id, e);
            ApiResponse::internal_error("Failed to rename file").into_response()
        }
    }
}

/// PATCH /folders/{folder_id} - Renommer dossier
pub async fn rename_folder_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<Uuid>,
    Json(body): Json<RenameItemRequest>,
) -> Response {
    match repo::rename_folder(&state.db_pool, claims.id, folder_id, &body.new_encrypted_metadata).await {
        Ok(_) => ApiResponse::ok("Folder renamed successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("Folder not found or access denied").into_response(),
        Err(e) => {
            tracing::error!("Failed to rename folder {}: {:?}", folder_id, e);
            ApiResponse::internal_error("Failed to rename folder").into_response()
        }
    }
}

// ========== PATCH Handlers for Move ==========

#[derive(Deserialize)]
pub struct MoveItemRequest {
    pub target_folder_id: Option<Uuid>,
}

/// PATCH /files/{file_id}/move - Déplacer fichier
pub async fn move_file_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<Uuid>,
    Json(body): Json<MoveItemRequest>,
) -> Response {
    match repo::move_file(&state.db_pool, claims.id, file_id, body.target_folder_id).await {
        Ok(_) => ApiResponse::ok("File moved successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("File or target folder not found").into_response(),
        Err(e) => {
            tracing::error!("Failed to move file {}: {:?}", file_id, e);
            ApiResponse::internal_error("Failed to move file").into_response()
        }
    }
}

/// PATCH /folders/{folder_id}/move - Déplacer dossier
pub async fn move_folder_restful_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<Uuid>,
    Json(body): Json<MoveItemRequest>,
) -> Response {
    match repo::move_folder(&state.db_pool, claims.id, folder_id, body.target_folder_id).await {
        Ok(_) => ApiResponse::ok("Folder moved successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => ApiResponse::not_found("Folder or target folder not found").into_response(),
        Err(sqlx::Error::Protocol(msg)) => ApiResponse::bad_request(&msg).into_response(),
        Err(e) => {
            tracing::error!("Failed to move folder {}: {:?}", folder_id, e);
            ApiResponse::internal_error("Failed to move folder").into_response()
        }
    }
}

/// GET /files - Liste tous les fichiers accessibles par l'utilisateur
pub async fn list_files_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Response {
    match repo::get_files_list(&state.db_pool, claims.id).await {
        Ok(files) => ApiResponse::ok(files).into_response(),
        Err(e) => {
            tracing::error!("Failed to list files: {:?}", e);
            ApiResponse::internal_error("Failed to list files").into_response()
        }
    }
}

/// Accepter un fichier partagé (le marque comme accepté → apparaît dans le drive principal)
pub async fn accept_shared_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<String>,
) -> Response {
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => return ApiResponse::bad_request("Invalid file_id").into_response(),
    };

    match repo::accept_shared_file(&state.db_pool, claims.id, file_id).await {
        Ok(_) => ApiResponse::ok("File accepted").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found or not shared with you").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to accept shared file: {:?}", e);
            ApiResponse::internal_error("Failed to accept shared file").into_response()
        }
    }
}

/// Accepter un dossier partagé (l'ancre à la racine + propage aux enfants)
pub async fn accept_shared_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<String>,
) -> Response {
    let folder_id = match Uuid::parse_str(&folder_id) {
        Ok(id) => id,
        Err(_) => return ApiResponse::bad_request("Invalid folder_id").into_response(),
    };

    match repo::accept_shared_folder(&state.db_pool, claims.id, folder_id).await {
        Ok(_) => ApiResponse::ok("Folder accepted").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder not found or not shared with you").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to accept shared folder: {:?}", e);
            ApiResponse::internal_error("Failed to accept shared folder").into_response()
        }
    }
}

pub async fn reject_shared_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(file_id): Path<String>,
) -> Response {
    let file_id = match Uuid::parse_str(&file_id) {
        Ok(id) => id,
        Err(_) => return ApiResponse::bad_request("Invalid file_id").into_response(),
    };

    // refuser l'accès au fichier partagé (revient au meme que de suppprimer le fichier du drive de l'utilisateur)
    match repo::reject_shared_file(&state.db_pool, claims.id, file_id).await {
        Ok(_) => ApiResponse::ok("File rejected").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found or not shared with you").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to reject shared file: {:?}", e);
            ApiResponse::internal_error("Failed to reject shared file").into_response()
        }
    }
}

pub async fn reject_shared_folder_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(folder_id): Path<String>,
) -> Response {
    let folder_id = match Uuid::parse_str(&folder_id) {
        Ok(id) => id,
        Err(_) => return ApiResponse::bad_request("Invalid folder_id").into_response(),
    };

    match repo::reject_shared_folder(&state.db_pool, claims.id, folder_id).await {
        Ok(_) => ApiResponse::ok("Folder rejected").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder not found or not shared with you").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to reject shared folder: {:?}", e);
            ApiResponse::internal_error("Failed to reject shared folder").into_response()
        }
    }
}