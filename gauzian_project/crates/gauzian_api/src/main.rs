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
    let cors = CorsLayer::new()
        // Pour le développement, autoriser l'origine précise de votre frontend
        // (ex: Vite dev server `http://localhost:5173`).
        // IMPORTANT: Pour que le navigateur accepte et stocke les cookies
        // envoyés par le serveur lors de requêtes cross-origin, il faut
        //  - autoriser les credentials côté serveur (.allow_credentials(true))
        //  - ne PAS utiliser l'origine générique `Any` (l'origine doit être précise)
        // En production, remplacez l'URL ci-dessous par l'URL réelle de l'UI.
        .allow_origin(AllowOrigin::exact(
            HeaderValue::from_static("http://localhost:5173"),
        ))
        .allow_methods([Method::GET, Method::POST]) // Autoriser les requêtes POST
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
        .layer(cors); // CORS qui gère l'origine, headers et credentials
    // 5. Lancement du Serveur
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 GAUZIAN Cloud lancé sur http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    // On active ConnectInfo pour pouvoir récupérer l'IP dans le login_handler
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;

    Ok(())
}