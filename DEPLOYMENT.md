# Guide de Déploiement GAUZIAN

Ce document décrit les procédures de déploiement pour les deux environnements :
- **VPS Kubernetes** (environnement principal avec K8s)
- **Clever Cloud** (hébergement PaaS alternatif)

---

## 📋 Vue d'Ensemble de l'Architecture

```
gauzian/
├── gauzian_back/
│   ├── Dockerfile              # 🔵 Pour VPS/Kubernetes
│   ├── Dockerfile.dev          # Développement local
│   └── k8s/                    # Manifests Kubernetes
│       ├── update-max.sh       # Script déploiement VPS
│       └── deployment.yaml
├── gauzian_front/
│   ├── Dockerfile              # 🔵 Pour VPS/Kubernetes
│   └── Dockerfile.dev
├── Dockerfile.backend          # 🟢 Pour Clever Cloud (backend)
├── Dockerfile.backend.optimized # Build optimisé Clever Cloud
├── Dockerfile.backend.prebuilt  # Image pre-built (auto-généré)
├── Dockerfile.frontend         # 🟢 Pour Clever Cloud (frontend)
├── push_docker_hub.sh          # 🔵 Script VPS
└── update-backend-image.sh     # 🟢 Script Clever Cloud
```

**Légende :**
- 🔵 Fichiers/scripts pour **VPS Kubernetes**
- 🟢 Fichiers/scripts pour **Clever Cloud**

---

## 🚀 Déploiement 1 : VPS Kubernetes (Production Principale)

### Architecture
- **Hébergement :** VPS avec Kubernetes (K8s)
- **Accès :** Alias SSH `vps` configuré
- **Registry :** Docker Hub (`angusvisual/gauzian-backend:dev`, `angusvisual/gauzian-front:dev`)
- **Dockerfiles utilisés :** `gauzian_back/Dockerfile` et `gauzian_front/Dockerfile`

### Variables d'Environnement (sur le VPS)
Configurées via Kubernetes Secrets/ConfigMaps :
```bash
DATABASE_URL=postgresql://user:pass@postgres:5432/gauzian
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=gauzian
JWT_SECRET=your-secret-key
RUST_LOG=gauzian_back=info,tower_http=info
```

### Procédure de Déploiement

#### Étape 1 : Build et Push des Images Docker

```bash
# Depuis la racine du projet
./push_docker_hub.sh
```

**Ce que fait ce script :**
- Build `gauzian_back/Dockerfile` → `angusvisual/gauzian-backend:dev`
- Build `gauzian_front/Dockerfile` → `angusvisual/gauzian-front:dev`
- Push les deux images sur Docker Hub

#### Étape 2 : Déploiement sur le VPS

```bash
# Connexion SSH et exécution du script de mise à jour
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'
```

**Ce que fait ce script :**
- Pull des nouvelles images depuis Docker Hub
- Redémarrage des pods Kubernetes
- Rolling update sans downtime

#### Étape 3 : Vérification (optionnel)

```bash
# Vérifier l'état des pods
ssh vps 'kubectl get pods -n gauzian'

# Vérifier les logs
ssh vps 'kubectl logs -n gauzian -l app=backend --tail=50'
ssh vps 'kubectl logs -n gauzian -l app=frontend --tail=50'
```

#### Étape 4 : Push vers GitHub (si nouveaux fichiers)

```bash
git add .
git commit -m "feat: [description de la fonctionnalité]"
git push origin main
```

### Commande Rapide (Tout-en-Un)

```bash
# 1. Build et push images
./push_docker_hub.sh && \
# 2. Déploiement VPS
ssh vps 'bash ./gauzian_back/k8s/update-max.sh' && \
# 3. Vérification
ssh vps 'kubectl get pods -n gauzian'
```

---

## ☁️ Déploiement 2 : Clever Cloud (Alternative PaaS)

### Architecture
- **Hébergement :** Clever Cloud (PaaS)
- **Déclencheur :** Git push vers dépôt Clever Cloud
- **Registry :** Docker Hub (backend pre-built)
- **Dockerfiles utilisés :** `Dockerfile.backend`, `Dockerfile.frontend`

### Configuration Clever Cloud

#### Variables d'Environnement (dans Clever Cloud Dashboard)
```bash
DATABASE_URL=postgresql://...  # PostgreSQL add-on Clever Cloud
REDIS_URL=redis://...          # Redis add-on Clever Cloud
S3_ENDPOINT=https://...        # S3 compatible (Scaleway, Clever Storage, etc.)
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_BUCKET=gauzian
JWT_SECRET=your-secret-key
RUST_LOG=gauzian_back=info
HOST=0.0.0.0
PORT=8080                      # Port dynamique (injecté par Clever Cloud)

# Clever Cloud spécifique
CC_DOCKERFILE=Dockerfile.backend  # Pour le backend
```

### Procédure de Déploiement

#### Option A : Build Complet (Premier Déploiement)

```bash
# Push vers Clever Cloud via Git
git push clever main
```

**Ce que Clever Cloud fait :**
- Détecte `Dockerfile.backend` (via `CC_DOCKERFILE`)
- Build l'image dans l'environnement Clever Cloud
- Déploie automatiquement

#### Option B : Build Optimisé (Mise à Jour Backend)

**Pourquoi ?** Clever Cloud a des timeouts de build. La solution : pre-build l'image localement.

```bash
# 1. Build et push l'image optimisée
./update-backend-image.sh
```

**Ce que fait ce script :**
1. Build `Dockerfile.backend.optimized` → `angusvisual/gauzian-backend:latest`
2. Push sur Docker Hub
3. Récupère le digest de l'image (hash immuable)
4. Génère automatiquement `Dockerfile.backend.prebuilt` :
   ```dockerfile
   FROM angusvisual/gauzian-backend@sha256:abc123...
   ENV HOST=0.0.0.0
   ENV PORT=8080
   EXPOSE 8080
   CMD ["./server"]
   ```

```bash
# 2. Commit le Dockerfile généré
git add Dockerfile.backend.prebuilt
git commit -m "chore: Update backend image"

# 3. Push vers Clever Cloud
git push clever main

# 4. Redémarrer l'application (si nécessaire)
clever restart
```

#### Frontend (Nuxt)

```bash
# Push direct (le frontend build plus rapidement)
git push clever main
```

**Clever Cloud détecte** `Dockerfile.frontend` et déploie automatiquement.

### Commandes Clever Cloud CLI

```bash
# Afficher les logs en temps réel
clever logs

# Redémarrer l'application
clever restart

# Voir les variables d'environnement
clever env

# Lister les applications
clever applications
```

---

## 🔄 Différences Clés entre VPS et Clever Cloud

| Aspect | VPS Kubernetes | Clever Cloud |
|--------|----------------|--------------|
| **Gestion infra** | Manuelle (K8s manifests) | Automatique (PaaS) |
| **Build Docker** | Local → Docker Hub → VPS pull | Git push → Build distant OU Pre-built |
| **Port** | Fixe (`:8080`) | Dynamique (`$PORT` injecté) |
| **Scaling** | Manuel (`kubectl scale`) | Auto-scaling |
| **Base de données** | Self-hosted (pod PostgreSQL) | Add-on managé |
| **Coût** | VPS fixe | Pay-as-you-go |
| **Déploiement** | `push_docker_hub.sh` + SSH | `git push clever` |

---

## 🛠️ Workflows Recommandés

### Développement Local
```bash
cd gauzian_back && cargo watch -x run
cd gauzian_front && npm run dev
```

### Test avant Déploiement
```bash
# Build local avec les Dockerfiles de prod
docker build -t test-backend -f gauzian_back/Dockerfile gauzian_back
docker build -t test-frontend -f gauzian_front/Dockerfile gauzian_front

# Lancer avec docker-compose
docker-compose -f docker-compose.dev.yml up
```

### Déploiement VPS (Standard)
```bash
./push_docker_hub.sh && ssh vps 'bash ./gauzian_back/k8s/update-max.sh'
```

### Déploiement Clever Cloud (Optimisé)
```bash
./update-backend-image.sh && \
git add Dockerfile.backend.prebuilt && \
git commit -m "chore: Update backend image" && \
git push clever main
```

---

## 📝 Checklist de Déploiement

### Avant chaque déploiement :
- [ ] Tests locaux passent (`cargo test`, `npm run test`)
- [ ] Variables d'environnement à jour
- [ ] Migrations de base de données exécutées
- [ ] DEVELOPMENT_LOG.md mis à jour
- [ ] Git commit avec message descriptif

### Après déploiement :
- [ ] Vérifier les logs (erreurs/warnings)
- [ ] Tester les endpoints critiques (auth, upload, download)
- [ ] Vérifier la connexion DB/Redis/S3
- [ ] Monitorer les métriques (CPU, RAM, requêtes)

---

## 🆘 Dépannage

### VPS Kubernetes

**Pods en CrashLoopBackOff :**
```bash
ssh vps 'kubectl describe pod -n gauzian <pod-name>'
ssh vps 'kubectl logs -n gauzian <pod-name> --previous'
```

**Rollback :**
```bash
ssh vps 'kubectl rollout undo deployment/backend -n gauzian'
```

### Clever Cloud

**Build timeout :**
- Utiliser `update-backend-image.sh` pour pre-build l'image

**Logs incomplets :**
```bash
clever logs --since 1h
```

**Redémarrage forcé :**
```bash
clever restart --without-cache
```

---

## 📊 Maintenance

### Nettoyage Docker Hub
```bash
# Liste des images
docker images | grep gauzian

# Suppression des anciennes tags
docker rmi angusvisual/gauzian-backend:old-tag
```

### Mise à jour des Dépendances
```bash
cd gauzian_back && cargo update
cd gauzian_front && npm update
```

---

## 📚 Liens Utiles

- [Docker Hub (Backend)](https://hub.docker.com/r/angusvisual/gauzian-backend)
- [Docker Hub (Frontend)](https://hub.docker.com/r/angusvisual/gauzian-front)
- [Clever Cloud Docs](https://www.clever-cloud.com/doc/)
- [Kubernetes Docs](https://kubernetes.io/docs/)

---

**Dernière mise à jour :** 2026-02-05
