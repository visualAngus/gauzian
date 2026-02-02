use sqlx::PgPool;
use crate::storage::StorageClient;
use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct AppState {
    pub jwt_secret: String,
    pub redis_client: redis::Client,
    pub db_pool: PgPool,
    pub storage_client: StorageClient,
    // Limite le nombre d'uploads concurrents pour éviter la saturation RAM
    pub upload_semaphore: Arc<Semaphore>,
}

impl AppState {
    pub async fn from_env(db_pool: PgPool) -> Self {
        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

        let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL must be set (ex: redis://127.0.0.1:6379)");
        let redis_client = redis::Client::open(redis_url).expect("Invalid REDIS_URL");

        let s3_bucket = std::env::var("S3_BUCKET").unwrap_or_else(|_| "gauzian".to_string());
        let storage_client = StorageClient::new(s3_bucket)
            .await
            .expect("Failed to initialize S3 client");

        // Limite à 50 uploads concurrents (ajustable via env var)
        let max_concurrent_uploads = std::env::var("MAX_CONCURRENT_UPLOADS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(50);
        tracing::info!("Max concurrent uploads: {}", max_concurrent_uploads);

        Self {
            jwt_secret,
            redis_client,
            db_pool,
            storage_client,
            upload_semaphore: Arc::new(Semaphore::new(max_concurrent_uploads)),
        }
    }
}
