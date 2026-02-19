#!/bin/bash
set -e

echo "🔌 Vérification de la connexion au VPS..."

# Vérifier si le tunnel SSH existe déjà
if ! pgrep -f "ssh.*vps.*5432:localhost:5432" > /dev/null; then
    echo "📡 Création du tunnel SSH vers le VPS..."
    ssh -f -N -L 5432:localhost:5432 vps
    sleep 2
fi

echo "✅ Tunnel actif"
echo "🔧 Exécution de cargo sqlx prepare..."

# Charger le .env et exécuter sqlx prepare
export $(cat .env | xargs)
cargo sqlx prepare

echo "✅ Done!"
