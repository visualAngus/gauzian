#!/bin/bash

# Script de test SQLMap RAPIDE pour Gauzian
# Teste uniquement les endpoints les plus critiques

BASE_URL="https://gauzian.pupin.fr/api"

echo "=========================================="
echo "  SQLMAP QUICK TEST - Endpoints critiques"
echo "=========================================="
echo ""

# Test 1: Login endpoint (le plus critique)
echo "[1/3] Test du endpoint de connexion..."
sqlmap -u "${BASE_URL}/login" \
    --data='{"email":"test@example.com","password":"test"}' \
    --method=POST \
    --header="Content-Type: application/json" \
    --dbms=PostgreSQL \
    --batch --level=2 --risk=1 \
    --force-ssl --ignore-code=401

echo ""
echo "---"
echo ""

# Test 2: Register endpoint
echo "[2/3] Test du endpoint d'inscription..."
sqlmap -u "${BASE_URL}/register" \
    --data='{"username":"test","password":"test","email":"test@example.com","encrypted_private_key":"test","public_key":"test","private_key_salt":"test","iv":"test","encrypted_record_key":"test"}' \
    --method=POST \
    --header="Content-Type: application/json" \
    --dbms=PostgreSQL \
    --batch --level=2 --risk=1 \
    --force-ssl --ignore-code=401

echo ""
echo "=========================================="
echo "  TESTS RAPIDES TERMINÉS"
echo "=========================================="
echo ""
echo "Note: Le endpoint /contacts/get_public_key nécessite une authentification."
echo "Pour tester TOUS les endpoints (y compris authentifiés), utilise:"
echo "  ./sqlmap_test.sh"
echo ""
