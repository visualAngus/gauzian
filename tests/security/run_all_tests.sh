#!/bin/bash
#
# GAUZIAN Complete Security Test Suite Runner
#
# This script runs all security tests in sequence:
# 1. Authentication bypass tests
# 2. IDOR/authorization tests
# 3. SQL injection tests (SQLMap)
# 4. Rate limiting tests (k6)
# 5. E2EE validation tests
#
# Usage:
#   ./tests/security/run_all_tests.sh [--full] [--quick]
#
# Options:
#   --full    Run comprehensive tests (SQLMap level 5, risk 3) [~60-90 min]
#   --quick   Run quick tests only [~10-15 min] (default)
#   --skip-sqlmap  Skip SQLMap tests (faster for CI/CD)
#

set -e  # Exit on error

# ================================
# Configuration
# ================================

BASE_URL="${API_URL:-https://gauzian.pupin.fr}"
REPORT_DIR="./tests/security/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/pentest_report_$TIMESTAMP.md"

# Create report directory
mkdir -p "$REPORT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test mode
TEST_MODE="quick"
SKIP_SQLMAP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            TEST_MODE="full"
            shift
            ;;
        --quick)
            TEST_MODE="quick"
            shift
            ;;
        --skip-sqlmap)
            SKIP_SQLMAP=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# ================================
# Helper Functions
# ================================

print_header() {
    echo -e "\n${BOLD}${CYAN}================================${NC}"
    echo -e "${BOLD}$1${NC}"
    echo -e "${BOLD}${CYAN}================================${NC}\n"
}

print_section() {
    echo -e "\n${BOLD}${BLUE}>>> $1${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

write_report_header() {
    cat > "$REPORT_FILE" << EOF
# GAUZIAN Security Test Report

**Generated:** $(date -Iseconds)
**Target:** $BASE_URL
**Test Mode:** $TEST_MODE
**Tester:** $(whoami)@$(hostname)

---

## Executive Summary

This report contains the results of comprehensive security testing performed against the GAUZIAN platform.

**Test Categories:**
1. Authentication Security (JWT, session management, brute-force protection)
2. Authorization Controls (IDOR, privilege escalation)
3. Injection Vulnerabilities (SQL, NoSQL, command injection)
4. Rate Limiting & DoS Protection
5. End-to-End Encryption Validation

---

## Test Results

EOF
}

append_to_report() {
    echo -e "$1" >> "$REPORT_FILE"
}

# ================================
# Prerequisite Checks
# ================================

print_header "GAUZIAN SECURITY TEST SUITE"

echo -e "${BOLD}Configuration:${NC}"
echo -e "  Base URL: ${BLUE}$BASE_URL${NC}"
echo -e "  Test Mode: ${BLUE}$TEST_MODE${NC}"
echo -e "  Report: ${BLUE}$REPORT_FILE${NC}"
echo ""

print_section "Checking Prerequisites"

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "python3 not found. Please install Python 3.8+"
    exit 1
fi
print_success "Python 3 found: $(python3 --version)"

# Check k6
if ! command -v k6 &> /dev/null; then
    print_warning "k6 not found. Skipping load tests. Install: https://k6.io/docs/getting-started/installation/"
    SKIP_K6=true
else
    print_success "k6 found: $(k6 version)"
    SKIP_K6=false
fi

# Check SQLMap (only if not skipped)
if [ "$SKIP_SQLMAP" = false ]; then
    if ! command -v sqlmap &> /dev/null; then
        print_warning "sqlmap not found. Skipping SQL injection tests. Install: apt install sqlmap"
        SKIP_SQLMAP=true
    else
        print_success "sqlmap found"
    fi
fi

# Check required Python packages
print_section "Checking Python Dependencies"
python3 -c "import requests, jwt" 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Required Python packages installed (requests, pyjwt)"
else
    print_error "Missing Python packages. Installing..."
    pip3 install requests pyjwt --quiet
fi

# ================================
# Get Test Credentials
# ================================

print_section "Test Credentials Setup"

echo -e "${BOLD}Enter test credentials for User A (owner):${NC}"
read -p "Email: " USER_A_EMAIL
read -sp "Password: " USER_A_PASSWORD
echo ""

echo -e "\n${BOLD}Enter test credentials for User B (for IDOR tests):${NC}"
read -p "Email: " USER_B_EMAIL
read -sp "Password: " USER_B_PASSWORD
echo ""

# Validate credentials by attempting login
print_section "Validating Credentials"

LOGIN_TEST=$(curl -s -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER_A_EMAIL\",\"password\":\"$USER_A_PASSWORD\"}" \
    -w "%{http_code}")

if [[ "$LOGIN_TEST" != *"200"* ]]; then
    print_error "User A login failed. Please check credentials."
    exit 1
fi
print_success "User A credentials validated"

LOGIN_TEST_B=$(curl -s -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$USER_B_EMAIL\",\"password\":\"$USER_B_PASSWORD\"}" \
    -w "%{http_code}")

if [[ "$LOGIN_TEST_B" != *"200"* ]]; then
    print_error "User B login failed. Please check credentials."
    exit 1
fi
print_success "User B credentials validated"

# ================================
# Initialize Report
# ================================

write_report_header
append_to_report "### Credentials Used"
append_to_report "- User A: \`$USER_A_EMAIL\` (owner/tester)"
append_to_report "- User B: \`$USER_B_EMAIL\` (unauthorized user)"
append_to_report ""

# ================================
# Test 1: Authentication Bypass Tests
# ================================

print_header "TEST 1: Authentication Security"

append_to_report "## 1. Authentication Security Tests"
append_to_report ""
append_to_report "\`\`\`"

python3 ./tests/security/scripts/auth_bypass_test.py \
    --url "$BASE_URL" \
    --user "$USER_A_EMAIL" \
    --password "$USER_A_PASSWORD" \
    | tee -a "$REPORT_FILE"

AUTH_EXIT_CODE=${PIPESTATUS[0]}

append_to_report "\`\`\`"
append_to_report ""

if [ $AUTH_EXIT_CODE -eq 0 ]; then
    print_success "Authentication tests passed (no vulnerabilities found)"
    append_to_report "**Result:** ✅ PASS - No authentication vulnerabilities detected"
else
    print_error "Authentication vulnerabilities detected! Review report for details."
    append_to_report "**Result:** ❌ FAIL - Vulnerabilities found (see above)"
fi

append_to_report ""

# ================================
# Test 2: Authorization Tests (IDOR)
# ================================

print_header "TEST 2: Authorization Controls (IDOR)"

append_to_report "## 2. Authorization Controls (IDOR) Tests"
append_to_report ""
append_to_report "\`\`\`"

python3 ./tests/security/scripts/idor_enumeration.py \
    --url "$BASE_URL" \
    --user-a "$USER_A_EMAIL" \
    --password-a "$USER_A_PASSWORD" \
    --user-b "$USER_B_EMAIL" \
    --password-b "$USER_B_PASSWORD" \
    | tee -a "$REPORT_FILE"

IDOR_EXIT_CODE=${PIPESTATUS[0]}

append_to_report "\`\`\`"
append_to_report ""

if [ $IDOR_EXIT_CODE -eq 0 ]; then
    print_success "Authorization tests passed (no IDOR vulnerabilities)"
    append_to_report "**Result:** ✅ PASS - No IDOR vulnerabilities detected"
else
    print_error "Authorization vulnerabilities detected! Review report for details."
    append_to_report "**Result:** ❌ FAIL - IDOR vulnerabilities found"
fi

append_to_report ""

# ================================
# Test 3: SQL Injection Tests (SQLMap)
# ================================

if [ "$SKIP_SQLMAP" = false ]; then
    print_header "TEST 3: SQL Injection Testing (SQLMap)"

    append_to_report "## 3. SQL Injection Tests (SQLMap)"
    append_to_report ""

    if [ "$TEST_MODE" = "full" ]; then
        print_section "Running FULL SQLMap tests (level 5, risk 3) - may take 60-90 minutes..."
        append_to_report "**Mode:** Full (level 5, risk 3)"
        append_to_report ""

        # Run comprehensive SQLMap test
        ./tests/security/sqlmap_test.sh 2>&1 | tee -a "$REPORT_FILE"
    else
        print_section "Running QUICK SQLMap tests (level 2, risk 1) - may take 5-10 minutes..."
        append_to_report "**Mode:** Quick (level 2, risk 1)"
        append_to_report ""

        # Run quick SQLMap test
        ./tests/security/sqlmap_quick_test.sh 2>&1 | tee -a "$REPORT_FILE"
    fi

    # Check for SQL injection findings
    if grep -r "sqlmap identified.*injection" ./sqlmap_reports/ &> /dev/null; then
        print_error "SQL injection vulnerabilities found! Check sqlmap_reports/"
        append_to_report "**Result:** ❌ FAIL - SQL injection vulnerabilities detected"
    else
        print_success "No SQL injections detected"
        append_to_report "**Result:** ✅ PASS - No SQL injection vulnerabilities"
    fi

    append_to_report ""
else
    print_warning "Skipping SQLMap tests (--skip-sqlmap flag or sqlmap not installed)"
    append_to_report "## 3. SQL Injection Tests"
    append_to_report "**Status:** SKIPPED"
    append_to_report ""
fi

# ================================
# Test 4: Rate Limiting & Brute-Force Protection (k6)
# ================================

if [ "$SKIP_K6" = false ]; then
    print_header "TEST 4: Rate Limiting & Brute-Force Protection"

    append_to_report "## 4. Rate Limiting Tests (k6)"
    append_to_report ""
    append_to_report "\`\`\`"

    k6 run ./tests/k6/pentest/auth-brute-force.js \
        --env API_URL="$BASE_URL" \
        --env TEST_EMAIL="$USER_A_EMAIL" \
        2>&1 | tee -a "$REPORT_FILE"

    K6_EXIT_CODE=${PIPESTATUS[0]}

    append_to_report "\`\`\`"
    append_to_report ""

    if [ $K6_EXIT_CODE -eq 0 ]; then
        print_success "Rate limiting tests passed"
        append_to_report "**Result:** ✅ PASS - Rate limiting is active"
    else
        print_warning "Rate limiting tests had issues (check report)"
        append_to_report "**Result:** ⚠️ WARNING - Review test output"
    fi

    append_to_report ""
else
    print_warning "Skipping k6 tests (k6 not installed)"
    append_to_report "## 4. Rate Limiting Tests"
    append_to_report "**Status:** SKIPPED (k6 not installed)"
    append_to_report ""
fi

# ================================
# Test 5: E2EE Validation (if script exists)
# ================================

if [ -f "./tests/security/scripts/e2ee_validation.py" ]; then
    print_header "TEST 5: End-to-End Encryption Validation"

    append_to_report "## 5. E2EE Validation Tests"
    append_to_report ""
    append_to_report "\`\`\`"

    python3 ./tests/security/scripts/e2ee_validation.py \
        --url "$BASE_URL" \
        --user "$USER_A_EMAIL" \
        --password "$USER_A_PASSWORD" \
        2>&1 | tee -a "$REPORT_FILE"

    E2EE_EXIT_CODE=${PIPESTATUS[0]}

    append_to_report "\`\`\`"
    append_to_report ""

    if [ $E2EE_EXIT_CODE -eq 0 ]; then
        print_success "E2EE validation passed"
        append_to_report "**Result:** ✅ PASS - Server cannot decrypt user data"
    else
        print_error "E2EE validation failed!"
        append_to_report "**Result:** ❌ FAIL - E2EE compromised"
    fi

    append_to_report ""
else
    print_warning "E2EE validation script not found (tests/security/scripts/e2ee_validation.py)"
fi

# ================================
# Final Summary
# ================================

print_header "TEST SUITE COMPLETE"

append_to_report "---"
append_to_report ""
append_to_report "## Summary"
append_to_report ""
append_to_report "**Test Completion Time:** $(date -Iseconds)"
append_to_report ""

# Count vulnerabilities
TOTAL_VULNS=0

if [ $AUTH_EXIT_CODE -ne 0 ]; then
    TOTAL_VULNS=$((TOTAL_VULNS + 1))
fi

if [ $IDOR_EXIT_CODE -ne 0 ]; then
    TOTAL_VULNS=$((TOTAL_VULNS + 1))
fi

if [ "$SKIP_SQLMAP" = false ] && grep -r "sqlmap identified.*injection" ./sqlmap_reports/ &> /dev/null; then
    TOTAL_VULNS=$((TOTAL_VULNS + 1))
fi

append_to_report "**Vulnerabilities Found:** $TOTAL_VULNS"
append_to_report ""

if [ $TOTAL_VULNS -eq 0 ]; then
    print_success "✅ All tests passed! No critical vulnerabilities detected."
    append_to_report "### Conclusion"
    append_to_report ""
    append_to_report "✅ **PASS** - The application shows no critical security vulnerabilities in the tested areas."
    append_to_report ""
    append_to_report "**Recommendations:**"
    append_to_report "- Continue regular security testing"
    append_to_report "- Monitor authentication logs for suspicious activity"
    append_to_report "- Keep dependencies updated (cargo audit)"
else
    print_error "❌ Vulnerabilities detected! Review the report immediately."
    append_to_report "### Conclusion"
    append_to_report ""
    append_to_report "❌ **FAIL** - Critical vulnerabilities were detected and must be remediated before production deployment."
    append_to_report ""
    append_to_report "**Next Steps:**"
    append_to_report "1. Review all failed tests in detail"
    append_to_report "2. Prioritize fixes by CVSS score (Critical > High > Medium > Low)"
    append_to_report "3. Implement fixes in code"
    append_to_report "4. Re-run this test suite to verify fixes"
fi

append_to_report ""
append_to_report "---"
append_to_report ""
append_to_report "**Report Generated By:** GAUZIAN Security Test Suite v1.0"
append_to_report ""
append_to_report "For questions or remediation assistance, contact the security team."

echo ""
echo -e "${BOLD}${CYAN}Full report saved to:${NC} ${BLUE}$REPORT_FILE${NC}"
echo ""

# Open report if in interactive mode
if [ -t 0 ]; then
    read -p "Open report now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v mdless &> /dev/null; then
            mdless "$REPORT_FILE"
        elif command -v less &> /dev/null; then
            less "$REPORT_FILE"
        else
            cat "$REPORT_FILE"
        fi
    fi
fi

# Exit with error code if vulnerabilities found
exit $TOTAL_VULNS
