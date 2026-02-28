#!/usr/bin/env bash
# generate-secrets.sh — Génère des secrets aléatoires, crée et chiffre secrets.yaml
# Structure : data: (valeurs base64) — identique à la prod
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

# --- Génération des valeurs en clair ---
DB_USER_PLAIN="gauzian_user"
DB_NAME_PLAIN="gauzian_db"
DB_PASSWORD_PLAIN="$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"
REDIS_PASSWORD_PLAIN="$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"
MINIO_USER_PLAIN="gauzian-minio"
MINIO_PASSWORD_PLAIN="$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)"
JWT_SECRET_PLAIN="$(openssl rand -base64 64 | tr -d '\n')"
METRICS_SECRET_PLAIN="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
S3_BUCKET_PLAIN="gauzian-bucket"
MINIO_REDIRECT_PLAIN="https://minio.dev.gauzian.pupin.fr"
DATABASE_URL_PLAIN="postgres://${DB_USER_PLAIN}:${DB_PASSWORD_PLAIN}@postgres:5432/${DB_NAME_PLAIN}"
REDIS_URL_PLAIN="redis://:${REDIS_PASSWORD_PLAIN}@redis:6379"

echo "✓ DB_PASSWORD      généré (40 chars)"
echo "✓ REDIS_PASSWORD   généré (40 chars)"
echo "✓ MINIO_PASSWORD   généré (40 chars)"
echo "✓ JWT_SECRET       généré (64 bytes base64)"
echo "✓ METRICS_SECRET   généré (32 chars)"
echo ""

# --- Encodage base64 ---
b64() { printf '%s' "$1" | base64 | tr -d '\n'; }

DB_USER_B64="$(b64 "$DB_USER_PLAIN")"
DB_NAME_B64="$(b64 "$DB_NAME_PLAIN")"
DB_PASSWORD_B64="$(b64 "$DB_PASSWORD_PLAIN")"
DATABASE_URL_B64="$(b64 "$DATABASE_URL_PLAIN")"
REDIS_PASSWORD_B64="$(b64 "$REDIS_PASSWORD_PLAIN")"
REDIS_URL_B64="$(b64 "$REDIS_URL_PLAIN")"
MINIO_USER_B64="$(b64 "$MINIO_USER_PLAIN")"
MINIO_PASSWORD_B64="$(b64 "$MINIO_PASSWORD_PLAIN")"
S3_BUCKET_B64="$(b64 "$S3_BUCKET_PLAIN")"
MINIO_REDIRECT_B64="$(b64 "$MINIO_REDIRECT_PLAIN")"
JWT_SECRET_B64="$(b64 "$JWT_SECRET_PLAIN")"
METRICS_SECRET_B64="$(b64 "$METRICS_SECRET_PLAIN")"
SMTP_PASSWORD_B64="$(b64 "")"

# --- Écriture de secrets.yaml (structure data: base64) ---
cat > "$SECRETS_FILE" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: gauzian-dev-secrets
  namespace: gauzian-dev
type: Opaque
data:
  DB_USER: ${DB_USER_B64}
  DB_NAME: ${DB_NAME_B64}
  DB_PASSWORD: ${DB_PASSWORD_B64}
  DATABASE_URL: ${DATABASE_URL_B64}
  REDIS_PASSWORD: ${REDIS_PASSWORD_B64}
  REDIS_URL: ${REDIS_URL_B64}
  MINIO_ROOT_USER: ${MINIO_USER_B64}
  MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD_B64}
  S3_BUCKET: ${S3_BUCKET_B64}
  MINIO_BROWSER_REDIRECT_URL: ${MINIO_REDIRECT_B64}
  JWT_SECRET: ${JWT_SECRET_B64}
  METRICS_SECRET: ${METRICS_SECRET_B64}
  SMTP_PASSWORD: ${SMTP_PASSWORD_B64}
EOF

echo "✓ secrets.yaml écrit (data: base64)"

# --- Chiffrement SOPS ---
echo "  Chiffrement SOPS..."
sops --encrypt "$SECRETS_FILE" > "$SECRETS_ENC"
echo "✓ secrets.enc.yaml créé"

# --- Suppression du fichier en clair ---
rm "$SECRETS_FILE"
echo "✓ secrets.yaml supprimé"

echo ""
echo "=== Terminé ==="
echo ""
echo "Valeurs générées (à conserver si besoin) :"
echo "  DB_PASSWORD               : ${DB_PASSWORD_PLAIN}"
echo "  REDIS_PASSWORD            : ${REDIS_PASSWORD_PLAIN}"
echo "  MINIO_USER                : ${MINIO_USER_PLAIN}"
echo "  MINIO_PASSWORD            : ${MINIO_PASSWORD_PLAIN}"
echo "  METRICS_SECRET            : ${METRICS_SECRET_PLAIN}"
echo ""
echo "Pour modifier les secrets plus tard :"
echo "  sops k8s/secrets.enc.yaml"
