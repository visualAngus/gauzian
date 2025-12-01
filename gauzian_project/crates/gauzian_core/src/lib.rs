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
    pub salt_e2e: String,
    pub salt_auth: String,
    pub storage_key_encrypted: String,
    pub storage_key_encrypted_recuperation: String,

    pub last_name: Option<String>,
    pub first_name: Option<String>,

    pub date_of_birth: Option<NaiveDate>,
    pub time_zone: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct UserKeys {
    pub salt: String,                 // Le sel utilisé par le client
    pub iv: String,                   // Le vecteur d'init (TRES IMPORTANT pour déchiffrer)
    #[serde(rename = "encryptedStorageKey")] 
    pub encrypted_storage_key: String, // La clé chiffrée
}

#[derive(Deserialize, Debug)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub ip_address: Option<String>,
}