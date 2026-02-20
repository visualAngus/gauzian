# CLAUDE.md - Branche `main` (Orchestration / Déploiement)

Guidance for Claude Code when working with the GAUZIAN repository.

---

## Structure des Branches (depuis 2026-02-20)

Le repo est organisé en **3 branches indépendantes** (orphelines) :

| Branche | Rôle | Contenu |
|---------|------|---------|
| **`main`** | Orchestration / Déploiement | `k8s/`, scripts, docs, CI/CD |
| **`back`** | Code source backend | Rust/Axum à la racine (`src/`, `Cargo.toml`, `Dockerfile`...) |
| **`front`** | Code source frontend | Nuxt 4 à la racine (`app/`, `nuxt.config.ts`, `Dockerfile`...) |
| `archive/before-restructure` | Snapshot | État du mono-repo avant restructuration |

> Les branches `back` et `front` sont **orphelines** : aucun ancêtre commun avec `main`.
> L'historique complet est dans `archive/before-restructure`.

---

## Workflow de Déploiement (CI/CD automatique)

```
git push origin back   →  GitHub Actions build backend  →  deploy VPS K8s
git push origin front  →  GitHub Actions build frontend →  deploy VPS K8s
git push origin main   →  GitHub Actions                →  deploy VPS K8s
```

Le script de déploiement sur VPS : `/home/debian/gauzian/k8s/scripts/ci-deploy.sh`

### Déploiement manuel (si CI/CD non disponible)

```bash
# Build + push images Docker Hub
./push_docker_hub.sh

# Déployer sur VPS
ssh vps 'bash /home/debian/gauzian/k8s/scripts/ci-deploy.sh'

# Vérifier déploiement
ssh vps 'kubectl get pods -n gauzian-v2'
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=50'
```

---

## Structure de `main`

```
gauzian/ (branche main)
├── k8s/                        # ⭐ Manifests Kubernetes (déplacé depuis gauzian_back/k8s/)
│   ├── README.md               # Documentation K8s complète (800 lignes)
│   ├── scripts/
│   │   └── ci-deploy.sh        # Script de déploiement CI/CD
│   └── *.yaml                  # Deployments, services, ingress, monitoring
│
├── .github/
│   └── workflows/
│       └── build-and-push.yml  # CI/CD : deploy VPS sur push main
│
├── docs/                       # Documentation technique
│   ├── SECURITY_TESTING.md
│   ├── SHARING_*.md
│   └── README.md
│
├── tests/                      # Suite de tests
│   ├── security/               # Tests SQLMap
│   └── k6/                     # Tests de charge
│
├── push_docker_hub.sh          # Script build + push Docker Hub
├── update.sh                   # Script de mise à jour VPS
├── DEPLOYMENT.md               # Guide déploiement complet
├── DEVELOPMENT_LOG.md          # Journal de bord (obligatoire)
└── README.md                   # Overview projet
```

---

## Kubernetes Operations

```bash
# Lister pods
ssh vps 'kubectl get pods -n gauzian-v2'

# Logs backend en temps réel
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend -f --tail=100'

# Vérifier HPA (auto-scaling)
ssh vps 'kubectl get hpa -n gauzian-v2'

# Redémarrer deployment
ssh vps 'kubectl rollout restart deployment/backend -n gauzian-v2'
ssh vps 'kubectl rollout restart deployment/frontend -n gauzian-v2'
```

### Database Migrations

```bash
# Port-forward PostgreSQL depuis VPS
ssh vps 'kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432' &
sqlx migrate run --database-url postgres://gauzian_user:<PASSWORD>@localhost:5432/gauzian_db
```

### Monitoring

```bash
# Grafana : https://grafana.gauzian.pupin.fr
# Port-forward local (debug)
ssh vps 'kubectl port-forward -n monitoring svc/grafana 3000:3000'
```

---

## Infrastructure K8s

**Voir `k8s/README.md` pour détails (800 lignes).**

### Services Déployés

| Service | Image | Replicas |
|---------|-------|----------|
| **Backend** | `angusvisual/gauzian-backend:dev` | 2-10 (HPA) |
| **Frontend** | `angusvisual/gauzian-front:dev` | 2+ |
| **PostgreSQL** | `postgres:17-alpine` | 1 |
| **Redis** | `redis:7-alpine` | 1 |
| **MinIO** | `minio/minio:latest` | 1 |
| **Prometheus** | `prom/prometheus:latest` | 1 |
| **Grafana** | `grafana/grafana:latest` | 1 |

### Networking (Traefik IngressRoute)

| URL | Service |
|-----|---------|
| `gauzian.pupin.fr/` | Frontend |
| `gauzian.pupin.fr/api/*` | Backend |
| `gauzian.pupin.fr/s3/*` | MinIO S3 |
| `grafana.gauzian.pupin.fr` | Grafana |

### Auto-Scaling (HPA)

- **Min** : 2 replicas / **Max** : 10 replicas
- **Triggers** : CPU > 50% OU RAM > 70%

---

## Workflow Git

### Commits (convention)

```
feat(scope): Description
fix(scope): Description
docs(scope): Description    ← ajouter [skip ci] pour éviter un déploiement
chore: Description          ← ajouter [skip ci] si pas de changement infra
```

> **`[skip ci]`** dans le message de commit empêche GitHub Actions de déclencher un déploiement.
> À utiliser pour les commits documentation, formatting, etc.

### Travailler sur le backend

```bash
git checkout back
# ... coder ...
git push origin back   # → CI build + deploy auto
```

### Travailler sur le frontend

```bash
git checkout front
# ... coder ...
git push origin front  # → CI build + deploy auto
```

---

## Journal de Bord (DEVELOPMENT_LOG.md)

**⚠️ OBLIGATOIRE** : Maintenir `DEVELOPMENT_LOG.md` à jour après chaque modification.

```markdown
[2026-02-20 15:30] - chore: Restructuration mono-repo en branches orphelines
```

---

## Contacts

- **Production** : https://gauzian.pupin.fr
- **Grafana** : https://grafana.gauzian.pupin.fr
- **MinIO Console** : https://minio.gauzian.pupin.fr

---

**Dernière mise à jour** : 2026-02-20
**Structure** : Branches orphelines back/front + main orchestration
