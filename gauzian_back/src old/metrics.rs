use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use lazy_static::lazy_static;
use prometheus::{
    opts, register_counter_vec, register_histogram_vec, register_int_gauge, CounterVec, Encoder,
    HistogramOpts, HistogramVec, IntGauge, TextEncoder,
};
use std::time::Instant;

// ==================== Métriques HTTP ====================

lazy_static! {
    /// Compteur total de requêtes par endpoint, méthode et status code
    pub static ref HTTP_REQUESTS_TOTAL: CounterVec = register_counter_vec!(
        opts!("http_requests_total", "Total number of HTTP requests"),
        &["method", "endpoint", "status"]
    )
    .unwrap();

    /// Histogramme de la durée des requêtes (en secondes)
    pub static ref HTTP_REQUEST_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        HistogramOpts::new("http_request_duration_seconds", "HTTP request duration in seconds")
            .buckets(vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]),
        &["method", "endpoint"]
    )
    .unwrap();

    /// Nombre de connexions HTTP actives
    pub static ref HTTP_CONNECTIONS_ACTIVE: IntGauge =
        register_int_gauge!("http_connections_active", "Number of active HTTP connections").unwrap();

    // ==================== Métriques Métier ====================

    /// Compteur d'uploads de fichiers
    pub static ref FILE_UPLOADS_TOTAL: CounterVec = register_counter_vec!(
        opts!("file_uploads_total", "Total number of file uploads"),
        &["status"] // "success", "failed", "aborted"
    )
    .unwrap();

    /// Compteur de downloads de fichiers
    pub static ref FILE_DOWNLOADS_TOTAL: CounterVec = register_counter_vec!(
        opts!("file_downloads_total", "Total number of file downloads"),
        &["status"] // "success", "failed"
    )
    .unwrap();

    /// Taille totale des fichiers uploadés (en bytes)
    pub static ref FILE_UPLOAD_BYTES_TOTAL: CounterVec = register_counter_vec!(
        opts!("file_upload_bytes_total", "Total bytes uploaded"),
        &["status"]
    )
    .unwrap();

    /// Durée d'upload des chunks individuels (en secondes)
    pub static ref CHUNK_UPLOAD_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        HistogramOpts::new("chunk_upload_duration_seconds", "Chunk upload duration in seconds")
            .buckets(vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]),
        &["status"] // "success", "failed"
    )
    .unwrap();

    /// Durée de download des chunks individuels (en secondes)
    pub static ref CHUNK_DOWNLOAD_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        HistogramOpts::new("chunk_download_duration_seconds", "Chunk download duration in seconds")
            .buckets(vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]),
        &["status"] // "success", "failed"
    )
    .unwrap();

    /// Compteur d'authentifications
    pub static ref AUTH_ATTEMPTS_TOTAL: CounterVec = register_counter_vec!(
        opts!("auth_attempts_total", "Total number of authentication attempts"),
        &["type", "status"] // type: "login", "register", "autologin" | status: "success", "failed"
    )
    .unwrap();

    /// Durée des opérations S3
    pub static ref S3_OPERATION_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        HistogramOpts::new("s3_operation_duration_seconds", "S3 operation duration in seconds")
            .buckets(vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]),
        &["operation"] // "put", "get", "delete"
    )
    .unwrap();

    /// Compteur d'opérations Redis
    pub static ref REDIS_OPERATIONS_TOTAL: CounterVec = register_counter_vec!(
        opts!("redis_operations_total", "Total number of Redis operations"),
        &["operation", "status"] // operation: "get", "set", "delete" | status: "success", "failed"
    )
    .unwrap();

    /// Compteur de requêtes DB
    pub static ref DB_QUERIES_TOTAL: CounterVec = register_counter_vec!(
        opts!("db_queries_total", "Total number of database queries"),
        &["query_type", "status"] // query_type: "select", "insert", "update", "delete"
    )
    .unwrap();

    /// Durée des requêtes DB
    pub static ref DB_QUERY_DURATION_SECONDS: HistogramVec = register_histogram_vec!(
        HistogramOpts::new("db_query_duration_seconds", "Database query duration in seconds")
            .buckets(vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]),
        &["query_type"]
    )
    .unwrap();
}

// ==================== Middleware de Tracking HTTP ====================

/// Middleware Axum pour tracker automatiquement toutes les requêtes HTTP
pub async fn track_metrics(req: Request, next: Next) -> Response {
    // Incrémenter le nombre de connexions actives
    HTTP_CONNECTIONS_ACTIVE.inc();

    // Capturer les informations de la requête
    let method = req.method().to_string();
    let path = normalize_path(req.uri().path());
    let start = Instant::now();

    // Exécuter le handler
    let response = next.run(req).await;

    // Calculer la durée
    let duration = start.elapsed().as_secs_f64();
    let status = response.status().as_u16().to_string();

    // Enregistrer les métriques
    HTTP_REQUESTS_TOTAL
        .with_label_values(&[&method, &path, &status])
        .inc();

    HTTP_REQUEST_DURATION_SECONDS
        .with_label_values(&[&method, &path])
        .observe(duration);

    // Décrémenter les connexions actives
    HTTP_CONNECTIONS_ACTIVE.dec();

    response
}

/// Normalise les chemins pour regrouper les routes avec paramètres
/// Exemple: /drive/file/123 -> /drive/file/:id
fn normalize_path(path: &str) -> String {
    let segments: Vec<&str> = path.split('/').collect();
    let mut normalized = Vec::new();

    for (i, segment) in segments.iter().enumerate() {
        if segment.is_empty() {
            continue;
        }

        // Détecter les IDs UUID ou numériques
        if is_uuid(segment) || segment.parse::<i32>().is_ok() {
            // Regarder le segment précédent pour nommer le paramètre
            if i > 0 {
                normalized.push(format!(":{}", segments[i - 1]));
            } else {
                normalized.push(":id".to_string());
            }
        } else {
            normalized.push(segment.to_string());
        }
    }

    format!("/{}", normalized.join("/"))
}

/// Vérifie si une chaîne ressemble à un UUID
fn is_uuid(s: &str) -> bool {
    s.len() == 36 && s.chars().filter(|c| *c == '-').count() == 4
}

// ==================== Endpoint /metrics ====================

/// Retourne les métriques au format texte Prometheus
pub fn metrics_text() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}

// ==================== Fonctions Helper pour les Métriques Métier ====================

/// Track une tentative d'authentification
pub fn track_auth_attempt(auth_type: &str, success: bool) {
    let status = if success { "success" } else { "failed" };
    AUTH_ATTEMPTS_TOTAL
        .with_label_values(&[auth_type, status])
        .inc();
}

/// Track un upload de fichier
pub fn track_file_upload(success: bool, bytes: u64) {
    let status = if success { "success" } else { "failed" };
    FILE_UPLOADS_TOTAL.with_label_values(&[status]).inc();
    if success {
        FILE_UPLOAD_BYTES_TOTAL
            .with_label_values(&[status])
            .inc_by(bytes as f64);
    }
}

/// Track un download de fichier
pub fn track_file_download(success: bool) {
    let status = if success { "success" } else { "failed" };
    FILE_DOWNLOADS_TOTAL.with_label_values(&[status]).inc();
}

/// Track la durée d'upload d'un chunk
pub fn track_chunk_upload_duration(duration_secs: f64, success: bool) {
    let status = if success { "success" } else { "failed" };
    CHUNK_UPLOAD_DURATION_SECONDS
        .with_label_values(&[status])
        .observe(duration_secs);
}

/// Track la durée de download d'un chunk
pub fn track_chunk_download_duration(duration_secs: f64, success: bool) {
    let status = if success { "success" } else { "failed" };
    CHUNK_DOWNLOAD_DURATION_SECONDS
        .with_label_values(&[status])
        .observe(duration_secs);
}

/// Track une opération S3
pub fn track_s3_operation(operation: &str, duration_secs: f64) {
    S3_OPERATION_DURATION_SECONDS
        .with_label_values(&[operation])
        .observe(duration_secs);
}

/// Track une opération Redis
pub fn track_redis_operation(operation: &str, success: bool) {
    let status = if success { "success" } else { "failed" };
    REDIS_OPERATIONS_TOTAL
        .with_label_values(&[operation, status])
        .inc();
}

/// Track une requête DB
pub fn track_db_query(query_type: &str, duration_secs: f64, success: bool) {
    let status = if success { "success" } else { "failed" };
    DB_QUERIES_TOTAL
        .with_label_values(&[query_type, status])
        .inc();
    DB_QUERY_DURATION_SECONDS
        .with_label_values(&[query_type])
        .observe(duration_secs);
}
