#!/bin/bash
# ============================================================
# deploy.sh — Déploiement complet de la stack Gauzian sur K8s
# ============================================================
#
# Usage :
#   ./k8s/scripts/deploy.sh               # déploiement complet (nécessite SOPS)
#   ./k8s/scripts/deploy.sh --no-secrets  # sans secrets (secrets déjà dans le cluster)
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
TEMP_KUSTOMIZATION="$K8S_DIR/kustomization.tmp.yaml"

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
  [[ -f "$SECRETS_FILE" ]]        && rm -f "$SECRETS_FILE"
  [[ -f "$TEMP_KUSTOMIZATION" ]] && rm -f "$TEMP_KUSTOMIZATION"
}
trap cleanup EXIT

# ── Vérifications préalables ────────────────────────────────
log "Vérification des prérequis..."
command -v kubectl &>/dev/null || err "kubectl non trouvé"
kubectl cluster-info &>/dev/null || err "Impossible de contacter le cluster K8s"

if [[ "$SKIP_SECRETS" == false ]]; then
  command -v sops &>/dev/null || err "sops non trouvé. Utilise --no-secrets si les secrets sont déjà dans le cluster."
fi
ok "Prérequis OK"

# ── Étape 1 : Secrets ───────────────────────────────────────
if [[ "$SKIP_SECRETS" == false ]]; then
  log "Déchiffrement et application des secrets (SOPS)..."
  [[ ! -f "$ENC_FILE" ]] && err "$ENC_FILE introuvable"
  sops --decrypt "$ENC_FILE" > "$SECRETS_FILE"
  kubectl apply -f "$SECRETS_FILE"
  ok "Secrets appliqués"
else
  warn "Mode --no-secrets : les secrets existants dans le cluster seront utilisés"

  # Vérifier que les secrets existent bien dans le cluster
  kubectl get secret gauzian-secrets -n gauzian-v2 &>/dev/null \
    || err "Secret 'gauzian-secrets' introuvable dans gauzian-v2. Relance sans --no-secrets."

  # Générer un secrets.yaml minimal pour que kustomize puisse valider
  # (apply -f va juste mettre à jour ce qui existe déjà — no-op si identique)
  kubectl get secret gauzian-secrets -n gauzian-v2 -o yaml \
    | grep -v 'resourceVersion\|uid\|creationTimestamp\|generation\|managedFields' \
    > "$SECRETS_FILE"
  ok "Secrets existants vérifiés dans le cluster"
fi

# ── Étape 2 : Namespaces ─────────────────────────────────────
log "Application des namespaces..."
kubectl apply -f "$K8S_DIR/namespace.yaml"
kubectl apply -f "$K8S_DIR/monitoring-namespace.yaml"
ok "Namespaces OK"

# ── Étape 3 : kubectl apply -k ───────────────────────────────
log "Application de la stack gauzian-v2 (kustomize)..."
kubectl apply -k "$K8S_DIR"
ok "Stack gauzian-v2 appliquée"

log "Application de la stack monitoring (kustomize)..."
kubectl apply -k "$K8S_DIR/monitoring"
ok "Stack monitoring appliquée"

# ── Étape 4 : Rollout des déploiements ───────────────────────
log "Attente du rollout des déploiements..."

deployments=(
  "gauzian-v2/backend"
  "gauzian-v2/front"
  "monitoring/sonarqube"
)

for dep in "${deployments[@]}"; do
  namespace="${dep%%/*}"
  name="${dep##*/}"
  echo -n "  → $name ($namespace)... "
  if kubectl rollout status deployment/"$name" -n "$namespace" --timeout=180s &>/dev/null; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}timeout — vérifier : kubectl logs -n $namespace deploy/$name${NC}"
  fi
done

# ── Étape 5 : Résumé ─────────────────────────────────────────
echo ""
log "État des pods :"
echo "  gauzian-v2 :"
kubectl get pods -n gauzian-v2 | sed 's/^/    /'
echo "  monitoring :"
kubectl get pods -n monitoring | sed 's/^/    /'
echo ""
log "État des PVCs :"
kubectl get pvc -n gauzian-v2 | sed 's/^/    /'
kubectl get pvc -n monitoring | sed 's/^/    /'
echo ""
ok "Déploiement terminé !"
echo ""
echo "  🌐 App      : https://gauzian.pupin.fr"
echo "  📊 Grafana  : https://grafana.gauzian.pupin.fr"
echo "  🔍 SonarQube: https://sonar.gauzian.pupin.fr"
