#!/bin/bash
set -e

NAMESPACE="gauzian-v2"
REGISTRY="angusvisual"
TAG="latest"

echo "📥 Téléchargement des nouvelles images Docker Hub..."
docker pull "$REGISTRY/gauzian-backend:$TAG"
docker pull "$REGISTRY/gauzian-frontend:$TAG"

echo "🚀 Déploiement CI/CD - Redémarrage des pods..."

kubectl rollout restart deployment/backend -n "$NAMESPACE"
kubectl rollout restart deployment/front -n "$NAMESPACE"

echo "⏳ Attente du déploiement..."
kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=120s
kubectl rollout status deployment/front -n "$NAMESPACE" --timeout=120s

echo "✅ Déploiement terminé !"
kubectl get pods -n "$NAMESPACE"
