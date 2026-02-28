#!/usr/bin/env bash
# apply-secrets.sh — Déchiffre secrets.enc.yaml et l'applique dans K8s
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
SECRETS_ENC="$K8S_DIR/secrets.enc.yaml"

command -v sops >/dev/null 2>&1 || { echo "ERREUR: sops n'est pas installé."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "ERREUR: kubectl n'est pas installé."; exit 1; }

if [ ! -f "$SECRETS_ENC" ]; then
  echo "ERREUR: $SECRETS_ENC absent."
  exit 1
fi

echo "Déchiffrement et application des secrets..."
sops --decrypt "$SECRETS_ENC" | kubectl apply -f -
echo "Secrets appliqués dans le namespace gauzian-dev."
