use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use uuid::Uuid;
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Validation, Algorithm};

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
    


use axum::{
    async_trait,
    extract::{FromRequest, RequestParts},
    http::{request::Parts, StatusCode,header::AUTHORIZATION},
    response::{IntoResponse, Response},
    Json,
};

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

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        
        // A. Recupérer le Header Authorization
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .ok_or(AuthError(StatusCode::UNAUTHORIZED, "Missing Authorization header".into()))?;

        // B.  Parser "Bearer <token>"
        let auth_str = auth_header.to_str().map_err(|_| AuthError(StatusCode::UNAUTHORIZED, "Invalid header format".into()))?;

        // Si il ne commence pas par "Bearer "
        if !auth_str.starts_with("Bearer ") {
            return Err(AuthError(StatusCode::UNAUTHORIZED, "Invalid authorization scheme".into()));
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

async fn protected_handler(claims: Claims) -> Json<String> {
    Json(format!("Bienvenue utilisateur : {} !", claims.sub))
}