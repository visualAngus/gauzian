# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also:
- `gauzian_back/CLAUDE.md` - Backend-specific guidance
- `gauzian_front/CLAUDE.md` - Frontend-specific guidance
- `DEPLOYMENT.md` - **Guide complet de déploiement (VPS K8s + Clever Cloud)**

## Project Overview

GAUZIAN is a zero-knowledge, end-to-end encrypted (E2EE) cloud storage platform. The server never sees plaintext data - all encryption/decryption happens client-side. Built with a Rust backend (Axum) and Nuxt.js frontend.

## Repository Structure

- `gauzian_back/` - Rust API server (Axum framework)
- `gauzian_front/` - Nuxt 4 / Vue 3 frontend
- `gauzian_back/k8s/` - Kubernetes deployment manifests (Kustomize)
- `gauzian_back/migrations/` - SQLx database migrations

## Build Commands

### Backend (Rust)
```bash
cd gauzian_back
cargo build              # Development build
cargo build --release    # Production build
cargo test               # Run tests
cargo watch -x run       # Development with auto-reload
```

### Frontend (Nuxt)
```bash
cd gauzian_front
npm install
npm run dev              # Development server (localhost:3000)
npm run build            # Production build
```

### Docker Development
```bash
# Start full stack (from gauzian_back/)
docker-compose -f docker-compose.dev.yml up -d

# Build and push images
docker build -t angusvisual/gauzian-backend:dev gauzian_back
docker build -t angusvisual/gauzian-front:dev gauzian_front
```

### Database Migrations
```bash
cd gauzian_back
sqlx migrate run --database-url postgres://user:pass@localhost/db
```

### Kubernetes
```bash
kubectl apply -k gauzian_back/k8s/     # Deploy all
kubectl get pods -n gauzian            # Check pods
kubectl logs -n gauzian -l app=backend # View logs
```

## Architecture

### Backend Modules (`gauzian_back/src/`)
- `main.rs` - Entry point, server initialization
- `state.rs` - AppState struct (DB pool, Redis, S3 client, JWT secret)
- `routes.rs` - Router definition with TraceLayer
- `handlers.rs` - HTTP endpoint handlers (auth, file operations)
- `drive.rs` - Core file/folder business logic (E2EE operations)
- `storage.rs` - S3/MinIO integration for encrypted chunk storage
- `auth.rs` - Password hashing (SHA256+salt), JWT claims extraction
- `jwt.rs` - JWT creation/validation with jti claims

### Key Technologies
- **Database**: PostgreSQL with SQLx (compile-time checked queries)
- **Cache**: Redis (token blacklisting for logout/revocation)
- **Storage**: MinIO (S3-compatible) for encrypted file chunks
- **Auth**: JWT tokens in cookies + Authorization header

### Security Model
- Client-side key management with `encrypted_private_key`, `encrypted_record_key`
- Token extraction from Cookie (`auth_token=`) or Bearer header
- Password hashing: SHA256 with per-user `auth_salt`
- Redis-based token revocation list

## Environment Variables

Required for backend:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection (redis://host:6379)
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` - MinIO/S3 config
- `JWT_SECRET` - Secret for JWT signing
- `RUST_LOG` - Log level (e.g., `gauzian_back=debug,tower_http=debug`)

## Database Schema

Key tables (see `gauzian_back/migrations/`):
- `users` - User accounts with encrypted crypto keys
- `files` / `folders` - File system structure with soft delete
- `file_access` / `folder_access` - Permission management
- `file_chunks` - Chunked upload tracking

# Instructions pour Claude Code

## Journal de Bord (Obligatoire)
- Un fichier nommé `DEVELOPMENT_LOG.md` doit être maintenu à jour à chaque modification importante.
- APRÈS chaque action de modification de code, tu DOIS ajouter une entrée en haut de ce fichier.
- Format de l'entrée : `[AAAA-MM-JJ HH:mm] - [Description concise de ce qui a été fait]`
- Ne supprime jamais l'historique existant, ajoute simplement les nouvelles lignes au début (ou à la fin, selon ta préférence).

## Environnements de Déploiement

Le projet supporte deux environnements de production :
- **VPS Kubernetes** (environnement principal) - Voir `DEPLOYMENT.md` section "Déploiement 1"
- **Clever Cloud** (PaaS alternatif) - Voir `DEPLOYMENT.md` section "Déploiement 2"

**⚠️ IMPORTANT :** Consulter `DEPLOYMENT.md` pour les procédures détaillées de chaque environnement.

### Commandes Rapides

**Déploiement VPS (Commande par défaut) :**
```bash
./push_docker_hub.sh && ssh vps 'bash ./gauzian_back/k8s/update-max.sh'
```

**Déploiement Clever Cloud :**
```bash
# Option 1 : Build distant (simple)
git push clever main

# Option 2 : Pre-build optimisé (recommandé pour le backend)
./update-backend-image.sh && \
git add Dockerfile.backend.prebuilt && \
git commit -m "chore: Update backend image" && \
git push clever main
```

## Commandes de Déploiement (Skills)

Quand je te demande de **"Déployer en prod"** ou **"Update le VPS"** (par défaut = VPS K8s) :
1. Lancer le script local : `./push_docker_hub.sh`
2. Déployer sur le VPS : `ssh vps 'bash ./gauzian_back/k8s/update-max.sh'`
3. Vérifier les pods : `ssh vps 'kubectl get pods -n gauzian'`
4. Si nouveaux fichiers, commit et push vers GitHub

Quand je te demande de **"Déployer sur Clever Cloud"** :
1. Exécuter : `./update-backend-image.sh`
2. Commit le Dockerfile généré : `git add Dockerfile.backend.prebuilt && git commit -m "chore: Update backend image"`
3. Push : `git push clever main`