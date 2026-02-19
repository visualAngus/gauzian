
use axum::{routing::get, routing::post, Router};
use crate::state::AppState;

use super::handlers;

pub fn agenda_routes() -> Router<AppState> {
    Router::new()
        .route("/events", get(handlers::get_events_handler))
        .route("/events",post(handlers::create_event_handler))
}