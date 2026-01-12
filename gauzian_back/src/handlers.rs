use axum::extract::{Json, State, Path};
use axum::response::{IntoResponse, Response};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::{info, instrument};
use uuid::Uuid;

use crate::{auth, jwt, response::ApiResponse, state::AppState,drive};
use base64::Engine;

use axum::http::HeaderMap;

#[derive(Serialize)]
pub struct LoginResponse {
    pub message: String,
    pub user_id: Uuid,
    pub encrypted_private_key: String,
    pub private_key_salt: String,
    pub iv: String,
    pub public_key: String,
}
#[derive(Serialize)]
pub struct RegisterResponse {
    pub message: String,
    pub user_id: Uuid,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub encrypted_private_key: String,
    pub public_key: String,
    pub email: String,
    pub private_key_salt: String,
    pub iv: String,
    pub encrypted_record_key: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>
)-> Response {   
    let user = match auth::get_user_by_email(&state.db_pool, &req.email).await {
        Ok(user) => user,
        Err(_) => {
            tracing::warn!("Email not found: {}", req.email);
            return ApiResponse::unauthorized("Invalid email or password").into_response();
        }
    };

    match auth::verify_password(&req.password, &user.password_hash, &user.auth_salt.unwrap_or_default()) {
        true => {
            let token = jwt::create_jwt(user.id, "user", state.jwt_secret.as_bytes()).unwrap();
            info!(%user.id, "Login successful, setting cookie");
            return ApiResponse::ok(LoginResponse {
                message: "Login successful".to_string(),
                user_id: user.id,
                encrypted_private_key: user.encrypted_private_key,
                private_key_salt: user.private_key_salt,
                iv: user.iv,
                public_key: user.public_key,
            })
            .with_token(token)
            .into_response();
        }
        false => {
            tracing::warn!("Login failed for email: {}", req.email);
            return ApiResponse::unauthorized("Invalid email or password").into_response();
        }
    }
}

pub async fn register_handler(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Response {
    // hash the password
    let salt = auth::generate_salt().await; // Await the future
    let password_hash = auth::hash_password(&req.password, &salt);

    let new_user = auth::NewUser {
        username: req.username,
        password: req.password,
        password_hash: Some(password_hash),
        encrypted_private_key: req.encrypted_private_key,
        public_key: req.public_key,
        email: req.email,
        encrypted_settings: None,
        private_key_salt: req.private_key_salt,
        auth_salt: Some(salt),
        iv: req.iv,
        encrypted_record_key: req.encrypted_record_key,
    };

    let user_id = match auth::create_user(&state.db_pool, new_user).await {
        Ok(id) => id,
        Err(e) => {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.message().contains("duplicate") || db_err.message().contains("unique") {
                    tracing::warn!("Duplicate user attempted");
                    return ApiResponse::conflict("Username or email already exists")
                        .into_response();
                }
            }
            tracing::error!("Database error: {:?}", e);
            return ApiResponse::internal_error("Failed to create user").into_response();
        }
    };

    println!("Created user with ID: {}", user_id);
    let token = jwt::create_jwt(user_id, "user", state.jwt_secret.as_bytes()).unwrap();

    info!(%user_id, "Registration successful, setting cookie");
    ApiResponse::ok(RegisterResponse {
        message: "Registration successful".to_string(),
        user_id,
    })
    .with_token(token)
    .into_response()
}
#[instrument]
pub async fn protected_handler(claims: jwt::Claims) -> ApiResponse<String> {
    info!(user_id = %claims.id, "Access granted via cookie");

    ApiResponse::ok(format!(
        "Bienvenue {} ! Tu es authentifié via Cookie.",
        claims.id
    ))
}

pub async fn auto_login_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
) -> ApiResponse<String> {
    info!(user_id = %claims.id, "Access granted via Authorization header");

    // générer un nouveau token
    let token = jwt::create_jwt(claims.id, &claims.role, state.jwt_secret.as_bytes()).unwrap();

    ApiResponse::ok(format!(
        "Bienvenue {} ! Tu es authentifié via Authorization header.",
        claims.id
    ))
    .with_token(token)
}

pub async fn logout_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
) -> ApiResponse<String> {
    let now = Utc::now().timestamp() as usize;
    let ttl_seconds = claims.exp.saturating_sub(now);

    if ttl_seconds > 0 {
        if let Err(e) = auth::blacklist_token(&state.redis_client, &claims.jti, ttl_seconds).await {
            tracing::warn!("Failed to blacklist token in Redis: {e}");
        }
    }

    ApiResponse::ok("Logged out".to_string())
}



pub async fn info_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
) -> Response {
    match auth::get_user_by_id(&state.db_pool, claims.id).await {
        Ok(user_info) => ApiResponse::ok(user_info).into_response(),
        Err(sqlx::Error::RowNotFound) => {
            tracing::warn!(user_id = %claims.id, "User info not found");
            ApiResponse::not_found("User not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to retrieve user info: {:?}", e);
            ApiResponse::internal_error("Failed to retrieve user info").into_response()
        }
    }
}


#[derive(Deserialize)]
pub struct InitializeFileRequest {
    size: i64,
    encrypted_metadata: String,
    mime_type: String,
    folder_id: String,
    encrypted_file_key: String,
}

pub async fn initialize_file_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
    _headers: HeaderMap,
    Json(body): Json<InitializeFileRequest>,
) -> Response {
    let folder_id = {
        let s = body.folder_id.trim();
        if s.is_empty() || s.eq_ignore_ascii_case("null") || s.eq_ignore_ascii_case("root") {
            None
        } else {
            match Uuid::parse_str(s) {
                Ok(id) if id.is_nil() => None,
                Ok(id) => Some(id),
                Err(_) => {
                    return ApiResponse::bad_request("Invalid parent_id (expected UUID or 'null')")
                        .into_response();
                }
            }
        }
    };
    // Vous pouvez accéder aux headers via `headers` et au body via `body`
    let file_id = match drive::initialize_file_in_db(&state.db_pool, claims.id, body.size, &body.encrypted_metadata, &body.mime_type, folder_id, &body.encrypted_file_key).await {
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



pub async fn get_account_and_drive_info_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
    Path(parent_id): Path<String>,
) -> Response {

    let parent_id = {
        let s = parent_id.trim();
        if s.is_empty() || s.eq_ignore_ascii_case("null") || s.eq_ignore_ascii_case("root") {
            None
        } else {
            match Uuid::parse_str(s) {
                Ok(id) if id.is_nil() => None,
                Ok(id) => Some(id),
                Err(_) => {
                    return ApiResponse::bad_request("Invalid parent_id (expected UUID or 'null')")
                        .into_response();
                }
            }
        }
    };

    tracing::info!("Requested parent folder ID: {:?}", parent_id);

    // user info
    let user_info = match auth::get_user_by_id(&state.db_pool, claims.id).await {
        Ok(user) => user,
        Err(e) => {
            tracing::error!("Failed to retrieve user info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve user info").into_response();
        }
    };
    
    let drive_info = match drive::get_drive_info(&state.db_pool, claims.id).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to retrieve drive info: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve drive info").into_response();
        }
    };

    let files_folder_liste = drive::get_files_and_folders_list(&state.db_pool, claims.id, parent_id).await;
    let files_and_folders = match files_folder_liste {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to retrieve files and folders list: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve files and folders list").into_response();
        }
    };


    let full_path = match drive::get_full_path(&state.db_pool, claims.id, parent_id).await {
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
            "used_space": drive_info.0,
            "file_count": drive_info.1,
            "folder_count": drive_info.2,
        },
        "files_and_folders": files_and_folders,
        "full_path": full_path,
    })).into_response()
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
    _claims: jwt::Claims,
    Json(body): Json<UploadChunkRequest>,
) -> Response {
    let chunk_data = match base64::engine::general_purpose::STANDARD.decode(&body.chunk_data) {
        Ok(data) => data,
        Err(e) => {
            tracing::error!("Failed to decode chunk data: {:?}", e);
            return ApiResponse::bad_request("Invalid chunk data").into_response();
        }
    };

    let storage_client = &state.storage_client;

    let meta_data_s3 = match storage_client
        .upload_line(&chunk_data, body.index.to_string(), body.iv.clone())
        .await
    {
        Ok(meta) => meta,
        Err(e) => {
            tracing::error!("Failed to upload chunk to storage: {:?}", e);
            return ApiResponse::internal_error("Failed to upload chunk").into_response();
        }
    };

    // Enregistrer la clé S3 dans la base
    let s3_record_id = match drive::save_chunk_metadata(&state.db_pool, body.file_id, body.index, &meta_data_s3.s3_id).await {
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
    })).into_response()
}

#[derive(Deserialize)]
pub struct CreateFolderRequest {
    encrypted_metadata: String,
    parent_folder_id: String,
    encrypted_folder_key: String,
}
pub async fn create_folder_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
    Json(body): Json<CreateFolderRequest>,
) -> Response {

    let parent_folder_id = {
        let s = body.parent_folder_id.trim();
        if s.is_empty() || s.eq_ignore_ascii_case("null") || s.eq_ignore_ascii_case("root") {
            None
        } else {
            match Uuid::parse_str(s) {
                Ok(id) if id.is_nil() => None,
                Ok(id) => Some(id),
                Err(_) => {
                    return ApiResponse::bad_request("Invalid parent_folder_id (expected UUID or 'null')")
                        .into_response();
                }
            }
        }
    };


    let folder_id = match drive::create_folder_in_db(
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
    claims: jwt::Claims,
    Path(parent_id): Path<String>,
) -> Response {

    let parent_id = {
        let s = parent_id.trim();
        if s.is_empty() || s.eq_ignore_ascii_case("null") || s.eq_ignore_ascii_case("root") {
            None
        } else {
            match Uuid::parse_str(s) {
                Ok(id) if id.is_nil() => None,
                Ok(id) => Some(id),
                Err(_) => {
                    return ApiResponse::bad_request("Invalid parent_id (expected UUID or 'null')")
                        .into_response();
                }
            }
        }
    };

    tracing::info!("Requested parent folder ID: {:?}", parent_id);

    let files_folder_liste = drive::get_files_and_folders_list(&state.db_pool, claims.id, parent_id).await;
    let files_and_folders = match files_folder_liste {
        Ok(list) => list,
        Err(e) => {
            tracing::error!("Failed to retrieve files and folders list: {:?}", e);
            return ApiResponse::internal_error("Failed to retrieve files and folders list").into_response();
        }
    };

    // full path
    let full_path = match drive::get_full_path(&state.db_pool, claims.id, parent_id).await {
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
        "files_and_folders": files_and_folders,
        "full_path": full_path,
    })).into_response()
}

#[derive(Deserialize)]
pub struct AbortUploadRequest {
    file_id: Uuid,
}
pub async fn abort_upload_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
    Json(body): Json<AbortUploadRequest>,
) -> Response {
    match drive::abort_file_upload(&state.db_pool, &state.storage_client, claims.id, body.file_id).await {
        Ok(_) => ApiResponse::ok("Upload aborted successfully").into_response(),
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
    claims: jwt::Claims,
    Json(body): Json<DeleteFileRequest>,
) -> Response {
    match drive::delete_file(&state.db_pool, &state.storage_client, claims.id, body.file_id).await {
        Ok(_) => ApiResponse::ok("File/Folder deleted successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("File not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to delete file/folder: {:?}", e); 
            ApiResponse::internal_error("Failed to delete file/folder").into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct DeleteFolderRequest {
    folder_id: Uuid,
}
pub async fn delete_folder_handler(
    State(state): State<AppState>,
    claims: jwt::Claims,
    Json(body): Json<DeleteFolderRequest>,
) -> Response {
    match drive::delete_folder(&state.db_pool, &state.storage_client, claims.id, body.folder_id).await {
        Ok(_) => ApiResponse::ok("Folder deleted successfully").into_response(),
        Err(sqlx::Error::RowNotFound) => {
            ApiResponse::not_found("Folder not found").into_response()
        }
        Err(e) => {
            tracing::error!("Failed to delete folder: {:?}", e);
            ApiResponse::internal_error("Failed to delete folder").into_response()
        }
    }
}