#!/bin/bash
# Script de déploiement complet de l'infrastructure GAUZIAN sur Kubernetes
# Usage: sudo bash ./update-max.sh

set -e  # Arrêt immédiat en cas d'erreur

NAMESPACE="gauzian"
K8S_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         DÉPLOIEMENT COMPLET GAUZIAN - KUBERNETES              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📂 Répertoire K8s : $K8S_DIR"
echo "🎯 Namespace      : $NAMESPACE"
echo ""

# =====================================================================
# ÉTAPE 1 : APPLICATION DE TOUS LES MANIFESTS
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 ÉTAPE 1/5 : Application de TOUS les manifests Kubernetes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 Ressources déployées :"
echo "   • Namespace & Secrets"
echo "   • Persistent Volume Claims (PostgreSQL, Redis, MinIO)"
echo "   • Deployments (DB, Cache, Storage, Backend, Frontend)"
echo "   • Services & HPA"
echo "   • Reverse Proxy (IngressRoute, Ingress, Middlewares)"
echo "   • Monitoring (Grafana, Prometheus ServiceMonitor)"
echo ""

cd "$K8S_DIR"

# Vérifier que kustomization.yaml existe
if [ ! -f "kustomization.yaml" ]; then
    echo "❌ ERREUR : kustomization.yaml introuvable dans $K8S_DIR"
    exit 1
fi

# Appliquer via Kustomize (gère automatiquement l'ordre des dépendances)
echo "⚙️  Application via Kustomize..."
if kubectl apply -k . ; then
    echo "✅ Tous les manifests ont été appliqués avec succès"
else
    echo "❌ ERREUR lors de l'application des manifests"
    exit 1
fi

echo ""

# =====================================================================
# ÉTAPE 2 : FORÇAGE DU PULL DES NOUVELLES IMAGES
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 ÉTAPE 2/5 : Forçage du pull des nouvelles images Docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Supprimer les pods pour forcer le pull (le Deployment les recrée immédiatement)
echo "🔄 Suppression des pods backend..."
kubectl delete pods -n $NAMESPACE -l app=backend --ignore-not-found=true

echo "🔄 Suppression des pods frontend..."
kubectl delete pods -n $NAMESPACE -l app=front --ignore-not-found=true

echo "✅ Pods supprimés (recréation automatique en cours...)"
echo ""

# =====================================================================
# ÉTAPE 3 : NETTOYAGE DU CACHE CONTAINERD
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 ÉTAPE 3/5 : Nettoyage du cache d'images containerd (K3s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Nettoyage du cache (non-critique si ça échoue)
if sudo k3s crictl rmi --prune 2>/dev/null; then
    echo "✅ Cache containerd nettoyé"
else
    echo "⚠️  Nettoyage crictl échoué (non-critique, on continue)"
fi

echo ""

# =====================================================================
# ÉTAPE 4 : ATTENTE DU ROLLOUT
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⏳ ÉTAPE 4/5 : Attente du redémarrage avec les nouvelles images"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🔍 Rollout du backend (timeout: 5 minutes)..."
if kubectl rollout status deployment/backend -n $NAMESPACE --timeout=5m; then
    echo "✅ Backend déployé avec succès"
else
    echo "❌ ERREUR : Timeout du rollout backend"
    echo "📊 État actuel des pods backend :"
    kubectl get pods -n $NAMESPACE -l app=backend
    exit 1
fi

echo ""
echo "🔍 Rollout du frontend (timeout: 5 minutes)..."
if kubectl rollout status deployment/front -n $NAMESPACE --timeout=5m; then
    echo "✅ Frontend déployé avec succès"
else
    echo "❌ ERREUR : Timeout du rollout frontend"
    echo "📊 État actuel des pods frontend :"
    kubectl get pods -n $NAMESPACE -l app=front
    exit 1
fi

echo ""

# =====================================================================
# ÉTAPE 5 : VÉRIFICATION FINALE
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ÉTAPE 5/5 : Vérification finale de l'infrastructure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🔍 État des pods :"
kubectl get pods -n $NAMESPACE -o wide

echo ""
echo "🔍 État des services :"
kubectl get svc -n $NAMESPACE

echo ""
echo "🔍 État des ingress :"
kubectl get ingress,ingressroute -n $NAMESPACE 2>/dev/null || echo "   (Aucun ingress configuré)"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            ✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ! ✅            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 L'infrastructure complète GAUZIAN est déployée et opérationnelle"
echo ""
echo "🔗 URLs de vérification :"
echo "   • Frontend  : https://gauzian.pupin.fr"
echo "   • Backend   : https://gauzian.pupin.fr/api/health/ready"
echo "   • MinIO     : https://minio.gauzian.pupin.fr"
echo ""
echo "📝 Logs en temps réel :"
echo "   kubectl logs -n $NAMESPACE -l app=backend --tail=50 -f"
echo "   kubectl logs -n $NAMESPACE -l app=front --tail=50 -f"
echo ""