#!/bin/bash
# ============================================================
# apply-secrets.sh — Déchiffre secrets.enc.yaml et applique sur K8s
# ============================================================
#
# Prérequis :
#   - sops installé (apt install sops)
#   - age installé (apt install age)
#   - Clé privée age disponible dans ~/.config/sops/age/keys.txt
#     OU variable d'env SOPS_AGE_KEY définie (CI/CD)
#
# Usage :
#   ./k8s/scripts/apply-secrets.sh
#   SOPS_AGE_KEY="AGE-SECRET-KEY-..." ./k8s/scripts/apply-secrets.sh
#
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/.."
ENC_FILE="$K8S_DIR/secrets.enc.yaml"
TMP_FILE="$(mktemp /tmp/gauzian-secrets-XXXXXX.yaml)"

# Nettoyage automatique du fichier temporaire à la sortie
trap 'rm -f "$TMP_FILE"' EXIT

# Vérifications
if [[ ! -f "$ENC_FILE" ]]; then
  echo "❌ Erreur : $ENC_FILE introuvable."
  echo "   → Chiffrer d'abord : sops --encrypt k8s/secrets.yaml > k8s/secrets.enc.yaml"
  exit 1
fi

if ! command -v sops &> /dev/null; then
  echo "❌ Erreur : sops n'est pas installé."
  echo "   → apt install sops  ou  https://github.com/getsops/sops/releases"
  exit 1
fi

echo "🔓 Déchiffrement de secrets.enc.yaml..."
sops --decrypt "$ENC_FILE" > "$TMP_FILE"

echo "🚀 Application des secrets sur le cluster K8s..."
kubectl apply -f "$TMP_FILE"

echo "✅ Secrets appliqués avec succès !"
echo "   (Le fichier déchiffré temporaire a été supprimé automatiquement)"
