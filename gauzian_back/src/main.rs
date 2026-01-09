use std::net::SocketAddr;
use sqlx::postgres::PgPoolOptions;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use gauzian_back::{routes, state::AppState};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let db_pool = PgPoolOptions::new()
        .max_connections(15) // Ajuster selon la charge
        .connect(&std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"))
        .await
        .expect("Failed to connect to Postgres");

    sqlx::migrate!()
        .run(&db_pool)
        .await
        .expect("Failed to run database migrations");

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "gauzian_back=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = AppState::from_env(db_pool).await;

    // Initialiser le bucket S3 au démarrage (avec timeout plus long)
    match tokio::time::timeout(
        std::time::Duration::from_secs(30),
        state.storage_client.init_bucket(),
    )
    .await
    {
        Ok(Ok(())) => {
            info!("S3 bucket initialized successfully");
        }
        Ok(Err(e)) => {
            // Non-fatal: le bucket sera créé à la première requête
            tracing::warn!("Failed to initialize S3 bucket at startup: {}. It will be created on first use.", e);
        }
        Err(_) => {
            tracing::warn!("S3 bucket initialization timed out. It will be created on first use.");
        }
    }

    let app = routes::app(state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);
    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .expect("Invalid HOST/PORT combination");
    info!("Server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}