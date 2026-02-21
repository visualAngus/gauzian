#!/bin/bash

# GAUZIAN - Script de setup des comptes de test
# À lancer UNE SEULE FOIS avant le premier run CI.
# Idempotent : ignore les 409 (compte déjà existant).

DEFAULT_BASE_URL="http://localhost:3000"
DEFAULT_EMAIL_A="testa@gauzian.local"
DEFAULT_EMAIL_B="testb@gauzian.local"
DEFAULT_PASSWORD="TestPassword123!"
DEFAULT_USERNAME_A="testuser_a"
DEFAULT_USERNAME_B="testuser_b"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="${DEFAULT_BASE_URL}"
EMAIL_A="${DEFAULT_EMAIL_A}"
EMAIL_B="${DEFAULT_EMAIL_B}"
PASSWORD="${DEFAULT_PASSWORD}"
USERNAME_A="${DEFAULT_USERNAME_A}"
USERNAME_B="${DEFAULT_USERNAME_B}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --base-url)   BASE_URL="$2";   shift 2 ;;
        --email-a)    EMAIL_A="$2";    shift 2 ;;
        --email-b)    EMAIL_B="$2";    shift 2 ;;
        --password)   PASSWORD="$2";   shift 2 ;;
        --username-a) USERNAME_A="$2"; shift 2 ;;
        --username-b) USERNAME_B="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

register_user() {
    local email="$1"
    local username="$2"
    local password="$3"

    echo -e "${YELLOW}Registering ${email}...${NC}"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${BASE_URL}/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${email}\",
            \"username\": \"${username}\",
            \"password\": \"${password}\",
            \"encrypted_private_key\": \"dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=\",
            \"public_key\": \"dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=\",
            \"private_key_salt\": \"dGVzdC1zYWx0\",
            \"iv\": \"dGVzdC1pdg==\",
            \"encrypted_record_key\": \"dGVzdC1yZWNvcmQta2V5\"
        }")

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "  ${GREEN}✓ Created${NC}"
    elif [ "$HTTP_CODE" = "409" ]; then
        echo -e "  ${YELLOW}~ Already exists (OK)${NC}"
    else
        echo -e "  ${RED}✗ Failed (HTTP $HTTP_CODE)${NC}"
        return 1
    fi
}

echo ""
echo "========================================"
echo "  GAUZIAN Test Accounts Setup"
echo "========================================"
echo "  API: ${BASE_URL}"
echo ""

register_user "$EMAIL_A" "$USERNAME_A" "$PASSWORD" || exit 1
register_user "$EMAIL_B" "$USERNAME_B" "$PASSWORD" || exit 1

echo ""
echo -e "${GREEN}Setup complete. You can now run the CI tests.${NC}"
echo ""
