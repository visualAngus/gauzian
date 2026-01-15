#!/bin/bash
set -e

NAMESPACE="gauzian"
REGISTRY="angusvisual"
TAG="dev"

echo "🔄 Mise à jour des images de développement..."

# Pull les dernières images
echo "📥 Téléchargement des images Docker Hub..."
docker pull "$REGISTRY/gauzian-backend:$TAG"
docker pull "$REGISTRY/gauzian-front:$TAG"

# Redémarre les déploiements pour charger les nouvelles images
echo "🚀 Redémarrage des déploiements K8s..."
sudo kubectl rollout restart deployment/backend -n "$NAMESPACE"
sudo kubectl rollout restart deployment/front -n "$NAMESPACE"

# Attendre le déploiement
echo "⏳ Attente du déploiement..."
sudo kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=5m
sudo kubectl rollout status deployment/front -n "$NAMESPACE" --timeout=5m

echo "✅ Mise à jour terminée !"
echo ""
echo "📊 Statut des pods :"
sudo kubectl get pods -n "$NAMESPACE" -l app=backend,app=front
