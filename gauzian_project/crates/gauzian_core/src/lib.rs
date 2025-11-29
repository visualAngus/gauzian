use sqlx::PgPool;
use serde::Deserialize;
use chrono::NaiveDate;

// --- 1. État Partagé ---
#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool, // "pub" est essentiel pour que les autres modules y accèdent
}

// --- 2. DTOs (Data Transfer Objects) ---
#[derive(Deserialize, Debug)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub last_name: String,
    pub first_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub time_zone: Option<String>,
}

// --- 3. Fonctions Partagées (Helpers) ---
// Tu pourras déplacer create_token ici plus tard si besoin.