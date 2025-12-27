use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use axum::http::HeaderValue;
use axum::{
    http::Method,
    routing::{get, post},
    Router,
};
use axum_client_ip::SecureClientIpSource;
use dotenvy;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::cors::{AllowOrigin, CorsLayer};

use gauzian_core::AppState;
// On importe les handlers depuis le module Auth
use axum::body::Body;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use gauzian_auth::{
    autologin_handler,
    login_handler,
    recovery_challenge_handler,
    recovery_reset_password_handler,
    recovery_verify_handler,
    register_handler,
    info_handler,
    refresh_handler,
    logout_handler,
};
    
use gauzian_drive::{
    create_folder_handler, download_handler, files_handler, finish_streaming_upload,
    folder_handler, full_path_handler, open_streaming_upload_handler, rename_folder_handler,
    upload_handler, upload_streaming_handler,download_raw_handler,delete_file_handler,
    delete_folder_handler,rename_file_handler,cancel_streaming_upload_handler,
    move_file_to_folder_handler, share_file_handler, prepare_share_file_handler,get_share_invites_handler,
    
};

use tracing_subscriber::{fmt, EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use tracing_error::ErrorLayer;

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info")); // override avec RUST_LOG
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(true).with_thread_ids(false))
        .with(ErrorLayer::default())
        .init();
}

// Middleware de debug pour logger l'origine et les méthodes (utile pour CORS)
async fn log_origin(req: Request<Body>, next: Next) -> Response {

    // Log l'origine comme avant
    if let Some(origin) = req.headers().get("origin") {
        tracing::info!(
            "➡️ Requête entrante: {} {} Origin: {:?}",
            req.method(),
            req.uri(),
            origin
        );
    } else {
        tracing::info!(
            "➡️ Requête entrante: {} {} (no Origin)",
            req.method(),
            req.uri()
        );
    }
    // Log si c'est une préflight OPTIONS
    if req.method() == Method::OPTIONS {
        tracing::info!("  - Préflight OPTIONS reçu pour {}", req.uri());
    }

    next.run(req).await
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();

    tracing::info!("starting Gauzian API");

    // 1. Chargement de la configuration
    match dotenvy::dotenv() {
        Ok(path) => tracing::info!("✅ .env chargé depuis : {:?}", path),
        Err(e) => tracing::warn!("⚠️ Impossible de charger .env : {:?}", e),
    }

    // 2. Connexion Base de Données
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");

    tracing::info!("⏳ Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(50)
        .connect(&database_url)
        .await?;
    tracing::info!("✅ Connecté à la base de données");

    // 3. Création de l'état partagé (défini dans gauzian_core)
    let state = AppState { db_pool: pool };

    // 4. Définition des Routes
    let origins_env =
        std::env::var("FRONT_ORIGINS").unwrap_or_else(|_| "http://localhost:3001".to_string());
    let origin_values: Vec<HeaderValue> = origins_env
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .filter_map(|s| match HeaderValue::from_str(s) {
            Ok(h) => Some(h),
            Err(e) => {
                tracing::warn!("⚠️ FRONT_ORIGINS: valeur invalide '{}': {}", s, e);
                None
            }
        })
        .collect();

    tracing::info!("CORS origin(s) autorisée(s) : {:?}", origin_values);

    let origin_list = origin_values.clone();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origin_list))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE, AUTHORIZATION])
        .allow_credentials(true);

    let app = Router::new()
        .route("/auth/register", post(register_handler))
        .route("/auth/login", post(login_handler))
        .route("/auth/autologin", post(autologin_handler))
        .route("/auth/refresh", post(refresh_handler))
        .route("/auth/logout", post(logout_handler))
        .route("/auth/info", get(info_handler))
        .route("/auth/recovery/challenge", post(recovery_challenge_handler))
        .route("/auth/recovery/verify", post(recovery_verify_handler))
        .route("/auth/recovery/reset-password", post(recovery_reset_password_handler))
        .route("/drive/upload", post(upload_handler))
        .route("/drive/download", get(download_handler))
        .route("/drive/folders", get(folder_handler))
        .route("/drive/files", get(files_handler))
        .route("/drive/new_folder", post(create_folder_handler))
        .route("/drive/full_path", get(full_path_handler))
        .route("/drive/rename_folder", post(rename_folder_handler))
        .route("/drive/open_streaming_upload",post(open_streaming_upload_handler))
        .route("/drive/upload_chunk", post(upload_streaming_handler))
        .route("/drive/finish_streaming_upload",post(finish_streaming_upload))
        .route("/drive/download_raw", get(download_raw_handler))
        .route("/drive/delete_file", post(delete_file_handler))
        .route("/drive/delete_folder", post(delete_folder_handler))
        .route("/drive/rename_file", post(rename_file_handler))
        .route("/drive/cancel_streaming_upload", post(cancel_streaming_upload_handler))
        .route("/drive/move_file", post(move_file_to_folder_handler)) 
        .route("/drive/share_file", post(share_file_handler))
        .route("/drive/prepare_share_file", post(prepare_share_file_handler))
        .route("/drive/get_share_invites", get(get_share_invites_handler))
        .with_state(state)
        .layer(axum::middleware::from_fn(log_origin))
        .layer(tower_http::add_extension::AddExtensionLayer::new(
            SecureClientIpSource::ConnectInfo,
        ))
        .layer(cors);

    // 5. Lancement du Serveur
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    // On active ConnectInfo pour pouvoir récupérer l'IP dans le login_handler
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    tracing::info!(addr = %addr, "listening");
    Ok(())
}
