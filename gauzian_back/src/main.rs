use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use uuid::Uuid;
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Validation, Algorithm};
use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode, header::AUTHORIZATION},
    response::{IntoResponse, Response},
    Json,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::env;


#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    id: Uuid,  // Identifiant unique de l'utilisateur
    role: String, // Rôle de l'utilisateur (ex: "admin", "user")
    exp: usize,   // Expiration (Unix timestamp obligatoire)
}

// JWT

fn create_jwt(user_id: Uuid, role: &str, secret: &[u8]) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        id: user_id,
        role: role.to_string(),
        exp: expiration,
    };
    let key = EncodingKey::from_secret(secret);
    encode(&jsonwebtoken::Header::default(), &claims, &key)
}

fn decode_jwt(token: &str, secret: &[u8]) -> Result<Claims, jsonwebtoken::errors::Error> {
    let key = DecodingKey::from_secret(secret);
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(token, &key, &validation)?;
    Ok(token_data.claims)
}
    


// Structure pour représenter une erreur d'authentification
struct AuthError(StatusCode, String);

// convertir AuthError en une réponse HTTP
impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let body = Json(serde_json::json!({
            "error": self.1,
        }));
        (self.0, body).into_response()
    }
}

impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl std::future::Future<Output = Result<Self, Self::Rejection>> + Send {
        async move {
            // A. Recupérer le Header Authorization
            let auth_header = parts
                .headers
                .get(AUTHORIZATION)
                .ok_or(AuthError(
                    StatusCode::UNAUTHORIZED,
                    "Missing Authorization header".into(),
                ))?;

            // B.  Parser "Bearer <token>"
            let auth_str = auth_header
                .to_str()
                .map_err(|_| AuthError(StatusCode::UNAUTHORIZED, "Invalid header format".into()))?;

            // Si il ne commence pas par "Bearer "
            if !auth_str.starts_with("Bearer ") {
                return Err(AuthError(
                    StatusCode::UNAUTHORIZED,
                    "Invalid authorization scheme".into(),
                ));
            }
            // Recupérer le token
            let token = &auth_str[7..]; // Extraire le token après "Bearer "

            // C. Décoder et valider le JWT
            let secret = b"your_secret_key"; // Utiliser une clé secrète sécurisée
            let claim = decode_jwt(token, secret)
                .map_err(|_| AuthError(StatusCode::UNAUTHORIZED, "Invalid or expired token".into()))?;
            Ok(claim)
        }
    }
}

async fn protected_handler(claims: Claims) -> Json<String> {
    Json(format!("Bienvenue utilisateur : {} !", claims.id))
}



#[tokio::main]
async fn main() {

    // Route login pour générer un JWT
    // Route protégée qui nécessite une authentification JWT
    let app = Router::new()
        .route("/login", post(login_handler))
        .route("/protected", get(protected_handler));

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap();
    axum::serve(listener, app)
        .await
        .unwrap();
}
async fn login_handler() -> Json<String> {
    let user_id = Uuid::new_v4();
    let role = "user";
    let secret = b"your_secret_key";
    match create_jwt(user_id, role, secret) {
        Ok(token) => Json(token),
        Err(_) => Json("Error generating token".into()),
    }
}