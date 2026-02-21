#!/bin/bash

# GAUZIAN API Security Tests Runner
# Runs all Hurl test files with proper variables and generates reports

# Default values for local testing
DEFAULT_BASE_URL="http://localhost:3000"
DEFAULT_EMAIL_A="testa@gauzian.local"
DEFAULT_EMAIL_B="testb@gauzian.local"
DEFAULT_PASSWORD="TestPassword123!"
DEFAULT_USERNAME_A="testuser_a"
DEFAULT_USERNAME_B="testuser_b"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments (env vars take priority over defaults)
BASE_URL="${API_URL:-${DEFAULT_BASE_URL}}"
EMAIL_A="${TEST_USER_EMAIL_A:-${DEFAULT_EMAIL_A}}"
EMAIL_B="${TEST_USER_EMAIL_B:-${DEFAULT_EMAIL_B}}"
PASSWORD="${TEST_USER_PASSWORD:-${DEFAULT_PASSWORD}}"
USERNAME_A="${TEST_USERNAME_A:-${DEFAULT_USERNAME_A}}"
USERNAME_B="${TEST_USERNAME_B:-${DEFAULT_USERNAME_B}}"
REPORT_HTML=false

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --base-url URL         API base URL (default: ${DEFAULT_BASE_URL})"
    echo "  --email-a EMAIL        Test user A email (default: ${DEFAULT_EMAIL_A})"
    echo "  --email-b EMAIL        Test user B email (default: ${DEFAULT_EMAIL_B})"
    echo "  --password PASSWORD    Test user password (default: ${DEFAULT_PASSWORD})"
    echo "  --username-a NAME      Test user A username (default: ${DEFAULT_USERNAME_A})"
    echo "  --username-b NAME      Test user B username (default: ${DEFAULT_USERNAME_B})"
    echo "  --report-html          Generate HTML report"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 --base-url https://api.gauzian.com --email-a user1@example.com --email-b user2@example.com"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        --email-a)
            EMAIL_A="$2"
            shift 2
            ;;
        --email-b)
            EMAIL_B="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --username-a)
            USERNAME_A="$2"
            shift 2
            ;;
        --username-b)
            USERNAME_B="$2"
            shift 2
            ;;
        --report-html)
            REPORT_HTML=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Verify hurl is installed
if ! command -v hurl &> /dev/null; then
    echo -e "${RED}Error: Hurl is not installed${NC}"
    echo "Install with: brew install hurl (macOS) or see https://hurl.dev/"
    exit 1
fi

# Create reports directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="${SCRIPT_DIR}/reports"
mkdir -p "${REPORTS_DIR}"

# Common Hurl variables (each passed as separate --variable flag)
HURL_VARS=(
    --variable "base_url=${BASE_URL}"
    --variable "test_email_a=${EMAIL_A}"
    --variable "test_email_b=${EMAIL_B}"
    --variable "test_password=${PASSWORD}"
    --variable "test_username_a=${USERNAME_A}"
    --variable "test_username_b=${USERNAME_B}"
)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  GAUZIAN API Security Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Base URL: ${BASE_URL}"
echo "  User A: ${EMAIL_A} (${USERNAME_A})"
echo "  User B: ${EMAIL_B} (${USERNAME_B})"
echo ""

# Check if the API is currently rate limiting login requests
check_rate_limited() {
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${EMAIL_A}\",\"password\":\"${PASSWORD}\"}")
    [ "$status" = "429" ]
}

# Function to run a test file
RATE_LIMITED=false

run_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .hurl)

    echo -e "${YELLOW}Running: ${test_name}${NC}"

    # Skip all remaining tests if rate limited
    if [ "$RATE_LIMITED" = true ]; then
        echo -e "  ${YELLOW}⚠ SKIPPED — rate limit actif (réessaie dans ~15 min)${NC}"
        return 2
    fi

    # For non-health tests, detect 429 before running hurl
    if [[ "$test_name" != "00_health" ]]; then
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/login" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"${EMAIL_A}\",\"password\":\"${PASSWORD}\"}")
        if [ "$status" = "429" ]; then
            RATE_LIMITED=true
            echo ""
            echo -e "  ${YELLOW}⚠ RATE LIMIT DÉTECTÉ (HTTP 429)${NC}"
            echo -e "  ${YELLOW}  → Le serveur bloque les connexions depuis cette IP/email.${NC}"
            echo -e "  ${YELLOW}  → Fenêtre : ~15 minutes. Réessaie plus tard.${NC}"
            echo -e "  ${YELLOW}  → Pour débloquer immédiatement :${NC}"
            echo -e "  ${YELLOW}    ssh vps 'kubectl exec -n gauzian-v2 deploy/redis -- redis-cli DEL login_attempts:${EMAIL_A} login_attempts:${EMAIL_B}'${NC}"
            echo -e "  ${YELLOW}⚠ SKIPPED${NC}"
            return 2
        fi
    fi

    if hurl --test "${HURL_VARS[@]}" "${test_file}"; then
        echo -e "  ${GREEN}✓ PASSED${NC}"
        return 0
    else
        echo -e "  ${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Counters
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

# Define test files in order
# NOTE: 01_register.hurl est exclu du CI — les comptes doivent exister au préalable.
# Lancer tests/setup_test_accounts.sh une seule fois pour les créer.
TEST_FILES=(
    "${SCRIPT_DIR}/api/00_health.hurl"
    "${SCRIPT_DIR}/api/auth/02_login.hurl"
    "${SCRIPT_DIR}/api/auth/03_token_security.hurl"
    "${SCRIPT_DIR}/api/auth/04_logout.hurl"
    "${SCRIPT_DIR}/api/drive/01_folder_crud.hurl"
    "${SCRIPT_DIR}/api/drive/02_file_crud.hurl"
    "${SCRIPT_DIR}/api/drive/03_idor_security.hurl"
    "${SCRIPT_DIR}/api/drive/04_sharing_security.hurl"
    "${SCRIPT_DIR}/api/drive/05_trash.hurl"
)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Running Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Run all tests
for test_file in "${TEST_FILES[@]}"; do
    if [ -f "$test_file" ]; then
        TOTAL=$((TOTAL + 1))
        run_test "$test_file"
        rc=$?
        if [ $rc -eq 0 ]; then
            PASSED=$((PASSED + 1))
        elif [ $rc -eq 2 ]; then
            SKIPPED=$((SKIPPED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "${RED}Warning: Test file not found: ${test_file}${NC}"
    fi
    echo ""
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total:   ${TOTAL}"
echo -e "Passed:  ${GREEN}${PASSED}${NC}"
echo -e "Skipped: ${YELLOW}${SKIPPED}${NC}"
echo -e "Failed:  ${RED}${FAILED}${NC}"
echo ""

if [ $SKIPPED -gt 0 ] && [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ Tests partiellement exécutés — rate limit actif. Réessaie dans ~15 min.${NC}"
    exit 2
elif [ $FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
