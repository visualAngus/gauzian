#!/bin/bash
set -e

NAMESPACE="gauzian"

echo "🚀 Forçage de la mise à jour des images..."

# 1. On demande à Kubernetes de supprimer les pods actuels
# (Le déploiement va en recréer immédiatement)
kubectl delete pods -n $NAMESPACE -l app=backend
kubectl delete pods -n $NAMESPACE -l app=front

# 2. Si ça ne suffit pas, on force le nettoyage du cache interne de K3s (containerd)
# Cette commande supprime les images non utilisées par des pods actifs
sudo k3s crictl rmi --prune

# recharger toute la conf yaml
kubectl apply -f ./k8s/backend-deployment.yaml -n $NAMESPACE
kubectl apply -f ./k8s/front-deployment.yaml -n $NAMESPACE

echo "⏳ Attente du redémarrage avec les nouvelles images..."
kubectl rollout status deployment/backend -n $NAMESPACE
kubectl rollout status deployment/front -n $NAMESPACE

echo "✅ Terminé !"