#!/bin/bash
set -e

NAMESPACE="gauzian"
K8S_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📂 Répertoire K8s : $K8S_DIR"
echo ""

echo "🔄 Application de TOUS les manifests Kubernetes..."
echo "   (via Kustomize pour respecter l'ordre des dépendances)"
echo ""

# Appliquer TOUS les manifests via Kustomize
# Kustomize gère l'ordre correct : namespace → secrets → PVC → deployments → services → ingress
cd "$K8S_DIR"
kubectl apply -k .

echo ""
echo "🚀 Forçage de la mise à jour des images (pull fresh)..."
echo ""

# 1. Supprimer les pods pour forcer le pull des nouvelles images
# (Le déploiement va les recréer immédiatement)
kubectl delete pods -n $NAMESPACE -l app=backend --ignore-not-found=true
kubectl delete pods -n $NAMESPACE -l app=front --ignore-not-found=true

# 2. Nettoyage du cache d'images containerd (K3s)
# Supprime les images non utilisées par des pods actifs
echo "🧹 Nettoyage du cache d'images containerd..."
sudo k3s crictl rmi --prune || echo "⚠️  Nettoyage crictl échoué (non-critique)"

echo ""
echo "⏳ Attente du redémarrage avec les nouvelles images..."
echo ""

# Attendre que les deployments soient prêts
kubectl rollout status deployment/backend -n $NAMESPACE --timeout=5m
kubectl rollout status deployment/front -n $NAMESPACE --timeout=5m

echo ""
echo "✅ Mise à jour terminée avec succès !"
echo ""
echo "📊 État des pods :"
kubectl get pods -n $NAMESPACE -o wide