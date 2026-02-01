# Architecture Modulaire - Gauzian Backend

## 📁 Structure Complète du Projet

```
gauzian_back/
├── src/
│   ├── main.rs                    # Point d'entrée (serveur Axum, DB pool, migrations)
│   ├── lib.rs                     # Déclaration des modules publics
│   │
│   ├── state.rs                   # AppState partagé (DB, Redis, S3, JWT)
│   ├── routes.rs                  # Composition des routes (assemble auth + drive)
│   ├── response.rs                # ApiResponse<T> avec gestion cookies/tokens
│   ├── storage.rs                 # Client S3/MinIO pour chunks E2EE
│   ├── metrics.rs                 # Métriques Prometheus (HTTP, business logic)
│   │
│   ├── auth/                      # 🔐 Module d'authentification
│   │   ├── mod.rs                 # Exports (auth_routes, Claims)
│   │   ├── routes.rs              # 7 routes (/login, /register, /logout, ...)
│   │   ├── handlers.rs            # 7 handlers HTTP
│   │   ├── services.rs            # JWT (create/verify), password hashing, Redis blacklist
│   │   └── repo.rs                # Queries SQL (users, public keys)
│   │
│   └── drive/                     # 📁 Module gestion fichiers/dossiers E2EE
│       ├── mod.rs                 # Exports (drive_routes)
│       ├── routes.rs              # 32 routes (fichiers, dossiers, partage, corbeille)
│       ├── handlers.rs            # 47 handlers HTTP (1416 lignes)
│       ├── services.rs            # Helpers (parse_uuid_or_error, format_string_to_uuid_or_root)
│       └── repo.rs                # Queries SQL massives (1900 lignes)
│
├── migrations/                    # Migrations SQLx (schema PostgreSQL)
├── k8s/                          # Manifests Kubernetes (Deployment, Service, Ingress)
└── docker-compose.dev.yml        # Stack locale (Postgres, Redis, MinIO)
```

---

## 🏗️ Architecture Clean: Flux de Responsabilités

```
┌─────────────────────────────────────────────────────────────┐
│                   HTTP Request                               │
│             POST /drive/upload_chunk                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  📍 routes.rs - Routage principal                            │
│  .nest("/drive", drive::drive_routes())                      │
│  .with_state(state)  ← État injecté UNE SEULE FOIS          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  📍 drive/routes.rs - Définition des routes du module        │
│  .route("/upload_chunk", post(handlers::upload_chunk_handler))│
│  Retourne Router<AppState> (type générique)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  🎯 drive/handlers.rs - Orchestration HTTP                   │
│                                                               │
│  pub async fn upload_chunk_handler(                          │
│      State(state): State<AppState>,  ← Injection auto        │
│      claims: Claims,                 ← Middleware JWT        │
│      Json(body): Json<UploadChunkRequest>,                   │
│  ) -> Response {                                             │
│      // 1. Parse & validate input                            │
│      // 2. Appelle services::                                │
│      // 3. Appelle repo:: (SQL)                              │
│      // 4. Retourne ApiResponse::ok() ou ::internal_error()  │
│  }                                                            │
└────────────┬─────────────────────┬──────────────────────────┘
             │                     │
             ▼                     ▼
┌──────────────────────┐  ┌───────────────────────────────────┐
│ 🧠 services.rs       │  │ 🗄️ repo.rs                        │
│                      │  │                                   │
│ Logique métier pure  │  │ Accès base de données (SQLx)      │
│ - parse_uuid_or_error│  │ - create_folder_in_db()           │
│ - format_to_uuid     │  │ - get_file_info()                 │
│                      │  │ - share_file_with_contact()       │
│ Aucune dépendance    │  │ - get_folder_contents()           │
│ HTTP ou DB           │  │                                   │
│                      │  │ Retourne Result<T, sqlx::Error>   │
└──────────────────────┘  └───────────────────────────────────┘
```

---

## 🔑 Le Secret du Partage d'AppState: Type-Safe Injection

### ❓ Problème Résolu
> "Comment tous les modules partagent le même AppState sans le cloner manuellement ?"

### ✅ Solution: Système de Types Rust + Axum

L'AppState est **injecté via le système de types** de Rust, pas cloné manuellement !

#### 1️⃣ **Définition Unique** (`state.rs`)
```rust
#[derive(Clone)]
pub struct AppState {
    pub jwt_secret: String,
    pub redis_client: redis::Client,
    pub db_pool: PgPool,
    pub storage_client: StorageClient,
}

impl AppState {
    pub async fn from_env(db_pool: PgPool) -> Self {
        // Charge JWT_SECRET, REDIS_URL, S3_* depuis l'environnement
    }
}
```

#### 2️⃣ **Import dans Chaque Module** (`auth/routes.rs`, `drive/routes.rs`)
```rust
use crate::state::AppState;  // ← Import du type
```

#### 3️⃣ **Retour de Router Générique** (pas d'instanciation)
```rust
// auth/routes.rs
pub fn auth_routes() -> Router<AppState> {  // ← Type générique
    Router::new()
        .route("/login", post(handlers::login_handler))
        .route("/register", post(handlers::register_handler))
    // ❌ PAS de .with_state() ici !
}
```

#### 4️⃣ **Injection Finale** (`routes.rs`)
```rust
pub fn app(state: AppState) -> Router {
    Router::new()
        .merge(auth::auth_routes())           // Routes sans préfixe
        .nest("/drive", drive::drive_routes()) // Routes préfixées /drive/*
        .with_state(state)  // ← État injecté ICI pour tout le graphe
}
```

#### 5️⃣ **Extraction dans les Handlers** (`auth/handlers.rs`)
```rust
pub async fn login_handler(
    State(state): State<AppState>,  // ← Axum injecte automatiquement !
    Json(payload): Json<LoginRequest>,
) -> Result<ApiResponse<LoginResponse>, (StatusCode, String)> {
    // Accès direct à state.db_pool, state.redis_client, etc.
    let user = repo::get_user_by_email(&state.db_pool, &payload.email).await?;
    // ...
}
```

### 🎯 Points Clés
- **`Router<AppState>`** = "Ce router a besoin d'un AppState" (promesse de type)
- **`State(state): State<AppState>`** = "Axum, injecte-moi l'état s'il te plaît"
- **`with_state(state)`** = "Voilà l'état concret à injecter dans tout le graphe"
- **Le compilateur vérifie** que tout est cohérent à la compilation, pas à l'exécution !

---

## 📦 Modules Détaillés

### 🔐 Module `auth/` - Authentification & Utilisateurs

#### Routes (`auth/routes.rs`)
```rust
POST   /login                           # Authentifie, retourne JWT cookie
POST   /register                        # Crée un utilisateur + clés E2EE
POST   /logout                          # Blacklist le JWT dans Redis
GET    /autologin                       # Vérifie si le token est valide
GET    /protected                       # Endpoint protégé (exemple)
GET    /info                            # Infos utilisateur connecté
GET    /contacts/get_public_key/:email # Récupère clé publique d'un contact
```

#### Handlers (`auth/handlers.rs`)
- Parse les requêtes (LoginRequest, RegisterRequest)
- Extrait `State<AppState>` et `Claims` (middleware JWT)
- Orchestre `services` (hash password, create JWT) et `repo` (SQL)
- Retourne `ApiResponse::ok()` avec `.with_token()` pour les cookies

#### Services (`auth/services.rs`)
```rust
// JWT
pub fn create_jwt(user_id: Uuid, role: &str, secret: &[u8]) -> Result<String>
pub fn verify_jwt(token: &str, secret: &[u8]) -> Result<Claims>

// Password
pub fn hash_password(password: &str) -> Result<String>  // Argon2
pub fn verify_password(password: &str, hash: &str, salt: &str) -> bool

// Blacklist Redis
pub async fn blacklist_token(redis: &Client, jti: &str, ttl: i64)
pub async fn is_token_blacklisted(redis: &Client, jti: &str) -> bool

// Claims (re-exporté dans mod.rs)
#[derive(Deserialize, Serialize)]
pub struct Claims {
    pub id: Uuid,       // user_id
    pub role: String,   // "user" | "admin"
    pub jti: String,    // Token ID unique (pour blacklist)
    pub exp: usize,     // Expiration timestamp
}
```

**Claims Middleware**: Extrait automatiquement le token depuis :
- Cookie `auth_token=...`
- Header `Authorization: Bearer <token>`

#### Repo (`auth/repo.rs`)
```rust
pub async fn create_user(pool: &PgPool, user: NewUser) -> Result<Uuid>
pub async fn get_user_by_email(pool: &PgPool, email: &str) -> Result<User>
pub async fn get_user_by_id(pool: &PgPool, user_id: Uuid) -> Result<UserInfo>
pub async fn get_public_key_by_email(pool: &PgPool, email: &str) -> Result<(Uuid, String)>
```

---

### 📁 Module `drive/` - Fichiers, Dossiers, Partage E2EE

#### Routes (`drive/routes.rs`) - 32 endpoints

**Fichiers (15 routes)**
```rust
POST   /initialize_file          # Crée un fichier vide, retourne file_id
POST   /upload_chunk             # Upload un chunk chiffré vers S3
POST   /finalize_upload/:file_id/:etat  # Marque upload terminé/failed
POST   /abort_upload             # Annule un upload en cours
GET    /file/:file_id            # Métadonnées d'un fichier
GET    /download/:file_id        # Download fichier complet (ou métadonnées chunks)
GET    /download_chunk/:s3_key   # Download un chunk depuis S3
POST   /delete_file              # Soft delete (is_deleted=true)
POST   /rename_file              # Renomme (update encrypted_metadata)
POST   /move_file                # Change de dossier parent
POST   /restore_file             # Restaure depuis corbeille
POST   /share_file               # Partage avec contact (clé re-chiffrée)
GET    /file/:file_id/InfoItem   # Infos détaillées (métadonnées + accès)
POST   /propagate_file_access    # Propage permissions récursives
POST   /revoke-access            # Révoque accès fichier/dossier
```

**Dossiers (12 routes)**
```rust
POST   /create_folder                    # Crée un dossier
GET    /get_folder/:folder_id           # Métadonnées d'un dossier
GET    /folder_contents/:folder_id      # Liste récursive des contenus
POST   /delete_folder                   # Soft delete
POST   /rename_folder                   # Renomme
POST   /move_folder                     # Change de parent
POST   /restore_folder                  # Restaure depuis corbeille
POST   /share_folder                    # Partage avec contact
POST   /share_folder_batch              # Partage avec plusieurs contacts
GET    /folder/:folder_id/shared_users  # Liste des utilisateurs ayant accès
GET    /folder/:folder_id/InfoItem      # Infos détaillées
POST   /propagate_folder_access         # Propage permissions
```

**Vues Globales (5 routes)**
```rust
GET    /get_all_drive_info/:parent_id  # Infos compte + drive (stockage, quotas)
GET    /get_file_folder/:parent_id     # Liste fichiers + dossiers d'un parent
POST   /empty_trash                    # Supprime définitivement tous les éléments de la corbeille
```

#### Handlers (`drive/handlers.rs`) - 47 fonctions
- **Upload Multi-Chunk**: `initialize_file` → `upload_chunk` (N fois) → `finalize_upload`
- **Permissions**: Vérifie ownership/access_level avant toute opération
- **UUID Parsing**: Utilise `services::parse_uuid_or_error()` pour valider folder_id/file_id
- **Error Handling**: Retourne `ApiResponse::bad_request()`, `::not_found()`, `::internal_error()`

#### Services (`drive/services.rs`)
```rust
/// Parse UUID avec support de "null", "root", "" → None
/// Retourne Err si format invalide
pub fn parse_uuid_or_error(s: &str) -> Result<Option<Uuid>, String>

/// Parse UUID avec fallback None (pas d'erreur)
pub fn format_string_to_uuid_or_root(s: &str) -> Option<Uuid>
```

**Exemple d'utilisation dans un handler** :
```rust
let folder_id = match services::parse_uuid_or_error(&body.folder_id) {
    Ok(id) => id,
    Err(err) => {
        return ApiResponse::bad_request(err).into_response();
    }
};
```

#### Repo (`drive/repo.rs`) - 1900 lignes de SQL
```rust
// Fichiers
pub async fn initialize_file_in_db(...) -> Result<Uuid>
pub async fn get_file_info(pool: &PgPool, file_id: Uuid) -> Result<FileInfo>
pub async fn delete_file(pool: &PgPool, user_id: Uuid, file_id: Uuid) -> Result<()>
pub async fn share_file_with_contact(...) -> Result<()>

// Dossiers
pub async fn create_folder_in_db(...) -> Result<Uuid>
pub async fn get_folder_contents(...) -> Result<Vec<FolderItem>>
pub async fn get_folder_contents_recursive(...) -> Result<serde_json::Value>
pub async fn share_folder_with_contact(...) -> Result<()>

// Permissions
pub async fn check_file_access(...) -> Result<bool>
pub async fn propagate_folder_access_recursive(...) -> Result<()>

// Corbeille
pub async fn restore_file(...) -> Result<()>
pub async fn empty_trash(pool: &PgPool, user_id: Uuid) -> Result<()>
```

---

## 🔄 Flux Complet d'une Requête: `POST /login`

```
1. Client envoie
   ┌────────────────────────────────────────┐
   │ POST /login                             │
   │ Content-Type: application/json          │
   │ {"email": "user@example.com",           │
   │  "password": "secure123"}               │
   └────────────────────────────────────────┘
                    │
                    ▼
2. routes.rs → auth::auth_routes() → /login
                    │
                    ▼
3. Axum injecte State<AppState> + Json<LoginRequest>
   ┌────────────────────────────────────────┐
   │ auth/handlers.rs::login_handler()       │
   │                                         │
   │ State(state): State<AppState>          │
   │ Json(payload): Json<LoginRequest>      │
   └────────────────────────────────────────┘
                    │
                    ▼
4. repo::get_user_by_email(&state.db_pool, &payload.email)
   ┌────────────────────────────────────────┐
   │ SELECT id, password_hash, auth_salt     │
   │ FROM users WHERE email = $1             │
   └────────────────────────────────────────┘
                    │
                    ▼ (User struct)
5. services::verify_password(&payload.password, &user.password_hash, salt)
   ┌────────────────────────────────────────┐
   │ Argon2::verify() ou SHA256 legacy       │
   └────────────────────────────────────────┘
                    │
                    ▼ (true/false)
6. services::create_jwt(user.id, "user", state.jwt_secret.as_bytes())
   ┌────────────────────────────────────────┐
   │ Claims { id, role, jti, exp }          │
   │ encode(&Header::default(), &claims, &key)│
   └────────────────────────────────────────┘
                    │
                    ▼ (JWT token string)
7. ApiResponse::ok(LoginResponse { token, user_id })
   .with_token(token)
   ┌────────────────────────────────────────┐
   │ Set-Cookie: auth_token=<JWT>;           │
   │   HttpOnly; Secure; SameSite=Lax;       │
   │   Max-Age=864000 (10 jours)             │
   └────────────────────────────────────────┘
                    │
                    ▼
8. Client reçoit
   ┌────────────────────────────────────────┐
   │ HTTP/1.1 200 OK                         │
   │ Content-Type: application/json          │
   │ Set-Cookie: auth_token=eyJ0eXAi...      │
   │                                         │
   │ {"token": "eyJ...", "user_id": "..."}  │
   └────────────────────────────────────────┘
```

---

## 📊 Métriques Prometheus (`metrics.rs`)

Le backend expose des métriques détaillées sur `/metrics` :

```rust
// Métriques HTTP (via middleware)
http_requests_total           # Counter (path, method, status)
http_request_duration_seconds # Histogram (latence)

// Métriques business logic
file_uploads_total            # Counter (status: success/failed)
file_downloads_total          # Counter
folder_operations_total       # Counter (operation: create/delete/share)

// Métriques système
db_query_duration_seconds     # Histogram (à implémenter si besoin)
```

**Middleware appliqué globalement** :
```rust
// routes.rs
.layer(middleware::from_fn(metrics::track_metrics))
```

---

## 📋 ApiResponse<T> - Type de Réponse Unifié

### Constructeurs
```rust
impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self                    // 200 OK
    pub fn with_token(mut self, token: String)    // Ajoute cookie auth_token
}

impl ApiResponse<ErrorResponse> {
    pub fn bad_request(message: impl Into<String>)   // 400
    pub fn unauthorized(message: impl Into<String>)  // 401
    pub fn not_found(message: impl Into<String>)     // 404
    pub fn conflict(message: impl Into<String>)      // 409
    pub fn internal_error(message: impl Into<String>) // 500
}
```

### Exemple d'usage
```rust
// Succès avec token
ApiResponse::ok(LoginResponse { token: jwt.clone(), user_id })
    .with_token(jwt)

// Erreur
ApiResponse::bad_request("Invalid UUID format").into_response()
```

### Configuration Cookie
```rust
// response.rs::IntoResponse
Cookie::build(("auth_token", token))
    .path("/")
    .http_only(true)               // Pas accessible en JS
    .secure(secure)                // HTTPS only (sauf COOKIE_SECURE=false)
    .same_site(SameSite::Lax)      // CSRF protection
    .max_age(Duration::days(10))   // 10 jours
```

---

## 🔒 Sécurité & Authentification

### 1️⃣ JWT Claims Extraction
**Middleware automatique** via `FromRequestParts` :
```rust
pub async fn protected_handler(
    State(state): State<AppState>,
    claims: Claims,  // ← Extrait automatiquement
) -> Response {
    // Si token invalide/blacklisté → 401 Unauthorized
}
```

**Sources du token** :
1. Cookie `auth_token=<JWT>`
2. Header `Authorization: Bearer <JWT>`

**Vérifications** :
- Signature valide (HMAC avec `jwt_secret`)
- Pas expiré (`exp` claim)
- Pas blacklisté dans Redis (`jti` claim)

### 2️⃣ Hashing Mot de Passe
- **Nouveau** : Argon2id (recommandé OWASP)
- **Legacy** : SHA256 + salt (support ancien système)

### 3️⃣ Permissions Fichiers/Dossiers
- Table `file_access` / `folder_access`
- `access_level`: `owner` | `editor` | `viewer`
- Vérification dans chaque handler : `repo::check_file_access()`

### 4️⃣ Soft Delete
- Tous les fichiers/dossiers ont `is_deleted: bool`
- Suppression définitive seulement via `/empty_trash`

---

## 🚀 Composition des Modules dans `routes.rs`

```rust
pub fn app(state: AppState) -> Router {
    Router::new()
        // Endpoints système
        .route("/health/ready", get(health_check_handler))  // K8s liveness probe
        .route("/metrics", get(|| async { metrics::metrics_text() }))

        // Modules métier
        .merge(auth::auth_routes())           // Routes à la racine
        .nest("/drive", drive::drive_routes()) // Routes préfixées /drive/*

        // Middlewares globaux (ordre important: bottom-up)
        .layer(middleware::from_fn(metrics::track_metrics))  // Métriques
        .layer(TraceLayer::new_for_http())                   // Logs HTTP

        // État injecté UNE SEULE FOIS pour tout le graphe
        .with_state(state)
}
```

### `.merge()` vs `.nest()`
| Méthode | Effet | Exemple |
|---------|-------|---------|
| `.merge(auth::auth_routes())` | Fusionne **sans préfixe** | `/login`, `/logout` |
| `.nest("/drive", drive::drive_routes())` | Ajoute **préfixe** `/drive/*` | `/drive/upload`, `/drive/download` |

---

## 🎓 Avantages de Cette Architecture

### ✅ Séparation des Responsabilités
- **routes.rs** : Mapping URL → handler
- **handlers.rs** : Orchestration HTTP
- **services.rs** : Logique métier pure (testable en isolation)
- **repo.rs** : SQL isolé (queries type-safe avec SQLx)

### ✅ Type Safety Rust
- `Router<AppState>` garantit que l'état sera injecté
- Compile-time vérification des routes et types
- SQLx vérifie les queries SQL à la compilation

### ✅ Testabilité
```rust
// Test unitaire d'un service (pas de DB)
#[test]
fn test_parse_uuid_or_error() {
    assert_eq!(parse_uuid_or_error("null"), Ok(None));
    assert!(parse_uuid_or_error("invalid").is_err());
}

// Test d'intégration d'un repo (avec DB)
#[sqlx::test]
async fn test_create_user(pool: PgPool) {
    let user_id = repo::create_user(&pool, new_user).await.unwrap();
    assert!(!user_id.is_nil());
}
```

### ✅ Scalabilité
Ajouter un module `notifications/` :
1. Créer `src/notifications/` avec `mod.rs`, `routes.rs`, `handlers.rs`
2. Déclarer dans `lib.rs` : `pub mod notifications;`
3. Composer dans `routes.rs` : `.nest("/notifs", notifications::routes())`

---

## 📝 Checklist pour Ajouter un Nouveau Module

- [ ] Créer `src/mon_module/`
- [ ] Créer `mod.rs` avec re-exports
- [ ] Créer `routes.rs` retournant `Router<AppState>`
- [ ] Créer `handlers.rs` avec fonctions async
- [ ] Créer `services.rs` (logique métier pure)
- [ ] Créer `repo.rs` (queries SQL)
- [ ] Déclarer dans `lib.rs` : `pub mod mon_module;`
- [ ] Composer dans `routes.rs` : `.merge()` ou `.nest()`
- [ ] **JAMAIS** appeler `with_state()` dans le sous-module !

---

## 🐛 Erreurs Courantes à Éviter

### ❌ Appeler `with_state()` dans un sous-module
```rust
// ❌ FAUX - auth/routes.rs
pub fn auth_routes(state: AppState) -> Router {
    Router::new()
        .route("/login", post(handlers::login_handler))
        .with_state(state)  // ❌ Double injection !
}
```

### ✅ Version correcte
```rust
// ✅ CORRECT - auth/routes.rs
pub fn auth_routes() -> Router<AppState> {  // <-- Type générique
    Router::new()
        .route("/login", post(handlers::login_handler))
    // Pas de with_state ici, c'est routes.rs principal qui s'en charge
}
```

### ❌ Mauvais imports de types
```rust
// ❌ FAUX
use crate::auth::get_user_by_id;  // Fonction dans repo, pas dans le module root

// ✅ CORRECT
use crate::auth::repo::get_user_by_id;
use crate::auth::Claims;  // Re-exporté dans mod.rs
```

---

## 🔧 Migration Depuis Ancienne Architecture

Si tu as un monolithe `handlers.rs` de 2000 lignes :

1. **Identifier les domaines** (auth, drive, admin, etc.)
2. **Créer les modules** avec structure complète
3. **Extraire les handlers** par domaine
4. **Séparer SQL** dans `repo.rs`
5. **Extraire logique métier** dans `services.rs`
6. **Mettre à jour imports** (`use crate::state::AppState;`)
7. **Tester** : `cargo check`, `cargo test`
8. **Supprimer ancien fichier** après migration complète

---

## 🎯 Résumé en Une Phrase

**L'AppState est partagé via le système de types de Rust** :
- `Router<AppState>` = "Ce router a besoin d'un AppState" (promesse)
- `State(state): State<AppState>` = "Axum, injecte-moi l'état" (extraction)
- `with_state(state)` = "Voilà l'état concret" (injection finale)

**Le compilateur garantit la cohérence à la compilation, pas à l'exécution !** 🦀✨
