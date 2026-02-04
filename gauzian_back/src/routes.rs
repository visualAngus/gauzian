use axum::{middleware, routing::get, Router};
use tower_http::trace::TraceLayer;

use crate::{auth, drive,agenda, metrics, state::AppState};

pub fn app(state: AppState) -> Router {
    Router::new()
        // Endpoints système (health check, métriques)
        .route("/", get(health_check_handler))  // Pour Clever Cloud health check
        .route("/health/ready", get(health_check_handler))
        .route("/metrics", get(|| async { metrics::metrics_text() }))
        // Composition des modules
        .merge(auth::auth_routes())
        .nest("/drive", drive::drive_routes())
        .nest("/agenda", agenda::agenda_routes())
        // Middlewares globaux
        .layer(middleware::from_fn(metrics::track_metrics))
        .layer(TraceLayer::new_for_http())
        // État partagé injecté dans tout le graphe de routes
        .with_state(state)
}

async fn health_check_handler() -> &'static str {
    "OK"
}
