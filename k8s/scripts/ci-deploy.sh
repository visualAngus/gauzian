#!/bin/bash
set -e

NAMESPACE="gauzian-v2"
REGISTRY="angusvisual"
TAG="dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENC_FILE="$SCRIPT_DIR/../secrets.enc.yaml"

echo "📥 Téléchargement des nouvelles images Docker Hub... V2"
docker pull "$REGISTRY/gauzian-backend:$TAG"
docker pull "$REGISTRY/gauzian-frontend:$TAG"

# Déchiffrement et application des secrets si secrets.enc.yaml existe
if [ -f "$ENC_FILE" ]; then
  echo "🔓 Application des secrets chiffrés..."
  "$SCRIPT_DIR/apply-secrets.sh"
fi

echo "🚀 Déploiement CI/CD - Redémarrage des pods..."

kubectl rollout restart deployment/backend -n "$NAMESPACE"
kubectl rollout restart deployment/front -n "$NAMESPACE"

echo "⏳ Attente du déploiement..."
kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=120s
kubectl rollout status deployment/front -n "$NAMESPACE" --timeout=120s

echo "✅ Déploiement terminé !"
kubectl get pods -n "$NAMESPACE"
