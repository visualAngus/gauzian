use axum::{
    Router,
    extract::{Json, State}, // On ajoute Json et State ici
    http::StatusCode,
    response::IntoResponse,
    routing::post,
};
use serde::Deserialize; // On n'a besoin que de Deserialize pour l'input
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::net::SocketAddr;

// On ajoute les imports pour l'identité
use argon2::{
    Argon2,
    password_hash::{
        rand_core::OsRng,
        PasswordHash,     // <--- Manquait pour parser le hash stocké
        PasswordHasher,   // <--- Pour créer le hash (register)
        PasswordVerifier, // <--- Manquait pour verify_password (login)
        SaltString
    },
};
use uuid::Uuid;
// On importe le module pour charger les variables d'environnement (si ce n'est pas déjà fait)
use dotenvy;

#[derive(Deserialize, Debug)]
struct RegisterRequest {
    username: String,
    email: String,
    password: String,
}
#[derive(Clone)]
struct AppState {
    db_pool: PgPool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // chargement du .env
    dotenvy::dotenv().ok();

    // on lie le .env pour recupérer l'url de la bdd
    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");

    // connexion à la bdd
    let db_pool = PgPoolOptions::new()
        .max_connections(50)
        .connect(&database_url)
        .await?;

    println!("Connected to the database");

    let state: AppState = AppState { db_pool };

    let app: Router = Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// 3. Le Handler (Contrôleur)
// Il prend l'état (DB) et le JSON (payload) en entrée.
// Il retourne quelque chose qui implémente IntoResponse (souvent un tuple (StatusCode, String))
async fn register_handler(
    State(state): State<AppState>,        // Injection du Pool de connexions
    Json(payload): Json<RegisterRequest>, // Désérialisation automatique du body JSON
) -> impl IntoResponse {

    // --- PERFORMANCE & SÉCURITÉ : Hachage Argon2 dans un thread bloquant ---
    // 1. On clone le mot de passe pour le "déménager" dans le thread bloquant
    let password_clone = payload.password.clone();

    // 2. On utilise tokio::task::spawn_blocking.
    // Le bloc "move || { ... }" prend possession (ownership) de password_clone.
    let hash_result = tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng); // Création du "sel" aléatoire
        let argon2 = Argon2::default();

        // C'est l'opération coûteuse en CPU (prend ~500ms)
        argon2
            .hash_password(password_clone.as_bytes(), &salt)
            .map(|hash| hash.to_string()) // On transforme le résultat en String
    })
    .await; // Le .await attend que le thread bloquant ait fini

    // 3. Gestion d'erreur du hachage
    let password_hash = match hash_result {
        // Ok(Ok(hash)) : Le premier Ok vient du tokio::spawn_blocking, le second Ok du Argon2
        Ok(Ok(hash)) => hash,
        // Si le hachage a échoué pour une raison (IO, OS, etc.)
        _ => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Erreur lors du hachage du mot de passe",
            )
                .into_response();
        }
    };

    // --- BASE DE DONNÉES : Insertion ---

    // Verifier si l'eamil est deja dans la base 

    // sqlx::query! vérifie la requête à la compilation !
    let insert_result = sqlx::query!(
        r#"
        INSERT INTO users (id, email, password_hash)
        VALUES ($1, $2, $3)
        "#,
        Uuid::new_v4(), // $1: Génération d'un UUID unique
        payload.email,  // $2: Email
        password_hash   // $3: Le Hash
    )
    .execute(&state.db_pool) // On exécute la requête sur le pool DB de l'état
    .await;

    // 4. Gestion d'erreur de la DB (ex: Email déjà utilisé)
    match insert_result {
        Ok(_) => {
            // Statut HTTP 201 CREATED
            (StatusCode::CREATED, "Utilisateur GAUZIAN créé.").into_response()
        }
        Err(e) => {
            eprintln!("Erreur SQL: {:?}", e);
            // Pour l'instant, on suppose que toute erreur est un conflit (DUPLICATE KEY)
            (
                StatusCode::CONFLICT,
                "L'email est déjà utilisé ou autre erreur de base de données.",
            )
                .into_response()
        }
    }
}

async fn login_handler(
    State(state): State<AppState>,        // Injection du Pool de connexions
    Json(payload): Json<RegisterRequest>,// Désérialisation automatique du body JSON
)-> impl IntoResponse {

    // verifier les informations de connexion dans la base de données

    let user_result = sqlx::query!(
        "SELECT id, password_hash FROM users WHERE email = $1",
        payload.email
    )
    .fetch_optional(&state.db_pool)
    .await;

    let user = match user_result {
        Ok(Some(u)) => u,
        Ok(None) => {
            // L'utilisateur n'existe pas.
            // Sécurité : On répond la même chose que si le mot de passe était faux
            // pour ne pas dire aux hackers quels emails existent.
            return (StatusCode::UNAUTHORIZED, "Email ou mot de passe incorrect").into_response();
        }
        Err(e) => {
            eprintln!("Erreur SQL Login: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
        }
    };

    let password_input = payload.password.clone();
    let stored_hash = user.password_hash.clone(); // Le hash qui vient de la DB


    let is_valid = tokio::task::spawn_blocking(move || {
        // 1. On parse le hash stocké (qui ressemble à "$argon2id$v=19$m=...")
        let parsed_hash = match PasswordHash::new(&stored_hash) {
            Ok(h) => h,
            Err(_) => return false, // Si le hash en DB est corrompu
        };

        // 2. On vérifie ! Argon2 recupère le sel dans 'parsed_hash' tout seul.
        Argon2::default()
            .verify_password(password_input.as_bytes(), &parsed_hash)
            .is_ok()
    })
    .await
    .unwrap_or(false);

    if is_valid {
        (StatusCode::OK, "Connexion réussie ! (Token à implémenter)").into_response()
    } else {
        (StatusCode::UNAUTHORIZED, "Email ou mot de passe incorrect").into_response()
    }

}