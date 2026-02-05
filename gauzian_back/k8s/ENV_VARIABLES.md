# Variables d'Environnement - Backend GAUZIAN (VPS Kubernetes)

Ce document liste **TOUTES** les variables d'environnement utilisées par le backend Rust.

---

## 📋 Variables Obligatoires (Must be set)

Ces variables **doivent** être définies, sinon l'application crashera au démarrage.

| Variable | Description | Exemple | Défini dans |
|----------|-------------|---------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgres://admin:pass@db:5432/gauzian` | `secrets.yaml` |
| `JWT_SECRET` | Clé secrète pour signer les JWT | `c3ab8ff13720e8ad...` | `secrets.yaml` |
| `REDIS_URL` | URL de connexion Redis | `redis://redis:6379` | `backend-deployment.yaml` |
| `S3_ENDPOINT` | URL du serveur S3/MinIO | `http://minio:9000` | `backend-deployment.yaml` |
| `S3_ACCESS_KEY` | Access Key S3 | `minioadmin` | `secrets.yaml` |
| `S3_SECRET_KEY` | Secret Key S3 | `ght56YhbnNN4034` | `secrets.yaml` |

---

## ⚙️ Variables Optionnelles (avec valeurs par défaut)

Ces variables ont des valeurs par défaut dans le code Rust.

| Variable | Description | Valeur par défaut | Défini dans |
|----------|-------------|-------------------|-------------|
| `HOST` | Adresse IP d'écoute | `0.0.0.0` | `backend-deployment.yaml` |
| `PORT` | Port d'écoute du serveur | `8080` | `backend-deployment.yaml` |
| `S3_REGION` | Région S3 (pour AWS SDK) | `us-east-1` | `backend-deployment.yaml` |
| `S3_BUCKET` | Nom du bucket S3 | `gauzian` | `secrets.yaml` |
| `MAX_CONCURRENT_UPLOADS` | Limite uploads simultanés | `50` | `backend-deployment.yaml` |
| `COOKIE_SECURE` | Force HTTPS pour cookies | `false` | `backend-deployment.yaml` |
| `RUST_LOG` | Niveau de logs | `gauzian_back=debug,tower_http=debug` | `backend-deployment.yaml` |

---

## 🔄 Variables Alias (AWS SDK Compatibility)

Ces variables sont des **alias** pour la compatibilité avec AWS SDK.

| Variable AWS | Équivalent GAUZIAN | Note |
|--------------|---------------------|------|
| `AWS_ACCESS_KEY_ID` | `S3_ACCESS_KEY` | Utilisé par aws-sdk-s3 |
| `AWS_SECRET_ACCESS_KEY` | `S3_SECRET_KEY` | Utilisé par aws-sdk-s3 |
| `AWS_DEFAULT_REGION` | `S3_REGION` | Utilisé par aws-sdk-s3 |

**Recommandation :** Définir **les deux** pour éviter les problèmes de compatibilité.

---

## 📍 Où sont définies les variables ?

### 1. **Secrets Kubernetes** (`secrets.yaml`)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: gauzian-secrets
  namespace: gauzian
type: Opaque
stringData:
  DB_USER: "admin"
  DB_PASSWORD: "qdgvhbj4034"
  DB_NAME: "gauzian"
  DATABASE_URL: "postgres://admin:qdgvhbj4034@db:5432/gauzian"
  MINIO_ROOT_USER: "minioadmin"
  MINIO_ROOT_PASSWORD: "ght56YhbnNN4034"
  S3_BUCKET: "gauzian"
  JWT_SECRET: "c3ab8ff13720e8afgfd695047dd39462b3c8974e592c2fa383d4a3960714caef0c4f2"
```

### 2. **Backend Deployment** (`backend-deployment.yaml`)
```yaml
env:
  # Variables injectées depuis les secrets
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: gauzian-secrets
        key: DATABASE_URL

  # Variables définies en dur (non-sensibles)
  - name: REDIS_URL
    value: "redis://redis:6379"

  - name: S3_ENDPOINT
    value: "http://minio:9000"

  - name: HOST
    value: "0.0.0.0"

  - name: PORT
    value: "8080"

  # ... (voir backend-deployment.yaml pour la liste complète)
```

---

## 🔧 Comment modifier les variables

### Modifier un Secret

```bash
# 1. Éditer secrets.yaml localement
vim gauzian_back/k8s/secrets.yaml

# 2. Appliquer sur le VPS
ssh vps 'kubectl apply -f ./gauzian_back/k8s/secrets.yaml'

# 3. Redémarrer le backend pour charger les nouvelles valeurs
ssh vps 'kubectl rollout restart deployment/backend -n gauzian'
```

### Modifier une variable non-sensible

```bash
# 1. Éditer backend-deployment.yaml localement
vim gauzian_back/k8s/backend-deployment.yaml

# 2. Appliquer sur le VPS
ssh vps 'kubectl apply -f ./gauzian_back/k8s/backend-deployment.yaml'

# Note : Le redémarrage est automatique si le deployment change
```

---

## 🚨 Variables de Production à Modifier

Avant le déploiement en production, **modifier ces valeurs** :

### Secrets
- ✅ `DB_PASSWORD` : Générer un mot de passe fort (ex: `openssl rand -base64 32`)
- ✅ `MINIO_ROOT_PASSWORD` : Générer un mot de passe fort
- ✅ `JWT_SECRET` : Générer une clé aléatoire (ex: `openssl rand -hex 64`)

### Configuration
- ✅ `COOKIE_SECURE` : Mettre à `"true"` pour forcer HTTPS
- ✅ `RUST_LOG` : Réduire à `"gauzian_back=info,tower_http=warn"` pour moins de logs
- ✅ `MAX_CONCURRENT_UPLOADS` : Ajuster selon la RAM disponible (30 pour 512MB, 50 pour 1GB)

---

## 📊 Matrice de Configuration

| Environnement | HOST | PORT | COOKIE_SECURE | RUST_LOG | MAX_CONCURRENT_UPLOADS |
|---------------|------|------|---------------|----------|------------------------|
| **Local Dev** | `127.0.0.1` | `8080` | `false` | `debug` | `10` |
| **VPS K8s** | `0.0.0.0` | `8080` | `true` | `info` | `30` |
| **Clever Cloud** | `0.0.0.0` | `8080` | `true` | `info` | `50` |

---

## 🔍 Vérification

Pour vérifier les variables d'environnement d'un pod en cours d'exécution :

```bash
# Lister les pods
ssh vps 'kubectl get pods -n gauzian'

# Afficher les variables d'env d'un pod
ssh vps 'kubectl exec -n gauzian <pod-name> -- env | grep -E "DATABASE|REDIS|S3|JWT|PORT"'

# Vérifier les logs au démarrage
ssh vps 'kubectl logs -n gauzian -l app=backend --tail=50'
```

---

## 📝 Références Code Source

- **`main.rs:14`** : `DATABASE_URL` (obligatoire)
- **`main.rs:55-59`** : `HOST`, `PORT` (optionnels)
- **`state.rs:19`** : `JWT_SECRET` (obligatoire)
- **`state.rs:21`** : `REDIS_URL` (obligatoire)
- **`state.rs:31`** : `S3_BUCKET` (optionnel)
- **`state.rs:37`** : `MAX_CONCURRENT_UPLOADS` (optionnel)
- **`storage.rs:51-59`** : `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (+ alias AWS)
- **`response.rs:84`** : `COOKIE_SECURE` (optionnel)

---

**Dernière mise à jour :** 2026-02-05
