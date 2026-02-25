use sqlx::PgPool;
use crate::storage::StorageClient;
use std::sync::Arc;
use tokio::sync::Semaphore;
use redis::aio::ConnectionManager;

use lettre::transport::smtp::authentication::Credentials;
use lettre::{SmtpTransport};

#[derive(Clone)]
pub struct AppState {
    pub jwt_secret: String,
    pub redis_manager: ConnectionManager,  // ConnectionManager au lieu de Client
    pub db_pool: PgPool,
    pub storage_client: StorageClient,
    // Limite le nombre d'uploads concurrents pour éviter la saturation RAM
    pub upload_semaphore: Arc<Semaphore>,
    pub mailer: SmtpTransport,
}

impl AppState {
    pub async fn from_env(db_pool: PgPool) -> Self {
        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

        let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL must be set (ex: redis://127.0.0.1:6379)");
        let redis_client = redis::Client::open(redis_url).expect("Invalid REDIS_URL");

        // Utiliser ConnectionManager pour pooler les connexions Redis automatiquement
        let redis_manager = ConnectionManager::new(redis_client)
            .await
            .expect("Failed to create Redis ConnectionManager");

        tracing::info!("Redis ConnectionManager initialized");

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

        // mail
        let creds = Credentials::new("gauzian@pupin.fr".to_string(), std::env::var("SMTP_PASSWORD").expect("SMTP_PASSWORD must be set"));
        let mailer = SmtpTransport::relay("smtp.ionos.fr")
            .expect("Failed to create SMTP transport")
            .credentials(creds)
            .build();
        tracing::info!("SMTP transport initialized");

        Self {
            jwt_secret,
            redis_manager,
            db_pool,
            storage_client,
            upload_semaphore: Arc::new(Semaphore::new(max_concurrent_uploads)),
            mailer,
        }
    }
}
