use axum::{routing::{get, post}, Router};
use tower_http::trace::TraceLayer;

use crate::{handlers, state::AppState};

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/login", post(handlers::login_handler))
        .route("/register", post(handlers::register_handler))
        .route("/logout", post(handlers::logout_handler))
        .route("/protected", get(handlers::protected_handler))
        .route("/auto_login", get(handlers::auto_login_handler))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
