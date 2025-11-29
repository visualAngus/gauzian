use axum::{
    routing::post,
    Router,
    http::Method, 
};
use std::net::SocketAddr;
use sqlx::postgres::PgPoolOptions;
use dotenvy;
use axum::http::HeaderValue;
use tower_http::cors::{CorsLayer, AllowOrigin};
use axum::http::header::{CONTENT_TYPE, AUTHORIZATION};


use gauzian_core::AppState; 
// On importe les handlers depuis le module Auth
use gauzian_auth::{register_handler, login_handler};
use axum::middleware::Next;
use axum::response::Response;
use axum::http::Request;
use axum::body::Body;

// Middleware de debug pour logger l'origine et les méthodes (utile pour CORS)
async fn log_origin(req: Request<Body>, next: Next) -> Response {
    if let Some(origin) = req.headers().get("origin") {
        eprintln!("➡️ Requête entrante: {} {} Origin: {:?}", req.method(), req.uri(), origin);
    } else {
        eprintln!("➡️ Requête entrante: {} {} (no Origin)", req.method(), req.uri());
    }
    // Log si c'est une préflight OPTIONS
    if req.method() == Method::OPTIONS {
        eprintln!("  - Préflight OPTIONS reçu pour {}", req.uri());
    }

    next.run(req).await
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Chargement de la configuration
    match dotenvy::dotenv() {
    Ok(path) => println!("✅ .env chargé depuis : {:?}", path),
    Err(e) => println!("⚠️ Impossible de charger .env : {:?}", e),
}

    // 2. Connexion Base de Données
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set in .env file");

    println!("⏳ Connexion à la base de données...");
    let pool = PgPoolOptions::new()
        .max_connections(50)
        .connect(&database_url)
        .await?;
    println!("✅ Connexion DB réussie !");

    // 3. Création de l'état partagé (défini dans gauzian_core)
    let state = AppState { db_pool: pool };

    // 4. Définition des Routes
    // On associe les URLs aux fonctions qui sont maintenant dans gauzian_auth
    // Construire la liste d'origines autorisées depuis l'env `FRONT_ORIGINS`.
    // Exemple :
    //  FRONT_ORIGINS="https://192.168.1.74:5500,http://localhost:5173"
    // Si non défini, on autorise `http://localhost:5173` par défaut (dev Vite).
    let origins_env = std::env::var("FRONT_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());
    let origin_values: Vec<HeaderValue> = origins_env
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .filter_map(|s| match HeaderValue::from_str(s) {
            Ok(h) => Some(h),
            Err(e) => {
                eprintln!("⚠️ FRONT_ORIGINS: valeur invalide '{}': {}", s, e);
                None
            }
        })
        .collect();

    println!("CORS origin(s) autorisée(s) : {:?}", origin_values);

    // Utiliser AllowOrigin::custom pour accepter seulement les origines listées.
    // Crée une copie pour passer à AllowOrigin::list (qui teste et renvoie
    // l'origine correspondante si elle est présente dans la liste).
    let origin_list = origin_values.clone();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origin_list))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        // Ne PAS utiliser `Any` quand `allow_credentials(true)` est activé.
        // Déclarer explicitement les headers attendus par le client.
        .allow_headers([CONTENT_TYPE, AUTHORIZATION])
        .allow_credentials(true); // Autoriser l'envoi de cookies / credentials

    // 4. Définition des Routes
    let app = Router::new()
        .route("/auth/register", post(register_handler))
        .route("/auth/login", post(login_handler))
        .route("/auth/autologin", post(gauzian_auth::autologin_handler))
        .with_state(state)
        .layer(axum::middleware::from_fn(log_origin))
        .layer(cors); // CORS qui gère l'origine, headers et credentials
    // 5. Lancement du Serveur
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 GAUZIAN Cloud lancé sur http://{}", addr);

    // Si on souhaite activer TLS en local : définir USE_TLS=1 et indiquer
    // les fichiers PEM via TLS_CERT et TLS_KEY (ou placer cert.pem/key.pem).
    if std::env::var("USE_TLS").is_ok() {
        let cert = std::env::var("TLS_CERT").unwrap_or_else(|_| "cert.pem".to_string());
        let key = std::env::var("TLS_KEY").unwrap_or_else(|_| "key.pem".to_string());

        // Charge la config rustls depuis les fichiers PEM (cert + private key)
        let rustls_config = axum_server::tls_rustls::RustlsConfig::from_pem_file(cert, key).await?;
        println!("🔐 GAUZIAN Cloud (TLS) lancé sur https://{}", addr);

        axum_server::bind_rustls(addr, rustls_config)
            .serve(app.into_make_service_with_connect_info::<SocketAddr>())
            .await?;
    } else {
        let listener = tokio::net::TcpListener::bind(addr).await?;

        // On active ConnectInfo pour pouvoir récupérer l'IP dans le login_handler
        axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
            .await?;
    }

    Ok(())
}