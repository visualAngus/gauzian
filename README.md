# gauzianDev

Environnement de développement Kubernetes pour Gauzian.

Le code source est monté directement depuis le VM Proxmox via `hostPath` — pas de build Docker.
Le backend tourne avec `cargo run`, le frontend avec `npm run dev`.

## Prérequis

- Cluster K8s accessible (kubectl configuré)
- SOPS configuré pour déchiffrer les secrets
- Chemins des repos `gauzianBack` et `gauzianFront` sur le VM

## Démarrage rapide

```bash
# 1. Cloner ce repo sur le VM Proxmox
git clone <repo-gauzianDev>
cd gauzianDev

# 2. Adapter les chemins hostPath dans les deployments
#    Remplacer REPLACE_WITH_GAUZIANBACK_PATH et REPLACE_WITH_GAUZIANFRONT_PATH
vim k8s/backend-deployment.yaml
vim k8s/front-deployment.yaml

# 3. Créer et remplir les secrets
cp k8s/secrets.yaml.example k8s/secrets.yaml
vim k8s/secrets.yaml
# Chiffrer avec SOPS :
sops --encrypt k8s/secrets.yaml > k8s/secrets.enc.yaml
rm k8s/secrets.yaml

# 4. Lancer le setup
./k8s/scripts/setup.sh
```

## URLs

| Service | URL |
|---------|-----|
| Frontend | https://dev.gauzian.pupin.fr |
| API | https://dev.gauzian.pupin.fr/api |
| MinIO Console | https://minio.dev.gauzian.pupin.fr |

## Structure

```
k8s/
├── namespace.yaml
├── kustomization.yaml
├── configmap.yaml               # Variables publiques (non-secrètes)
├── secrets.yaml.example         # Template — copier et remplir
├── backend-deployment.yaml      # rust:latest + hostPath + cargo run
├── backend-service.yaml
├── front-deployment.yaml        # node:20-alpine + hostPath + npm run dev
├── front-service.yaml
├── postgres-deployment.yaml
├── postgres-service.yaml
├── postgres-pvc.yaml
├── redis-deployment.yaml
├── redis-service.yaml
├── redis-pvc.yaml
├── minio-deployment.yaml
├── minio-service.yaml
├── minio-pvc.yaml
├── ingressroute.yaml            # dev.gauzian.pupin.fr + TLS
├── middleware.yaml
└── scripts/
    ├── setup.sh
    └── apply-secrets.sh
```

## Volumes hostPath créés automatiquement

```
/opt/gauzian-dev/
├── cargo-cache/         # Cache dépendances Rust (CARGO_HOME)
├── backend-target/      # Artifacts compilés Rust (recompilation incrémentale)
└── front-node_modules/  # node_modules du frontend
```

## Notes

- Premier démarrage du backend : ~5-15 min (téléchargement + compilation complète)
- Redémarrages suivants : ~30-60s (compilation incrémentale depuis le cache)
- HMR frontend : automatique via Nuxt dev server
