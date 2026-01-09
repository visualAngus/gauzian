use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub jwt_secret: String,
    pub redis_client: redis::Client,
    pub db_pool: PgPool,
}

impl AppState {
    pub fn from_env(db_pool: PgPool) -> Self {
        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

        let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL must be set (ex: redis://127.0.0.1:6379)");
        let redis_client = redis::Client::open(redis_url).expect("Invalid REDIS_URL");

        Self {
            jwt_secret,
            redis_client,
            db_pool,
        }
    }
}
