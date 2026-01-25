# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also:
- `gauzian_back/CLAUDE.md` - Backend-specific guidance
- `gauzian_front/CLAUDE.md` - Frontend-specific guidance

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

## Environnement & Infrastructure
- **Serveur :** VPS distant tournant sous Kubernetes (K8s).
- **Accès SSH :** La commande `vps` est configurée dans le terminal (alias) pour se connecter au serveur.
- **Workflow de Déploiement :**
    1. Mise à jour des images localement : `./push_docker_hub.sh` (script local).
    2. Déploiement sur le VPS : Utiliser SSH via `vps` pour exécuter le script : `/gauzian_back/k8s/update-max.sh`.
    3. Si des fichiers ont été ajoutés, push les changements sur GitHub : `git add . && git commit -m "Update" && git push`. Modifie le message de commit selon le contexte.
    4. Pull les changements sur le serveur : `ssh vps 'git pull origin main'`.

## Commandes de Déploiement (Skills)
Désormais, quand je te demande de "Déployer en prod" ou "Update le VPS", tu dois :
1. Lancer le script local : `./push_docker_hub.sh`
2. Te connecter au VPS et lancer le script de mise à jour distant en une seule commande : 
   `ssh vps 'bash ./gauzian_back/k8s/update-max.sh'`
3. Si des fichiers ont été ajoutés, push les changements sur GitHub et pull sur le serveur.
4. Confirmer le succès du déploiement en vérifiant les pods si nécessaire : `ssh vps 'kubectl get pods'`