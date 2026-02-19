# Guide de Déploiement Clever Cloud - GAUZIAN

## 📋 Prérequis

- Compte Clever Cloud : https://console.clever-cloud.com/
- Repo GitHub avec le code GAUZIAN
- Services externes déjà configurés :
  - Base de données PostgreSQL
  - Redis
  - MinIO/S3

## 🚀 Configuration

### Application 1 : Backend (Rust/Axum)

#### 1. Créer l'application
```
Type : Docker
Nom : gauzian-backend
Région : Paris (par1) ou autre selon préférence
```

#### 2. Lier le repo Git
```
Repo : https://github.com/votre-username/gauzian
Branche : main (ou feat/micros-sevices-prometheus selon votre workflow)
```

#### 3. Variables d'environnement requises

**Configuration Docker :**
```bash
CC_DOCKERFILE=Dockerfile.backend
```
> ⚠️ **Important** : Cette variable indique à Clever Cloud d'utiliser le fichier `Dockerfile.backend` à la racine du repo

**Base de données :**
```bash
DATABASE_URL=postgres://user:password@host:5432/gauzian
```

**Redis :**
```bash
REDIS_URL=redis://host:6379
```

**S3/MinIO :**
```bash
S3_ENDPOINT=https://s3.endpoint.com
S3_ACCESS_KEY=votre_access_key
S3_SECRET_KEY=votre_secret_key
S3_BUCKET=gauzian
```

**JWT :**
```bash
JWT_SECRET=votre_secret_jwt_très_long_et_aléatoire
```

**Logs (optionnel) :**
```bash
RUST_LOG=gauzian_back=info,tower_http=info
```

#### 4. Déployer
- Commit et push sur GitHub
- Clever Cloud build et déploie automatiquement
- Récupérer l'URL : `https://app-xxxxxxxx.cleverapps.io`

---

### Application 2 : Frontend (Nuxt.js)

#### 1. Créer l'application
```
Type : Docker
Nom : gauzian-frontend
Région : Paris (par1) - même région que le backend pour réduire la latence
```

#### 2. Lier le repo Git
```
Repo : https://github.com/votre-username/gauzian
Branche : main
```

#### 3. Variables d'environnement requises

**Configuration Docker :**
```bash
CC_DOCKERFILE=Dockerfile.frontend
```
> ⚠️ **Important** : Cette variable indique à Clever Cloud d'utiliser le fichier `Dockerfile.frontend` à la racine du repo

**API Backend :**
```bash
# ⚠️ IMPORTANT : Remplacer par l'URL réelle de votre backend Clever Cloud
NUXT_PUBLIC_API_URL=https://app-xxxxxxxx.cleverapps.io
```

> **Note :** L'URL doit pointer vers votre application backend Clever Cloud (sans `/api` à la fin si votre backend gère déjà ce préfixe dans les routes)

**Mode production :**
```bash
NODE_ENV=production
```

#### 4. Déployer
- Commit et push sur GitHub
- Clever Cloud build et déploie automatiquement
- Récupérer l'URL : `https://app-yyyyyyyy.cleverapps.io`

---

## 🔄 Workflow de mise à jour

### Depuis votre machine locale

```bash
# 1. Faire vos modifications
git add .
git commit -m "Description des changements"

# 2. Push sur GitHub
git push origin main

# 3. Clever Cloud redéploie automatiquement les deux applications
```

### Vérifier le déploiement

```bash
# Backend
curl https://gauzian-backend.cleverapps.io/health

# Frontend
curl https://gauzian-frontend.cleverapps.io
```

---

## 📊 Monitoring

### Logs en temps réel

Via l'interface Clever Cloud :
```
Backend : Console > Applications > gauzian-backend > Logs
Frontend : Console > Applications > gauzian-frontend > Logs
```

Via CLI (clever-tools) :
```bash
# Installer clever-tools
npm install -g clever-tools

# Se connecter
clever login

# Voir les logs
clever logs --app gauzian-backend
clever logs --app gauzian-frontend
```

---

## 🔒 CORS Configuration

Si vous avez des erreurs CORS, vérifiez que le backend autorise l'origine du frontend.

Dans `gauzian_back/src/routes.rs`, la configuration CORS doit inclure :
```rust
.allow_origin("https://gauzian-frontend.cleverapps.io".parse::<HeaderValue>().unwrap())
```

---

## 💡 Astuces

### Domaine personnalisé
Vous pouvez configurer vos propres domaines :
```
Backend : api.gauzian.com
Frontend : app.gauzian.com
```

Dans Clever Cloud : `Application > Domain names > Add a domain name`

### Variables par environnement
Pour tester sur staging avant prod :
```
Branche main → Production
Branche staging → Staging (créer une 2e app Clever Cloud)
```

### Scaling automatique
Clever Cloud scale automatiquement selon la charge.
Configurer dans : `Application > Scalability`

---

## ❓ Troubleshooting

### Le build échoue

**Vérifier :**
- `CC_DOCKER_BUILD_DIR` est bien défini
- Le Dockerfile existe dans le bon dossier
- Les dépendances sont disponibles (cargo/npm)

**Logs :**
```
Console > Application > Overview > Build logs
```

### L'application crash au démarrage

**Vérifier :**
- Toutes les variables d'environnement sont définies
- DATABASE_URL / REDIS_URL sont accessibles
- Le port 8080 est bien exposé

**Logs :**
```bash
clever logs --app gauzian-backend --since 5m
```

### Connexion DB/Redis impossible

**Vérifier :**
- Les services sont bien accessibles depuis internet
- Les credentials sont corrects
- Les IP Clever Cloud sont autorisées dans votre firewall

---

## 📝 Notes importantes

1. **Port 3000 → 8080** : Les Dockerfiles ont été modifiés pour Clever Cloud
2. **Rétrocompatibilité K8s** : Définir `PORT=3000` en env var dans vos deployments K8s
3. **Monorepo** :
   - Structure propre avec des Dockerfiles wrapper à la racine
   - `Dockerfile.backend` → Build depuis `gauzian_back/`
   - `Dockerfile.frontend` → Build depuis `gauzian_front/`
   - Les Dockerfiles originaux dans les sous-dossiers restent pour K8s/dev local
4. **Migrations DB** : Elles s'exécutent automatiquement au démarrage du backend (voir `main.rs:18-21`)

---

## 🎯 Checklist finale

Backend :
- [ ] Application créée sur Clever Cloud
- [ ] `CC_DOCKER_BUILD_DIR=gauzian_back` défini
- [ ] Variables DATABASE_URL, REDIS_URL, S3_*, JWT_SECRET définies
- [ ] Repo Git lié
- [ ] Premier déploiement réussi
- [ ] Health check OK : `curl https://backend-url/health`

Frontend :
- [ ] Application créée sur Clever Cloud
- [ ] `CC_DOCKER_BUILD_DIR=gauzian_front` défini
- [ ] Variable API_URL pointant vers le backend
- [ ] Repo Git lié
- [ ] Premier déploiement réussi
- [ ] Site accessible

Connexion :
- [ ] Le frontend peut appeler l'API backend
- [ ] CORS configuré correctement
- [ ] Login/Register fonctionnent
- [ ] Upload de fichiers fonctionne

---

**Besoin d'aide ?**
- Documentation Clever Cloud : https://developers.clever-cloud.com/doc/
- Support : https://console.clever-cloud.com/users/me/support
