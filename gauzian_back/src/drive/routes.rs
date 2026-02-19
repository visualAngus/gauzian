// Routes du module drive
// Gestion des fichiers, dossiers, upload, download, partage

use axum::{
    extract::DefaultBodyLimit,
    routing::{get, patch, post},
    Router,
};
use crate::state::AppState;

use super::handlers;

/// Toutes les routes liées au drive (fichiers/dossiers)
/// Retourne un Router<AppState> qui sera composé dans routes.rs principal
pub fn drive_routes() -> Router<AppState> {
    // Routes d'upload avec limite de 6MB par chunk
    let upload_routes = Router::new()
        .route("/upload_chunk", post(handlers::upload_chunk_handler))
        .route("/upload_chunk_binary", post(handlers::upload_chunk_binary_handler))
        .route("/files/{file_id}/upload-chunk", post(handlers::upload_chunk_restful_handler))
        .layer(DefaultBodyLimit::max(6 * 1024 * 1024)); // 6 MB max par chunk

    Router::new()
        // ========== Gestion des fichiers (endpoints conservés pour compatibilité) ==========
        .route("/initialize_file", post(handlers::initialize_file_handler))
        .merge(upload_routes)
        .route("/finalize_upload/{file_id}/{etat}", post(handlers::finalize_upload_handler))
        .route("/abort_upload", post(handlers::abort_upload_handler))
        .route("/file/{file_id}", get(handlers::get_file_info_handler))
        .route("/download/{file_id}", get(handlers::download_file_handler))
        .route("/download_chunk/{s3_key}", get(handlers::download_chunk_handler))
        .route("/download_chunk_binary/{s3_key}", get(handlers::download_chunk_binary_handler))
        .route("/restore_file", post(handlers::restore_file_handler))
        .route("/file/{file_id}/InfoItem", get(handlers::get_file_info_item_handler))

        // ========== RESTful file endpoints (alias pour tests/API publique) ==========
        .route("/files/initialize", post(handlers::initialize_file_handler))  // POST /files/initialize
        .route("/files/{file_id}/move", patch(handlers::move_file_restful_handler))  // PATCH /files/{id}/move (AVANT route générique)
        .route("/files/{file_id}/download", get(handlers::download_file_handler))  // GET /files/{id}/download
        .route("/files/{file_id}/share", post(handlers::share_file_restful_handler))  // POST /files/{id}/share
        .route("/files/{file_id}/share/{user_id}", axum::routing::delete(handlers::revoke_file_access_handler))  // DELETE /files/{id}/share/{user_id}
        .route("/files/{file_id}", get(handlers::get_file_info_handler))      // GET /files/{id}
        .route("/files/{file_id}", axum::routing::delete(handlers::delete_file_restful_handler))  // DELETE /files/{id}
        .route("/files/{file_id}", patch(handlers::rename_file_restful_handler))  // PATCH /files/{id} (rename)
        .route("/files", get(handlers::list_files_handler))  // GET /files (liste tous les fichiers)

        // ========== Gestion des dossiers (endpoints conservés pour compatibilité) ==========
        .route("/create_folder", post(handlers::create_folder_handler))
        .route("/get_folder/{folder_id}", get(handlers::get_folder_handler))
        .route("/folder_contents/{folder_id}", get(handlers::get_folder_contents_handler))
        .route("/restore_folder", post(handlers::restore_folder_handler))
        .route("/share_folder_batch", post(handlers::share_folder_batch_handler))
        .route("/folder/{folder_id}/shared_users", get(handlers::get_folder_shared_users_handler))
        .route("/folder/{folder_id}/InfoItem", get(handlers::get_folder_info_item_handler))

        // ========== RESTful folder endpoints (alias pour tests/API publique) ==========
        .route("/folders", post(handlers::create_folder_handler))  // POST /folders
        .route("/folders/{folder_id}/move", patch(handlers::move_folder_restful_handler))  // PATCH /folders/{id}/move (AVANT route générique)
        .route("/folders/{folder_id}/share", post(handlers::share_folder_restful_handler))  // POST /folders/{id}/share
        .route("/folders/{folder_id}/share/{user_id}", axum::routing::delete(handlers::revoke_folder_access_handler))  // DELETE /folders/{id}/share/{user_id}
        .route("/folders/{folder_id}", get(handlers::get_folder_handler))  // GET /folders/{id}
        .route("/folders/{folder_id}", axum::routing::delete(handlers::delete_folder_restful_handler))  // DELETE /folders/{id}
        .route("/folders/{folder_id}", patch(handlers::rename_folder_restful_handler))  // PATCH /folders/{id} (rename)

        // ========== Gestion des accès ==========
        .route("/propagate_file_access", post(handlers::propagate_file_access_handler))
        .route("/propagate_folder_access", post(handlers::propagate_folder_access_handler))
        .route("/revoke-access", post(handlers::revoke_access_handler))

        // ========== Vues globales ==========
        .route("/get_all_drive_info/{parent_id}", get(handlers::get_account_and_drive_info_handler))
        .route("/get_file_folder/{parent_id}", get(handlers::get_file_folder_handler))
        .route("/empty_trash", post(handlers::empty_trash_handler))
}
