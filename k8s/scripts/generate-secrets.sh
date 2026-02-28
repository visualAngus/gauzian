#!/usr/bin/env bash
# generate-secrets.sh — Génère des secrets aléatoires, crée et chiffre secrets.yaml
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
SECRETS_FILE="$K8S_DIR/secrets.yaml"
SECRETS_ENC="$K8S_DIR/secrets.enc.yaml"

# --- Vérifications ---
command -v openssl >/dev/null 2>&1 || { echo "ERREUR: openssl n'est pas installé."; exit 1; }
command -v sops    >/dev/null 2>&1 || { echo "ERREUR: sops n'est pas installé."; exit 1; }

if [ -f "$SECRETS_ENC" ]; then
  echo "⚠️  $SECRETS_ENC existe déjà."
  read -r -p "   Écraser ? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Annulé."; exit 0; }
fi

echo "=== Génération des secrets gauzian-dev ==="
echo ""

# --- Génération des mots de passe ---
DB_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"
REDIS_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"
MINIO_USER="gauzian-minio"
MINIO_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"
JWT_SECRET="$(openssl rand -base64 64)"

echo "✓ DB_PASSWORD      généré (40 chars)"
echo "✓ REDIS_PASSWORD   généré (40 chars)"
echo "✓ MINIO_PASSWORD   généré (40 chars)"
echo "✓ JWT_SECRET       généré (64 bytes base64)"
echo ""

# --- Écriture de secrets.yaml ---
cat > "$SECRETS_FILE" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: gauzian-dev-secrets
  namespace: gauzian-dev
type: Opaque
stringData:
  # ===== BASE DE DONNÉES =====
  DB_USER: "gauzian_user"
  DB_PASSWORD: "${DB_PASSWORD}"
  DB_NAME: "gauzian_db"
  DATABASE_URL: "postgres://gauzian_user:${DB_PASSWORD}@postgres:5432/gauzian_db"

  # ===== REDIS =====
  REDIS_PASSWORD: "${REDIS_PASSWORD}"
  REDIS_URL: "redis://:${REDIS_PASSWORD}@redis:6379"

  # ===== MINIO / S3 =====
  MINIO_ROOT_USER: "${MINIO_USER}"
  MINIO_ROOT_PASSWORD: "${MINIO_PASSWORD}"

  # ===== SÉCURITÉ =====
  JWT_SECRET: "${JWT_SECRET}"
EOF

echo "✓ secrets.yaml écrit dans $SECRETS_FILE"

# --- Chiffrement SOPS ---
echo "  Chiffrement SOPS..."
sops --encrypt "$SECRETS_FILE" > "$SECRETS_ENC"
echo "✓ secrets.enc.yaml créé : $SECRETS_ENC"

# --- Suppression du fichier en clair ---
rm "$SECRETS_FILE"
echo "✓ secrets.yaml supprimé (ne reste que le chiffré)"

echo ""
echo "=== Terminé ==="
echo ""
echo "Mots de passe générés (sauvegarde-les si besoin) :"
echo "  DB_PASSWORD    : ${DB_PASSWORD}"
echo "  REDIS_PASSWORD : ${REDIS_PASSWORD}"
echo "  MINIO_USER     : ${MINIO_USER}"
echo "  MINIO_PASSWORD : ${MINIO_PASSWORD}"
echo ""
echo "Pour modifier les secrets plus tard :"
echo "  sops k8s/secrets.enc.yaml"
