use axum::{
    Router,
    extract::{Json, State}, // On ajoute Json et State ici
    http::StatusCode,
    response::IntoResponse,
    routing::post,
};
use axum::http::{header::ACCEPT_LANGUAGE, HeaderMap}; // header constant + HeaderMap extractor
use axum::extract::{self, ConnectInfo};
use axum::http::header::USER_AGENT;
use ipnetwork::IpNetwork; 

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
use rand::RngCore; // Pour remplir des bytes au hasard
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit},
    XChaCha20Poly1305, Key
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

// std::time::Duration removed; using chrono::Duration for DateTime arithmetic
use chrono::{DateTime, Utc, NaiveDate}; // Pour gérer les dates/heures de manière sûre et explicite
use chrono::Duration as ChronoDuration; // Pour l'expiration des tokens

#[derive(Deserialize, Debug)]
struct RegisterRequest {
    email: String,
    password: String,
    last_name: String,
    first_name: String,
    date_of_birth: Option<NaiveDate>,
    time_zone: Option<String>,
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

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await?;

    Ok(())
}

/// Génère une Master Key (MK) et la chiffre avec le mot de passe de l'utilisateur.
fn create_user_vault(password: &str) -> Result<(String, String), String> {
    // 1. Générer la Master Key (MK) aléatoire (128 octets)
    let mut master_key: [u8; 128] = [0u8; 128];
    rand::thread_rng().fill_bytes(&mut master_key);

    // 2. Préparer le sel pour la clé de chiffrement (KEK)
    let salt = SaltString::generate(&mut OsRng);

    // 3. Dériver la clé de chiffrement (KEK) depuis le mot de passe
    // CORRECTION ICI : On utilise hash_password standard et on extrait les bytes
    let argon2 = Argon2::default();
    
    // On dérive une clé KEK de 32 octets (256 bits) à partir du mot de passe.
    // XChaCha20Poly1305 attend une clé de 32 octets, donc on utilise
    // `hash_password_into` pour remplir exactement 32 octets.
    let mut kek = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt.as_ref().as_bytes(), &mut kek)
        .map_err(|e| e.to_string())?;

    // 4. Chiffrement (Wrapping) de la MK avec la KEK
    let key = Key::from_slice(&kek);
    let cipher = XChaCha20Poly1305::new(key);
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);

    let ciphertext = cipher.encrypt(&nonce, master_key.as_ref())
        .map_err(|_| "Erreur de chiffrement".to_string())?;

    // 5. Packaging (Nonce + Ciphertext)
    let mut vault_bytes = nonce.to_vec();
    vault_bytes.extend_from_slice(&ciphertext);

    let vault_b64 = BASE64.encode(vault_bytes);
    let salt_b64 = salt.as_str().to_string(); // CORRECTION: as_str() avant to_string()

    Ok((vault_b64, salt_b64))
}


async fn create_token() -> Result<String, String> {
    // generation d'un token aleatoire de 32 bytes
    let mut token_bytes: [u8; 32] = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut token_bytes);
    let token_b64 = BASE64.encode(token_bytes);
    Ok(token_b64)
}

// 3. Le Handler (Contrôleur)
// Il prend l'état (DB) et le JSON (payload) en entrée.
// Il retourne quelque chose qui implémente IntoResponse (souvent un tuple (StatusCode, String))
async fn register_handler(
    State(state): State<AppState>,        // Injection du Pool de connexions
    headers: HeaderMap,                   // FromRequestParts extractors MUST come before body extractors
    Json(payload): Json<RegisterRequest>, // Désérialisation automatique du body JSON
) -> impl IntoResponse {

    // get local time zone from Accept-Language header
    let raw_locale = headers
        .get(ACCEPT_LANGUAGE)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Parse the locale to get the primary language code
    let locale = raw_locale
        .as_deref()
        .and_then(|s| s.split(',').next()) // Prend la première partie (la préférée)
        .and_then(|s| s.split('-').next()) // Prend le code principal (ex: 'fr')
        .unwrap_or("en") // La valeur par défaut (GAUZIAN est par défaut en anglais)
        .to_string();

    // Use the provided time_zone or default to "UTC"
    let time_zone = payload.time_zone.unwrap_or("UTC".to_string());

    // On change le type de retour du spawn_blocking : on veut Hash + Vault + Salt
    let password_clone = payload.password.clone();
    let crypto_result = tokio::task::spawn_blocking(move || {
        // A. Hachage pour l'authentification (ce qu'on faisait avant)
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let auth_hash = argon2
            .hash_password(password_clone.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| e.to_string())?;

        // B. Création du Vault (Nouveau !)
        let (vault, vault_salt) = create_user_vault(&password_clone)?;

        Ok::<(String, String, String), String>((auth_hash, vault, vault_salt))
    })
    .await;

    // Récupération des données
    let (auth_hash, vault, vault_salt) = match crypto_result {
        Ok(Ok(res)) => res,
        Ok(Err(e)) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Crypto error: {}", e)).into_response(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Thread error").into_response(),
    };

    // ... Insertion SQL mise à jour
    let insert_result = sqlx::query!(
        r#"
        INSERT INTO users (id, email, password_hash, vault, vault_salt, first_name, last_name, locale, time_zone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        Uuid::new_v4(),
        payload.email,
        auth_hash,
        vault,
        vault_salt,
        payload.first_name,
        payload.last_name,
        // CHAMPS AUTOMATIQUES
        locale,     // $8
        time_zone   // $9
    )
    .execute(&state.db_pool)
    .await;

    // Gestion d'erreur de la DB (ex: Email déjà utilisé)
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
    State(state): State<AppState>,                      // 1. (Parts) État
    extract::ConnectInfo(addr): extract::ConnectInfo<SocketAddr>, // 2. (Parts) Connexion IP
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,               // 3. (Body) JSON
) -> impl IntoResponse {

    // ip client
    let ip_addr: std::net::IpAddr = addr.ip();
    println!("Tentative de connexion depuis l'IP: {}", ip_addr);

    let ip_network = IpNetwork::from(ip_addr);


    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or("Inconnu".to_string()); // Valeur par défaut de sécurité
    println!("User-Agent: {}", user_agent);
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
        let session_token = match create_token().await {
            Ok(token) => token,
            Err(e) => {
                eprintln!("Erreur de génération de token: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur de token").into_response();
            }
        };

        // hasher le token avant de le stocker 

        // expire dans 1 heure (chrono::Duration)
        let days: i64 = std::env::var("DATABASE_URL")
            .ok()
            .and_then(|val| val.parse::<i64>().ok())
            .unwrap_or(1); // Default to 1 day if parsing fails
        let expires_at: DateTime<Utc> = Utc::now() + ChronoDuration::seconds(days * 24 * 3600);

        let insert_session_result = sqlx::query!(
            r#"
            INSERT INTO sessions (token, user_id, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            "#,
            session_token,
            user.id,
            expires_at,
            ip_network,
            user_agent
        )
        .execute(&state.db_pool)
        .await;
        match insert_session_result {
            Ok(_) => {
                let set_cookie_header = format!(
                    "session_id={}; Max-Age={}; Path=/; HttpOnly; Secure; SameSite=Strict",
                    session_token,
                    days * 24 * 3600
                );
                
                // On utilise le tuple (Headers, StatusCode, Body) qui implémente IntoResponse
                  return (
                    // 1. Statut HTTP
                    StatusCode::OK,
                    // 2. Headers (Array de 1 seul élément)
                    [(axum::http::header::SET_COOKIE, set_cookie_header)],
                    // 3. Corps de la réponse (Body)
                    "Connexion réussie. Le token est dans le cookie HttpOnly.", 
                ).into_response();
            }
            Err(e) => {
                eprintln!("Erreur SQL Insert Session: {:?}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Erreur interne").into_response();
            }
        };

    } else {
        (StatusCode::UNAUTHORIZED, "Email ou mot de passe incorrect").into_response()
    }

}