# Best Practices - Rust Backend (Axum)

Guide des bonnes pratiques pour le développement du backend GAUZIAN (Rust / Axum / SQLx / Tokio).

**Dernière mise à jour** : 2026-02-11

---

## Table des Matières

1. [Architecture & Organisation](#architecture--organisation)
2. [Error Handling](#error-handling)
3. [Database (SQLx)](#database-sqlx)
4. [Async/Await & Tokio](#asyncawait--tokio)
5. [Security](#security)
6. [Testing](#testing)
7. [Performance](#performance)
8. [Logging & Monitoring](#logging--monitoring)
9. [Code Style](#code-style)
10. [Common Pitfalls](#common-pitfalls)

---

## Architecture & Organisation

### Modularisation

✅ **DO** : Organiser le code en modules indépendants avec des responsabilités claires.

```rust
// ✅ GOOD - Structure modulaire claire
src/
├── auth/
│   ├── mod.rs          // Public API du module
│   ├── handlers.rs     // HTTP handlers
│   ├── services.rs     // Business logic
│   ├── repo.rs         // Database queries
│   └── models.rs       // Data structures
├── drive/
│   ├── mod.rs
│   ├── handlers.rs
│   ├── services.rs
│   └── repo.rs
└── main.rs

// ❌ BAD - Tout dans un seul fichier
src/
└── main.rs  // 5000 lignes
```

**Pattern recommandé** : **Repository Pattern**

- `handlers.rs` : Extraction des paramètres HTTP, appel des services
- `services.rs` : Business logic (validation, orchestration)
- `repo.rs` : Accès à la base de données (SQLx queries)
- `models.rs` : Structs de données (Request, Response, Entity)

---

### Separation of Concerns

✅ **DO** : Séparer les responsabilités HTTP / Business / Database.

```rust
// ✅ GOOD - Separation claire
// handlers.rs
pub async fn create_file_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<CreateFileRequest>,
) -> Result<Json<FileResponse>, AppError> {
    // 1. Extract & validate HTTP params
    let folder_id = Uuid::parse_str(&req.folder_id)
        .map_err(|_| AppError::BadRequest("Invalid folder_id"))?;

    // 2. Call service (business logic)
    let file = services::create_file(
        &state.db_pool,
        claims.id,
        folder_id,
        req.encrypted_metadata,
        req.size,
    )
    .await?;

    // 3. Return HTTP response
    Ok(Json(FileResponse::from(file)))
}

// services.rs
pub async fn create_file(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    encrypted_metadata: String,
    size: i64,
) -> Result<File, ServiceError> {
    // Business logic: check permissions, validate size, etc.
    if size > MAX_FILE_SIZE {
        return Err(ServiceError::FileTooLarge);
    }

    // Check folder exists and user has access
    repo::check_folder_access(pool, folder_id, user_id).await?;

    // Create file
    repo::insert_file(pool, user_id, folder_id, encrypted_metadata, size).await
}

// repo.rs
pub async fn insert_file(
    pool: &PgPool,
    user_id: Uuid,
    folder_id: Uuid,
    encrypted_metadata: String,
    size: i64,
) -> Result<File, sqlx::Error> {
    sqlx::query_as!(
        File,
        "INSERT INTO files (user_id, folder_id, encrypted_metadata, size)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
        user_id, folder_id, encrypted_metadata, size
    )
    .fetch_one(pool)
    .await
}
```

---

### AppState Pattern

✅ **DO** : Utiliser `AppState` pour injecter toutes les dépendances.

```rust
// ✅ GOOD - AppState centralisé
#[derive(Clone)]
pub struct AppState {
    pub db_pool: PgPool,
    pub redis: RedisPool,
    pub s3_client: S3Client,
    pub jwt_secret: String,
}

// Injection automatique dans handlers
pub async fn my_handler(
    State(state): State<AppState>,  // ← AppState injecté par Axum
    claims: Claims,
) -> Result<Json<Response>, AppError> {
    // Accès à toutes les dépendances
    let user = repo::get_user(&state.db_pool, claims.id).await?;
    let cached = state.redis.get("key").await?;
    // ...
}

// ❌ BAD - Global static state
static DB_POOL: OnceCell<PgPool> = OnceCell::new();  // Pas testable, pas thread-safe

// ❌ BAD - Créer une nouvelle connexion à chaque requête
pub async fn my_handler() -> Result<Json<Response>, AppError> {
    let pool = PgPoolOptions::new()
        .connect(&DATABASE_URL)  // ⚠️ Très coûteux !
        .await?;
    // ...
}
```

**Avantages de AppState** :
- ✅ Type-safe (compile-time errors)
- ✅ Testable (mock AppState dans tests)
- ✅ No global state
- ✅ Connection pooling (réutilisation des connexions DB/Redis)

---

## Error Handling

### Utiliser un Error Type Centralisé

✅ **DO** : Définir un `AppError` centralisé avec `IntoResponse`.

```rust
// ✅ GOOD - Erreur centralisée
#[derive(Debug)]
pub enum AppError {
    Database(sqlx::Error),
    Unauthorized(String),
    NotFound(String),
    BadRequest(String),
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
            }
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg)
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

// Implement From pour conversion automatique
impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e)
    }
}

// Usage dans handlers
pub async fn my_handler(
    State(state): State<AppState>,
) -> Result<Json<Response>, AppError> {
    let user = repo::get_user(&state.db_pool, user_id).await?;  // ← ? convertit sqlx::Error en AppError
    Ok(Json(user))
}
```

---

### Propagation d'Erreurs avec `?`

✅ **DO** : Utiliser `?` operator pour propager les erreurs.

```rust
// ✅ GOOD
pub async fn create_file(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<File, AppError> {
    let folder = repo::get_folder(pool, folder_id).await?;  // ← Propagation automatique
    let file = repo::insert_file(pool, user_id, folder.id).await?;
    Ok(file)
}

// ❌ BAD - unwrap() en production
pub async fn create_file(
    pool: &PgPool,
    user_id: Uuid,
) -> File {
    let folder = repo::get_folder(pool, folder_id).await.unwrap();  // ⚠️ PANIC si erreur !
    repo::insert_file(pool, user_id, folder.id).await.unwrap()
}
```

---

### Contextualiser les Erreurs

✅ **DO** : Ajouter du contexte aux erreurs pour faciliter le debugging.

```rust
// ✅ GOOD - Erreur contextualisée
pub async fn delete_file(
    pool: &PgPool,
    file_id: Uuid,
) -> Result<(), AppError> {
    repo::soft_delete_file(pool, file_id)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete file {}: {}", file_id, e)))?;

    Ok(())
}

// ❌ BAD - Erreur sans contexte
pub async fn delete_file(
    pool: &PgPool,
    file_id: Uuid,
) -> Result<(), AppError> {
    repo::soft_delete_file(pool, file_id).await?;  // Quelle erreur ? Quel file ?
    Ok(())
}
```

**Recommandation** : Utiliser la crate [`anyhow`](https://docs.rs/anyhow) pour ajouter du contexte facilement.

```rust
use anyhow::{Context, Result};

pub async fn delete_file(pool: &PgPool, file_id: Uuid) -> Result<()> {
    repo::soft_delete_file(pool, file_id)
        .await
        .context(format!("Failed to delete file {}", file_id))?;

    Ok(())
}
```

---

## Database (SQLx)

### Utiliser `sqlx::query!` (Compile-Time Checked)

✅ **DO** : Toujours utiliser `query!` ou `query_as!` (vérification à la compilation).

```rust
// ✅ GOOD - Compile-time checked
let user = sqlx::query_as!(
    User,
    "SELECT id, email, username FROM users WHERE id = $1",
    user_id
)
.fetch_one(pool)
.await?;

// ❌ BAD - Runtime errors seulement
let user: User = sqlx::query("SELECT id, email, username FROM users WHERE id = $1")
    .bind(user_id)
    .fetch_one(pool)
    .await?
    .try_into()?;  // ⚠️ Erreur si colonne manquante
```

**Avantages de `query!`** :
- ✅ Typage strict (compile-time errors si colonne manquante ou type incorrect)
- ✅ Autocomplete dans l'IDE
- ✅ Refactoring sûr (renommer une colonne → erreur de compilation)

---

### Connection Pooling

✅ **DO** : Toujours utiliser un pool de connexions (jamais créer de nouvelles connexions).

```rust
// ✅ GOOD - Pool configuré au démarrage
let pool = PgPoolOptions::new()
    .max_connections(20)  // Limite globale
    .acquire_timeout(Duration::from_secs(30))  // Timeout si pool exhausted
    .connect(&database_url)
    .await?;

// Réutiliser le pool pour chaque requête
let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
    .fetch_one(&pool)  // ← Utilise le pool
    .await?;

// ❌ BAD - Nouvelle connexion à chaque requête
let conn = PgConnection::connect(&database_url).await?;  // ⚠️ Très coûteux !
let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
    .fetch_one(&conn)
    .await?;
```

---

### Transactions

✅ **DO** : Utiliser des transactions pour les opérations atomiques.

```rust
// ✅ GOOD - Transaction pour opération atomique
pub async fn transfer_file_ownership(
    pool: &PgPool,
    file_id: Uuid,
    old_owner_id: Uuid,
    new_owner_id: Uuid,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    // 1. Vérifier ownership
    sqlx::query!(
        "SELECT id FROM file_access
         WHERE file_id = $1 AND user_id = $2 AND access_level = 'owner'",
        file_id, old_owner_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| AppError::Unauthorized("Not the owner"))?;

    // 2. Update ancien owner → editor
    sqlx::query!(
        "UPDATE file_access SET access_level = 'editor'
         WHERE file_id = $1 AND user_id = $2",
        file_id, old_owner_id
    )
    .execute(&mut *tx)
    .await?;

    // 3. Créer nouveau owner
    sqlx::query!(
        "INSERT INTO file_access (id, file_id, user_id, access_level, encrypted_file_key)
         VALUES ($1, $2, $3, 'owner', $4)",
        Uuid::new_v4(), file_id, new_owner_id, encrypted_file_key
    )
    .execute(&mut *tx)
    .await?;

    // Commit si tout OK, rollback si erreur
    tx.commit().await?;
    Ok(())
}

// ❌ BAD - Pas de transaction (incohérent si erreur entre les deux requêtes)
pub async fn transfer_file_ownership(
    pool: &PgPool,
    file_id: Uuid,
    old_owner_id: Uuid,
    new_owner_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query!("UPDATE file_access SET access_level = 'editor' WHERE file_id = $1", file_id)
        .execute(pool)
        .await?;

    // ⚠️ Si erreur ici, l'ancien owner a perdu ownership sans nouveau owner !
    sqlx::query!("INSERT INTO file_access (...) VALUES (...)")
        .execute(pool)
        .await?;

    Ok(())
}
```

---

### SQL Injection Prevention

✅ **DO** : Toujours utiliser des paramètres bindés (`$1`, `$2`) - **JAMAIS de string interpolation**.

```rust
// ✅ GOOD - Paramètres bindés (safe)
let email = req.email;
let user = sqlx::query_as!(
    User,
    "SELECT * FROM users WHERE email = $1",
    email  // ← SQLx échappe automatiquement
)
.fetch_one(pool)
.await?;

// ❌ BAD - String interpolation (SQL injection vulnérable !)
let email = req.email;
let query = format!("SELECT * FROM users WHERE email = '{}'", email);  // ⚠️ DANGER !
let user = sqlx::query(&query).fetch_one(pool).await?;

// Attaque possible :
// email = "'; DROP TABLE users; --"
// → SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
```

**⚠️ CRITIQUE** : **JAMAIS** utiliser `format!()` ou string concatenation pour construire des requêtes SQL.

---

### Indices & Performance

✅ **DO** : Créer des indices sur les colonnes fréquemment utilisées dans les WHERE clauses.

```sql
-- ✅ GOOD - Indices pour requêtes courantes
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_file_access_user_id ON file_access(user_id);
CREATE INDEX idx_file_access_file_id ON file_access(file_id);

-- Requête optimisée (utilise l'indice)
SELECT * FROM files WHERE folder_id = '...';  -- ← Index scan (rapide)
```

```rust
// ❌ BAD - Pas d'indice sur folder_id
// Requête lente (full table scan)
SELECT * FROM files WHERE folder_id = '...';  -- ⚠️ Lent si beaucoup de fichiers
```

**Vérifier les indices** :

```sql
EXPLAIN ANALYZE SELECT * FROM files WHERE folder_id = '...';
-- Doit afficher "Index Scan" (pas "Seq Scan")
```

---

## Async/Await & Tokio

### Toujours `async` pour I/O

✅ **DO** : Utiliser `async fn` pour toutes les opérations I/O (DB, Redis, S3, HTTP).

```rust
// ✅ GOOD - Async I/O
pub async fn get_file(pool: &PgPool, file_id: Uuid) -> Result<File, AppError> {
    sqlx::query_as!(File, "SELECT * FROM files WHERE id = $1", file_id)
        .fetch_one(pool)  // ← Async I/O
        .await?;
    Ok(file)
}

// ❌ BAD - Blocking I/O dans runtime Tokio
pub async fn get_file_blocking(file_id: Uuid) -> Result<File, AppError> {
    let file = std::fs::read_to_string("file.json")?;  // ⚠️ Bloque le thread Tokio !
    Ok(serde_json::from_str(&file)?)
}
```

---

### Éviter `block_on` dans Async Context

❌ **DON'T** : **JAMAIS** utiliser `block_on()` dans un contexte async.

```rust
// ❌ BAD - Deadlock garanti !
pub async fn my_handler(State(state): State<AppState>) -> Result<Json<Response>, AppError> {
    let result = tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(async {  // ⚠️ DEADLOCK si déjà dans runtime Tokio !
            repo::get_user(&state.db_pool, user_id).await
        })?;

    Ok(Json(result))
}

// ✅ GOOD - Juste await
pub async fn my_handler(State(state): State<AppState>) -> Result<Json<Response>, AppError> {
    let result = repo::get_user(&state.db_pool, user_id).await?;
    Ok(Json(result))
}
```

---

### Blocking Tasks

✅ **DO** : Utiliser `spawn_blocking` pour les tâches CPU-intensives.

```rust
// ✅ GOOD - CPU-intensive task dans spawn_blocking
pub async fn hash_password(password: &str) -> Result<String, AppError> {
    let password = password.to_string();

    // Argon2 hashing est CPU-intensive → spawn_blocking
    let hash = tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        argon2.hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|e| AppError::Internal(format!("Hashing error: {}", e)))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))??;

    Ok(hash)
}

// ❌ BAD - CPU-intensive task bloque le thread Tokio
pub async fn hash_password_bad(password: &str) -> Result<String, AppError> {
    // ⚠️ Bloque le thread Tokio pendant plusieurs centaines de ms !
    let hash = Argon2::default().hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}
```

**Règle** : Si l'opération prend > 10ms CPU-bound (pas I/O), utiliser `spawn_blocking`.

---

### Concurrency avec `join!` et `try_join!`

✅ **DO** : Utiliser `join!` pour paralléliser les opérations indépendantes.

```rust
use tokio::try_join;

// ✅ GOOD - Parallélisation de 3 requêtes indépendantes
pub async fn get_dashboard_data(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<DashboardData, AppError> {
    let (files, folders, quota) = try_join!(
        repo::get_user_files(pool, user_id),
        repo::get_user_folders(pool, user_id),
        repo::get_user_quota(pool, user_id),
    )?;

    Ok(DashboardData { files, folders, quota })
}

// ❌ BAD - Séquentiel (3x plus lent !)
pub async fn get_dashboard_data_slow(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<DashboardData, AppError> {
    let files = repo::get_user_files(pool, user_id).await?;  // 50ms
    let folders = repo::get_user_folders(pool, user_id).await?;  // 50ms
    let quota = repo::get_user_quota(pool, user_id).await?;  // 50ms
    // Total: 150ms au lieu de ~50ms avec try_join!

    Ok(DashboardData { files, folders, quota })
}
```

---

## Security

### Password Hashing

✅ **DO** : Utiliser **Argon2** (pas SHA-256).

```rust
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

// ✅ GOOD - Argon2 (OWASP recommended)
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Hashing error: {}", e)))?;

    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(format!("Invalid hash: {}", e)))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

// ❌ BAD - SHA-256 (pas de salt, pas de coût computationnel)
use sha2::{Sha256, Digest};

pub fn hash_password_bad(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())  // ⚠️ Vulnérable aux rainbow tables !
}
```

**Pourquoi Argon2 ?**
- ✅ Résistant aux attaques GPU/ASIC (memory-hard)
- ✅ Coût computationnel ajustable
- ✅ Winner de la Password Hashing Competition (PHC)

---

### JWT Secrets

✅ **DO** : Utiliser des secrets forts (256 bits minimum).

```rust
// ✅ GOOD - Secret fort
let jwt_secret = env::var("JWT_SECRET")
    .expect("JWT_SECRET must be set");

// Validation au démarrage
if jwt_secret.len() < 32 {
    panic!("JWT_SECRET must be at least 256 bits (32 bytes)");
}

// ❌ BAD - Secret faible
let jwt_secret = "secret123";  // ⚠️ Vulnérable aux attaques brute-force !
```

**Génération de secret sécurisé** :

```bash
openssl rand -hex 32  # 256 bits
```

---

### Input Validation

✅ **DO** : Toujours valider les entrées utilisateur (XSS, injection, etc.).

```rust
use validator::Validate;

#[derive(Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email)]
    pub email: String,

    #[validate(length(min = 8, max = 128))]
    pub password: String,

    #[validate(length(min = 3, max = 50))]
    pub username: String,
}

pub async fn register_handler(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<Response>, AppError> {
    // Validation automatique
    req.validate()
        .map_err(|e| AppError::BadRequest(format!("Validation error: {}", e)))?;

    // ... rest of handler
}

// ❌ BAD - Pas de validation
pub async fn register_handler_bad(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<Response>, AppError> {
    // ⚠️ Accepte n'importe quoi : email invalide, password vide, etc.
    let user = repo::create_user(&state.db_pool, req).await?;
    Ok(Json(user))
}
```

---

### CORS Configuration

✅ **DO** : Configurer CORS strictement en production.

```rust
use tower_http::cors::{CorsLayer, Any};
use http::Method;

// ✅ GOOD - CORS strict en production
let cors = CorsLayer::new()
    .allow_origin("https://gauzian.com".parse::<HeaderValue>().unwrap())  // ← Domaine spécifique
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_credentials(true)  // ⚠️ CRITIQUE pour cookies JWT
    .allow_headers([AUTHORIZATION, CONTENT_TYPE]);

let app = Router::new()
    .route("/api/files", get(list_files))
    .layer(cors);

// ❌ BAD - CORS permissif (accepte tous les domaines)
let cors = CorsLayer::new()
    .allow_origin(Any)  // ⚠️ DANGER : N'importe quel site peut appeler l'API !
    .allow_credentials(true);
```

---

### Logging Sécurisé

❌ **DON'T** : **JAMAIS** logger de données sensibles.

```rust
// ✅ GOOD - Logs sécurisés
tracing::info!(user_id = %user.id, "User logged in");  // ✅ OK

// ❌ BAD - Logs sensibles
tracing::info!("User logged in with password: {}", password);  // ⚠️ DANGER !
tracing::debug!("JWT token: {}", token);  // ⚠️ DANGER !
tracing::error!("Database error: {:?}", user);  // ⚠️ Peut contenir encrypted_private_key !
```

**Liste de données à JAMAIS logger** :
- ❌ Passwords (plaintext ou hashed)
- ❌ JWT tokens
- ❌ `encrypted_private_key`, `encrypted_file_key`
- ❌ API keys, secrets
- ❌ Numéros de carte de crédit, SSN, etc.

---

## Testing

### Unit Tests

✅ **DO** : Écrire des tests unitaires pour la business logic.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_file_size() {
        assert!(validate_file_size(1024).is_ok());
        assert!(validate_file_size(MAX_FILE_SIZE + 1).is_err());
    }

    #[tokio::test]
    async fn test_hash_password() {
        let password = "password123";
        let hash = hash_password(password).await.unwrap();

        assert!(verify_password(password, &hash).await.unwrap());
        assert!(!verify_password("wrong_password", &hash).await.unwrap());
    }
}
```

---

### Integration Tests

✅ **DO** : Tester les handlers avec une DB de test.

```rust
// tests/integration_test.rs
use sqlx::PgPool;

async fn setup_test_db() -> PgPool {
    let pool = PgPoolOptions::new()
        .connect("postgres://localhost/test_db")
        .await
        .unwrap();

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .unwrap();

    pool
}

#[tokio::test]
async fn test_create_file() {
    let pool = setup_test_db().await;

    let file = repo::create_file(
        &pool,
        Uuid::new_v4(),
        "encrypted_metadata",
        1024,
    )
    .await
    .unwrap();

    assert_eq!(file.size, 1024);

    // Cleanup
    sqlx::query!("DELETE FROM files WHERE id = $1", file.id)
        .execute(&pool)
        .await
        .unwrap();
}
```

---

### Mock Dependencies

✅ **DO** : Mocker les dépendances externes (S3, Redis) dans les tests.

```rust
use mockall::predicate::*;
use mockall::mock;

mock! {
    pub S3Client {
        async fn put_object(&self, key: &str, data: Vec<u8>) -> Result<(), S3Error>;
        async fn get_object(&self, key: &str) -> Result<Vec<u8>, S3Error>;
    }
}

#[tokio::test]
async fn test_upload_chunk() {
    let mut mock_s3 = MockS3Client::new();

    // Mock S3 put_object
    mock_s3
        .expect_put_object()
        .with(eq("chunk_0"), any())
        .times(1)
        .returning(|_, _| Ok(()));

    // Test handler avec mock
    let result = upload_chunk_handler(mock_s3, "file_id", "chunk_0", vec![0; 1024]).await;

    assert!(result.is_ok());
}
```

---

## Performance

### N+1 Query Problem

❌ **DON'T** : Éviter les requêtes N+1.

```rust
// ❌ BAD - N+1 queries (1 + N requêtes)
pub async fn get_files_with_access(pool: &PgPool, user_id: Uuid) -> Result<Vec<FileWithAccess>, AppError> {
    let files = sqlx::query_as!(File, "SELECT * FROM files WHERE user_id = $1", user_id)
        .fetch_all(pool)
        .await?;

    let mut result = Vec::new();
    for file in files {
        // ⚠️ Requête SQL pour chaque fichier (N requêtes)
        let access = sqlx::query_as!(
            FileAccess,
            "SELECT * FROM file_access WHERE file_id = $1",
            file.id
        )
        .fetch_all(pool)
        .await?;

        result.push(FileWithAccess { file, access });
    }

    Ok(result)
}

// ✅ GOOD - Une seule requête avec JOIN
pub async fn get_files_with_access(pool: &PgPool, user_id: Uuid) -> Result<Vec<FileWithAccess>, AppError> {
    let rows = sqlx::query!(
        "SELECT
            f.id AS file_id, f.encrypted_metadata, f.size,
            fa.user_id AS access_user_id, fa.access_level
         FROM files f
         LEFT JOIN file_access fa ON f.id = fa.file_id
         WHERE f.user_id = $1",
        user_id
    )
    .fetch_all(pool)
    .await?;

    // Group by file_id (en mémoire)
    let mut files_map: HashMap<Uuid, FileWithAccess> = HashMap::new();
    for row in rows {
        files_map.entry(row.file_id).or_insert_with(|| FileWithAccess {
            file: File { id: row.file_id, encrypted_metadata: row.encrypted_metadata, size: row.size },
            access: Vec::new(),
        });

        if let Some(access_user_id) = row.access_user_id {
            files_map.get_mut(&row.file_id).unwrap().access.push(FileAccess {
                user_id: access_user_id,
                access_level: row.access_level,
            });
        }
    }

    Ok(files_map.into_values().collect())
}
```

---

### Caching avec Redis

✅ **DO** : Cacher les données fréquemment lues et rarement modifiées.

```rust
use redis::AsyncCommands;

// ✅ GOOD - Cache avec Redis
pub async fn get_user_cached(
    pool: &PgPool,
    redis: &mut redis::aio::Connection,
    user_id: Uuid,
) -> Result<User, AppError> {
    let cache_key = format!("user:{}", user_id);

    // 1. Check cache
    let cached: Option<String> = redis.get(&cache_key).await.ok();

    if let Some(cached) = cached {
        return Ok(serde_json::from_str(&cached)?);
    }

    // 2. Cache miss → fetch from DB
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(pool)
        .await?;

    // 3. Save to cache (TTL 5 min)
    let serialized = serde_json::to_string(&user)?;
    redis.set_ex(&cache_key, serialized, 300).await?;

    Ok(user)
}

// ❌ BAD - Pas de cache (requête DB à chaque fois)
pub async fn get_user_no_cache(pool: &PgPool, user_id: Uuid) -> Result<User, AppError> {
    sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(pool)
        .await
        .map_err(Into::into)
}
```

**Invalidation du cache** :

```rust
pub async fn update_user(
    pool: &PgPool,
    redis: &mut redis::aio::Connection,
    user_id: Uuid,
    new_email: String,
) -> Result<(), AppError> {
    // 1. Update DB
    sqlx::query!("UPDATE users SET email = $1 WHERE id = $2", new_email, user_id)
        .execute(pool)
        .await?;

    // 2. Invalidate cache
    let cache_key = format!("user:{}", user_id);
    redis.del(&cache_key).await?;

    Ok(())
}
```

---

### Pagination

✅ **DO** : Toujours paginer les listes volumineuses.

```rust
// ✅ GOOD - Pagination avec LIMIT/OFFSET
#[derive(Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    page: i64,
    #[serde(default = "default_per_page")]
    per_page: i64,
}

fn default_page() -> i64 { 1 }
fn default_per_page() -> i64 { 50 }

pub async fn list_files(
    pool: &PgPool,
    user_id: Uuid,
    params: PaginationParams,
) -> Result<Vec<File>, AppError> {
    let offset = (params.page - 1) * params.per_page;

    let files = sqlx::query_as!(
        File,
        "SELECT * FROM files
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3",
        user_id, params.per_page, offset
    )
    .fetch_all(pool)
    .await?;

    Ok(files)
}

// ❌ BAD - Pas de pagination (retourne TOUS les fichiers)
pub async fn list_files_bad(pool: &PgPool, user_id: Uuid) -> Result<Vec<File>, AppError> {
    sqlx::query_as!(File, "SELECT * FROM files WHERE user_id = $1", user_id)
        .fetch_all(pool)  // ⚠️ Peut retourner 10,000+ fichiers !
        .await
        .map_err(Into::into)
}
```

---

## Logging & Monitoring

### Structured Logging avec `tracing`

✅ **DO** : Utiliser `tracing` (pas `println!`).

```rust
use tracing::{info, warn, error, instrument};

// ✅ GOOD - Structured logging
#[instrument(skip(pool))]
pub async fn create_file(
    pool: &PgPool,
    user_id: Uuid,
    size: i64,
) -> Result<File, AppError> {
    info!(user_id = %user_id, size, "Creating file");

    let file = repo::insert_file(pool, user_id, size).await?;

    info!(file_id = %file.id, "File created successfully");

    Ok(file)
}

// ❌ BAD - println! (pas de métadonnées, pas de filtrage)
pub async fn create_file_bad(
    pool: &PgPool,
    user_id: Uuid,
    size: i64,
) -> Result<File, AppError> {
    println!("Creating file for user {}", user_id);  // ⚠️ Pas structuré

    let file = repo::insert_file(pool, user_id, size).await?;

    println!("File created: {}", file.id);

    Ok(file)
}
```

**Configuration** :

```rust
// main.rs
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string())
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // ...
}
```

---

### Prometheus Metrics

✅ **DO** : Expoer des métriques custom pour le monitoring.

```rust
use prometheus::{IntCounter, IntGauge, Histogram, register_int_counter, register_histogram};

lazy_static! {
    pub static ref FILE_UPLOADS_TOTAL: IntCounter =
        register_int_counter!("gauzian_file_uploads_total", "Total file uploads").unwrap();

    pub static ref ACTIVE_UPLOADS: IntGauge =
        register_int_gauge!("gauzian_active_uploads", "Active file uploads").unwrap();

    pub static ref UPLOAD_DURATION: Histogram =
        register_histogram!("gauzian_upload_duration_seconds", "Upload duration").unwrap();
}

pub async fn upload_file_handler(/* ... */) -> Result<(), AppError> {
    let _timer = UPLOAD_DURATION.start_timer();
    ACTIVE_UPLOADS.inc();
    FILE_UPLOADS_TOTAL.inc();

    // ... upload logic ...

    ACTIVE_UPLOADS.dec();
    Ok(())
}
```

---

## Code Style

### Naming Conventions

✅ **DO** : Suivre les conventions Rust.

```rust
// ✅ GOOD
struct UserAccount { /* ... */ }  // PascalCase pour types
const MAX_FILE_SIZE: i64 = 1024 * 1024 * 100;  // SCREAMING_SNAKE_CASE pour constantes
fn create_user() { /* ... */ }  // snake_case pour fonctions
let user_id = Uuid::new_v4();  // snake_case pour variables

// ❌ BAD
struct user_account { /* ... */ }  // ⚠️ Devrait être PascalCase
const maxFileSize: i64 = 100;  // ⚠️ Devrait être SCREAMING_SNAKE_CASE
fn CreateUser() { /* ... */ }  // ⚠️ Devrait être snake_case
let userId = Uuid::new_v4();  // ⚠️ Devrait être snake_case
```

---

### Documentation

✅ **DO** : Documenter les fonctions publiques.

```rust
/// Creates a new file record in the database.
///
/// # Arguments
///
/// * `pool` - Database connection pool
/// * `user_id` - ID of the file owner
/// * `size` - File size in bytes
///
/// # Returns
///
/// The created `File` record.
///
/// # Errors
///
/// Returns `AppError::Database` if the database query fails.
pub async fn create_file(
    pool: &PgPool,
    user_id: Uuid,
    size: i64,
) -> Result<File, AppError> {
    // ...
}
```

---

### Rustfmt & Clippy

✅ **DO** : Toujours formater le code avec `rustfmt` et vérifier avec `clippy`.

```bash
# Formatter le code
cargo fmt

# Vérifier les warnings
cargo clippy -- -D warnings

# Avant chaque commit
cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

---

## Common Pitfalls

### Pitfall #1 : Oublier `.await`

```rust
// ❌ BAD - Oublier .await
pub async fn get_user(pool: &PgPool, user_id: Uuid) -> Result<User, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(pool);  // ⚠️ Retourne Future<Output = Result<User, sqlx::Error>>, pas User !

    Ok(user)  // ⚠️ Erreur de compilation : expected User, found Future
}

// ✅ GOOD
pub async fn get_user(pool: &PgPool, user_id: Uuid) -> Result<User, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(pool)
        .await?;  // ← .await pour exécuter la future

    Ok(user)
}
```

---

### Pitfall #2 : Cloner inutilement

```rust
// ❌ BAD - Clone inutile (coûteux pour String, Vec)
pub fn process_metadata(metadata: String) -> String {
    let cloned = metadata.clone();  // ⚠️ Clone inutile
    cloned.to_uppercase()
}

// ✅ GOOD - Consommer directement (move)
pub fn process_metadata(metadata: String) -> String {
    metadata.to_uppercase()
}

// ✅ GOOD - Emprunter si on doit garder l'original
pub fn process_metadata(metadata: &str) -> String {
    metadata.to_uppercase()
}
```

---

### Pitfall #3 : unwrap() en Production

```rust
// ❌ BAD - unwrap() peut paniquer
pub async fn my_handler(State(state): State<AppState>) -> Json<Response> {
    let user = repo::get_user(&state.db_pool, user_id)
        .await
        .unwrap();  // ⚠️ PANIC si erreur DB !

    Json(Response { user })
}

// ✅ GOOD - Gérer l'erreur proprement
pub async fn my_handler(
    State(state): State<AppState>,
) -> Result<Json<Response>, AppError> {
    let user = repo::get_user(&state.db_pool, user_id).await?;  // ← Propagation d'erreur

    Ok(Json(Response { user }))
}
```

---

### Pitfall #4 : Mutex dans Async

❌ **DON'T** : **JAMAIS** utiliser `std::sync::Mutex` dans code async.

```rust
use std::sync::Mutex;

// ❌ BAD - std::sync::Mutex bloque le thread Tokio
lazy_static! {
    static ref COUNTER: Mutex<i64> = Mutex::new(0);
}

pub async fn increment_counter() {
    let mut count = COUNTER.lock().unwrap();  // ⚠️ Bloque le thread !
    *count += 1;
}

// ✅ GOOD - tokio::sync::Mutex (async-safe)
use tokio::sync::Mutex;

lazy_static! {
    static ref COUNTER: Mutex<i64> = Mutex::new(0);
}

pub async fn increment_counter() {
    let mut count = COUNTER.lock().await;  // ← Async lock
    *count += 1;
}
```

---

### Pitfall #5 : Lifetime Issues

```rust
// ❌ BAD - Lifetime error (dangling reference)
pub async fn get_user_email(pool: &PgPool, user_id: Uuid) -> &str {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(pool)
        .await
        .unwrap();

    &user.email  // ⚠️ Erreur : user est dropped à la fin de la fonction !
}

// ✅ GOOD - Retourner String (ownership)
pub async fn get_user_email(pool: &PgPool, user_id: Uuid) -> Result<String, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", user_id)
        .fetch_one(pool)
        .await?;

    Ok(user.email)  // ← Move ownership
}
```

---

## Résumé des Règles d'Or

1. ✅ **Architecture** : Modulariser (handlers → services → repo)
2. ✅ **Errors** : Utiliser `Result<T, AppError>` + `?` operator
3. ✅ **Database** : `query!` (compile-time checked) + connection pooling
4. ✅ **Async** : `async fn` pour I/O, `spawn_blocking` pour CPU
5. ✅ **Security** : Argon2, strong JWT secrets, input validation, CORS strict
6. ✅ **Testing** : Unit tests + integration tests + mocks
7. ✅ **Performance** : Éviter N+1, caching Redis, pagination
8. ✅ **Logging** : `tracing` (structured) + Prometheus metrics
9. ✅ **Style** : `rustfmt` + `clippy` + documentation
10. ❌ **Never** : `unwrap()` en prod, `std::sync::Mutex` dans async, logger secrets

---

**Ressources** :
- [Rust Book](https://doc.rust-lang.org/book/)
- [Axum Docs](https://docs.rs/axum)
- [SQLx Docs](https://docs.rs/sqlx)
- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/)

**Dernière mise à jour** : 2026-02-11
