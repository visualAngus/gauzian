use std::sync;

use sqlx::{PgPool, types::uuid};
use serde::Deserialize;
use chrono::NaiveDate;
use uuid::Uuid;
use chrono::{DateTime, Utc};

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
    pub folder_key_encrypted: String,
    pub folder_metadata_encrypted: String,

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
#[derive(Deserialize, Debug)]
pub struct UploadRequest {
    pub encrypted_blob: String,
    pub encrypted_metadata: String,
    pub encrypted_file_key: String,
    pub media_type: String,
    pub file_size: usize,
    pub parent_folder_id: Option<Uuid>,
}
#[derive(Deserialize, Debug)]
pub struct DownloadRequest {
    // Le JS envoie "id_file", mais en Rust on préfère "file_id"
    // On utilise serde pour faire le lien
    #[serde(alias = "id_file")] 
    pub file_id: Uuid,
}

#[derive(Deserialize, Debug)]
pub struct FolderRequest {
    pub parent_folder_id: Option<Uuid>
}

#[derive(Deserialize, Debug)]   
pub struct FullPathRequest {
    pub folder_id: Uuid,
}

#[derive(Deserialize, Debug)]
pub struct FolderCreationRequest {
    pub parent_folder_id: Uuid,
    pub encrypted_metadata: String,
    pub encrypted_folder_key: String,
}

#[derive(Debug)]
pub struct FolderRecord {
    pub id: Uuid,
    pub encrypted_metadata: Vec<u8>,
    pub updated_at: Option<DateTime<Utc>>, // Option car timestamps parfois nullable par défaut
    pub encrypted_folder_key: Vec<u8>,
    pub is_root: bool,
}

#[derive(Deserialize, Debug)]
pub struct FolderRenameRequest {
    pub folder_id: Uuid,
    pub new_encrypted_metadata: String,
}

#[derive(Deserialize, Debug)]
pub struct UploadStreamingRequest {
    pub encrypted_chunk: String,
    pub chunk_index: usize,
    pub total_chunks: usize,   
    pub temp_upload_id: Uuid,
}

#[derive(Deserialize, Debug)]
pub struct OpenStreamingUploadRequest {
    pub encrypted_metadata: String,
    pub encrypted_file_key: Option<String>,
    pub media_type: String,
    pub file_size: usize,
    pub parent_folder_id: Option<Uuid>,
}