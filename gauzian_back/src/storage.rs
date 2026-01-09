use aws_sdk_s3::{config::Region, Client};
use aws_types::credentials::Credentials;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use uuid::Uuid;

/// Métadonnées pour une ligne de données stockée
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageMetadata {
    pub s3_id: String,
    pub index: String,
    pub date_upload: String,
    pub data_hash: String, // Pour vérifier l'intégrité
}

/// Erreurs de stockage
#[derive(Debug)]
pub enum StorageError {
    S3Error(String),
    JsonError(String),
    NotFound,
    DataValidationError(String),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::S3Error(e) => write!(f, "S3 Error: {}", e),
            StorageError::JsonError(e) => write!(f, "JSON Error: {}", e),
            StorageError::NotFound => write!(f, "Data not found in S3"),
            StorageError::DataValidationError(e) => write!(f, "Validation Error: {}", e),
        }
    }
}

impl std::error::Error for StorageError {}

/// Client de stockage S3
#[derive(Clone)]
pub struct StorageClient {
    client: Client,
    bucket: String,
}

impl StorageClient {
    /// Créer un nouveau client S3
    pub async fn new(bucket: String) -> Result<Self, StorageError> {
        let s3_endpoint = std::env::var("S3_ENDPOINT")
            .unwrap_or_else(|_| "http://localhost:9000".to_string());
        let region = std::env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());
        let access_key = std::env::var("S3_ACCESS_KEY")
            .or_else(|_| std::env::var("AWS_ACCESS_KEY_ID"))
            .unwrap_or_else(|_| "minioadmin".to_string());
        let secret_key = std::env::var("S3_SECRET_KEY")
            .or_else(|_| std::env::var("AWS_SECRET_ACCESS_KEY"))
            .unwrap_or_else(|_| "minioadmin".to_string());

        tracing::info!("Initializing S3 client with endpoint: {} and bucket: {}", s3_endpoint, bucket);

        let shared_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(Region::new(region))
            .credentials_provider(Credentials::new(access_key, secret_key, None, None, "static"))
            .load()
            .await;

        let client = Client::from_conf(
            aws_sdk_s3::config::Builder::from(&shared_config)
                .endpoint_url(&s3_endpoint)
                .force_path_style(true)  // Important pour MinIO
                .build(),
        );

        Ok(StorageClient { client, bucket })
    }

    /// **Fonction 1: Écrire une ligne (data_encrypted, index, date_upload) -> S3_id**
    ///
    /// Stocke les données chiffrées dans MinIO et retourne un identifiant unique
    pub async fn upload_line(
        &self,
        data_encrypted: &[u8],
        index: String,
    ) -> Result<StorageMetadata, StorageError> {
        let s3_id = Uuid::new_v4().to_string();
        let date_upload = Utc::now().to_rfc3339();

        // Créer les métadonnées
        let mut hasher = Sha256::new();
        hasher.update(data_encrypted);
        let data_hash = format!("{:x}", hasher.finalize());

        let metadata = StorageMetadata {
            s3_id: s3_id.clone(),
            index: index.clone(),
            date_upload: date_upload.clone(),
            data_hash: data_hash.clone(),
        };

        // Stocker les données chiffrées sous la clé s3_id
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&s3_id)
            .body(aws_sdk_s3::primitives::ByteStream::from(data_encrypted.to_vec()))
            .metadata("index", &index)
            .metadata("date-upload", &date_upload)
            .metadata("data-hash", &metadata.data_hash)
            .send()
            .await
            .map_err(|e| StorageError::S3Error(format!("Failed to upload: {}", e)))?;

        tracing::info!(
            "Data uploaded to S3: s3_id={}, index={}, size={}",
            s3_id,
            index,
            data_encrypted.len()
        );

        Ok(metadata)
    }

    /// **Fonction 2: Récupérer les données depuis S3_id**
    ///
    /// Récupère les données chiffrées et ses métadonnées
    pub async fn download_line(
        &self,
        s3_id: &str,
    ) -> Result<(Vec<u8>, StorageMetadata), StorageError> {
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(s3_id)
            .send()
            .await
            .map_err(|e| {
                let err_str = e.to_string();
                if err_str.contains("NoSuchKey") {
                    return StorageError::NotFound;
                }
                StorageError::S3Error(format!("Failed to download: {}", e))
            })?;

        // Récupérer les métadonnées
        let metadata = StorageMetadata {
            s3_id: s3_id.to_string(),
            index: resp
                .metadata()
                .and_then(|m| m.get("index"))
                .cloned()
                .unwrap_or_default(),
            date_upload: resp
                .metadata()
                .and_then(|m| m.get("date-upload"))
                .cloned()
                .unwrap_or_default(),
            data_hash: resp
                .metadata()
                .and_then(|m| m.get("data-hash"))
                .cloned()
                .unwrap_or_default(),
        };

        // Récupérer le corps des données
        let bytes = resp
            .body
            .collect()
            .await
            .map_err(|e| StorageError::S3Error(format!("Failed to read body: {}", e)))?
            .into_bytes();

        // Vérifier l'intégrité si le hash est disponible
        if !metadata.data_hash.is_empty() {
            let mut hasher = Sha256::new();
            hasher.update(&bytes);
            let computed_hash = format!("{:x}", hasher.finalize());
            if computed_hash != metadata.data_hash {
                return Err(StorageError::DataValidationError(
                    "Data integrity check failed".to_string(),
                ));
            }
        }

        tracing::info!(
            "Data downloaded from S3: s3_id={}, size={}",
            s3_id,
            bytes.len()
        );

        Ok((bytes.to_vec(), metadata))
    }

    /// **Fonction 3: Supprimer les données depuis S3_id**
    ///
    /// Supprime les données et ses métadonnées du stockage
    pub async fn delete_line(&self, s3_id: &str) -> Result<(), StorageError> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(s3_id)
            .send()
            .await
            .map_err(|e| StorageError::S3Error(format!("Failed to delete: {}", e)))?;

        tracing::info!("Data deleted from S3: s3_id={}", s3_id);

        Ok(())
    }

    /// Vérifier si un objet existe
    pub async fn exists(&self, s3_id: &str) -> Result<bool, StorageError> {
        match self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(s3_id)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("NoSuchKey") {
                    return Ok(false);
                }
                Err(StorageError::S3Error(format!("Failed to check existence: {}", e)))
            }
        }
    }

    /// Initialiser le bucket (le créer s'il n'existe pas)
    pub async fn init_bucket(&self) -> Result<(), StorageError> {
        const MAX_RETRIES: u32 = 5;
        const RETRY_DELAY: std::time::Duration = std::time::Duration::from_secs(2);

        for attempt in 1..=MAX_RETRIES {
            match self.client.create_bucket().bucket(&self.bucket).send().await {
                Ok(_) => {
                    tracing::info!("S3 bucket created: {}", self.bucket);
                    return Ok(());
                }
                Err(e) => {
                    let err_str = e.to_string();
                    // Si le bucket existe déjà, ce n'est pas une erreur
                    if err_str.contains("BucketAlreadyOwnedByYou")
                        || err_str.contains("BucketAlreadyExists")
                    {
                        tracing::info!("S3 bucket already exists: {}", self.bucket);
                        return Ok(());
                    }

                    // Si c'est une erreur de connexion, retry
                    if attempt < MAX_RETRIES
                        && (err_str.contains("dispatch failure")
                            || err_str.contains("connection")
                            || err_str.contains("timeout"))
                    {
                        tracing::warn!(
                            "S3 connection failed (attempt {}/{}), retrying in {:?}...: {}",
                            attempt,
                            MAX_RETRIES,
                            RETRY_DELAY,
                            e
                        );
                        tokio::time::sleep(RETRY_DELAY).await;
                        continue;
                    }

                    return Err(StorageError::S3Error(format!("Failed to init bucket: {}", e)));
                }
            }
        }

        Err(StorageError::S3Error(
            "Failed to init bucket: max retries exceeded".to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_storage_metadata_creation() {
        let metadata = StorageMetadata {
            s3_id: "test-id".to_string(),
            index: "file-1".to_string(),
            date_upload: Utc::now().to_rfc3339(),
            data_hash: "abc123".to_string(),
        };

        assert_eq!(metadata.s3_id, "test-id");
        assert_eq!(metadata.index, "file-1");
    }
}
