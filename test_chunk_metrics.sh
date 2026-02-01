#!/bin/bash

# Script de test pour générer des métriques chunk_upload_duration_seconds

set -e

echo "🧪 Test des métriques d'upload de chunks"
echo "========================================"

# Configuration
API_URL="https://gauzian.pupin.fr/api"
EMAIL="${TEST_EMAIL:-votre@email.com}"
PASSWORD="${TEST_PASSWORD:-votrepassword}"

# 1. Login
echo "1️⃣  Connexion..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

# Extraire le token (adapter selon votre réponse JSON)
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ Échec de connexion. Réponse:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Connecté avec succès"

# 2. Initialiser un fichier de test
echo "2️⃣  Initialisation d'un fichier de test..."
INIT_RESPONSE=$(curl -s -X POST "$API_URL/drive/initialize_file" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "encrypted_metadata": "dGVzdF9tZXRyaWNz",
    "encrypted_file_key": "dGVzdF9rZXk=",
    "parent_folder_id": "null",
    "size": 3145728,
    "mime_type": "application/octet-stream",
    "total_chunks": 3
  }')

FILE_ID=$(echo "$INIT_RESPONSE" | jq -r '.file_id // empty')

if [ -z "$FILE_ID" ]; then
  echo "❌ Échec initialisation. Réponse:"
  echo "$INIT_RESPONSE"
  exit 1
fi

echo "✅ Fichier initialisé : $FILE_ID"

# 3. Uploader plusieurs chunks pour générer des métriques
echo "3️⃣  Upload de 3 chunks (va générer les métriques)..."

for i in 0 1 2; do
  echo "   📦 Chunk $i..."

  # Générer 1MB de données aléatoires
  CHUNK_DATA=$(head -c 1048576 /dev/urandom | base64 -w 0)

  UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/drive/upload_chunk" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"file_id\": \"$FILE_ID\",
      \"index\": $i,
      \"chunk_data\": \"$CHUNK_DATA\",
      \"iv\": \"aXZfdGVzdA==\"
    }")

  if echo "$UPLOAD_RESPONSE" | jq -e '.s3_id' > /dev/null 2>&1; then
    echo "   ✅ Chunk $i uploadé"
  else
    echo "   ⚠️  Chunk $i : $UPLOAD_RESPONSE"
  fi

  sleep 0.5  # Petite pause entre les chunks
done

echo ""
echo "4️⃣  Vérification des métriques..."
sleep 2  # Laisser le temps à Prometheus de scraper

METRICS=$(curl -s https://gauzian.pupin.fr/api/metrics | grep "chunk_upload_duration_seconds")

echo "📊 Métriques générées :"
echo "$METRICS" | grep -E "(count|sum)"

echo ""
echo "✅ Test terminé ! Vérifiez Grafana pour voir les nouvelles valeurs."
echo "   URL: https://grafana.gauzian.pupin.fr"
