#!/usr/bin/env bash
# setup.sh — Initialisation de l'environnement gauzianDev
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== gauzianDev Setup ==="
echo ""

# --- Vérifications préliminaires ---
command -v kubectl >/dev/null 2>&1 || { echo "ERREUR: kubectl n'est pas installé."; exit 1; }
command -v sops >/dev/null 2>&1 || { echo "ERREUR: sops n'est pas installé."; exit 1; }

# --- Vérifier que les placeholders ont été remplacés ---
if grep -q "REPLACE_WITH_GAUZIANBACK_PATH" "$K8S_DIR/backend-deployment.yaml"; then
  echo "ERREUR: Remplacer REPLACE_WITH_GAUZIANBACK_PATH dans k8s/backend-deployment.yaml"
  exit 1
fi
if grep -q "REPLACE_WITH_GAUZIANFRONT_PATH" "$K8S_DIR/front-deployment.yaml"; then
  echo "ERREUR: Remplacer REPLACE_WITH_GAUZIANFRONT_PATH dans k8s/front-deployment.yaml"
  exit 1
fi

# --- Vérifier que secrets.enc.yaml existe ---
if [ ! -f "$K8S_DIR/secrets.enc.yaml" ]; then
  echo "ERREUR: k8s/secrets.enc.yaml absent."
  echo "  Créer depuis le template :"
  echo "    cp k8s/secrets.yaml.example k8s/secrets.yaml"
  echo "    vim k8s/secrets.yaml"
  echo "    sops --encrypt k8s/secrets.yaml > k8s/secrets.enc.yaml"
  echo "    rm k8s/secrets.yaml"
  exit 1
fi

# --- Créer les répertoires de cache sur le host ---
echo "[1/3] Création des répertoires de cache..."
mkdir -p /opt/gauzian-dev/cargo-cache
mkdir -p /opt/gauzian-dev/backend-target
mkdir -p /opt/gauzian-dev/front-node_modules
echo "      /opt/gauzian-dev/ OK"

# --- Appliquer les secrets déchiffrés ---
echo "[2/3] Application des secrets (SOPS déchiffrement)..."
"$SCRIPT_DIR/apply-secrets.sh"

# --- Appliquer les manifests ---
echo "[3/3] Application des manifests Kubernetes..."
kubectl apply -f "$K8S_DIR/namespace.yaml"
kubectl apply -f "$K8S_DIR/configmap.yaml"
kubectl apply -f "$K8S_DIR/postgres-pvc.yaml"
kubectl apply -f "$K8S_DIR/postgres-deployment.yaml"
kubectl apply -f "$K8S_DIR/postgres-service.yaml"
kubectl apply -f "$K8S_DIR/redis-pvc.yaml"
kubectl apply -f "$K8S_DIR/redis-deployment.yaml"
kubectl apply -f "$K8S_DIR/redis-service.yaml"
kubectl apply -f "$K8S_DIR/minio-pvc.yaml"
kubectl apply -f "$K8S_DIR/minio-deployment.yaml"
kubectl apply -f "$K8S_DIR/minio-service.yaml"
kubectl apply -f "$K8S_DIR/backend-deployment.yaml"
kubectl apply -f "$K8S_DIR/backend-service.yaml"
kubectl apply -f "$K8S_DIR/front-deployment.yaml"
kubectl apply -f "$K8S_DIR/front-service.yaml"
kubectl apply -f "$K8S_DIR/middleware.yaml"
kubectl apply -f "$K8S_DIR/ingressroute.yaml"

echo ""
echo "=== Setup terminé ==="
echo ""
echo "Vérifier le statut des pods :"
echo "  kubectl get pods -n gauzian-dev"
echo ""
echo "Logs backend (compilation en cours ~5-15 min) :"
echo "  kubectl logs -n gauzian-dev deployment/backend -f"
echo ""
echo "Logs frontend :"
echo "  kubectl logs -n gauzian-dev deployment/front -f"
echo ""
echo "URLs :"
echo "  https://dev.gauzian.pupin.fr"
echo "  https://minio.dev.gauzian.pupin.fr"
