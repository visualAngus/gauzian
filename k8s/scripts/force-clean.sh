#!/bin/bash
# Script pour forcer la suppression complète du namespace gauzian
# Usage: sudo bash ./force-clean.sh

set +e  # Continue même en cas d'erreur

NAMESPACE="gauzian-v2"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       NETTOYAGE FORCÉ DU NAMESPACE KUBERNETES                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Namespace : $NAMESPACE"
echo ""

# =====================================================================
# ÉTAPE 1 : VÉRIFIER SI LE NAMESPACE EXISTE
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 ÉTAPE 1 : Vérification du namespace"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if ! kubectl get namespace $NAMESPACE &>/dev/null; then
    echo "✅ Le namespace '$NAMESPACE' n'existe pas (déjà supprimé)"
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║              ✅ NETTOYAGE DÉJÀ EFFECTUÉ ! ✅                  ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    exit 0
fi

echo "📊 État actuel du namespace :"
kubectl get namespace $NAMESPACE
echo ""

# Vérifier si le namespace est en Terminating
NS_STATUS=$(kubectl get namespace $NAMESPACE -o jsonpath='{.status.phase}')
echo "📌 Statut : $NS_STATUS"
echo ""

# =====================================================================
# ÉTAPE 2 : SUPPRIMER TOUTES LES RESSOURCES
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗑️  ÉTAPE 2 : Suppression forcée de toutes les ressources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🔄 Suppression des deployments..."
kubectl delete deployments --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des services..."
kubectl delete services --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des pods..."
kubectl delete pods --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des statefulsets..."
kubectl delete statefulsets --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des daemonsets..."
kubectl delete daemonsets --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des replicasets..."
kubectl delete replicasets --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des PVC (Persistent Volume Claims)..."
kubectl delete pvc --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des secrets..."
kubectl delete secrets --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des configmaps..."
kubectl delete configmaps --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des ingress/ingressroutes..."
kubectl delete ingress,ingressroute --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo "🔄 Suppression des serviceaccounts..."
kubectl delete serviceaccounts --all -n $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo ""
echo "✅ Toutes les ressources supprimées"
echo ""

# =====================================================================
# ÉTAPE 3 : SUPPRIMER LES FINALIZERS DU NAMESPACE
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔓 ÉTAPE 3 : Suppression des finalizers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "🔓 Vérification des finalizers..."
FINALIZERS=$(kubectl get namespace $NAMESPACE -o jsonpath='{.spec.finalizers}')
echo "   Finalizers actuels : $FINALIZERS"
echo ""

if [ "$FINALIZERS" != "[]" ] && [ -n "$FINALIZERS" ]; then
    echo "🔧 Suppression des finalizers via patch..."

    if kubectl patch namespace $NAMESPACE -p '{"spec":{"finalizers":[]}}' --type=merge; then
        echo "✅ Finalizers supprimés avec succès"
    else
        echo "⚠️  Patch échoué, tentative via API raw..."

        # Tentative via API raw
        kubectl get namespace $NAMESPACE -o json | \
          sed 's/"finalizers": \[[^]]*\]/"finalizers": []/' | \
          kubectl replace --raw /api/v1/namespaces/$NAMESPACE/finalize -f - &>/dev/null || true

        echo "✅ Finalizers supprimés via API raw"
    fi
else
    echo "ℹ️  Aucun finalizer à supprimer"
fi

echo ""

# =====================================================================
# ÉTAPE 4 : SUPPRESSION FORCÉE DU NAMESPACE
# =====================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💥 ÉTAPE 4 : Suppression forcée du namespace"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "💥 Suppression du namespace avec --force..."
kubectl delete namespace $NAMESPACE --force --grace-period=0 &>/dev/null || true

echo ""
echo "⏳ Attente de la suppression complète (max 60 secondes)..."

# Attendre que le namespace soit supprimé (max 60 secondes)
WAIT_COUNT=0
while kubectl get namespace $NAMESPACE &>/dev/null; do
    if [ $WAIT_COUNT -ge 20 ]; then
        echo ""
        echo "⚠️  Le namespace met trop de temps à se supprimer"
        echo "   Tentative de suppression via API directe..."

        # Dernière tentative : suppression via API avec proxy
        kubectl proxy --port=8888 &
        PROXY_PID=$!
        sleep 2

        curl -X PUT http://localhost:8888/api/v1/namespaces/$NAMESPACE/finalize \
          -H "Content-Type: application/json" \
          --data '{"apiVersion":"v1","kind":"Namespace","metadata":{"name":"'$NAMESPACE'"},"spec":{"finalizers":[]}}' \
          &>/dev/null || true

        kill $PROXY_PID &>/dev/null || true

        sleep 3
        break
    fi

    echo -n "."
    sleep 3
    ((WAIT_COUNT++))
done

echo ""

# =====================================================================
# ÉTAPE 5 : VÉRIFICATION FINALE
# =====================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ÉTAPE 5 : Vérification finale"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if kubectl get namespace $NAMESPACE &>/dev/null; then
    echo "❌ Le namespace '$NAMESPACE' existe toujours !"
    echo ""
    echo "📊 État actuel :"
    kubectl get namespace $NAMESPACE -o yaml
    echo ""
    echo "⚠️  SOLUTION MANUELLE REQUISE :"
    echo "   1. Vérifier les ressources bloquées :"
    echo "      kubectl api-resources --verbs=list --namespaced -o name | xargs -n 1 kubectl get --show-kind --ignore-not-found -n $NAMESPACE"
    echo ""
    echo "   2. Contacter le support K8s/K3s si le problème persiste"
    exit 1
else
    echo "✅ Le namespace '$NAMESPACE' a été complètement supprimé !"
    echo ""
    echo "🧹 Nettoyage du cache containerd..."
    if sudo k3s crictl rmi --prune 2>/dev/null; then
        echo "✅ Cache nettoyé"
    else
        echo "⚠️  Nettoyage cache échoué (non-critique)"
    fi
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         ✅ NETTOYAGE FORCÉ TERMINÉ AVEC SUCCÈS ! ✅          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🎯 Prochaine étape :"
    echo "   sudo bash ./update-max.sh"
    echo ""
fi