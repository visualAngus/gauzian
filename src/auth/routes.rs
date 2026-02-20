// Routes du module auth
// Cette fonction retourne un Router<AppState> qui sera composé dans routes.rs principal

use axum::{routing::{get, post}, Router};
use crate::state::AppState;

use super::handlers;

/// Toutes les routes liées à l'authentification
/// IMPORTANT: Cette fonction retourne un Router<AppState> (générique)
/// Le with_state() sera appelé au niveau du router principal
pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/login", post(handlers::login_handler))
        .route("/register", post(handlers::register_handler))
        .route("/logout", post(handlers::logout_handler))
        .route("/autologin", get(handlers::auto_login_handler))
        .route("/protected", get(handlers::protected_handler))
        .route("/info", get(handlers::info_handler))
        .route("/contacts/get_public_key/{email}", get(handlers::get_public_key_handler))
}
