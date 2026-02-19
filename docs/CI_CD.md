# CI/CD Pipeline - GAUZIAN

Automatisation du build, push et déploiement via GitHub Actions.

---

## Workflow : `build-and-push.yml`

**Déclenchement** : push sur `main` ou manuellement (`workflow_dispatch`)

```
push main
  ├── build-backend  → Docker Hub (angusvisual/gauzian-backend:latest)
  ├── build-frontend → Docker Hub (angusvisual/gauzian-front:latest)
  └── deploy (attend les 2 builds)
        └── SSH → VPS → ci-deploy.sh → kubectl rollout restart
```

---

## Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Username Docker Hub (`angusvisual`) |
| `DOCKERHUB_TOKEN` | Token d'accès Docker Hub (Settings → Security) |
| `VPS_HOST` | IP ou hostname du VPS |
| `VPS_USER` | User SSH de déploiement (`deploy`) |
| `VPS_SSH_KEY` | Clé privée SSH du user `deploy` |

---

## Script de déploiement VPS

**Fichier** : `gauzian_back/k8s/scripts/ci-deploy.sh`

Lance un `rollout restart` sur les deployments `backend` et `front` dans le namespace `gauzian-v2`, puis attend la fin du déploiement.

---

## Setup VPS (une seule fois)

```bash
# Créer user deploy dédié
sudo useradd -m -s /bin/bash deploy

# Configurer kubectl
sudo mkdir -p /home/deploy/.kube
sudo cp ~/.kube/config /home/deploy/.kube/config
sudo chown -R deploy:deploy /home/deploy/.kube

# Accès kubeconfig k3s
sudo chmod o+r /etc/rancher/k3s/k3s.yaml

# Accès au repo
sudo chmod o+rx /home/debian
sudo chmod -R o+rx /home/debian/gauzian

# Clé SSH - générer sur le VPS
sudo -u deploy ssh-keygen -t ed25519 -C "github-actions-deploy" -f /home/deploy/.ssh/id_ed25519 -N ""
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo -u deploy cat /home/deploy/.ssh/id_ed25519.pub | sudo tee /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys

# Récupérer la clé privée → coller dans GitHub Secret VPS_SSH_KEY
sudo cat /home/deploy/.ssh/id_ed25519
```

---

## Déploiement manuel (fallback)

```bash
# Depuis la machine locale
./push_docker_hub.sh
ssh vps 'bash /home/debian/gauzian/gauzian_back/k8s/scripts/ci-deploy.sh'
```

---

**Dernière mise à jour** : 2026-02-19
