use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use axum::http::HeaderValue;
use axum::{
    http::Method,
    routing::{get, post},
    Router,
    Extension, // <--- Import nécessaire pour injecter le store WS
};
use axum_client_ip::SecureClientIpSource;
use dotenvy;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::cors::{AllowOrigin, CorsLayer};

use gauzian_core::AppState;
use axum::body::Body;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;

// Import des handlers Auth et Drive existants...
use gauzian_auth::{
    autologin_handler, login_handler, recovery_challenge_handler,
    recovery_reset_password_handler, recovery_verify_handler, register_handler,
    info_handler, refresh_handler, logout_handler,
};
use gauzian_drive::{
    create_folder_handler, download_handler, files_handler, finish_streaming_upload,
    folder_handler, full_path_handler, open_streaming_upload_handler, rename_folder_handler,
    upload_handler, upload_streaming_handler, download_raw_handler, delete_file_handler,
    delete_folder_handler, rename_file_handler, cancel_streaming_upload_handler,
    move_file_to_folder_handler, share_file_handler, prepare_share_file_handler,
    get_share_invites_handler, accept_share_file_invite_handler,
};

// Import du nouveau module
use gauzian_collab; 

use tracing_subscriber::{fmt, EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use tracing_error::ErrorLayer;

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(true).with_thread_ids(false))
        .with(ErrorLayer::default())
        .init();
}

async fn log_origin(req: Request<Body>, next: Next) -> Response {
    if let Some(origin) = req.headers().get("origin") {
        tracing::info!("➡️ {} {} Origin: {:?}", req.method(), req.uri(), origin);
    } else {
        tracing::info!("➡️ {} {} (no Origin)", req.method(), req.uri());
    }
    if req.method() == Method::OPTIONS {
        tracing::info!("  - Préflight OPTIONS reçu pour {}", req.uri());
    }
    next.run(req).await
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();
    tracing::info!("starting Gauzian API");

    match dotenvy::dotenv() {
        Ok(path) => tracing::info!("✅ .env chargé depuis : {:?}", path),
        Err(e) => tracing::warn!("⚠️ Impossible de charger .env : {:?}", e),
    }

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL required");
    tracing::info!("⏳ Connexion DB...");
    let pool = PgPoolOptions::new()
        .max_connections(50)
        .connect(&database_url)
        .await?;
    tracing::info!("✅ DB Connectée");

    // État global (DB)
    let state = AppState { db_pool: pool };

    // État spécifique Websocket (Mémoire des rooms)
    // On l'initialise ici pour qu'il vive tant que le serveur tourne
    let collab_store = gauzian_collab::CollabStore::new();

    // Config CORS
    let origins_env = std::env::var("FRONT_ORIGINS").unwrap_or_else(|_| "http://localhost:3001".to_string());
    let origin_values: Vec<HeaderValue> = origins_env
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .filter_map(|s| HeaderValue::from_str(s).ok())
        .collect();
    
    let origin_list = origin_values.clone();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origin_list))
        // IMPORTANT : Le WS n'utilise pas POST/GET classique mais Upgrade.
        // Cependant, le handshake initial est un GET.
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE, AUTHORIZATION])
        .allow_credentials(true);

    let app = Router::new()
        // --- Routes Auth ---
        .route("/auth/register", post(register_handler))
        .route("/auth/login", post(login_handler))
        .route("/auth/autologin", post(autologin_handler))
        .route("/auth/refresh", post(refresh_handler))
        .route("/auth/logout", post(logout_handler))
        .route("/auth/info", get(info_handler))
        .route("/auth/recovery/challenge", post(recovery_challenge_handler))
        .route("/auth/recovery/verify", post(recovery_verify_handler))
        .route("/auth/recovery/reset-password", post(recovery_reset_password_handler))
        // --- Routes Drive ---
        .route("/drive/upload", post(upload_handler))
        .route("/drive/download", get(download_handler))
        .route("/drive/folders", get(folder_handler))
        .route("/drive/files", get(files_handler))
        .route("/drive/new_folder", post(create_folder_handler))
        .route("/drive/full_path", get(full_path_handler))
        .route("/drive/rename_folder", post(rename_folder_handler))
        .route("/drive/open_streaming_upload", post(open_streaming_upload_handler))
        .route("/drive/upload_chunk", post(upload_streaming_handler))
        .route("/drive/finish_streaming_upload", post(finish_streaming_upload))
        .route("/drive/download_raw", get(download_raw_handler))
        .route("/drive/delete_file", post(delete_file_handler))
        .route("/drive/delete_folder", post(delete_folder_handler))
        .route("/drive/rename_file", post(rename_file_handler))
        .route("/drive/cancel_streaming_upload", post(cancel_streaming_upload_handler))
        .route("/drive/move_file", post(move_file_to_folder_handler))
        .route("/drive/share_file", post(share_file_handler))
        .route("/drive/prepare_share_file", post(prepare_share_file_handler))
        .route("/drive/get_share_invites", get(get_share_invites_handler))
        .route("/drive/accept_share_invite", post(accept_share_file_invite_handler))
        
        // --- Fusion des routes Collab (Websocket) ---
        // On fusionne le routeur collab qui contient "/ws/:room_id"
        .merge(gauzian_collab::router())
        
        // --- Configuration globale ---
        .with_state(state) // Injecte AppState (DB) partout
        
        // Injecte le CollabStore spécifiquement via Extension
        // Cela le rend disponible dans les handlers qui le demandent (ceux de gauzian_collab)
        .layer(Extension(collab_store)) 
    
        .layer(axum::middleware::from_fn(log_origin))
        .layer(tower_http::add_extension::AddExtensionLayer::new(
            SecureClientIpSource::ConnectInfo,
        ))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!(addr = %addr, "🚀 listening");
    
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}