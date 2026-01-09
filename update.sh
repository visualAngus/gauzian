#!/bin/bash

# Script de mise à jour automatique après git pull
# Usage: ./update.sh

echo "🔄 Mise à jour de Gauzian..."

# Aller dans le bon répertoire
cd "$(dirname "$0")"

echo "📥 Git pull..."
git pull

echo "🐳 Reconstruction et redémarrage des conteneurs..."
docker compose -f gauzian_back/docker-compose.dev.yml down
docker compose -f gauzian_back/docker-compose.dev.yml up -d --build

echo "✅ Mise à jour terminée!"
echo "📊 Logs disponibles avec: docker compose -f gauzian_back/docker-compose.dev.yml logs -f"
