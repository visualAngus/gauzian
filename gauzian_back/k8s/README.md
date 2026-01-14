# Déploiement Kubernetes pour Gauzian

Architecture Kubernetes simplifiée avec Traefik Ingress Controller (intégré K3s).

## Architecture

- **Backend** : API Rust (2 replicas)
- **Frontend** : Nuxt.js (2 replicas)
- **PostgreSQL** : Base de données persistante
- **Redis** : Cache en mémoire
- **MinIO** : Stockage S3-compatible
- **Traefik** : Ingress avec certificats Let's Encrypt automatiques

## Avant de déployer

### 1. Modifier les secrets

Éditez [secrets.yaml](secrets.yaml) avec vos vraies valeurs :
```yaml
DB_USER: "admin"
DB_PASSWORD: "votre_mot_de_passe"
JWT_SECRET: "votre_secret_jwt"
DATABASE_URL: "postgres://admin:motdepasse@db:5432/gauzian"
```

### 2. Builder et pusher les images Docker

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

## Déploiement

### Déployer tous les services

```bash
kubectl apply -k gauzian_back/k8s/
```

### Vérifier le déploiement

```bash
# Pods
kubectl get pods -n gauzian

# Services
kubectl get svc -n gauzian

# Ingress
kubectl get ingress -n gauzian

# Logs backend
kubectl logs -n gauzian -l app=backend --tail=50
```

## Accès

- **HTTPS** : https://gauzian.pupin.fr
- **HTTP** : http://gauzian.pupin.fr (redirige vers HTTPS)
- **API** : https://gauzian.pupin.fr/api/*
- **MinIO Console** : https://gauzian.pupin.fr/minio/*
- **MinIO S3 API** : https://gauzian.pupin.fr/s3/*

Le certificat SSL est automatiquement généré par Traefik via Let's Encrypt.

## Mise à l'échelle

```bash
# Backend
kubectl scale deployment backend -n gauzian --replicas=3

# Frontend
kubectl scale deployment front -n gauzian --replicas=3
```

## Mise à jour des images

```bash
# Après avoir pushé une nouvelle image
kubectl rollout restart deployment/backend -n gauzian
kubectl rollout restart deployment/front -n gauzian
```

## Suppression

```bash
# Supprimer tous les ressources
kubectl delete namespace gauzian
```

## Notes

- Les PVC utilisent le StorageClass par défaut (local-path sur K3s)
- Traefik gère automatiquement les certificats Let's Encrypt
- Les secrets doivent être modifiés avant le déploiement initial
- PostgreSQL conserve les données même après redémarrage

## Structure des fichiers

- `namespace.yaml` - Namespace Kubernetes pour l'application
- `secrets.yaml` - Secrets pour les credentials (DB, MinIO, JWT)
- `*-pvc.yaml` - PersistentVolumeClaims pour le stockage persistant
- `*-deployment.yaml` - Deployments et Services pour chaque composant
- `kustomization.yaml` - Configuration Kustomize pour déployer tous les manifestes

## Avant de déployer

### 1. Modifier les secrets

Éditez `secrets.yaml` et remplacez les valeurs par défaut :
```yaml
DB_USER: "votre_utilisateur"
DB_PASSWORD: "votre_mot_de_passe"
JWT_SECRET: "votre_secret_jwt_securise"
```

### 2. Builder et pusher les images Docker

Vous devez créer vos images Docker et les pousser vers un registry accessible par Kubernetes :

```bash
# Backend
cd gauzian_back
docker build -t votre-registry/gauzian-backend:v1.0 .
docker push votre-registry/gauzian-backend:v1.0

# Caddy
docker build -f Caddy.Dockerfile -t votre-registry/gauzian-caddy:v1.0 .
docker push votre-registry/gauzian-caddy:v1.0

# Frontend
cd ../gauzian_front
docker build -t votre-registry/gauzian-front:v1.0 .
docker push votre-registry/gauzian-front:v1.0
```

Puis modifiez les fichiers deployment pour utiliser vos images :
- `backend-deployment.yaml` : ligne `image:`
- `caddy-deployment.yaml` : ligne `image:`
- `front-deployment.yaml` : ligne `image:`

### 3. Configurer Caddy

Copiez le contenu de votre `Caddyfile` dans `caddy-configmap.yaml`.

## Déploiement

### Option 1 : Avec kubectl apply

```bash
kubectl apply -f k8s/
```

### Option 2 : Avec Kustomize

```bash
kubectl apply -k k8s/
```

## Vérifier le déploiement

```bash
# Vérifier les pods
kubectl get pods -n gauzian

# Vérifier les services
kubectl get services -n gauzian

# Voir les logs
kubectl logs -n gauzian -l app=backend
kubectl logs -n gauzian -l app=front

# Accéder à l'application
kubectl get service caddy -n gauzian
```

## Accès local (Minikube)

Si vous utilisez Minikube :

```bash
# Exposer le service Caddy
minikube service caddy -n gauzian

# Ou créer un tunnel
minikube tunnel
```

## Mise à l'échelle

```bash
# Augmenter le nombre de replicas backend
kubectl scale deployment backend -n gauzian --replicas=3

# Augmenter le nombre de replicas frontend
kubectl scale deployment front -n gauzian --replicas=3
```

## Suppression

```bash
# Supprimer tous les ressources
kubectl delete -k k8s/

# Ou supprimer le namespace (supprime tout)
kubectl delete namespace gauzian
```

## Notes importantes

1. **Stockage persistant** : Les PVC utilisent le StorageClass par défaut de votre cluster. Pour Minikube, c'est `standard`.

2. **LoadBalancer** : Le service Caddy utilise le type `LoadBalancer`. Sur Minikube, utilisez `minikube tunnel` pour y accéder. En production, cela créera un load balancer cloud.

3. **Images** : Les images utilisent `imagePullPolicy: IfNotPresent`. Pour un registry privé, ajoutez un `imagePullSecret`.

4. **Healthchecks** : PostgreSQL et MinIO ont des probes configurées pour vérifier leur santé.

5. **Dépendances** : Kubernetes ne garantit pas l'ordre de démarrage comme Docker Compose. Les applications doivent gérer les reconnexions.
