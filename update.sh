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
# Lancer la base de données d'abord
docker compose -f gauzian_back/docker-compose.dev.yml up -d --build db
# Attendre que la base de données soit "healthy"
echo "⏳ Attente que la base de données soit prête..."
until [ "$(docker inspect -f '{{.State.Health.Status}}' gauzian_dbV2)" == "healthy" ]; do
	sleep 2
	echo "...en attente de la base de données..."
done
echo "✅ Base de données prête !"
# Lancer les autres services
docker compose -f gauzian_back/docker-compose.dev.yml up -d --build redis minio backend front caddy

echo "✅ Mise à jour terminée!"
echo "📊 Logs disponibles avec: docker compose -f gauzian_back/docker-compose.dev.yml logs -f"
