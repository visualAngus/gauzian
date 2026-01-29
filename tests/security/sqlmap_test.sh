#!/bin/bash

# Script de test SQLMap pour Gauzian
# Ce script teste tous les endpoints de l'API pour détecter les injections SQL

BASE_URL="https://gauzian.pupin.fr/api"
REPORT_DIR="./sqlmap_reports"
mkdir -p "$REPORT_DIR"

echo "================================================"
echo "  SQLMAP TEST - GAUZIAN API"
echo "================================================"
echo ""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester un endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth_token=$4
    local description=$5
    local ignore_code=$6  # Paramètre optionnel pour ignorer certains codes HTTP

    echo -e "${YELLOW}[TEST]${NC} $description"
    echo "Endpoint: $method $endpoint"

    # Options communes pour SQLMap
    local common_options="--dbms=PostgreSQL --batch --level=3 --risk=2 --output-dir=$REPORT_DIR --flush-session --force-ssl"

    # Ajouter ignore-code si spécifié
    if [ -n "$ignore_code" ]; then
        common_options="$common_options --ignore-code=$ignore_code"
    fi

    if [ "$method" = "GET" ]; then
        if [ -z "$auth_token" ]; then
            sqlmap -u "${BASE_URL}${endpoint}" \
                $common_options
        else
            sqlmap -u "${BASE_URL}${endpoint}" \
                --cookie="auth_token=${auth_token}" \
                $common_options
        fi
    elif [ "$method" = "POST" ]; then
        if [ -z "$auth_token" ]; then
            sqlmap -u "${BASE_URL}${endpoint}" \
                --data="$data" \
                --method=POST \
                --header="Content-Type: application/json" \
                $common_options
        else
            sqlmap -u "${BASE_URL}${endpoint}" \
                --data="$data" \
                --method=POST \
                --cookie="auth_token=${auth_token}" \
                --header="Content-Type: application/json" \
                $common_options
        fi
    fi

    echo ""
    echo "---"
    echo ""
}

echo "Voulez-vous tester les endpoints authentifiés ? (y/n)"
read -r test_auth

AUTH_TOKEN=""
if [ "$test_auth" = "y" ]; then
    echo ""
    echo "Comment voulez-vous fournir le token JWT ?"
    echo "1) Saisir email/mot de passe (tentative automatique)"
    echo "2) Fournir directement le token JWT"
    read -r auth_method

    if [ "$auth_method" = "1" ]; then
        echo ""
        echo "Entrez votre email:"
        read -r email
        echo "Entrez votre mot de passe:"
        read -rs password

        # Obtenir le token JWT
        echo ""
        echo "Récupération du token JWT..."
        response=$(curl -s -c /tmp/gauzian_cookies.txt "${BASE_URL}/login" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"${email}\",\"password\":\"${password}\"}")

        # Extraire le token du cookie
        AUTH_TOKEN=$(grep -oP 'auth_token=\K[^;]+' /tmp/gauzian_cookies.txt 2>/dev/null || echo "")

        if [ -z "$AUTH_TOKEN" ]; then
            echo -e "${RED}[ERREUR]${NC} Impossible de récupérer le token JWT. Vérifiez vos identifiants."
            echo "Les tests authentifiés seront ignorés."
        else
            echo -e "${GREEN}[OK]${NC} Token JWT récupéré avec succès."
        fi
    elif [ "$auth_method" = "2" ]; then
        echo ""
        echo "Entrez votre token JWT:"
        read -r AUTH_TOKEN
        if [ -n "$AUTH_TOKEN" ]; then
            echo -e "${GREEN}[OK]${NC} Token JWT saisi avec succès."
        else
            echo -e "${RED}[ERREUR]${NC} Token vide, les tests authentifiés seront ignorés."
        fi
    else
        echo -e "${YELLOW}[INFO]${NC} Option invalide, les tests authentifiés seront ignorés."
    fi
    echo ""
fi

echo "================================================"
echo "  DÉBUT DES TESTS"
echo "================================================"
echo ""

# ==============================================================================
# TESTS DES ENDPOINTS PUBLICS (SANS AUTHENTIFICATION)
# ==============================================================================

echo -e "${GREEN}[SECTION]${NC} Tests des endpoints publics"
echo ""

# Test 1: Login endpoint
test_endpoint "POST" "/login" \
    '{"email":"test@example.com","password":"test123"}' \
    "" \
    "Endpoint de connexion (login)" \
    "401"

# Test 2: Register endpoint
test_endpoint "POST" "/register" \
    '{"username":"sqltest","password":"test123","email":"sqltest@example.com","encrypted_private_key":"test","public_key":"test","private_key_salt":"test","iv":"test","encrypted_record_key":"test"}' \
    "" \
    "Endpoint d'inscription (register)" \
    "401"

# Test 3: Get public key by email
test_endpoint "GET" "/contacts/get_public_key/test@example.com" \
    "" \
    "" \
    "Récupération de clé publique par email" \
    "401"

# ==============================================================================
# TESTS DES ENDPOINTS AUTHENTIFIÉS
# ==============================================================================

if [ -n "$AUTH_TOKEN" ]; then
    echo ""
    echo -e "${GREEN}[SECTION]${NC} Tests des endpoints authentifiés"
    echo ""

    # Test 4: Get drive info with parent_id
    test_endpoint "GET" "/drive/get_all_drive_info/00000000-0000-0000-0000-000000000000" \
        "" \
        "$AUTH_TOKEN" \
        "Récupération des infos du drive avec parent_id"

    # Test 5: Get folder by ID
    test_endpoint "GET" "/drive/get_folder/00000000-0000-0000-0000-000000000000" \
        "" \
        "$AUTH_TOKEN" \
        "Récupération d'un dossier par ID"

    # Test 6: Get file info by ID
    test_endpoint "GET" "/drive/file/00000000-0000-0000-0000-000000000000" \
        "" \
        "$AUTH_TOKEN" \
        "Récupération d'infos de fichier par ID"

    # Test 7: Download file
    test_endpoint "GET" "/drive/download/00000000-0000-0000-0000-000000000000" \
        "" \
        "$AUTH_TOKEN" \
        "Téléchargement de fichier"

    # Test 8: Get folder contents
    test_endpoint "GET" "/drive/folder_contents/00000000-0000-0000-0000-000000000000" \
        "" \
        "$AUTH_TOKEN" \
        "Récupération du contenu d'un dossier"

    # Test 9: Create folder
    test_endpoint "POST" "/drive/create_folder" \
        '{"name":"test_folder","parent_id":"00000000-0000-0000-0000-000000000000","encrypted_name":"test"}' \
        "$AUTH_TOKEN" \
        "Création d'un dossier"

    # Test 10: Delete file
    test_endpoint "POST" "/drive/delete_file" \
        '{"file_id":"00000000-0000-0000-0000-000000000000"}' \
        "$AUTH_TOKEN" \
        "Suppression d'un fichier"

    # Test 11: Delete folder
    test_endpoint "POST" "/drive/delete_folder" \
        '{"folder_id":"00000000-0000-0000-0000-000000000000"}' \
        "$AUTH_TOKEN" \
        "Suppression d'un dossier"

    # Test 12: Rename file
    test_endpoint "POST" "/drive/rename_file" \
        '{"file_id":"00000000-0000-0000-0000-000000000000","new_name":"newname.txt"}' \
        "$AUTH_TOKEN" \
        "Renommer un fichier"

    # Test 13: Share folder
    test_endpoint "POST" "/drive/share_folder" \
        '{"folder_id":"00000000-0000-0000-0000-000000000000","target_user_email":"test@example.com","access_level":"viewer"}' \
        "$AUTH_TOKEN" \
        "Partager un dossier"

    # Test 14: Get folder shared users
    test_endpoint "GET" "/drive/folder/00000000-0000-0000-0000-000000000000/shared_users" \
        "" \
        "$AUTH_TOKEN" \
        "Récupérer les utilisateurs avec qui un dossier est partagé"

else
    echo -e "${YELLOW}[INFO]${NC} Tests authentifiés ignorés (pas de token JWT)"
fi

echo ""
echo "================================================"
echo "  TESTS TERMINÉS"
echo "================================================"
echo ""
echo "Les rapports détaillés sont disponibles dans: $REPORT_DIR"
echo ""
echo "Pour voir un résumé des résultats:"
echo "  grep -r 'sqlmap identified' $REPORT_DIR"
echo ""
echo "Pour voir toutes les vulnérabilités trouvées:"
echo "  grep -r 'vulnerable' $REPORT_DIR"
echo ""
