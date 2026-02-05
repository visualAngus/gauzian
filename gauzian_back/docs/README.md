# Déploiement Kubernetes pour Gauzian

Architecture Kubernetes avec Traefik Ingress Controller pour un déploiement production haute disponibilité.

## 🏗️ Architecture

- **Backend** : API Rust (2+ replicas avec HPA)
- **Frontend** : Nuxt.js (2+ replicas)
- **PostgreSQL** : Base de données persistante
- **Redis** : Cache en mémoire + token revocation
- **MinIO** : Stockage S3-compatible pour chunks chiffrés
- **Traefik** : Ingress avec certificats Let's Encrypt automatiques

---

## 📋 Prérequis

- Cluster Kubernetes opérationnel (K3s, K8s, etc.)
- `kubectl` configuré avec accès au cluster
- Images Docker disponibles sur un registry (Docker Hub, privé, etc.)

---

## ⚙️ Configuration Initiale

### 1. Configurer les Secrets

**⚠️ IMPORTANT** : Modifiez `secrets.yaml` avec vos valeurs sécurisées AVANT le déploiement :

```yaml
DB_USER: "votre_utilisateur"
DB_PASSWORD: "votre_mot_de_passe_securise"
JWT_SECRET: "votre_secret_jwt_tres_long_et_aleatoire"
DATABASE_URL: "postgres://user:pass@postgres:5432/gauzian"
S3_ACCESS_KEY: "votre_cle_minio"
S3_SECRET_KEY: "votre_secret_minio"
```

**Génération de secrets sécurisés :**
```bash
# JWT Secret (64 caractères minimum)
openssl rand -base64 48

# Mots de passe DB/MinIO
openssl rand -base64 32
```

### 2. Builder et Pousser les Images Docker

**Avec le script automatisé (recommandé) :**
```bash
# Depuis la racine du projet
./push_docker_hub.sh
```

**Ou manuellement :**
```bash
# Backend
cd gauzian_back
docker build -t angusvisual/gauzian-backend:latest .
docker push angusvisual/gauzian-backend:latest

# Frontend
cd ../gauzian_front
docker build -t angusvisual/gauzian-front:latest .
docker push angusvisual/gauzian-front:latest
```

---

## 🚀 Déploiement

### Déploiement Initial

```bash
# Depuis la racine du projet
kubectl apply -k gauzian_back/k8s/
```

### Mise à Jour des Images

**Avec le script automatisé (recommandé) :**
```bash
# Build + push + déploiement K8s
./push_docker_hub.sh
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'
```

**Ou manuellement :**
```bash
# Après avoir pushé de nouvelles images
kubectl rollout restart deployment/backend -n gauzian
kubectl rollout restart deployment/front -n gauzian

# Suivre le rollout
kubectl rollout status deployment/backend -n gauzian
kubectl rollout status deployment/front -n gauzian
```

---

## 🔍 Vérification & Monitoring

### Vérifier l'État des Pods

```bash
# Tous les pods du namespace
kubectl get pods -n gauzian

# Avec détails
kubectl get pods -n gauzian -o wide

# Suivre les pods en temps réel
watch kubectl get pods -n gauzian
```

### Vérifier les Services

```bash
# Liste des services
kubectl get svc -n gauzian

# Ingress et routes
kubectl get ingress -n gauzian
```

### Consulter les Logs

```bash
# Backend (dernières 50 lignes)
kubectl logs -n gauzian -l app=backend --tail=50

# Frontend
kubectl logs -n gauzian -l app=front --tail=50

# Suivre les logs en temps réel
kubectl logs -n gauzian -l app=backend -f

# Logs d'un pod spécifique
kubectl logs -n gauzian <nom-du-pod>
```

### Health Checks

```bash
# Vérifier les probes (readiness/liveness)
kubectl describe pod -n gauzian <nom-du-pod> | grep -A 10 "Conditions"

# Tester le endpoint health
kubectl exec -n gauzian <backend-pod> -- curl http://localhost:8080/health/ready
```

---

## 📊 Mise à l'Échelle

### Scaling Manuel

```bash
# Backend (augmenter à 4 replicas)
kubectl scale deployment backend -n gauzian --replicas=4

# Frontend
kubectl scale deployment front -n gauzian --replicas=3
```

### Horizontal Pod Autoscaler (HPA)

Un HPA est configuré pour le backend (`backend-hpa.yaml`) :
- **Min replicas** : 2
- **Max replicas** : 10
- **Trigger** : CPU > 70%

```bash
# Vérifier l'état du HPA
kubectl get hpa -n gauzian

# Détails du HPA
kubectl describe hpa backend-hpa -n gauzian
```

---

## 🌐 Accès à l'Application

**Production (via Traefik + Let's Encrypt) :**
- **HTTPS** : https://gauzian.pupin.fr
- **API** : https://gauzian.pupin.fr/api/*
- **MinIO Console** : https://gauzian.pupin.fr/minio/*
- **MinIO S3 API** : https://gauzian.pupin.fr/s3/*

Le certificat SSL est automatiquement généré et renouvelé par Traefik via Let's Encrypt.

**Développement Local (Minikube) :**
```bash
# Exposer les services localement
minikube service caddy -n gauzian

# Ou créer un tunnel
minikube tunnel
```

---

## 🗂️ Structure des Fichiers

```
k8s/
├── namespace.yaml              # Namespace Kubernetes
├── secrets.yaml                # Credentials DB/MinIO/JWT ⚠️
├── postgres-pvc.yaml           # Stockage persistant PostgreSQL
├── postgres-deployment.yaml    # Déploiement PostgreSQL
├── redis-pvc.yaml              # Stockage persistant Redis
├── redis-deployment.yaml       # Déploiement Redis
├── minio-pvc.yaml              # Stockage persistant MinIO
├── minio-deployment.yaml       # Déploiement MinIO
├── backend-deployment.yaml     # Déploiement API Rust
├── backend-hpa.yaml            # Autoscaling backend
├── front-deployment.yaml       # Déploiement Nuxt frontend
├── ingressroute.yaml           # Traefik IngressRoute
├── middleware.yaml             # Traefik middlewares (CORS, headers)
├── kustomization.yaml          # Kustomize pour déployer tout
├── update-max.sh               # Script de mise à jour automatique
└── README.md                   # Ce fichier
```

---

## 🔧 Dépannage

### Pod en CrashLoopBackOff

```bash
# Voir les logs du pod qui crash
kubectl logs -n gauzian <pod-name> --previous

# Décrire le pod pour voir les events
kubectl describe pod -n gauzian <pod-name>
```

### Base de Données Inaccessible

```bash
# Vérifier que PostgreSQL est up
kubectl get pods -n gauzian | grep postgres

# Tester la connexion depuis un pod backend
kubectl exec -n gauzian <backend-pod> -- psql $DATABASE_URL -c "SELECT 1"

# Port-forward pour debug local
kubectl port-forward -n gauzian svc/postgres 5432:5432
```

### Problèmes de Certificats SSL

```bash
# Vérifier les ingress Traefik
kubectl get ingressroute -n gauzian

# Logs Traefik (si disponible)
kubectl logs -n kube-system -l app=traefik
```

### Redis Inaccessible

```bash
# Tester Redis depuis un pod
kubectl exec -n gauzian <backend-pod> -- redis-cli -h redis -p 6379 PING
```

---

## 🧹 Suppression

### Supprimer l'Application

```bash
# Via Kustomize
kubectl delete -k gauzian_back/k8s/

# Ou supprimer tout le namespace
kubectl delete namespace gauzian
```

**⚠️ ATTENTION** : Cette opération supprime également les PVC (données PostgreSQL/MinIO/Redis).

### Conserver les Données

Si vous souhaitez conserver les données :
```bash
# Supprimer uniquement les deployments
kubectl delete deployment --all -n gauzian

# Les PVC et données persistent
kubectl get pvc -n gauzian
```

---

## 📝 Notes Importantes

1. **Stockage Persistant** : Les PVC utilisent le StorageClass par défaut (`local-path` sur K3s, `standard` sur Minikube). En production, configurez un StorageClass approprié.

2. **Certificats SSL** : Traefik gère automatiquement Let's Encrypt. Assurez-vous que votre DNS pointe vers l'IP du cluster.

3. **Secrets** : Ne jamais commit `secrets.yaml` avec des vraies valeurs dans Git. Utilisez un gestionnaire de secrets en production (Sealed Secrets, Vault, etc.).

4. **Health Checks** : Le backend implémente `/health/ready` qui vérifie PostgreSQL, Redis, et MinIO. Kubernetes attend que ce endpoint retourne 200 avant de router le trafic.

5. **Zero-Downtime Deployments** : Les health checks garantissent qu'aucun trafic n'est routé vers des pods non-prêts lors des mises à jour.

6. **Migrations DB** : Les migrations SQLx doivent être exécutées manuellement avant le déploiement initial :
   ```bash
   kubectl exec -n gauzian <backend-pod> -- sqlx migrate run
   ```

---

## 📞 Support

Pour des questions spécifiques au déploiement, consultez :
- [DEVELOPMENT_LOG.md](../../DEVELOPMENT_LOG.md) : Historique détaillé des changements
- [CLAUDE.md](../CLAUDE.md) : Guide backend Rust
- [README.md](../../README.md) : Documentation projet principale
