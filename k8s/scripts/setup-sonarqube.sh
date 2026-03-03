#!/bin/bash
# ============================================================
# setup-sonarqube.sh — Setup initial SonarQube (DB + secret K8s)
# À lancer UNE SEULE FOIS avant le premier déploiement
# ============================================================
#
# Ce script :
#   1. Vérifie/crée l'utilisateur PostgreSQL sonarqube
#   2. Vérifie/crée la base de données sonarqube
#   3. Crée le secret K8s sonarqube-secrets dans monitoring
#
# Usage :
#   ./k8s/scripts/setup-sonarqube.sh
#   SONAR_DB_PASSWORD=monpass ./k8s/scripts/setup-sonarqube.sh
#
# ============================================================

set -euo pipefail

# ── Couleurs ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ── Vérifications préalables ────────────────────────────────
log "Vérification des prérequis..."
command -v kubectl &>/dev/null || err "kubectl non trouvé"
kubectl cluster-info &>/dev/null || err "Impossible de contacter le cluster K8s"
ok "Prérequis OK"

# ── Mot de passe ────────────────────────────────────────────
if [[ -n "${SONAR_DB_PASSWORD:-}" ]]; then
  SONAR_PASSWORD="$SONAR_DB_PASSWORD"
else
  echo ""
  read -r -s -p "Mot de passe pour l'utilisateur PostgreSQL 'sonarqube' : " SONAR_PASSWORD
  echo ""
  read -r -s -p "Confirme le mot de passe : " SONAR_PASSWORD_CONFIRM
  echo ""
  [[ "$SONAR_PASSWORD" == "$SONAR_PASSWORD_CONFIRM" ]] || err "Les mots de passe ne correspondent pas"
fi

[[ -z "$SONAR_PASSWORD" ]] && err "Le mot de passe ne peut pas être vide"

# ── Trouver le pod PostgreSQL ────────────────────────────────
log "Recherche du pod PostgreSQL dans gauzian-v2..."

POSTGRES_POD=$(kubectl get pods -n gauzian-v2 \
  --selector=app=postgres \
  --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [[ -z "$POSTGRES_POD" ]]; then
  # Fallback : chercher par nom
  POSTGRES_POD=$(kubectl get pods -n gauzian-v2 \
    -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' \
    | tr ' ' '\n' | grep -i postgres | head -1 || true)
fi

[[ -z "$POSTGRES_POD" ]] && err "Aucun pod PostgreSQL Running trouvé dans gauzian-v2"
ok "Pod PostgreSQL trouvé : $POSTGRES_POD"

# ── Helper : exécuter du SQL ─────────────────────────────────
run_sql() {
  kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
    psql -U "$POSTGRES_USER_ENV" -d postgres -tAc "$1" 2>/dev/null
}

# Récupérer le nom d'utilisateur postgres depuis l'env du pod
POSTGRES_USER_ENV=$(kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
  printenv POSTGRES_USER 2>/dev/null || echo "postgres")

log "Utilisateur PostgreSQL admin : $POSTGRES_USER_ENV"

# ── Étape 1 : Utilisateur sonarqube ─────────────────────────
log "Vérification de l'utilisateur 'sonarqube' dans PostgreSQL..."

USER_EXISTS=$(run_sql "SELECT 1 FROM pg_roles WHERE rolname='sonarqube';" || true)

if [[ "$USER_EXISTS" == "1" ]]; then
  ok "Utilisateur 'sonarqube' existe déjà"
  warn "Mise à jour du mot de passe..."
  kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
    psql -U "$POSTGRES_USER_ENV" -d postgres -c \
    "ALTER USER sonarqube WITH PASSWORD '$SONAR_PASSWORD';"
else
  log "Création de l'utilisateur 'sonarqube'..."
  kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
    psql -U "$POSTGRES_USER_ENV" -d postgres -c \
    "CREATE USER sonarqube WITH PASSWORD '$SONAR_PASSWORD';"
  ok "Utilisateur 'sonarqube' créé"
fi

# ── Étape 2 : Base de données sonarqube ─────────────────────
log "Vérification de la base de données 'sonarqube'..."

DB_EXISTS=$(run_sql "SELECT 1 FROM pg_database WHERE datname='sonarqube';" || true)

if [[ "$DB_EXISTS" == "1" ]]; then
  warn "Base de données 'sonarqube' existe déjà — reset en cours..."
  log "Révocation des connexions actives..."
  kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
    psql -U "$POSTGRES_USER_ENV" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='sonarqube' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true
  log "Suppression de la base de données 'sonarqube'..."
  kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
    psql -U "$POSTGRES_USER_ENV" -d postgres -c \
    "DROP DATABASE sonarqube;"
  ok "Ancienne base supprimée"
fi

log "Création de la base de données 'sonarqube'..."
kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
  psql -U "$POSTGRES_USER_ENV" -d postgres -c \
  "CREATE DATABASE sonarqube OWNER sonarqube;"
ok "Base de données 'sonarqube' créée"

# ── Étape 3 : Vérification des droits ───────────────────────
log "Vérification des droits sur la base..."
kubectl exec -n gauzian-v2 "$POSTGRES_POD" -- \
  psql -U "$POSTGRES_USER_ENV" -d postgres -c \
  "GRANT ALL PRIVILEGES ON DATABASE sonarqube TO sonarqube;"
ok "Droits OK"

# ── Étape 4 : Secret K8s ────────────────────────────────────
log "Création/mise à jour du secret K8s 'sonarqube-secrets' dans monitoring..."

kubectl create secret generic sonarqube-secrets \
  --namespace monitoring \
  --from-literal=SONAR_JDBC_PASSWORD="$SONAR_PASSWORD" \
  --dry-run=client -o yaml \
  | kubectl apply -f -

ok "Secret K8s 'sonarqube-secrets' appliqué"

# ── Résumé ───────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
ok "Setup SonarQube terminé !"
echo ""
echo "  PostgreSQL user  : sonarqube"
echo "  PostgreSQL db    : sonarqube"
echo "  K8s secret       : sonarqube-secrets (namespace: monitoring)"
echo ""
echo "  Si SonarQube est déjà déployé, redémarre-le :"
echo "  kubectl rollout restart deployment/sonarqube -n monitoring"
echo "════════════════════════════════════════"
