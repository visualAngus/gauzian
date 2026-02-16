# CLAUDE.md - Backend (Rust / Axum)

Guidance for Claude Code when working with the **GAUZIAN backend** (Rust API).

**⚠️ IMPORTANT** : Pas de développement local. Déploiement sur **VPS K8s** ou **Clever Cloud**.

---

## Quick Links

- **Root Guidance** : `/CLAUDE.md`
- **Architecture Backend** : `src/ARCHITECTURE.md` (⭐ 26KB, très détaillé)
- **Database Schema** : `docs/DATABASE_SCHEMA.md` (⭐ 700 lignes, ERD Mermaid)
- **K8s Infrastructure** : `k8s/README.md` (⭐ 800 lignes)
- **Environment Variables** : `docs/ENV_VARIABLES.md`
- **Deployment Guide** : `/DEPLOYMENT.md`

---

## Build & Run Commands

### Development

```bash
cd gauzian_back

# Build
cargo build                    # Debug build
cargo build --release          # Release build (optimisé)

# Run
cargo run                      # Dev server (port 3000)
RUST_LOG=debug cargo run       # Avec logs debug

# Tests
cargo test                     # Run all tests
cargo test --lib               # Tests unitaires seulement
cargo test --test integration  # Tests intégration

# Watch (auto-reload)
cargo watch -x run             # Recompile à chaque modification
cargo watch -x test            # Rerun tests
```

### Production (VPS K8s)

```bash
# Build image Docker
docker build -t angusvisual/gauzian-backend:dev .

# Push Docker Hub
./push_docker_hub.sh

# Déployer sur VPS
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'
```

### Database Migrations

```bash
# Port-forward PostgreSQL depuis VPS
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &

# Run migrations
sqlx migrate run --database-url $DATABASE_URL

# Create new migration
sqlx migrate add <migration_name>

# Revert last migration
sqlx migrate revert --database-url $DATABASE_URL
```

---

## Architecture

**Voir `src/ARCHITECTURE.md` pour détails complets (26KB).**

### Structure Modulaire

```
gauzian_back/src/
├── main.rs                 # Entry point, serveur Axum
├── state.rs                # AppState (DB pool, Redis, S3, JWT secret)
├── routes.rs               # Router avec middleware TraceLayer
├── metrics.rs              # Prometheus (17 métriques custom)
├── storage.rs              # Client S3/MinIO pour chunks chiffrés
│
├── auth/                   # Module authentification
│   ├── mod.rs              # Public API du module
│   ├── handlers.rs         # Endpoints (register, login, logout, verify)
│   ├── jwt.rs              # Création/validation JWT
│   ├── password.rs         # Hashing SHA256 (⚠️ à migrer Argon2)
│   └── models.rs           # Structs (LoginRequest, RegisterRequest, etc.)
│
├── drive/                  # Module fichiers/dossiers E2EE
│   ├── mod.rs              # 32 routes publiques
│   ├── files/              # Gestion fichiers
│   │   ├── handlers.rs     # Endpoints (initialize, upload_chunk, finalize, download)
│   │   ├── metadata.rs     # Chiffrement/déchiffrement métadonnées
│   │   └── models.rs       # Structs (FileRecord, FileAccess, etc.)
│   ├── folders/            # Gestion dossiers
│   │   ├── handlers.rs     # Endpoints (create, list, delete, share)
│   │   ├── hierarchy.rs    # Arbre récursif de dossiers
│   │   └── models.rs       # Structs (FolderRecord, FolderAccess, etc.)
│   └── sharing/            # Partage E2EE
│       ├── handlers.rs     # Endpoints (share_file, share_folder, revoke)
│       └── crypto.rs       # Re-chiffrement clés pour destinataires
│
└── agenda/                 # Module calendrier (en développement)
    ├── mod.rs              # Routes agenda
    ├── events/             # Gestion événements
    │   ├── handlers.rs     # CRUD événements avec E2EE
    │   └── models.rs       # Structs (AgendaEvent, encrypted fields)
    └── categories/         # Gestion catégories
        ├── handlers.rs     # CRUD catégories
        └── models.rs       # Struct AgendaCategory
```

### Modules Clés

| Module | Lignes | Description |
|--------|--------|-------------|
| **auth/** | ~500 | Authentification, JWT, password hashing |
| **drive/** | ~2000+ | Core E2EE (fichiers, dossiers, partage) |
| **agenda/** | ~800 | Calendrier avec événements chiffrés (en dev) |
| **metrics.rs** | ~300 | 17 métriques Prometheus custom |
| **storage.rs** | ~200 | Client MinIO S3 (upload/download chunks) |

---

## Key Patterns

### 1. AppState Injection

**Pattern** : AppState contient toutes les dépendances (DB, Redis, S3, JWT secret).

```rust
pub struct AppState {
    pub db: PgPool,            // PostgreSQL connection pool
    pub redis: RedisPool,      // Redis client
    pub s3: S3Client,          // MinIO S3 client
    pub jwt_secret: String,    // Secret pour signing JWT
}

// Injection automatique dans handlers
async fn my_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Response>, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(user))
}
```

**Avantages** :
- ✅ Type-safe (compile-time errors si mauvais type)
- ✅ Testable (mock AppState pour tests unitaires)
- ✅ No global state (chaque handler reçoit Arc<AppState>)

---

### 2. Authentication & Authorization

**Pattern** : JWT extrait via `FromRequestParts` trait.

```rust
// Extraction automatique du JWT depuis Cookie ou Authorization header
pub struct AuthUser {
    pub user_id: Uuid,
    pub username: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    // Extrait JWT depuis :
    // 1. Cookie "auth_token"
    // 2. Header "Authorization: Bearer <token>"
    // Valide signature + expiration
    // Vérifie révocation dans Redis
}

// Usage dans handlers
async fn protected_endpoint(
    auth: AuthUser,  // ← Automatique, 401 si absent/invalid
    State(state): State<Arc<AppState>>,
) -> Result<Json<Data>, AppError> {
    // auth.user_id est garanti valide ici
    let data = fetch_user_data(&state.db, auth.user_id).await?;
    Ok(Json(data))
}
```

**Authorization** :
- Permissions gérées via tables `file_access` / `folder_access`
- `access_level` : `owner`, `editor`, `viewer`
- Vérification dans handlers : `check_file_access(&state.db, file_id, user_id).await?`

**Endpoints Auth** :
- `POST /auth/register` - Crée un utilisateur **ET retourne un JWT** (auto-login après inscription)
- `POST /auth/login` - Authentifie et retourne un JWT
- `POST /auth/logout` - Révoque le JWT (blacklist Redis)
- `GET /auth/info` - Récupère les infos de l'utilisateur connecté (protégé)
- `GET /auth/autologin` - Vérifie la validité du token (protégé)

---

### 3. File Upload (Chunked + E2EE)

**Workflow** :

```
Client                         Backend                        MinIO S3
  │                               │                               │
  │  POST /files/initialize       │                               │
  ├──────────────────────────────>│                               │
  │  { encrypted_metadata, size } │                               │
  │                               │ INSERT INTO files             │
  │                               │ (id, encrypted_metadata, ...) │
  │<──────────────────────────────┤                               │
  │  { file_id }                  │                               │
  │                               │                               │
  │  POST /files/{id}/chunks      │                               │
  ├──────────────────────────────>│                               │
  │  FormData: { chunk, iv }      │  PUT /bucket/{s3_key}         │
  │                               ├──────────────────────────────>│
  │                               │  (encrypted chunk)            │
  │                               │                               │
  │  (repeat for each chunk)      │                               │
  │                               │                               │
  │  POST /files/{id}/finalize    │                               │
  ├──────────────────────────────>│                               │
  │                               │ UPDATE files                  │
  │                               │ SET is_fully_uploaded = true  │
  │<──────────────────────────────┤                               │
  │  { success: true }            │                               │
```

**Code** :

```rust
// 1. Initialize
pub async fn initialize_file(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<InitializeFileRequest>,
) -> Result<Json<FileRecord>, AppError> {
    let file_id = Uuid::new_v4();

    sqlx::query!(
        "INSERT INTO files (id, encrypted_metadata, size, mime_type, is_fully_uploaded)
         VALUES ($1, $2, $3, $4, false)",
        file_id, req.encrypted_metadata, req.size, req.mime_type
    )
    .execute(&state.db)
    .await?;

    Ok(Json(FileRecord { id: file_id, ... }))
}

// 2. Upload chunk
pub async fn upload_chunk(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(file_id): Path<Uuid>,
    multipart: Multipart,
) -> Result<StatusCode, AppError> {
    // Extract chunk + IV from multipart
    let (chunk_data, iv, chunk_index) = extract_multipart(multipart).await?;

    // Upload to MinIO S3
    let s3_key = format!("chunks/{}/{}", file_id, chunk_index);
    state.s3.put_object(s3_key, chunk_data).await?;

    // Save s3_key mapping
    sqlx::query!(
        "INSERT INTO s3_keys (id, s3_key, file_id) VALUES ($1, $2, $3)",
        Uuid::new_v4(), s3_key, file_id
    )
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

// 3. Finalize
pub async fn finalize_upload(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(file_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    sqlx::query!(
        "UPDATE files SET is_fully_uploaded = true WHERE id = $1",
        file_id
    )
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}
```

---

### 4. E2EE Sharing (RSA Key Wrapping)

**Pattern** : `file_key` rechiffré avec clé publique du destinataire.

```rust
pub async fn share_file(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(file_id): Path<Uuid>,
    Json(req): Json<ShareFileRequest>,
) -> Result<StatusCode, AppError> {
    // 1. Vérifier ownership
    check_file_owner(&state.db, file_id, auth.user_id).await?;

    // 2. Récupérer clé publique du destinataire
    let recipient_pub_key = sqlx::query_scalar!(
        "SELECT public_key FROM users WHERE id = $1",
        req.recipient_user_id
    )
    .fetch_one(&state.db)
    .await?;

    // 3. Insérer permission avec encrypted_file_key
    // (encrypted_file_key généré côté client - serveur ne fait que stocker)
    sqlx::query!(
        "INSERT INTO file_access (id, file_id, user_id, encrypted_file_key, access_level)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (file_id, user_id) DO UPDATE
         SET encrypted_file_key = EXCLUDED.encrypted_file_key, access_level = EXCLUDED.access_level",
        Uuid::new_v4(), file_id, req.recipient_user_id, req.encrypted_file_key, req.access_level
    )
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}
```

**⚠️ IMPORTANT** : Le serveur ne chiffre **jamais** `encrypted_file_key`. C'est fait côté client (crypto.ts).

---

### 5. Soft Delete

**Pattern** : `is_deleted` flag au lieu de `DELETE`.

```rust
// Soft delete
pub async fn delete_file(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(file_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    sqlx::query!(
        "UPDATE files SET is_deleted = true, updated_at = NOW() WHERE id = $1",
        file_id
    )
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// Hard delete (admin only, ou cron job après 30j)
pub async fn hard_delete_file(
    State(state): State<Arc<AppState>>,
    Path(file_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Supprimer chunks S3
    let s3_keys = sqlx::query_scalar!(
        "SELECT s3_key FROM s3_keys WHERE file_id = $1",
        file_id
    )
    .fetch_all(&state.db)
    .await?;

    for s3_key in s3_keys {
        state.s3.delete_object(&s3_key).await?;
    }

    // Supprimer DB record (CASCADE supprime s3_keys et file_access)
    sqlx::query!("DELETE FROM files WHERE id = $1", file_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
```

---

## Environment Variables

**Voir `docs/ENV_VARIABLES.md` pour liste exhaustive.**

### Obligatoires

| Variable | Exemple | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://user:pass@postgres:5432/gauzian_db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://redis:6379` | Redis connection |
| `S3_ENDPOINT` | `http://minio:9000` | MinIO S3 endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret key |
| `S3_BUCKET` | `gauzian-chunks` | S3 bucket name |
| `JWT_SECRET` | `<256-bit random hex>` | Secret pour signing JWT |

### Optionnelles

| Variable | Défaut | Description |
|----------|--------|-------------|
| `RUST_LOG` | `info` | Log level (trace, debug, info, warn, error) |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `3000` | Bind port |
| `COOKIE_SECURE` | `false` | Force HTTPS cookies (⚠️ `true` en prod) |
| `MAX_CONCURRENT_UPLOADS` | `30` | Limite uploads concurrents |

---

## Database

**Voir `docs/DATABASE_SCHEMA.md` pour schéma complet (700 lignes + ERD Mermaid).**

### Tables (9)

```sql
users                   -- Comptes utilisateurs (encrypted_private_key, public_key)
files                   -- Fichiers (encrypted_metadata, is_deleted, is_fully_uploaded)
folders                 -- Dossiers (encrypted_metadata, parent_folder_id, is_root, is_deleted)
file_access             -- Permissions fichiers (encrypted_file_key, access_level: owner/editor/viewer)
folder_access           -- Permissions dossiers (encrypted_folder_key, access_level)
s3_keys                 -- Mapping chunks S3 (s3_key, file_id)
agenda_events           -- Événements calendrier (encrypted_data_key, champs chiffrés)
agenda_categories       -- Catégories événements
agenda_event_participants -- Partage événements (encrypted_event_key)
```

### Requêtes Courantes

```rust
// Lister fichiers d'un utilisateur
let files = sqlx::query_as!(
    FileRecord,
    "SELECT f.* FROM files f
     JOIN file_access fa ON f.id = fa.file_id
     WHERE fa.user_id = $1 AND fa.is_deleted = false AND f.is_deleted = false AND f.is_fully_uploaded = true
     ORDER BY f.created_at DESC",
    user_id
)
.fetch_all(&state.db)
.await?;

// Vérifier ownership
let is_owner = sqlx::query_scalar!(
    "SELECT EXISTS(SELECT 1 FROM file_access WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner')",
    file_id, user_id
)
.fetch_one(&state.db)
.await?;
```

---

## Testing

### Unit Tests

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_upload_flow

# Run with output
cargo test -- --nocapture
```

**Structure** :

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_initialize_file() {
        // Setup mock AppState
        let state = mock_app_state().await;

        // Test handler
        let req = InitializeFileRequest { /* ... */ };
        let result = initialize_file(State(state), mock_auth(), Json(req)).await;

        assert!(result.is_ok());
    }
}
```

### Integration Tests

```bash
# Nécessite PostgreSQL + Redis + MinIO en cours
cargo test --test integration
```

---

## Metrics (Prometheus)

**17 métriques custom** exposées sur `/metrics`.

**Voir `METRICS_USAGE_EXAMPLES.md` pour requêtes Grafana.**

```rust
// Exemples de métriques
gauzian_request_duration_seconds{method="POST", endpoint="/files/initialize"}  # Histogram
gauzian_requests_total{method="GET", status="200"}                             # Counter
gauzian_active_connections                                                     # Gauge
gauzian_db_pool_active                                                         # Gauge
gauzian_redis_cache_hits                                                       # Counter
gauzian_s3_uploads_total                                                       # Counter
gauzian_file_operations_total{operation="create"}                              # Counter
```

**Usage dans code** :

```rust
use crate::metrics::METRICS;

pub async fn upload_chunk(...) -> Result<...> {
    let _timer = METRICS.request_duration.start_timer();
    METRICS.s3_uploads.inc();

    // ... upload logic ...

    METRICS.file_operations.with_label_values(&["upload_chunk"]).inc();
    Ok(...)
}
```

---

## Deployment

### VPS Kubernetes

**Voir `k8s/README.md` pour procédures complètes (800 lignes).**

```bash
# Build image
docker build -t angusvisual/gauzian-backend:dev .

# Push Docker Hub
docker push angusvisual/gauzian-backend:dev

# Deploy VPS
ssh vps 'kubectl rollout restart deployment/backend -n gauzian-v2'
```

### Clever Cloud

```bash
# Pre-build image
./update-backend-image.sh

# Commit Dockerfile
git add Dockerfile.backend.prebuilt
git commit -m "chore: Update backend image"

# Push
git push clever main
```

---

## Troubleshooting

### Erreur "Database pool exhausted"

**Symptôme** : `sqlx::Error::PoolTimedOut`

**Cause** : Trop de connexions DB ouvertes (max_connections dépassé).

**Fix** :

```rust
// main.rs - Augmenter pool size
let pool = PgPoolOptions::new()
    .max_connections(20)  // ⬆️ Augmenter (défaut 10)
    .acquire_timeout(Duration::from_secs(30))
    .connect(&database_url)
    .await?;
```

---

### Erreur "Redis connection refused"

**Symptôme** : `redis::Error: Connection refused`

**Debug** :

```bash
# Vérifier Redis en cours
ssh vps 'kubectl get pods -n gauzian-v2 -l app=redis'

# Tester connexion
ssh vps 'kubectl exec -it redis-<POD_ID> -n gauzian-v2 -- redis-cli ping'
# Devrait retourner : PONG
```

---

### Erreur "S3 bucket does not exist"

**Symptôme** : `rusoto_s3::Error: NoSuchBucket`

**Fix** :

```bash
# Accéder MinIO Console
ssh vps 'kubectl port-forward -n gauzian-v2 svc/minio 9001:9001'
# Ouvrir http://localhost:9001
# Login avec MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
# Créer bucket "gauzian-chunks" (ou nom défini dans S3_BUCKET)
```

---

## Best Practices

### ✅ DO

1. **Compile-time SQL checks** : Utiliser `sqlx::query!` (pas `query`)
2. **Error propagation** : Utiliser `?` operator (pas `unwrap()`)
3. **Connection pooling** : Réutiliser `state.db` (pas de nouvelles connexions)
4. **Async handlers** : Toujours `async fn` pour I/O (DB, Redis, S3)
5. **Structured logging** : `tracing::info!()` (pas `println!()`)

### ❌ DON'T

1. **❌ JAMAIS logger** `password_hash`, `encrypted_private_key`, `JWT_SECRET`
2. **❌ JAMAIS bloquer** thread Tokio (pas de `std::thread::sleep`, utiliser `tokio::time::sleep`)
3. **❌ JAMAIS unwrap()** en production (utiliser `?` ou `match`)
4. **❌ JAMAIS hardcoder** secrets (utiliser env vars)
5. **❌ JAMAIS bypass** authorization checks

---

## Documentation Complète

- **Architecture** : `src/ARCHITECTURE.md` (26KB)
- **Database** : `docs/DATABASE_SCHEMA.md` (700 lignes)
- **K8s** : `k8s/README.md` (800 lignes)
- **Environment** : `docs/ENV_VARIABLES.md`
- **Deployment** : `/DEPLOYMENT.md`
- **Metrics** : `METRICS_USAGE_EXAMPLES.md`

---

**Dernière mise à jour** : 2026-02-11
**Version** : Rust stable, Axum 0.7+, SQLx 0.7+
