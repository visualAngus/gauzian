// Routes du module drive
// Gestion des fichiers, dossiers, upload, download, partage

use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router
};
use crate::state::AppState;

use super::handlers;

/// Toutes les routes liées au drive (fichiers/dossiers)
/// Retourne un Router<AppState> qui sera composé dans routes.rs principal
pub fn drive_routes() -> Router<AppState> {
    // Routes d'upload avec limite de 2MB par chunk
    let upload_routes = Router::new()
        .route("/upload_chunk", post(handlers::upload_chunk_handler))
        .route("/upload_chunk_binary", post(handlers::upload_chunk_binary_handler))
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024)); // 2 MB max par chunk

    Router::new()
        // Gestion des fichiers
        .route("/initialize_file", post(handlers::initialize_file_handler))
        .merge(upload_routes)
        .route("/finalize_upload/{file_id}/{etat}", post(handlers::finalize_upload_handler))
        .route("/abort_upload", post(handlers::abort_upload_handler))
        .route("/file/{file_id}", get(handlers::get_file_info_handler))
        .route("/download/{file_id}", get(handlers::download_file_handler))
        .route("/download_chunk/{s3_key}", get(handlers::download_chunk_handler))
        .route("/download_chunk_binary/{s3_key}", get(handlers::download_chunk_binary_handler))
        .route("/delete_file", post(handlers::delete_file_handler))
        .route("/rename_file", post(handlers::rename_file_handler))
        .route("/move_file", post(handlers::move_file_handler))
        .route("/restore_file", post(handlers::restore_file_handler))
        .route("/share_file", post(handlers::share_file_handler))
        .route("/file/{file_id}/InfoItem", get(handlers::get_file_info_item_handler))
        // Gestion des dossiers
        .route("/create_folder", post(handlers::create_folder_handler))
        .route("/get_folder/{folder_id}", get(handlers::get_folder_handler))
        .route("/folder_contents/{folder_id}", get(handlers::get_folder_contents_handler))
        .route("/delete_folder", post(handlers::delete_folder_handler))
        .route("/rename_folder", post(handlers::rename_folder_handler))
        .route("/move_folder", post(handlers::move_folder_handler))
        .route("/restore_folder", post(handlers::restore_folder_handler))
        .route("/share_folder", post(handlers::share_folder_handler))
        .route("/share_folder_batch", post(handlers::share_folder_batch_handler))
        .route("/folder/{folder_id}/shared_users", get(handlers::get_folder_shared_users_handler))
        .route("/folder/{folder_id}/InfoItem", get(handlers::get_folder_info_item_handler))
        // Gestion des accès
        .route("/propagate_file_access", post(handlers::propagate_file_access_handler))
        .route("/propagate_folder_access", post(handlers::propagate_folder_access_handler))
        .route("/revoke-access", post(handlers::revoke_access_handler))
        // Vues globales
        .route("/get_all_drive_info/{parent_id}", get(handlers::get_account_and_drive_info_handler))
        .route("/get_file_folder/{parent_id}", get(handlers::get_file_folder_handler))
        .route("/empty_trash", post(handlers::empty_trash_handler))
}
