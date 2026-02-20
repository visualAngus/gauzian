# Guide d'Utilisation des Métriques Prometheus

Ce fichier montre comment utiliser les métriques définies dans `src/metrics.rs` dans vos handlers.

## 📊 Métriques Disponibles

### Métriques HTTP (Automatiques)
✅ Ces métriques sont **automatiquement collectées** par le middleware `track_metrics` :
- `http_requests_total` - Compteur de requêtes par méthode/endpoint/status
- `http_request_duration_seconds` - Durée des requêtes
- `http_connections_active` - Connexions actives

### Métriques Métier (Manuelles)
❗ Ces métriques doivent être **appelées explicitement** dans vos handlers :
- `file_uploads_total` - Uploads de fichiers
- `file_downloads_total` - Downloads de fichiers
- `file_upload_bytes_total` - Volume uploadé
- `auth_attempts_total` - Tentatives d'authentification
- `s3_operation_duration_seconds` - Durée opérations S3
- `redis_operations_total` - Opérations Redis
- `db_queries_total` - Requêtes DB
- `db_query_duration_seconds` - Durée requêtes DB

## 🔧 Exemples d'Utilisation

### 1. Tracker les Authentifications

```rust
// Dans login_handler
use crate::metrics;

pub async fn login_handler(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Response {
    let user = match auth::get_user_by_email(&state.db_pool, &req.email).await {
        Ok(user) => user,
        Err(_) => {
            // ❌ Login échoué
            metrics::track_auth_attempt("login", false);
            return ApiResponse::unauthorized("Invalid email or password").into_response();
        }
    };

    match auth::verify_password(&req.password, &user.password_hash, &user.auth_salt.unwrap_or_default()) {
        true => {
            // ✅ Login réussi
            metrics::track_auth_attempt("login", true);

            let token = jwt::create_jwt(user.id, "user", state.jwt_secret.as_bytes()).unwrap();
            return ApiResponse::ok(LoginResponse { /* ... */ })
                .with_token(token)
                .into_response();
        }
        false => {
            // ❌ Mot de passe incorrect
            metrics::track_auth_attempt("login", false);
            return ApiResponse::unauthorized("Invalid email or password").into_response();
        }
    }
}

// Dans register_handler
pub async fn register_handler(/* ... */) -> Response {
    // ... code d'insertion ...

    match sqlx::query!(/* ... */).execute(&state.db_pool).await {
        Ok(_) => {
            metrics::track_auth_attempt("register", true);
            ApiResponse::created(/* ... */).into_response()
        }
        Err(e) => {
            metrics::track_auth_attempt("register", false);
            ApiResponse::internal_error("Registration failed").into_response()
        }
    }
}
```

### 2. Tracker les Uploads de Fichiers

```rust
// Dans finalize_upload_handler
use std::time::Instant;
use crate::metrics;

pub async fn finalize_upload_handler(
    State(state): State<AppState>,
    Path((file_id, etat)): Path<(Uuid, i16)>,
    headers: HeaderMap,
) -> Response {
    // ... code de récupération du fichier ...

    let file_size = 12345u64; // Taille réelle du fichier

    match etat {
        1 => {
            // Upload réussi
            metrics::track_file_upload(true, file_size);
            ApiResponse::ok("Upload finalized successfully").into_response()
        }
        _ => {
            // Upload échoué/avorté
            metrics::track_file_upload(false, 0);
            ApiResponse::ok("Upload aborted").into_response()
        }
    }
}
```

### 3. Tracker les Downloads

```rust
// Dans download_file_handler
pub async fn download_file_handler(
    State(state): State<AppState>,
    Path(file_id): Path<Uuid>,
    headers: HeaderMap,
) -> Response {
    // ... vérifications ...

    match state.storage_client.get_object(&s3_key).await {
        Ok(stream) => {
            metrics::track_file_download(true);
            // Retourner le stream
        }
        Err(e) => {
            metrics::track_file_download(false);
            ApiResponse::internal_error("Download failed").into_response()
        }
    }
}
```

### 4. Tracker les Opérations S3

```rust
// Dans storage.rs (votre client S3)
use std::time::Instant;
use crate::metrics;

impl StorageClient {
    pub async fn put_object(&self, key: &str, data: Vec<u8>) -> Result<(), Error> {
        let start = Instant::now();

        let result = self.s3_client
            .put_object()
            .bucket(&self.bucket_name)
            .key(key)
            .body(data.into())
            .send()
            .await;

        let duration = start.elapsed().as_secs_f64();
        metrics::track_s3_operation("put", duration);

        result.map(|_| ()).map_err(|e| e.into())
    }

    pub async fn get_object(&self, key: &str) -> Result<ByteStream, Error> {
        let start = Instant::now();

        let result = self.s3_client
            .get_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await;

        let duration = start.elapsed().as_secs_f64();
        metrics::track_s3_operation("get", duration);

        result.map(|resp| resp.body).map_err(|e| e.into())
    }

    pub async fn delete_object(&self, key: &str) -> Result<(), Error> {
        let start = Instant::now();

        let result = self.s3_client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(key)
            .send()
            .await;

        let duration = start.elapsed().as_secs_f64();
        metrics::track_s3_operation("delete", duration);

        result.map(|_| ()).map_err(|e| e.into())
    }
}
```

### 5. Tracker les Opérations Redis

```rust
// Dans vos opérations Redis
use crate::metrics;

// Blacklist un token
pub async fn blacklist_token(redis_client: &redis::Client, jti: &str, exp: i64) -> Result<(), Error> {
    let mut con = redis_client.get_multiplexed_async_connection().await?;

    let result: Result<(), redis::RedisError> = redis::cmd("SETEX")
        .arg(format!("blacklist:{}", jti))
        .arg(exp - Utc::now().timestamp())
        .arg("1")
        .query_async(&mut con)
        .await;

    match result {
        Ok(_) => {
            metrics::track_redis_operation("set", true);
            Ok(())
        }
        Err(e) => {
            metrics::track_redis_operation("set", false);
            Err(e.into())
        }
    }
}

// Vérifier si un token est blacklisté
pub async fn is_token_blacklisted(redis_client: &redis::Client, jti: &str) -> bool {
    let mut con = match redis_client.get_multiplexed_async_connection().await {
        Ok(c) => c,
        Err(_) => {
            metrics::track_redis_operation("get", false);
            return false;
        }
    };

    let result: Result<Option<String>, redis::RedisError> = redis::cmd("GET")
        .arg(format!("blacklist:{}", jti))
        .query_async(&mut con)
        .await;

    match result {
        Ok(value) => {
            metrics::track_redis_operation("get", true);
            value.is_some()
        }
        Err(_) => {
            metrics::track_redis_operation("get", false);
            false
        }
    }
}
```

### 6. Tracker les Requêtes DB

```rust
// Exemple wrapper pour les requêtes DB
use std::time::Instant;
use crate::metrics;

pub async fn create_user(pool: &PgPool, user_data: &RegisterRequest) -> Result<Uuid, sqlx::Error> {
    let start = Instant::now();

    let result = sqlx::query!(
        r#"INSERT INTO users (username, email, password_hash, /* ... */)
           VALUES ($1, $2, $3, /* ... */)
           RETURNING id"#,
        user_data.username,
        user_data.email,
        // ...
    )
    .fetch_one(pool)
    .await;

    let duration = start.elapsed().as_secs_f64();

    match &result {
        Ok(_) => metrics::track_db_query("insert", duration, true),
        Err(_) => metrics::track_db_query("insert", duration, false),
    }

    result.map(|row| row.id)
}
```

## 📈 Visualisation dans Grafana

### Requêtes PromQL Utiles

```promql
# Taux de requêtes par seconde
rate(http_requests_total[5m])

# Latence p95 par endpoint
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Taux d'erreurs (status 5xx)
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# Taux de succès d'authentification
sum(rate(auth_attempts_total{status="success"}[5m])) / sum(rate(auth_attempts_total[5m]))

# Volume d'upload par minute
rate(file_upload_bytes_total[1m])

# Latence moyenne S3
rate(s3_operation_duration_seconds_sum[5m]) / rate(s3_operation_duration_seconds_count[5m])

# Top 5 endpoints les plus lents
topk(5, histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])))
```

## ✅ Checklist d'Implémentation

- [x] Middleware `track_metrics` ajouté dans `routes.rs`
- [ ] Tracking auth dans `login_handler` et `register_handler`
- [ ] Tracking uploads dans `initialize_file_handler` et `finalize_upload_handler`
- [ ] Tracking downloads dans `download_file_handler`
- [ ] Tracking S3 dans `storage.rs`
- [ ] Tracking Redis dans les opérations de cache
- [ ] Tracking DB dans les requêtes critiques
- [ ] Dashboard Grafana configuré
- [ ] Alertes Prometheus configurées

## 🎯 Métriques Critiques à Monitorer

1. **Disponibilité** : Taux d'erreurs 5xx < 1%
2. **Performance** : p95 latency < 500ms
3. **Sécurité** : Taux d'échec auth < 5%
4. **Storage** : Durée S3 < 2s
5. **Database** : Durée requêtes < 100ms
