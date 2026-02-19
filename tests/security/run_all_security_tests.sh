#!/bin/bash
#
# GAUZIAN - Security Test Suite Runner
#
# Exécute tous les tests de sécurité pour valider la migration vers Authorization headers.
#
# USAGE:
#     ./run_all_security_tests.sh [options]
#
# OPTIONS:
#     --api-url <URL>        URL de l'API (défaut: https://gauzian.pupin.fr/api)
#     --verbose              Mode verbose (pytest -vv)
#     --stop-on-failure      Arrêter aux premiers échecs (pytest -x)
#     --coverage             Générer rapport de coverage (pytest-cov)
#     --suite <name>         Exécuter une suite spécifique: auth, csrf, permissions, ou all (défaut: all)
#     --html-report          Générer rapport HTML (pytest-html)
#     --help                 Afficher cette aide
#
# EXEMPLES:
#     # Tous les tests (mode défaut)
#     ./run_all_security_tests.sh
#
#     # Tests auth uniquement
#     ./run_all_security_tests.sh --suite auth
#
#     # Mode verbose avec arrêt aux premiers échecs
#     ./run_all_security_tests.sh --verbose --stop-on-failure
#
#     # Tests contre environnement local
#     ./run_all_security_tests.sh --api-url http://localhost:3000/api
#
# REQUIREMENTS:
#     pip install requests pytest pyjwt faker cryptography pytest-html pytest-cov
#

set -euo pipefail

# ========== Configuration ==========

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Valeurs par défaut
API_URL="${API_URL:-https://gauzian.pupin.fr/api}"
VERBOSE=""
STOP_ON_FAILURE=""
COVERAGE=""
HTML_REPORT=""
SUITE="all"

# ========== Parsing Arguments ==========

while [[ $# -gt 0 ]]; do
    case $1 in
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE="-vv"
            shift
            ;;
        --stop-on-failure)
            STOP_ON_FAILURE="-x"
            shift
            ;;
        --coverage)
            COVERAGE="--cov=. --cov-report=html --cov-report=term"
            shift
            ;;
        --suite)
            SUITE="$2"
            shift 2
            ;;
        --html-report)
            HTML_REPORT="--html=reports/security_tests_$(date +%Y%m%d_%H%M%S).html --self-contained-html"
            mkdir -p "$SCRIPT_DIR/reports"
            shift
            ;;
        --help)
            grep '^#' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# ========== Banner ==========

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  GAUZIAN Security Test Suite - Authorization Header Migration Validation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  API URL:    ${GREEN}$API_URL${NC}"
echo -e "  Test Suite: ${GREEN}$SUITE${NC}"
echo -e "  Verbose:    ${GREEN}${VERBOSE:-disabled}${NC}"
echo -e "  Coverage:   ${GREEN}${COVERAGE:-disabled}${NC}"
echo ""

# ========== Vérifier dépendances Python ==========

echo -e "${YELLOW}🔍 Checking Python dependencies...${NC}"

required_packages=("requests" "pytest" "jwt" "faker")
missing_packages=()

for package in "${required_packages[@]}"; do
    if ! python3 -c "import ${package}" 2>/dev/null; then
        missing_packages+=("$package")
    fi
done

if [ ${#missing_packages[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing Python packages: ${missing_packages[*]}${NC}"
    echo -e "${YELLOW}Install with:${NC}"
    echo "  pip install requests pytest pyjwt faker cryptography pytest-html pytest-cov"
    exit 1
fi

echo -e "${GREEN}✅ All dependencies installed${NC}"
echo ""

# ========== Exporter variables d'environnement ==========

export API_URL
export PYTHONDONTWRITEBYTECODE=1  # Éviter fichiers .pyc

# ========== Définir suites de tests ==========

declare -A TEST_SUITES=(
    ["auth"]="auth_header_validation.py"
    ["csrf"]="csrf_bypass_tests.py"
    ["permissions"]="permissions_e2ee_tests.py"
)

# ========== Fonction d'exécution de tests ==========

run_test_suite() {
    local suite_name=$1
    local test_file=$2

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Running: ${suite_name}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local pytest_args=(
        "$SCRIPT_DIR/$test_file"
        "-ra"  # Show summary of all test results
        "--tb=short"  # Shorter traceback format
        "--color=yes"
    )

    # Ajouter options conditionnelles
    [ -n "$VERBOSE" ] && pytest_args+=("$VERBOSE")
    [ -n "$STOP_ON_FAILURE" ] && pytest_args+=("$STOP_ON_FAILURE")
    [ -n "$COVERAGE" ] && pytest_args+=($COVERAGE)
    [ -n "$HTML_REPORT" ] && pytest_args+=($HTML_REPORT)

    if pytest "${pytest_args[@]}"; then
        echo -e "${GREEN}✅ ${suite_name} - PASSED${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ ${suite_name} - FAILED${NC}"
        echo ""
        return 1
    fi
}

# ========== Exécution des tests ==========

FAILED_SUITES=()
PASSED_SUITES=()

if [ "$SUITE" == "all" ]; then
    # Exécuter toutes les suites
    for suite_name in "${!TEST_SUITES[@]}"; do
        test_file="${TEST_SUITES[$suite_name]}"

        if run_test_suite "$suite_name" "$test_file"; then
            PASSED_SUITES+=("$suite_name")
        else
            FAILED_SUITES+=("$suite_name")
        fi
    done
else
    # Exécuter suite spécifique
    if [ -n "${TEST_SUITES[$SUITE]}" ]; then
        test_file="${TEST_SUITES[$SUITE]}"

        if run_test_suite "$SUITE" "$test_file"; then
            PASSED_SUITES+=("$SUITE")
        else
            FAILED_SUITES+=("$SUITE")
        fi
    else
        echo -e "${RED}❌ Unknown test suite: $SUITE${NC}"
        echo -e "${YELLOW}Available suites: ${!TEST_SUITES[*]} all${NC}"
        exit 1
    fi
fi

# ========== Rapport Final ==========

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Test Results Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ${#PASSED_SUITES[@]} -gt 0 ]; then
    echo -e "${GREEN}✅ Passed Suites (${#PASSED_SUITES[@]}):${NC}"
    for suite in "${PASSED_SUITES[@]}"; do
        echo -e "   - ${suite}"
    done
    echo ""
fi

if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed Suites (${#FAILED_SUITES[@]}):${NC}"
    for suite in "${FAILED_SUITES[@]}"; do
        echo -e "   - ${suite}"
    done
    echo ""
fi

# ========== Exit Code ==========

if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  🎉 ALL SECURITY TESTS PASSED 🎉${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}Authorization header migration is SECURE ✅${NC}"
    echo ""

    if [ -n "$HTML_REPORT" ]; then
        echo -e "${YELLOW}📊 HTML Report generated in: $SCRIPT_DIR/reports/${NC}"
    fi

    if [ -n "$COVERAGE" ]; then
        echo -e "${YELLOW}📊 Coverage Report: htmlcov/index.html${NC}"
    fi

    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ⚠️  SECURITY TESTS FAILED  ⚠️${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${RED}❌ ${#FAILED_SUITES[@]} test suite(s) failed${NC}"
    echo -e "${YELLOW}Review the logs above for details${NC}"
    echo ""

    exit 1
fi
