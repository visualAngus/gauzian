use axum::{routing::{get, post}, Router};
use tower_http::trace::TraceLayer;

use crate::{handlers, state::AppState};

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/login", post(handlers::login_handler))
        .route("/register", post(handlers::register_handler))
        .route("/logout", post(handlers::logout_handler))
        .route("/protected", get(handlers::protected_handler))
        .route("/autologin", get(handlers::auto_login_handler))
        .route("/info", get(handlers::info_handler))
        .route("/drive/initialize_file", post(handlers::initialize_file_handler))
        .route("/drive/upload_chunk", post(handlers::upload_chunk_handler))
        
        .route("/drive/get_all_drive_info/{parent_id}", get(handlers::get_account_and_drive_info_handler))
        .route("/drive/create_folder", post(handlers::create_folder_handler))
        .route("/drive/get_file_folder/{parent_id}", get(handlers::get_file_folder_handler))
        .route("/drive/get_folder/{folder_id}", get(handlers::get_folder_handler))
        .route("/drive/file/{file_id}", get(handlers::get_file_info_handler))
        .route("/drive/download/{file_id}", get(handlers::download_file_handler))
        .route("/drive/finish_upload/{file_id}", post(handlers::finish_upload_handler))
        .route("/drive/download_chunk/{s3_key}", get(handlers::download_chunk_handler))
        .route("/drive/folder_contents/{folder_id}", get(handlers::get_folder_contents_handler))
        .route("/drive/abort_upload", post(handlers::abort_upload_handler))
        .route("/drive/delete_file", post(handlers::delete_file_handler))
        .route("/drive/delete_folder", post(handlers::delete_folder_handler))
        .route("/drive/rename_file", post(handlers::rename_file_handler))
        .route("/drive/rename_folder", post(handlers::rename_folder_handler))
        .route("/drive/move_file", post(handlers::move_file_handler))
        .route("/drive/move_folder", post(handlers::move_folder_handler))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
