use axum::{middleware, routing::get, Router};
use tower_http::trace::TraceLayer;

use crate::{auth, drive, agenda, metrics, state::AppState};

pub fn app(state: AppState) -> Router {
    Router::new()
        // Endpoints système (health check, métriques)
        .route("/", get(health_check_handler))
        .route("/health/ready", get(health_check_handler))
        .route("/metrics", get(metrics_handler))
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

/// GET /metrics — Prometheus scraping endpoint, protégé par METRICS_SECRET si défini.
///
/// Pour Prometheus, configurer:
///   scrape_configs:
///     - job_name: 'gauzian'
///       bearer_token: '<valeur de METRICS_SECRET>'
///       static_configs:
///         - targets: ['backend:3000']
async fn metrics_handler(
    headers: axum::http::HeaderMap,
) -> axum::response::Response {
    use axum::response::IntoResponse;

    let secret = std::env::var("METRICS_SECRET").unwrap_or_default();

    if !secret.is_empty() {
        let provided = headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .and_then(|s| s.strip_prefix("Bearer "))
            .unwrap_or("");

        if provided != secret {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                "Unauthorized",
            )
                .into_response();
        }
    }

    (
        axum::http::StatusCode::OK,
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4",
        )],
        metrics::metrics_text(),
    )
        .into_response()
}
