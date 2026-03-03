#!/bin/bash
# ============================================================
# deploy.sh — Déploiement complet de la stack Gauzian sur K8s
# ============================================================
#
# Usage :
#   ./k8s/scripts/deploy.sh               # déploiement complet
#   ./k8s/scripts/deploy.sh --no-secrets  # sans ré-appliquer les secrets
#
# ============================================================

set -euo pipefail

# ── Couleurs ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Chemins ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/.."
ENC_FILE="$K8S_DIR/secrets.enc.yaml"
SECRETS_FILE="$K8S_DIR/secrets.yaml"

# ── Options ─────────────────────────────────────────────────
SKIP_SECRETS=false
for arg in "$@"; do
  [[ "$arg" == "--no-secrets" ]] && SKIP_SECRETS=true
done

# ── Fonctions ───────────────────────────────────────────────
log()  { echo -e "${BLUE}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

cleanup() {
  if [[ -f "$SECRETS_FILE" ]]; then
    rm -f "$SECRETS_FILE"
    log "Fichier secrets.yaml temporaire supprimé"
  fi
}
trap cleanup EXIT

# ── Vérifications préalables ────────────────────────────────
log "Vérification des prérequis..."

command -v kubectl &>/dev/null || err "kubectl non trouvé"
command -v sops    &>/dev/null || err "sops non trouvé (apt install sops)"

kubectl cluster-info &>/dev/null || err "Impossible de contacter le cluster K8s"

ok "Prérequis OK"

# ── Étape 1 : Secrets ───────────────────────────────────────
if [[ "$SKIP_SECRETS" == false ]]; then
  log "Déchiffrement et application des secrets (SOPS)..."

  [[ ! -f "$ENC_FILE" ]] && err "$ENC_FILE introuvable"

  sops --decrypt "$ENC_FILE" > "$SECRETS_FILE"
  kubectl apply -f "$SECRETS_FILE" -n gauzian-v2

  ok "Secrets appliqués"
else
  warn "Secrets ignorés (--no-secrets)"
  # Créer un secrets.yaml vide pour que kustomize ne bloque pas
  # (les secrets existent déjà dans le cluster)
  kubectl get secret gauzian-secrets -n gauzian-v2 -o yaml > "$SECRETS_FILE" 2>/dev/null \
    || err "Secret gauzian-secrets introuvable dans le cluster. Relance sans --no-secrets."
fi

# ── Étape 2 : Namespace monitoring ──────────────────────────
log "Application du namespace monitoring..."
kubectl apply -f "$K8S_DIR/monitoring-namespace.yaml"
ok "Namespace monitoring OK"

# ── Étape 3 : kubectl apply -k ──────────────────────────────
log "Application de la stack complète (kustomize)..."
kubectl apply -k "$K8S_DIR"
ok "Manifests appliqués"

# ── Étape 4 : Rollout des déploiements applicatifs ──────────
log "Attente du rollout des déploiements..."

deployments=(
  "gauzian-v2/backend"
  "gauzian-v2/front"
)

for dep in "${deployments[@]}"; do
  namespace="${dep%%/*}"
  name="${dep##*/}"
  echo -n "  → $name ($namespace)... "
  if kubectl rollout status deployment/"$name" -n "$namespace" --timeout=120s &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}timeout (vérifier manuellement)${NC}"
  fi
done

# ── Étape 5 : Résumé ────────────────────────────────────────
echo ""
log "État des pods :"
kubectl get pods -n gauzian-v2
echo ""
kubectl get pods -n monitoring
echo ""
log "État des PVCs :"
kubectl get pvc -n gauzian-v2
kubectl get pvc -n monitoring
echo ""
ok "Déploiement terminé !"
echo ""
echo "  🌐 App      : https://gauzian.pupin.fr"
echo "  📊 Grafana  : https://grafana.gauzian.pupin.fr"
echo "  🔍 Sonar    : https://sonar.gauzian.pupin.fr"
