# Kubernetes Infrastructure Documentation

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Complète](#architecture-complète)
3. [Structure des Fichiers](#structure-des-fichiers)
4. [Ressources Déployées](#ressources-déployées)
5. [Configuration Réseau](#configuration-réseau)
6. [Monitoring & Observabilité](#monitoring--observabilité)
7. [Déploiement](#déploiement)
8. [Scaling](#scaling)
9. [Troubleshooting](#troubleshooting)
10. [Sécurité](#sécurité)

---

## Vue d'Ensemble

Cette infrastructure Kubernetes déploie **GAUZIAN**, une plateforme de stockage cloud chiffrée de bout en bout (E2EE), avec un stack complet incluant :

- **Backend Rust** (Axum) - API RESTful avec auto-scaling (HPA)
- **Frontend Nuxt.js** - Application web client-side E2EE
- **PostgreSQL** - Base de données relationnelle
- **Redis** - Cache et liste de révocation de tokens
- **MinIO** - Stockage S3-compatible pour chunks chiffrés
- **Traefik** - Reverse proxy avec Let's Encrypt automatique
- **Prometheus + Grafana** - Stack de monitoring complet
- **Node Exporter** - Métriques système des nœuds K8s

**Namespace principal** : `gauzian-v2`
**Namespace monitoring** : `monitoring`

---

## Architecture Complète

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet (HTTPS)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │   Traefik    │ ← Let's Encrypt (certResolver)
                  │ IngressRoute │
                  └──────┬───────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Frontend   │ │   Backend    │ │    MinIO     │
│  (Nuxt.js)   │ │    (Rust)    │ │ S3 API+UI    │
│              │ │              │ │              │
│ Replicas: 2+ │ │ HPA: 2-10    │ │ Replicas: 1  │
└──────────────┘ └──────┬───────┘ └──────┬───────┘
                        │                │
              ┌─────────┼────────────────┤
              │         │                │
              ▼         ▼                ▼
       ┌──────────┐ ┌────────┐   ┌──────────────┐
       │PostgreSQL│ │ Redis  │   │ MinIO PVC    │
       │   PVC    │ │  PVC   │   │ (chunks      │
       │ (20Gi)   │ │ (5Gi)  │   │  chiffrés)   │
       └──────────┘ └────────┘   └──────────────┘

                         │
                         ▼
              ┌──────────────────┐
              │   Prometheus     │
              │   + Grafana      │
              │   (Monitoring)   │
              └──────────────────┘
```

### Flux de Données

1. **Client HTTPS** → Traefik IngressRoute
2. **Routing Traefik** :
   - `gauzian.pupin.fr/` → Frontend (Nuxt)
   - `gauzian.pupin.fr/api/*` → Backend (Rust) via middleware `strip-api-prefix`
   - `gauzian.pupin.fr/s3/*` → MinIO S3 API via middleware `strip-s3-prefix`
   - `minio.gauzian.pupin.fr` → MinIO Console UI
3. **Backend** :
   - Requêtes DB → PostgreSQL (port 5432)
   - Cache/tokens → Redis (port 6379)
   - Chunks chiffrés → MinIO (port 9000)
4. **Monitoring** :
   - Backend expose `/metrics` → Prometheus scrape (ServiceMonitor)
   - Grafana affiche dashboards (données depuis Prometheus)

---

## Structure des Fichiers

```
k8s/
├── README.md (ce fichier)
│
├── kustomization.yaml              # Orchestration Kustomize (ordre de déploiement)
│
├── namespace.yaml                  # Namespace gauzian-v2
├── monitoring-namespace.yaml       # Namespace monitoring
├── secrets.yaml                    # Secrets (DB, Redis, S3, JWT) - À créer manuellement
│
├── postgres-pvc.yaml               # PersistentVolumeClaim PostgreSQL (20Gi)
├── postgres-deployment.yaml        # Deployment + Service PostgreSQL
│
├── redis-pvc.yaml                  # PersistentVolumeClaim Redis (5Gi)
├── redis-deployment.yaml           # Deployment + Service Redis
│
├── minio-pvc.yaml                  # PersistentVolumeClaim MinIO (50Gi)
├── minio-deployment.yaml           # Deployment + Service MinIO (S3 API + Console)
│
├── backend-deployment.yaml         # Deployment + Service Backend Rust (2 replicas initiales)
├── backend-hpa.yaml                # HorizontalPodAutoscaler (2-10 replicas)
│
├── front-deployment.yaml           # Deployment + Service Frontend Nuxt
│
├── middleware.yaml                 # Traefik Middlewares (rate-limit, security-headers, compression)
├── ingressroute.yaml               # Traefik IngressRoute (HTTP → HTTPS redirect + routing HTTPS)
│
├── prometheus-config.yaml          # ConfigMap config Prometheus
├── prometheus-deployment.yaml      # Deployment + Service Prometheus
│
├── grafana-datasources.yaml        # ConfigMap datasources Grafana (Prometheus)
├── grafana-dashboards-provider.yaml # ConfigMap provider dashboards
├── grafana-dashboard-gauzian.yaml  # Dashboard Gauzian (métriques app)
├── grafana-dashboard-sysadmin.yaml # Dashboard SysAdmin (métriques système)
├── grafana-deployment.yaml         # Deployment + Service Grafana
├── grafana-ingress.yaml            # Ingress Grafana (deprecated)
│
├── node-exporter-daemonset.yaml    # DaemonSet Node Exporter (métriques nœuds)
│
└── monitoring/
    ├── kustomization.yaml          # Kustomization monitoring namespace
    ├── backend-servicemonitor.yaml # ServiceMonitor pour scraping /metrics backend
    ├── grafana-ingressroute.yaml   # IngressRoute Grafana (Traefik)
    └── prometheus-values.yaml      # Configuration Prometheus (alerting, scrape configs)
```

---

## Ressources Déployées

### 1. Namespaces

#### `namespace.yaml`
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: gauzian-v2
```

**⚠️ ATTENTION** : Incohérence détectée dans `backend-deployment.yaml` (ligne 5) qui utilise `namespace: gauzian` au lieu de `gauzian-v2`. À corriger.

#### `monitoring-namespace.yaml`
Namespace `monitoring` pour Prometheus, Grafana, Node Exporter.

---

### 2. Secrets (`secrets.yaml`)

**Fichier à créer manuellement** (non versionné dans Git pour sécurité).

Structure attendue :
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gauzian-secrets
  namespace: gauzian-v2
type: Opaque
stringData:
  # PostgreSQL
  DB_USER: "gauzian_user"
  DB_PASSWORD: "<GENERATE_STRONG_PASSWORD>"
  DB_NAME: "gauzian_db"
  DATABASE_URL: "postgres://gauzian_user:<PASSWORD>@postgres:5432/gauzian_db"

  # MinIO S3
  MINIO_ROOT_USER: "<GENERATE_ACCESS_KEY>"
  MINIO_ROOT_PASSWORD: "<GENERATE_SECRET_KEY>"
  S3_BUCKET: "gauzian-chunks"

  # JWT
  JWT_SECRET: "<GENERATE_256BIT_SECRET>"
```

**Génération de secrets** :
```bash
# Passwords PostgreSQL/MinIO
openssl rand -base64 32

# JWT Secret (256 bits)
openssl rand -hex 32
```

---

### 3. Persistent Volumes

| Ressource | Taille | Utilisation | StorageClass |
|-----------|--------|-------------|--------------|
| `postgres-pvc` | 20Gi | Base de données PostgreSQL | `local-path` (ou configuré) |
| `redis-pvc` | 5Gi | Cache Redis | `local-path` |
| `minio-pvc` | 50Gi | Chunks de fichiers chiffrés | `local-path` |

**Notes** :
- Les PVCs utilisent `accessModes: [ReadWriteOnce]` (un seul pod à la fois)
- Adapter la `storageClassName` selon votre cluster (ex: `longhorn`, `ceph-rbd`, `nfs`)

---

### 4. PostgreSQL

#### Deployment (`postgres-deployment.yaml`)
- **Image** : `postgres:17-alpine` (version légère)
- **Replicas** : 1 (base de données stateful)
- **Port** : 5432
- **Variables d'environnement** : `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (depuis Secret)
- **Volume** : `/var/lib/postgresql/data` → PVC `postgres-pvc`

#### Service
- **Type** : ClusterIP (interne au cluster)
- **Port** : 5432

**Accès pour migrations** :
```bash
kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432
sqlx migrate run --database-url postgres://gauzian_user:<PASSWORD>@localhost:5432/gauzian_db
```

---

### 5. Redis

#### Deployment (`redis-deployment.yaml`)
- **Image** : `redis:7-alpine`
- **Replicas** : 1
- **Port** : 6379
- **Volume** : `/data` → PVC `redis-pvc`
- **Commande** : `redis-server --appendonly yes` (persistence AOF)

#### Service
- **Type** : ClusterIP
- **Port** : 6379

**Utilisation** : Cache et liste de révocation JWT (token blacklist).

---

### 6. MinIO (S3-Compatible Object Storage)

#### Deployment (`minio-deployment.yaml`)
- **Image** : `quay.io/minio/minio:latest`
- **Replicas** : 1
- **Ports** :
  - `9000` : S3 API
  - `9001` : Console Web UI
- **Variables** : `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (depuis Secret)
- **Commande** : `minio server /data --console-address :9001`
- **Volume** : `/data` → PVC `minio-pvc`

#### Service
- **Type** : ClusterIP
- **Ports** : 9000 (S3), 9001 (Console)

**Accès** :
- **S3 API** : `gauzian.pupin.fr/s3/*` (via Traefik)
- **Console** : `minio.gauzian.pupin.fr` (via Traefik)

---

### 7. Backend (Rust - Axum)

#### Deployment (`backend-deployment.yaml`)
- **Image** : `angusvisual/gauzian-backend:dev`
- **Replicas initiales** : 2 (géré par HPA ensuite)
- **Port** : 8080
- **Resources** :
  - **Requests** : 100m CPU, 512Mi RAM
  - **Limits** : 500m CPU, 1Gi RAM
- **Probes** :
  - **Startup** : `/health/ready` (max 60s pour démarrer)
  - **Readiness** : `/health/ready` (prêt à recevoir du trafic ?)
  - **Liveness** : `/health/ready` (app toujours vivante ?)
- **Variables d'environnement** (17+) :
  - `DATABASE_URL`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `REDIS_URL=redis://redis:6379`
  - `S3_ENDPOINT=http://minio:9000`, `S3_REGION=us-east-1`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`
  - Alias AWS SDK : `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`
  - `JWT_SECRET`, `COOKIE_SECURE=true`
  - `HOST=0.0.0.0`, `PORT=8080`
  - `RUST_LOG=gauzian_back=info,tower_http=info,sqlx=warn`
  - `MAX_CONCURRENT_UPLOADS=30`

#### Service
- **Type** : ClusterIP
- **Port** : 8080
- **Label** : `app: backend` (utilisé par Prometheus ServiceMonitor)

---

### 8. HorizontalPodAutoscaler (HPA)

#### Configuration (`backend-hpa.yaml`)
- **Target** : Deployment `backend`
- **Min/Max Replicas** : 2-10
- **Metrics** :
  - CPU : scale si utilisation > 50%
  - Memory : scale si utilisation > 70%
- **Behavior** :
  - **Scale Up** : Rapide (100%/30s ou +2 pods/30s, max des deux)
  - **Scale Down** : Conservateur (attendre 5 min, max -50%/min)

**Monitoring HPA** :
```bash
kubectl get hpa -n gauzian-v2
kubectl describe hpa backend-hpa -n gauzian-v2
```

---

### 9. Frontend (Nuxt.js)

#### Deployment (`front-deployment.yaml`)
- **Image** : `angusvisual/gauzian-front:dev`
- **Replicas** : 2+
- **Port** : 8080 (port interne Nuxt serve)
- **Resources** : À définir selon charge

#### Service
- **Type** : ClusterIP
- **Port** : 8080

---

### 10. Traefik Ingress & Routing

#### Middlewares (`middleware.yaml`)

| Middleware | Description |
|------------|-------------|
| `redirect-https` | Redirection HTTP → HTTPS (301 permanent) |
| `strip-api-prefix` | Supprime `/api` avant proxy vers backend |
| `strip-s3-prefix` | Supprime `/s3` avant proxy vers MinIO |
| `compress` | Compression Gzip/Brotli |
| `security-headers` | Headers de sécurité (CSP, HSTS, X-Frame-Options) |
| `rate-limit-api` | Rate limiting API backend (100 req/s average, 200 burst) |
| `rate-limit-s3` | Rate limiting S3 uploads (50 req/s average, 100 burst) |
| `inflight-limit` | Max 1000 requêtes concurrentes |

#### IngressRoute (`ingressroute.yaml`)

**Route HTTPS** (`gauzian-https`) :
1. **MinIO Console** : `minio.gauzian.pupin.fr` → `minio:9001`
   - Middlewares : security-headers, inflight-limit
2. **API Backend** : `gauzian.pupin.fr/api/*` → `backend:8080`
   - Middlewares : rate-limit-api, inflight-limit, security-headers, strip-api-prefix, compress
3. **MinIO S3 API** : `gauzian.pupin.fr/s3/*` → `minio:9000`
   - Middlewares : rate-limit-s3, security-headers, strip-s3-prefix, compress
4. **Frontend** : `gauzian.pupin.fr` (catch-all) → `front:8080`
   - Middlewares : security-headers, compress
5. **TLS** : `certResolver: letsencrypt` (auto-provisioning Let's Encrypt)

**Route HTTP** (`gauzian-http`) :
- Redirect HTTP → HTTPS (sauf challenges ACME)
- Utilise `noop@internal` service Traefik (pas de backend réel)

---

### 11. Monitoring Stack

#### Prometheus (`prometheus-deployment.yaml`)

- **Image** : `prom/prometheus:latest`
- **Namespace** : `monitoring`
- **Port** : 9090
- **ConfigMap** : `prometheus-config.yaml`
  - **Scrape Configs** :
    - `prometheus` lui-même (9090)
    - `node-exporter` (9100, découverte via labels `app=node-exporter`)
    - `gauzian-backend` (8080/metrics, découverte via ServiceMonitor)
  - **Alerting** : Alertmanager configuré (optionnel)
- **Volume** : `/prometheus` (données métriques)

**Accès Prometheus** :
```bash
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Ouvrir http://localhost:9090
```

#### Grafana (`grafana-deployment.yaml`)

- **Image** : `grafana/grafana:latest`
- **Namespace** : `monitoring`
- **Port** : 3000
- **ConfigMaps** :
  - `grafana-datasources` : Connexion à Prometheus
  - `grafana-dashboards-provider` : Auto-provisionning dashboards
  - `grafana-dashboard-gauzian` : Dashboard métriques application (17 métriques custom)
  - `grafana-dashboard-sysadmin` : Dashboard métriques système (CPU, RAM, réseau)
- **Credentials par défaut** : `admin/admin` (à changer en production !)

**Accès Grafana** :
- **Production** : `grafana.gauzian.pupin.fr` (via IngressRoute)
- **Port-forward** :
  ```bash
  kubectl port-forward -n monitoring svc/grafana 3000:3000
  # Ouvrir http://localhost:3000
  ```

#### Node Exporter (`node-exporter-daemonset.yaml`)

- **Type** : DaemonSet (1 pod par nœud K8s)
- **Image** : `prom/node-exporter:latest`
- **Port** : 9100
- **Utilisation** : Expose métriques système (CPU, RAM, disk, network) des nœuds

#### Backend ServiceMonitor (`monitoring/backend-servicemonitor.yaml`)

- **CRD Prometheus Operator** : Auto-découverte du backend
- **Selector** : `app: backend`
- **Endpoint** : `http://backend.gauzian-v2.svc.cluster.local:8080/metrics`
- **Interval** : 30s

**Métriques backend exposées** (17 custom) :
- `gauzian_request_duration_seconds` (histogram)
- `gauzian_requests_total` (counter)
- `gauzian_active_connections` (gauge)
- `gauzian_db_pool_*` (connections, idle, active)
- `gauzian_redis_*` (hit_rate, operations)
- `gauzian_s3_*` (uploads, downloads, errors)
- `gauzian_file_operations_*` (create, delete, share)
- etc. (voir `gauzian_back/src/metrics.rs`)

---

## Configuration Réseau

### Domaines & DNS

| FQDN | Service | Port | Protocole |
|------|---------|------|-----------|
| `gauzian.pupin.fr` | Frontend | 443 | HTTPS |
| `gauzian.pupin.fr/api/*` | Backend API | 443 | HTTPS |
| `gauzian.pupin.fr/s3/*` | MinIO S3 API | 443 | HTTPS |
| `minio.gauzian.pupin.fr` | MinIO Console | 443 | HTTPS |
| `grafana.gauzian.pupin.fr` | Grafana | 443 | HTTPS |

**Configuration DNS** :
```
gauzian.pupin.fr       A      <VPS_PUBLIC_IP>
minio.gauzian.pupin.fr A      <VPS_PUBLIC_IP>
grafana.gauzian.pupin.fr A    <VPS_PUBLIC_IP>
```

### Let's Encrypt

- **CertResolver** : `letsencrypt` (configuré dans Traefik)
- **Challenge** : HTTP-01 (via port 80, géré automatiquement par Traefik)
- **Certificats** : Auto-renouvelés tous les 60 jours
- **Stockage** : `/data/acme.json` dans le pod Traefik (à persister avec PVC si besoin)

### Firewall (VPS)

**Ports à ouvrir** :
- `80/tcp` : HTTP (redirect + ACME challenges)
- `443/tcp` : HTTPS (tout le trafic applicatif)
- `6443/tcp` : Kubernetes API (si cluster multi-nœuds)

---

## Monitoring & Observabilité

### Dashboards Grafana

#### 1. Dashboard Gauzian (Application)

Fichier : `grafana-dashboard-gauzian.yaml`

**Panels** :
- Request Rate (req/s)
- Response Time (P50, P95, P99)
- Error Rate (%)
- Active Connections
- Database Pool (connections actives/idle/total)
- Redis Hit Rate (%)
- S3 Operations (uploads/downloads/errors)
- File Operations (create, delete, share)

#### 2. Dashboard SysAdmin (Système)

Fichier : `grafana-dashboard-sysadmin.yaml`

**Panels** :
- CPU Usage per node (%)
- Memory Usage per node (GB)
- Disk I/O (read/write MB/s)
- Network Traffic (in/out MB/s)
- Pod Restarts
- HPA Scaling Events

### Requêtes Prometheus Utiles

```promql
# Request rate backend (req/s)
rate(gauzian_requests_total[5m])

# P95 latency backend (ms)
histogram_quantile(0.95, rate(gauzian_request_duration_seconds_bucket[5m])) * 1000

# Error rate (%)
rate(gauzian_requests_total{status=~"5.."}[5m]) / rate(gauzian_requests_total[5m]) * 100

# Database pool saturation
gauzian_db_pool_active / gauzian_db_pool_max * 100

# Redis cache hit rate (%)
gauzian_redis_cache_hits / (gauzian_redis_cache_hits + gauzian_redis_cache_misses) * 100
```

### Logs

**Visionner logs en temps réel** :
```bash
# Backend
kubectl logs -n gauzian-v2 -l app=backend -f --tail=100

# Frontend
kubectl logs -n gauzian-v2 -l app=front -f --tail=100

# PostgreSQL
kubectl logs -n gauzian-v2 -l app=postgres -f

# Prometheus
kubectl logs -n monitoring -l app=prometheus -f
```

**Logs avec timestamps** :
```bash
kubectl logs -n gauzian-v2 -l app=backend --timestamps=true
```

---

## Déploiement

### 1. Prérequis

- Cluster Kubernetes opérationnel (K3s, K8s, etc.)
- `kubectl` configuré avec accès au cluster
- Traefik Ingress Controller installé avec :
  - CRDs IngressRoute/Middleware
  - Let's Encrypt certResolver configuré
- DNS pointant vers l'IP publique du cluster

### 2. Créer le fichier secrets.yaml

**Template** :
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gauzian-secrets
  namespace: gauzian-v2
type: Opaque
stringData:
  DB_USER: "gauzian_user"
  DB_PASSWORD: "$(openssl rand -base64 32)"
  DB_NAME: "gauzian_db"
  DATABASE_URL: "postgres://gauzian_user:<PASSWORD>@postgres:5432/gauzian_db"
  MINIO_ROOT_USER: "$(openssl rand -base64 16)"
  MINIO_ROOT_PASSWORD: "$(openssl rand -base64 32)"
  S3_BUCKET: "gauzian-chunks"
  JWT_SECRET: "$(openssl rand -hex 32)"
```

**Créer et appliquer** :
```bash
cd /home/gael/Bureau/gauzian/gauzian_back/k8s
# Éditer secrets.yaml avec vraies valeurs
kubectl apply -f secrets.yaml
```

### 3. Déploiement Initial (Kustomize)

```bash
cd /home/gael/Bureau/gauzian/gauzian_back/k8s

# Déployer toute l'infrastructure
kubectl apply -k .

# Vérifier le déploiement
kubectl get all -n gauzian-v2
kubectl get all -n monitoring
```

**Ordre d'application (via kustomization.yaml)** :
1. Namespaces (`gauzian-v2`, `monitoring`)
2. Secrets
3. PVCs (postgres, redis, minio)
4. Databases & services (postgres, redis, minio)
5. Applications (backend, front)
6. HPA (backend autoscaling)
7. Routing (middlewares, ingressroute)
8. Monitoring (prometheus, grafana, node-exporter, servicemonitor)

### 4. Initialiser la Base de Données

```bash
# Port-forward PostgreSQL
kubectl port-forward -n gauzian-v2 svc/postgres 5432:5432

# Dans un autre terminal, lancer migrations
cd /home/gael/Bureau/gauzian/gauzian_back
sqlx migrate run --database-url postgres://gauzian_user:<PASSWORD>@localhost:5432/gauzian_db
```

### 5. Créer le Bucket MinIO

```bash
# Port-forward MinIO Console
kubectl port-forward -n gauzian-v2 svc/minio 9001:9001

# Ouvrir http://localhost:9001
# Login avec MINIO_ROOT_USER/MINIO_ROOT_PASSWORD
# Créer bucket "gauzian-chunks" (ou nom défini dans S3_BUCKET)
```

**OU via mc (MinIO Client)** :
```bash
mc alias set myminio http://localhost:9000 <ACCESS_KEY> <SECRET_KEY>
mc mb myminio/gauzian-chunks
mc anonymous set none myminio/gauzian-chunks  # Privé
```

### 6. Vérification du Déploiement

```bash
# Statut des pods
kubectl get pods -n gauzian-v2
kubectl get pods -n monitoring

# Logs backend (vérifier connexions DB/Redis/S3)
kubectl logs -n gauzian-v2 -l app=backend --tail=50

# Test health check backend
kubectl port-forward -n gauzian-v2 svc/backend 8080:8080
curl http://localhost:8080/health/ready
# Devrait retourner : {"status":"healthy"}

# Vérifier HPA
kubectl get hpa -n gauzian-v2

# Tester accès HTTPS
curl -I https://gauzian.pupin.fr
curl https://gauzian.pupin.fr/api/health/ready
```

### 7. Script de Déploiement Automatisé

Voir `/home/gael/Bureau/gauzian/gauzian_back/k8s/update-max.sh` (script SSH utilisé depuis VPS).

**Workflow de mise à jour typique** (depuis machine locale) :
```bash
# 1. Build et push images Docker
cd /home/gael/Bureau/gauzian
./push_docker_hub.sh

# 2. Déployer sur VPS
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'

# 3. Vérifier pods
ssh vps 'kubectl get pods -n gauzian-v2'
```

---

## Scaling

### Horizontal Pod Autoscaler (HPA)

**Configuration actuelle** (`backend-hpa.yaml`) :
- Min : 2 replicas
- Max : 10 replicas
- Triggers : CPU > 50% OU RAM > 70%

**Modifier les seuils** :
```bash
kubectl edit hpa backend-hpa -n gauzian-v2
# Modifier averageUtilization
```

**Scaling manuel (override HPA temporairement)** :
```bash
# Scale à 5 replicas
kubectl scale deployment backend --replicas=5 -n gauzian-v2

# HPA reprendra le contrôle automatiquement après
```

### Vertical Scaling (Resources)

**Augmenter les limites CPU/RAM** :
```bash
kubectl edit deployment backend -n gauzian-v2
# Modifier resources.limits et resources.requests
```

**Recommandations** :
- **Backend** : Tester avec 200m-1000m CPU, 1-2Gi RAM pour haute charge
- **Frontend** : 100m-500m CPU, 256Mi-512Mi RAM
- **PostgreSQL** : 500m-2000m CPU, 2-4Gi RAM (selon taille DB)

### Load Testing

Voir `/home/gael/Bureau/gauzian/tests/k6/` pour scripts de test de charge.

**Lancer un test k6** :
```bash
cd /home/gael/Bureau/gauzian/tests/k6
k6 run --vus 100 --duration 5m load-test.js
```

**Observer le scaling** :
```bash
watch kubectl get hpa -n gauzian-v2
watch kubectl get pods -n gauzian-v2 -l app=backend
```

---

## Troubleshooting

### 1. Pods ne démarrent pas

**Diagnostic** :
```bash
kubectl get pods -n gauzian-v2
kubectl describe pod <POD_NAME> -n gauzian-v2
kubectl logs <POD_NAME> -n gauzian-v2
```

**Problèmes courants** :
- **ImagePullBackOff** : Image Docker n'existe pas ou credentials manquants
  - Vérifier `imagePullPolicy: Always` nécessite image sur registry
  - Solution : Build + push image ou utiliser `imagePullPolicy: IfNotPresent`
- **CrashLoopBackOff** : App crash au démarrage
  - Vérifier logs : `kubectl logs <POD> -n gauzian-v2 --previous`
  - Causes : variables d'env incorrectes, DB non accessible, secrets manquants
- **Pending** : Ressources insuffisantes
  - Vérifier : `kubectl describe pod <POD> -n gauzian-v2`
  - Solution : Réduire `resources.requests` ou ajouter nœuds

### 2. Backend ne se connecte pas à PostgreSQL

**Symptômes** :
```
ERROR sqlx::postgres: error connecting to database: connection refused
```

**Diagnostic** :
```bash
# Vérifier service PostgreSQL
kubectl get svc postgres -n gauzian-v2

# Tester connexion depuis backend pod
kubectl exec -it <BACKEND_POD> -n gauzian-v2 -- sh
apk add postgresql-client  # Si Alpine
psql $DATABASE_URL
```

**Solutions** :
- Vérifier `DATABASE_URL` dans Secret (format correct ?)
- Vérifier PostgreSQL est démarré : `kubectl get pods -l app=postgres -n gauzian-v2`
- Vérifier service name : `postgres` (pas `postgres-service`)

### 3. MinIO S3 Erreurs 403/404

**Symptômes** :
```
ERROR gauzian_back::storage: S3 upload failed: Access Denied
```

**Diagnostic** :
```bash
# Vérifier credentials MinIO dans Secret
kubectl get secret gauzian-secrets -n gauzian-v2 -o yaml

# Tester depuis backend pod
kubectl exec -it <BACKEND_POD> -n gauzian-v2 -- sh
env | grep S3
env | grep AWS
```

**Solutions** :
- Vérifier `MINIO_ROOT_USER` == `S3_ACCESS_KEY` == `AWS_ACCESS_KEY_ID`
- Vérifier bucket existe : `mc ls myminio/gauzian-chunks`
- Vérifier politique bucket (privé par défaut, OK pour GAUZIAN)

### 4. Traefik IngressRoute ne route pas

**Symptômes** :
- `curl https://gauzian.pupin.fr` → 404 Not Found
- Certificat Let's Encrypt non provisionné

**Diagnostic** :
```bash
# Vérifier IngressRoute
kubectl get ingressroute -n gauzian-v2
kubectl describe ingressroute gauzian-https -n gauzian-v2

# Vérifier logs Traefik
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik
```

**Solutions** :
- Vérifier Traefik CRDs installées : `kubectl get crd | grep traefik`
- Vérifier `certResolver: letsencrypt` existe dans config Traefik
- Vérifier DNS pointe bien vers IP publique
- Vérifier ports 80/443 ouverts sur firewall

### 5. HPA ne scale pas

**Symptômes** :
- Charge élevée mais replicas restent à 2

**Diagnostic** :
```bash
kubectl describe hpa backend-hpa -n gauzian-v2
kubectl top pods -n gauzian-v2  # Nécessite metrics-server
```

**Solutions** :
- Installer metrics-server si absent :
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```
- Vérifier `resources.requests` définis dans Deployment (HPA calcule % sur requests)
- Vérifier `kubectl get hpa` montre métriques (pas `<unknown>`)

### 6. Prometheus ne scrape pas le backend

**Symptômes** :
- Dashboard Grafana Gauzian vide
- Prometheus Targets : backend `DOWN`

**Diagnostic** :
```bash
# Vérifier ServiceMonitor
kubectl get servicemonitor -n gauzian-v2

# Vérifier endpoint /metrics backend
kubectl port-forward -n gauzian-v2 svc/backend 8080:8080
curl http://localhost:8080/metrics

# Vérifier Prometheus Targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Ouvrir http://localhost:9090/targets
```

**Solutions** :
- Vérifier ServiceMonitor sélectionne bon service (`app: backend`)
- Vérifier namespace correct dans ServiceMonitor
- Vérifier Prometheus a RBAC pour scraper namespace `gauzian-v2`

### 7. Certificat Let's Encrypt ACME Challenge échoue

**Symptômes** :
- Logs Traefik : `ACME challenge failed`
- Site accessible en HTTP mais pas HTTPS

**Diagnostic** :
```bash
# Vérifier DNS résolu publiquement
nslookup gauzian.pupin.fr 8.8.8.8

# Tester port 80 ouvert
curl -I http://gauzian.pupin.fr/.well-known/acme-challenge/test
```

**Solutions** :
- Vérifier DNS propagé (peut prendre jusqu'à 48h)
- Vérifier port 80 ouvert et accessible depuis Internet
- Vérifier Traefik écoute sur port 80 (entryPoint `web`)
- Rate limit Let's Encrypt : max 5 certificats/semaine/domaine (attendre si dépassé)

### 8. Logs Utiles

**Tout voir en temps réel** :
```bash
# Stern (multi-pods streaming)
stern -n gauzian-v2 backend

# Kubetail (alternative)
kubetail -n gauzian-v2 -l app=backend
```

---

## Sécurité

### 1. Secrets Management

**⚠️ CRITIQUE** :
- **NE JAMAIS** commit `secrets.yaml` dans Git
- Ajouter `secrets.yaml` au `.gitignore`
- Utiliser secrets management externe pour production (Vault, Sealed Secrets, SOPS)

**Rotation des secrets** :
```bash
# Générer nouveau JWT_SECRET
NEW_JWT_SECRET=$(openssl rand -hex 32)

# Mettre à jour Secret
kubectl patch secret gauzian-secrets -n gauzian-v2 \
  -p "{\"stringData\":{\"JWT_SECRET\":\"$NEW_JWT_SECRET\"}}"

# Restart backend pour recharger
kubectl rollout restart deployment backend -n gauzian-v2
```

### 2. Network Policies (Optionnel)

Limiter le trafic réseau entre pods :

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-netpol
  namespace: gauzian-v2
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: traefik  # Seulement Traefik peut appeler backend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app: minio
    ports:
    - protocol: TCP
      port: 9000
```

### 3. RBAC (Role-Based Access Control)

**Principe du moindre privilège** : Créer ServiceAccounts spécifiques pour chaque service.

**Exemple pour backend** :
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backend-sa
  namespace: gauzian-v2
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: backend-role
  namespace: gauzian-v2
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["gauzian-secrets"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: backend-rb
  namespace: gauzian-v2
subjects:
- kind: ServiceAccount
  name: backend-sa
roleRef:
  kind: Role
  name: backend-role
  apiGroup: rbac.authorization.k8s.io
```

Puis dans `backend-deployment.yaml` :
```yaml
spec:
  template:
    spec:
      serviceAccountName: backend-sa
```

### 4. Security Headers (Traefik Middleware)

Définis dans `middleware.yaml` :
```yaml
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: security-headers
spec:
  headers:
    customResponseHeaders:
      X-Content-Type-Options: "nosniff"
      X-Frame-Options: "DENY"
      X-XSS-Protection: "1; mode=block"
      Strict-Transport-Security: "max-age=31536000; includeSubDomains"
      Content-Security-Policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
```

### 5. Rate Limiting

Protège contre abus et DDoS (défini dans `middleware.yaml`) :
- **API Backend** : 100 req/s average, 200 burst
- **S3 Uploads** : 50 req/s average, 100 burst
- **Inflight** : Max 1000 requêtes concurrentes

**Ajuster les limites** :
```bash
kubectl edit middleware rate-limit-api -n gauzian-v2
```

### 6. Pod Security Standards (PSS)

**Activer PSS sur namespace** :
```bash
kubectl label namespace gauzian-v2 \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

**Adapter Deployments si nécessaire** :
```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: backend
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
          readOnlyRootFilesystem: true  # Si app le supporte
```

### 7. Backup & Disaster Recovery

**PostgreSQL Backup** :
```bash
# Backup manuel
kubectl exec -n gauzian-v2 postgres-<POD_ID> -- \
  pg_dump -U gauzian_user gauzian_db > backup-$(date +%Y%m%d).sql

# Restore
kubectl exec -i -n gauzian-v2 postgres-<POD_ID> -- \
  psql -U gauzian_user gauzian_db < backup-20260211.sql
```

**Automatiser avec CronJob** :
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: gauzian-v2
spec:
  schedule: "0 2 * * *"  # Tous les jours à 2h du matin
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:17-alpine
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: gauzian-secrets
                  key: DB_PASSWORD
            command:
            - /bin/sh
            - -c
            - pg_dump -h postgres -U gauzian_user gauzian_db | gzip > /backup/backup-$(date +\%Y\%m\%d-\%H\%M).sql.gz
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: postgres-backup-pvc
```

---

## Annexes

### A. Commandes Utiles

```bash
# === DÉPLOIEMENT ===
kubectl apply -k /path/to/k8s/          # Déployer avec Kustomize
kubectl delete -k /path/to/k8s/         # Supprimer tous les objets
kubectl apply -f <file>.yaml            # Déployer un seul fichier

# === INSPECTION ===
kubectl get all -n gauzian-v2           # Tous les objets
kubectl get pods -n gauzian-v2 -o wide  # Pods avec IP et node
kubectl describe pod <POD> -n gauzian-v2
kubectl logs <POD> -n gauzian-v2 -f     # Logs en temps réel
kubectl top pods -n gauzian-v2          # Utilisation CPU/RAM

# === EXEC & DEBUG ===
kubectl exec -it <POD> -n gauzian-v2 -- sh    # Shell dans pod
kubectl port-forward svc/<SERVICE> <LOCAL_PORT>:<REMOTE_PORT> -n gauzian-v2
kubectl cp <POD>:/path/to/file ./local-file -n gauzian-v2

# === ROLLING UPDATE ===
kubectl set image deployment/backend backend=angusvisual/gauzian-backend:v2 -n gauzian-v2
kubectl rollout status deployment/backend -n gauzian-v2
kubectl rollout undo deployment/backend -n gauzian-v2  # Rollback

# === SCALING ===
kubectl scale deployment backend --replicas=5 -n gauzian-v2
kubectl autoscale deployment backend --min=2 --max=10 --cpu-percent=50 -n gauzian-v2

# === SECRETS ===
kubectl get secrets -n gauzian-v2
kubectl describe secret gauzian-secrets -n gauzian-v2
kubectl create secret generic gauzian-secrets --from-file=./secrets.yaml -n gauzian-v2

# === MONITORING ===
kubectl top nodes                       # CPU/RAM par node
kubectl get hpa -n gauzian-v2 -w        # Watch HPA
kubectl get events -n gauzian-v2 --sort-by='.lastTimestamp'  # Événements récents
```

### B. Ressources Externes

- **Traefik Docs** : https://doc.traefik.io/traefik/
- **Kubernetes Docs** : https://kubernetes.io/docs/
- **Prometheus Operator** : https://prometheus-operator.dev/
- **Grafana Dashboards** : https://grafana.com/grafana/dashboards/
- **MinIO Docs** : https://min.io/docs/minio/kubernetes/upstream/

### C. Améliorations Futures

1. **High Availability** :
   - PostgreSQL HA avec Patroni ou Zalando Postgres Operator
   - Redis Sentinel ou Redis Cluster
   - MinIO multi-nœuds (mode distributed)

2. **Sécurité** :
   - Sealed Secrets ou External Secrets Operator
   - Pod Security Policies ou Pod Security Standards
   - Network Policies (isolation réseau)
   - Falco (runtime security monitoring)

3. **Observabilité** :
   - Loki pour agrégation de logs
   - Jaeger ou Tempo pour distributed tracing
   - Alertmanager avec notifications (Slack, email)

4. **CI/CD** :
   - GitOps avec ArgoCD ou FluxCD
   - Pipeline de build automatisé (GitHub Actions, GitLab CI)
   - Tests E2E avant déploiement

5. **Performance** :
   - CDN pour assets statiques frontend (Cloudflare, Fastly)
   - Redis comme cache applicatif (pas seulement tokens)
   - Connection pooling optimisé (PgBouncer)

---

## Contact & Support

Pour questions sur l'infrastructure K8s :
- **Repository** : https://github.com/VOTRE_ORG/gauzian
- **Documentation** : Voir `/docs/`, `/gauzian_back/docs/`, `/gauzian_front/docs/`
- **Issues** : GitHub Issues

**Auteur** : GAUZIAN Development Team
**Dernière mise à jour** : 2026-02-11
