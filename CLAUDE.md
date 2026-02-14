# CLAUDE.md - Project Root

Guidance for Claude Code when working with the GAUZIAN repository.

**⚠️ IMPORTANT** : Ce projet se déploie sur **VPS K8s** ou **Clever Cloud**. Pas de développement local.

---

## Quick Links

- **Backend Guidance** : `gauzian_back/CLAUDE.md`
- **Frontend Guidance** : `gauzian_front/CLAUDE.md`
- **Deployment Guide** : `DEPLOYMENT.md` (VPS K8s + Clever Cloud)
- **K8s Infrastructure** : `gauzian_back/k8s/README.md` (⭐ 800 lignes)
- **Database Schema** : `gauzian_back/docs/DATABASE_SCHEMA.md` (⭐ 700 lignes, ERD Mermaid)
- **Crypto Architecture** : `gauzian_front/docs/CRYPTO_ARCHITECTURE.md` (⭐ 1000 lignes, E2EE détaillé)

---

## Project Overview

**GAUZIAN** est une plateforme de stockage cloud **zero-knowledge** avec chiffrement de bout en bout (E2EE). Le serveur ne voit jamais les données en clair - tout le chiffrement/déchiffrement se fait côté client.

### Stack Technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| **Backend** | Rust (Axum) | Stable |
| **Frontend** | Nuxt 4 / Vue 3 | Latest |
| **Database** | PostgreSQL | 17 |
| **Cache** | Redis | 7 |
| **Storage** | MinIO (S3-compatible) | Latest |
| **Orchestration** | Kubernetes (K3s) | 1.28+ |
| **Monitoring** | Prometheus + Grafana | Latest |

---

## Repository Structure

```
gauzian/
├── gauzian_back/           # Rust API (Axum)
│   ├── src/                # Code source
│   │   ├── auth/           # Module authentification
│   │   ├── drive/          # Module stockage fichiers/dossiers
│   │   ├── agenda/         # Module calendrier (en développement)
│   │   └── ARCHITECTURE.md # ⭐ Architecture backend détaillée (26KB)
│   ├── migrations/         # Migrations SQLx (15 fichiers)
│   ├── k8s/                # Manifests Kubernetes
│   │   ├── README.md       # ⭐ Documentation K8s complète (800 lignes)
│   │   └── *.yaml          # 28 manifests (deployments, services, ingress, monitoring)
│   └── docs/
│       ├── DATABASE_SCHEMA.md  # ⭐ Schéma DB + ERD (700 lignes)
│       ├── ENV_VARIABLES.md    # Variables d'environnement
│       └── README.md           # Guide déploiement K8s
│
├── gauzian_front/          # Frontend Nuxt 4
│   ├── app/
│   │   ├── pages/          # Routes (login, drive, agenda, info)
│   │   ├── composables/    # Logique réutilisable (useAuth, useDriveData, useEvents)
│   │   ├── components/     # Composants Vue (FileItem, EventModal, etc.)
│   │   └── utils/
│   │       └── crypto.ts   # ⭐ CORE E2EE (RSA-4096 + AES-256-GCM)
│   ├── docs/
│   │   └── CRYPTO_ARCHITECTURE.md # ⭐ Documentation crypto complète (1000 lignes)
│   └── README.md           # ⭐ Architecture frontend (1100 lignes)
│
├── docs/                   # Documentation technique
│   ├── SECURITY_TESTING.md # Tests de sécurité (SQLMap, Nikto)
│   ├── SHARING_*.md        # Implémentation partage E2EE
│   └── README.md           # Index documentation
│
├── tests/                  # Suite de tests
│   ├── security/           # Tests SQLMap
│   └── k6/                 # Tests de charge
│
├── DEPLOYMENT.md           # ⭐ Guide déploiement complet
├── DEVELOPMENT_LOG.md      # Journal de bord (148KB - historique complet)
└── README.md               # Overview projet
```

---

## Quick Commands

### Déploiement Production

#### VPS Kubernetes (Défaut)

```bash
# Build + push images Docker Hub
./push_docker_hub.sh

# Déployer sur VPS
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'

# Vérifier déploiement
ssh vps 'kubectl get pods -n gauzian-v2'
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=50'
```

#### Clever Cloud (Alternatif)

```bash
# Option 1 : Build distant
git push clever main

# Option 2 : Pre-build optimisé (recommandé)
./update-backend-image.sh
git add Dockerfile.backend.prebuilt
git commit -m "chore: Update backend image"
git push clever main
```

### Database Migrations

```bash
# Sur VPS (via port-forward)
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &
cd gauzian_back
sqlx migrate run --database-url postgres://gauzian_user:<PASSWORD>@localhost:5432/gauzian_db
```

### Kubernetes Operations

```bash
# Lister pods
ssh vps 'kubectl get pods -n gauzian-v2'

# Logs backend en temps réel
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend -f --tail=100'

# Vérifier HPA (auto-scaling)
ssh vps 'kubectl get hpa -n gauzian-v2'

# Redémarrer deployment
ssh vps 'kubectl rollout restart deployment/backend -n gauzian-v2'
```

### Monitoring

```bash
# Accès Grafana (production)
# URL : https://grafana.gauzian.pupin.fr
# Credentials : admin/admin (à changer)

# Port-forward local (debug)
ssh vps 'kubectl port-forward -n monitoring svc/grafana 3000:3000'
# Ouvrir http://localhost:3000
```

---

## Architecture Globale

### Backend Modules (`gauzian_back/src/`)

**Voir `gauzian_back/src/ARCHITECTURE.md` pour détails complets (26KB).**

| Module | Fichier | Description |
|--------|---------|-------------|
| **Core** | `main.rs` | Entry point, initialisation serveur Axum |
| **State** | `state.rs` | AppState (DB pool, Redis, S3 client, JWT secret) |
| **Routes** | `routes.rs` | Définition des routes avec middleware TraceLayer |
| **Auth** | `auth/` | Authentification (register, login, JWT, password hashing) |
| **Drive** | `drive/` | Fichiers/dossiers E2EE (32 routes, 47 handlers) |
| **Agenda** | `agenda/` | Calendrier partagé (en développement) |
| **Storage** | `storage.rs` | Client S3/MinIO pour chunks chiffrés |
| **Metrics** | `metrics.rs` | Prometheus (17 métriques custom) |

### Frontend Pages (`gauzian_front/app/pages/`)

**Voir `gauzian_front/README.md` pour détails complets (1100 lignes).**

| Page | Fichier | Description |
|------|---------|-------------|
| **Index** | `index.vue` | Redirect vers /login ou /drive |
| **Login** | `login.vue` | Authentification (login + register avec génération clés RSA) |
| **Drive** | `drive.vue` | ⭐ Gestionnaire de fichiers principal (upload/download E2EE) |
| **Agenda** | `agenda.vue` | Calendrier partagé avec événements chiffrés |
| **Info** | `info.vue` | Infos utilisateur + tests crypto (dev) |

### Composables Principaux

| Composable | Usage |
|------------|-------|
| `useAuth` | État authentification, login/logout |
| `useDriveData` | Chargement fichiers/dossiers |
| `useFileActions` | Upload, download, delete, rename, share |
| `useEvents` | CRUD événements agenda (E2EE) |
| `useNotification` | Système de notifications toast |

---

## Modèle de Sécurité E2EE

**Voir `gauzian_front/docs/CRYPTO_ARCHITECTURE.md` pour détails (1000 lignes).**

### Algorithmes

- **RSA-4096** (OAEP, SHA-256) : Partage de clés asymétrique
- **AES-256-GCM** : Chiffrement symétrique (fichiers, métadonnées)
- **PBKDF2** (SHA-256, **310k iterations**) : Dérivation clé depuis mot de passe

### Workflow

1. **Register** :
   - Client génère paire RSA-4096
   - Chiffre clé privée avec mot de passe (PBKDF2 → AES-GCM)
   - Envoie `encrypted_private_key` + `public_key` au serveur
   - Serveur ne peut **jamais** déchiffrer la clé privée

2. **Upload Fichier** :
   - Client génère `file_key` aléatoire (AES-256)
   - Chiffre fichier par chunks de 5MB avec `file_key`
   - Chiffre `file_key` avec clé publique owner
   - Upload chunks chiffrés vers MinIO S3
   - Serveur ne voit **jamais** le nom ou contenu du fichier

3. **Partage E2EE** :
   - Owner déchiffre `file_key` avec sa clé privée
   - Rechiffre `file_key` avec clé publique du destinataire
   - Serveur stocke `encrypted_file_key` sans pouvoir le déchiffrer
   - Destinataire déchiffre avec sa clé privée

### Stockage Clés

- **IndexedDB** : Clés stockées avec `extractable: false` (non-exportables via JavaScript)
- **Expiration** : 10 jours (force re-login pour sécurité)
- **Protection XSS** : Impossible d'exfiltrer clés privées

---

## Database Schema

**Voir `gauzian_back/docs/DATABASE_SCHEMA.md` pour détails (700 lignes + ERD Mermaid).**

### Tables Principales (9)

| Table | Description | Clés Crypto |
|-------|-------------|-------------|
| `users` | Comptes utilisateurs | `encrypted_private_key`, `public_key`, `encrypted_record_key` |
| `files` | Métadonnées fichiers | `encrypted_metadata` (nom, extension chiffrés) |
| `folders` | Hiérarchie dossiers | `encrypted_metadata` |
| `file_access` | Permissions fichiers | `encrypted_file_key` (chiffré par destinataire) |
| `folder_access` | Permissions dossiers | `encrypted_folder_key` |
| `s3_keys` | Mapping chunks S3 | - |
| `agenda_events` | Événements calendrier | `encrypted_data_key`, champs chiffrés (title, description, horaires) |
| `agenda_categories` | Catégories événements | - |
| `agenda_event_participants` | Partage événements | `encrypted_event_key` |

### Soft Delete

Toutes les tables principales utilisent `is_deleted: BOOLEAN` (corbeille, pas de hard delete immédiat).

---

## Environment Variables

### Backend (`gauzian_back/`)

**Voir `gauzian_back/docs/ENV_VARIABLES.md` pour liste complète.**

| Variable | Exemple | Obligatoire |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://user:pass@postgres:5432/gauzian_db` | ✅ |
| `REDIS_URL` | `redis://redis:6379` | ✅ |
| `S3_ENDPOINT` | `http://minio:9000` | ✅ |
| `S3_ACCESS_KEY` | `minioadmin` | ✅ |
| `S3_SECRET_KEY` | `minioadmin` | ✅ |
| `S3_BUCKET` | `gauzian-chunks` | ✅ |
| `JWT_SECRET` | `<256-bit random>` | ✅ |
| `RUST_LOG` | `gauzian_back=info,tower_http=info` | ❌ |
| `COOKIE_SECURE` | `true` | ✅ (production) |

### Frontend (`gauzian_front/`)

| Variable | Exemple | Obligatoire |
|----------|---------|-------------|
| `NUXT_PUBLIC_API_URL` | `https://gauzian.pupin.fr/api` | ✅ |

---

## Kubernetes Infrastructure

**Voir `gauzian_back/k8s/README.md` pour détails (800 lignes).**

### Services Déployés

| Service | Image | Replicas | Resources |
|---------|-------|----------|-----------|
| **Backend** | `angusvisual/gauzian-backend:dev` | 2-10 (HPA) | 100m-500m CPU, 512Mi-1Gi RAM |
| **Frontend** | `angusvisual/gauzian-front:dev` | 2+ | - |
| **PostgreSQL** | `postgres:17-alpine` | 1 | PVC 20Gi |
| **Redis** | `redis:7-alpine` | 1 | PVC 5Gi |
| **MinIO** | `minio/minio:latest` | 1 | PVC 50Gi |
| **Prometheus** | `prom/prometheus:latest` | 1 | - |
| **Grafana** | `grafana/grafana:latest` | 1 | - |
| **Node Exporter** | DaemonSet | 1 par nœud | - |

### Networking (Traefik IngressRoute)

| URL | Service | Middleware |
|-----|---------|------------|
| `gauzian.pupin.fr/` | Frontend | compress, security-headers |
| `gauzian.pupin.fr/api/*` | Backend | rate-limit (100/s), strip-api-prefix, compress |
| `gauzian.pupin.fr/s3/*` | MinIO S3 API | rate-limit (50/s), strip-s3-prefix |
| `minio.gauzian.pupin.fr` | MinIO Console | security-headers |
| `grafana.gauzian.pupin.fr` | Grafana | - |

### Auto-Scaling (HPA)

- **Min** : 2 replicas
- **Max** : 10 replicas
- **Triggers** : CPU > 50% OU RAM > 70%
- **Behavior** : Scale up rapide (100%/30s), scale down conservateur (5min stabilization)

---

## Monitoring & Observability

### Métriques Prometheus (17 custom)

**Voir `gauzian_back/METRICS_USAGE_EXAMPLES.md` pour requêtes.**

| Métrique | Type | Description |
|----------|------|-------------|
| `gauzian_request_duration_seconds` | Histogram | Latence requêtes HTTP |
| `gauzian_requests_total` | Counter | Nombre de requêtes |
| `gauzian_active_connections` | Gauge | Connexions actives |
| `gauzian_db_pool_*` | Gauge | État connection pool PostgreSQL |
| `gauzian_redis_*` | Gauge | Cache hit/miss rate |
| `gauzian_s3_*` | Counter | Opérations S3 (uploads, downloads, errors) |
| `gauzian_file_operations_*` | Counter | Opérations fichiers (create, delete, share) |

### Dashboards Grafana

1. **Gauzian Application** : Request rate, latency P95, error rate, DB pool, Redis hit rate
2. **SysAdmin** : CPU/RAM par nœud, disk I/O, network traffic, pod restarts

---

## Troubleshooting

### Backend ne démarre pas

```bash
# Vérifier logs
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=100'

# Causes communes :
# - DATABASE_URL incorrect (typo password)
# - Redis non accessible (vérifier svc/redis)
# - MinIO bucket inexistant (créer via console)
```

### Erreur "Failed to decrypt private key"

**Frontend** : Mot de passe incorrect lors du login.

**Fix** : Vérifier que `PBKDF2 iterations = 310k` côté client ET backend (cohérence).

### HPA ne scale pas

```bash
# Vérifier metrics-server
ssh vps 'kubectl top pods -n gauzian-v2'

# Si "<unknown>" → installer metrics-server
ssh vps 'kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml'
```

### Prometheus ne scrape pas backend

```bash
# Vérifier endpoint /metrics
ssh vps 'kubectl port-forward -n gauzian-v2 svc/backend 8080:8080' &
curl http://localhost:8080/metrics

# Vérifier ServiceMonitor
ssh vps 'kubectl get servicemonitor -n gauzian-v2'
```

---

## Workflow Git

### Branches

- **`main`** : Production stable (déployé sur VPS K8s)
- **`feat/*`** : Features en développement
- **`fix/*`** : Bugfixes

### Commits

**Format** : `<type>(<scope>): <description>`

Exemples :
```
feat(drive): Add folder sharing with E2EE
fix(auth): Correct JWT expiration handling
docs(k8s): Document HPA configuration
chore: Update backend Docker image
```

### Deploy Workflow

```bash
# 1. Développer sur branche feat/
git checkout -b feat/new-feature
# ... code ...
git commit -m "feat(scope): Description"

# 2. Merge vers main
git checkout main
git merge feat/new-feature

# 3. Déployer
./push_docker_hub.sh
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'

# 4. Vérifier
ssh vps 'kubectl get pods -n gauzian-v2'
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=50'
```

---

## Journal de Bord (DEVELOPMENT_LOG.md)

**⚠️ OBLIGATOIRE** : Maintenir `DEVELOPMENT_LOG.md` à jour après chaque modification de code.

**Format** :
```markdown
[2026-02-11 15:30] - feat(drive): Ajout partage de dossiers E2EE avec re-chiffrement récursif des sous-dossiers
[2026-02-10 09:15] - fix(k8s): Correction namespace backend-deployment.yaml (gauzian → gauzian-v2)
```

**Localisation** : `/home/gael/Bureau/gauzian/DEVELOPMENT_LOG.md` (148KB actuellement).

---

## Documentation Complète

### Backend

- **Architecture** : `gauzian_back/src/ARCHITECTURE.md` (26KB, très détaillé)
- **Database Schema** : `gauzian_back/docs/DATABASE_SCHEMA.md` (700 lignes, ERD Mermaid)
- **Environment Variables** : `gauzian_back/docs/ENV_VARIABLES.md`
- **K8s Deployment** : `gauzian_back/k8s/README.md` (800 lignes)
- **Metrics Examples** : `gauzian_back/METRICS_USAGE_EXAMPLES.md`

### Frontend

- **README** : `gauzian_front/README.md` (1100 lignes, architecture complète)
- **Crypto Architecture** : `gauzian_front/docs/CRYPTO_ARCHITECTURE.md` (1000 lignes, E2EE détaillé)
- **API Endpoints** : `gauzian_front/API_ENDPOINTS.md` (focus agenda)

### Deployment & Operations

- **Deployment Guide** : `DEPLOYMENT.md` (VPS K8s + Clever Cloud)
- **Monitoring Setup** : `MONITORING_SETUP.md` (Prometheus + Grafana)
- **Security Testing** : `docs/SECURITY_TESTING.md` (SQLMap, Nikto, SSL/TLS)
- **Sharing E2EE** : `docs/SHARING_IMPLEMENTATION.md`

### Tests

- **Security Tests** : `tests/README.md` (SQLMap procedures)
- **Load Tests** : `tests/k6/` (k6 scripts)

---

## Contact & Support

- **Repository** : GitHub (lien privé)
- **Production** : https://gauzian.pupin.fr
- **Grafana** : https://grafana.gauzian.pupin.fr
- **MinIO Console** : https://minio.gauzian.pupin.fr

---

**Dernière mise à jour** : 2026-02-11
**Version** : Production VPS K8s + Clever Cloud
