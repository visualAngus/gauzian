# Gauzian — Architecture Technique

*Analyse de l'architecture complète (backend + frontend + E2EE) — Février 2026*

---

## Vue d'ensemble

Gauzian est composé de deux dépôts principaux :

| Dépôt | Technologie | Rôle |
|-------|-------------|------|
| `gauzianBack` | Rust (Axum) | API REST, gestion des données, stockage S3, permissions |
| `gauzianFront` | Nuxt 3 / Vue 3 / TypeScript | Interface utilisateur, moteur E2EE client-side |

L'infrastructure repose sur Docker + Kubernetes (k8s), avec Caddy comme reverse proxy, et est hébergée sur VPS OVH France.

---

## Backend — gauzianBack

### Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Langage | Rust | stable |
| Framework HTTP | Axum | 0.8.8 |
| Base de données | PostgreSQL | via SQLx 0.8.6 |
| Cache / JWT blacklist | Redis | via redis 1.0.2 |
| Stockage fichiers | S3 / MinIO (compatible) | aws-sdk-s3 1.68.0 |
| Authentification | JWT (HMAC) + cookies HttpOnly | jsonwebtoken 10.3.0 |
| Hachage mots de passe | Argon2id | argon2 0.5.3 |
| Métriques | Prometheus | prometheus 0.14.0 |
| Async runtime | Tokio | 1.49.0 |
| Reverse proxy | Caddy | — |

### Architecture en couches

```
routes.rs
    │
    ├── auth::auth_routes()
    │       handlers.rs → services.rs → repo.rs → PostgreSQL
    │
    ├── drive::drive_routes()
    │       handlers.rs → services.rs → repo.rs → PostgreSQL + S3
    │
    └── agenda::agenda_routes()
            handlers.rs → services.rs → repo.rs → PostgreSQL
```

**AppState** (partagé via `Arc<AppState>` dans Axum) :
```rust
struct AppState {
    jwt_secret: String,
    redis_client: Client,
    db_pool: PgPool,
    storage_client: StorageClient,  // S3/MinIO
}
```

### Module auth/ — Authentification

**Routes (7) :**
- `POST /login` — connexion, émission cookie JWT HttpOnly (10 jours)
- `POST /register` — inscription avec génération clé E2EE côté serveur (stockage clé publique)
- `POST /logout` — blacklist du JWT dans Redis (jti)
- `GET /autologin` — vérification cookie JWT existant
- `GET /protected` — route de test auth
- `GET /info` — informations utilisateur connecté
- `GET /contacts/get_public_key/:email` — récupération clé publique RSA d'un contact (pour partage E2EE)

**Sécurité auth :**
- JWT Claims : `{ id: Uuid, role: String, jti: String, exp: usize }`
- Cookie : `HttpOnly=true, Secure=true, SameSite=Lax, Max-Age=10j`
- Argon2id pour le hachage des mots de passe
- Blacklist JWT par jti dans Redis (résistance au vol de cookie)

### Module drive/ — Gestion des fichiers

**Routes (32 routes, ~47 handlers, ~1900 lignes repo) :**

*Fichiers (15 routes) :*
- `POST initialize_file` — initialise un upload multipart E2EE
- `POST upload_chunk` — upload d'un chunk chiffré (binaire)
- `POST finalize_upload/:file_id/:etat` — finalise l'upload, marque `is_fully_uploaded=true`
- `POST abort_upload` — annule un upload en cours
- `GET file/:id` — métadonnées du fichier
- `GET download/:id` — téléchargement (retourne URL S3 signée ou stream)
- `GET download_chunk/:s3_key` — téléchargement d'un chunk spécifique
- `DELETE delete_file` — suppression douce (`is_deleted=true`)
- `PUT rename_file` — renommage
- `PUT move_file` — déplacement dans l'arborescence
- `POST restore_file` — restauration depuis la corbeille
- `POST share_file` — partage avec un autre utilisateur
- `GET file/:id/InfoItem` — informations détaillées (taille, partages, dates)
- `POST propagate_file_access` — propagation des permissions dans les sous-dossiers
- `DELETE revoke-access` — révocation d'un accès partagé

*Dossiers (12 routes) :*
- `POST create_folder`, `GET get_folder/:id`, `GET folder_contents/:id`
- `DELETE delete_folder`, `PUT rename_folder`, `PUT move_folder`
- `POST restore_folder`, `POST share_folder`, `POST share_folder_batch`
- `GET folder/:id/shared_users`, `GET folder/:id/InfoItem`
- `POST propagate_folder_access`

*Vues (5 routes) :*
- `GET get_all_drive_info/:parent_id` — contenu complet d'un répertoire
- `GET get_file_folder/:parent_id` — liste fichiers + dossiers
- `DELETE empty_trash` — vidage de la corbeille

**Modèle de permissions :**
- Tables : `file_access`, `folder_access`
- Niveaux : `owner | editor | viewer`
- Suppression douce : `is_deleted` (corbeille), `is_fully_uploaded` (upload atomique)

**Flux d'upload E2EE :**
```
Client                          Serveur (Axum)                    S3/MinIO
  │                                  │                               │
  ├── initialize_file ──────────────►│ créer entrée DB               │
  │◄── file_id ─────────────────────│                               │
  │                                  │                               │
  ├── upload_chunk(1, chiffré) ─────►│ stream ──────────────────────►│ chunk_1
  ├── upload_chunk(2, chiffré) ─────►│ stream ──────────────────────►│ chunk_2
  ├── upload_chunk(N, chiffré) ─────►│ stream ──────────────────────►│ chunk_N
  │                                  │                               │
  └── finalize_upload ──────────────►│ is_fully_uploaded=true        │
```

### Module agenda/ — Calendrier E2EE

- Routes CRUD pour les événements d'agenda
- **Champs chiffrés E2EE** : titre, description, lieu (chiffrés côté client avant envoi)
- Le serveur ne stocke que des données chiffrées pour les champs sensibles
- Migrations : `encrypt_agenda_fields` (20260202-03)

### Base de données — Schéma principal (migrations SQLx)

| Migration | Description |
|-----------|-------------|
| 20260105 | users table (id, email, password_hash, role, is_active) |
| 20260106 | add_crypto (public_key, encrypted_private_key pour E2EE) |
| 20260109 | recovery_key, file+file_access tables, is_deleted, access_level |
| 20260202 | agenda_table |
| 20260202-03 | encrypt_agenda_fields (champs agenda chiffrés) |
| 20260219 | add_is_accepted (partages avec acceptation) |

---

## Frontend — gauzianFront

### Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Nuxt 3 (Vue 3) | 4.x (compat 2025-07-15) |
| Langage | TypeScript | — |
| CSS | Thème custom (theme.css) | — |
| API | Proxy Nuxt → backend Axum | /api/** |
| Sécurité headers | HSTS, X-Frame-Options, CSP, Referrer-Policy | — |

### Structure des pages

| Page | Route | Description |
|------|-------|-------------|
| `index.vue` | `/` | Page d'accueil / landing |
| `login.vue` | `/login` | Connexion / inscription |
| `drive.vue` | `/drive` | Interface principale du drive |
| `agenda.vue` | `/agenda` | Calendrier E2EE (v1) |
| `agendav2.vue` | `/agendav2` | Calendrier E2EE (v2 en cours) |
| `info.vue` | `/info` | Informations utilisateur |

### Composants principaux

| Composant | Rôle |
|-----------|------|
| `AppHeader.vue` | En-tête application, navigation |
| `FileItem.vue` | Affichage d'un fichier dans le drive |
| `FolderTreeNode.vue` | Nœud d'arborescence de dossiers |
| `ShareItem.vue` | Interface de partage E2EE |
| `ContextMenu.vue` | Menu contextuel (clic droit) |
| `InfoItem.vue` | Panneau d'informations fichier/dossier |
| `Notification.vue` | Système de notifications toast |
| `Loading.vue` | Indicateur de chargement |
| `EventAgenda.vue` | Événement calendrier |
| `agenda/` | Composants agenda v1 |
| `agendaV2/` | Composants agenda v2 |

### Composables (logique métier)

| Composable | Rôle |
|------------|------|
| `useAuth.js` | Authentification, session, user info |
| `useFetchWithAuth.js` | Requêtes API avec gestion JWT/cookie |
| `useApiUrl.js` | URL de l'API backend |
| `useNotification.js` | Gestion des notifications |
| `drive/` | Composables drive (upload, download, partage) |
| `agenda/` | Composables agenda |

---

## Moteur E2EE — crypto.ts (725 lignes)

Le cœur cryptographique de Gauzian est implémenté dans `app/utils/crypto.ts`. Il s'appuie exclusivement sur la **Web Crypto API** native du navigateur (aucune dépendance externe).

### Principes fondamentaux

| Principe | Description |
|----------|-------------|
| **Zero-Knowledge** | Le serveur ne reçoit jamais de données en clair |
| **Client-Side Only** | Toute opération cryptographique dans le navigateur |
| **Web Crypto API** | Aucune bibliothèque tierce (surface d'attaque réduite) |
| **Non-Extractable** | Clé privée RSA stockée en IndexedDB avec `extractable: false` |
| **AEAD** | AES-GCM = chiffrement + intégrité en une opération |

### Algorithmes utilisés

| Algorithme | Paramètres | Usage |
|------------|------------|-------|
| RSA-OAEP | 4096 bits, SHA-256 | Chiffrement asymétrique (partage de clé AES) |
| AES-GCM | 256 bits, IV 12 bytes | Chiffrement symétrique des fichiers et métadonnées |
| PBKDF2 | SHA-256, 310 000 itérations | Dérivation de clé depuis mot de passe (OWASP 2024) |
| IndexedDB | `extractable: false` | Persistance sécurisée de la clé privée |
| Base64 / UTF-8 | — | Transport JSON |
| PEM SPKI/PKCS#8 | — | Format d'export des clés |

**Pourquoi RSA-4096 ?** Résistance 150 ans vs 30 ans pour RSA-2048. Choix stratégique pour un produit centré sur la confidentialité long terme, acceptant la légère lenteur de la génération initiale.

**Pourquoi AES-GCM ?** Mode AEAD (authenticated encryption) : chiffrement + vérification d'intégrité en une seule opération, immune aux attaques de padding oracle, parallélisable.

**Pourquoi PBKDF2 à 310k itérations ?** Recommandation OWASP 2024. Durée ~300ms sur client moderne : acceptable pour l'UX, prohibitif pour une attaque brute force.

### Flux de chiffrement d'un fichier

```
Utilisateur (navigateur)
        │
        ├── 1. Générer AES-256-GCM key (aléatoire par fichier)
        ├── 2. Chiffrer fichier avec AES-256-GCM key → chunks chiffrés
        ├── 3. Chiffrer AES key avec RSA-4096 public key utilisateur → encrypted_key
        ├── 4. upload_chunk (chunks chiffrés) → Serveur → S3
        └── 5. finalize_upload (encrypted_key + métadonnées chiffrées)
                        │
                        ▼
                Serveur : stocke uniquement données chiffrées
                S3 : chunks chiffrés illisibles
```

### Flux de partage E2EE

```
Émetteur (navigateur)
        │
        ├── 1. Récupérer RSA public key du destinataire (/contacts/get_public_key/:email)
        ├── 2. Déchiffrer AES key du fichier (avec sa propre clé privée)
        └── 3. Re-chiffrer AES key avec RSA public key du destinataire → partage

Destinataire (navigateur)
        │
        ├── 1. Télécharger le partage (AES key chiffrée avec sa public key)
        ├── 2. Déchiffrer AES key avec sa clé privée
        └── 3. Déchiffrer le fichier avec AES key → fichier en clair
```

---

## Infrastructure

### Configuration actuelle (MVP)

```
Internet
    │
    ▼
Caddy (reverse proxy, TLS automatique Let's Encrypt)
    │
    ├── gauzianFront (Nuxt 3, Node.js)
    │
    └── gauzianBack (Rust Axum API)
            │
            ├── PostgreSQL (base de données)
            ├── Redis (cache JWT blacklist)
            └── S3/MinIO (chunks chiffrés)
```

### Hébergement actuel vs cible

| Aspect | Actuel (MVP) | Cible (post-seed) |
|--------|-------------|-------------------|
| Compute | VPS OVH 1 (€12/mois) | Scaleway Managed k8s |
| Stockage fichiers | S3/MinIO auto-hébergé | Scaleway Object Storage |
| Base de données | PostgreSQL self-hosted | Scaleway Managed DB PostgreSQL |
| Cache | Redis self-hosted | Scaleway Managed Redis |
| Réseau | 1 Gbit/s, trafic illimité | Multi-AZ, CDN optionnel |
| Hébergement | France (OVH Gravelines) | France (Scaleway PAR) |

### Sécurité réseau et transport

- **TLS** : Caddy gère Let's Encrypt automatiquement (HTTPS partout)
- **Headers sécurité frontend** : HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy
- **CSP** : `default-src 'self'`, `connect-src gauzian.pupin.fr`
- **Cookie JWT** : `HttpOnly=true, Secure=true, SameSite=Lax` (résistance XSS + CSRF)
- **JWT blacklist** : Redis (résistance vol de token post-logout)
- **Tests sécurité** : pentests et tests E2EE automatisés dans le repo `gauzianMain/tests/`

---

## Points forts architecturaux

1. **E2EE natif et complet** — RSA-4096 + AES-256-GCM, Web Crypto API, zero-knowledge réel, flux de partage E2EE sans exposition de clés
2. **Rust backend** — Sécurité mémoire garantie à la compilation, pas de race condition ni de buffer overflow, performances C-like
3. **Architecture modulaire** — Séparation nette handlers/services/repo, AppState injectable, extensible facilement
4. **Scalabilité native** — k8s ready dès le MVP, upload chunked (résistance aux fichiers volumineux), PostgreSQL + S3 scalables horizontalement
5. **Sécurité en profondeur** — Argon2id passwords, JWT blacklist Redis, HttpOnly cookies, CSP strict, headers sécurité
6. **Chiffrement de l'agenda** — Les champs sensibles du calendrier sont également chiffrés E2EE (titre, description, lieu)

---

## Points d'amélioration identifiés pour le business plan

| Point | Impact Business | Action recommandée |
|-------|----------------|-------------------|
| Client mobile (iOS/Android) | Adoption grand public | Développer app mobile native (M4-M5) |
| Synchronisation desktop | Usage quotidien | Client desktop (Electron ou natif) |
| Import depuis Dropbox/Google Drive | Acquisition | Migration automatisée |
| Certification HDS | Marché santé | Processus HDS à M12-M18 |
| SecNumCloud | Marchés publics | Processus long (2-3 ans), démarrer à M12 |
| Versioning fichiers | Rétention | Déjà prévu dans les plans tarifaires |
| SSO / SAML | Offre PME | Développer pour plan Business (M5) |
| Audit log | Conformité PME | Développer pour plan Business (M5) |

---

*Document généré dans le cadre de la session étude de marché & business plan — Février 2026*
*Basé sur l'analyse du code source gauzianBack/ et gauzianFront/*
