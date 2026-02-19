# GAUZIAN Security Testing Suite

**Version:** 1.0
**Last Updated:** 2026-02-17
**Maintainer:** Backend Security Team

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Test Categories](#test-categories)
4. [Prerequisites](#prerequisites)
5. [Running Tests](#running-tests)
6. [Understanding Results](#understanding-results)
7. [Directory Structure](#directory-structure)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This directory contains a comprehensive security testing suite for the GAUZIAN zero-knowledge cloud storage platform. The tests cover:

- **Authentication Security**: JWT manipulation, session management, brute-force protection
- **Authorization Controls**: IDOR, privilege escalation, permission validation
- **Injection Vulnerabilities**: SQL injection (SQLMap), NoSQL injection, command injection
- **Rate Limiting**: DoS protection, concurrent request handling
- **Cryptographic Validation**: E2EE verification, key management

### Security Posture Goals

- ✅ **Zero-Knowledge Architecture** - Server cannot decrypt user data
- ✅ **Defense in Depth** - Multiple security layers
- ✅ **Fail-Closed** - Service failures deny access (not bypass security)
- ✅ **OWASP Top 10 Coverage** - Protection against common vulnerabilities

---

## Quick Start

### Run All Tests (Quick Mode)

```bash
cd /home/gael/Bureau/gauzian

# Run quick security test suite (~10-15 minutes)
./tests/security/run_all_tests.sh --quick

# View report
cat tests/security/reports/pentest_report_*.md
```

### Run Full Security Audit

```bash
# Run comprehensive tests (~60-90 minutes)
./tests/security/run_all_tests.sh --full

# This includes:
# - SQLMap level 5, risk 3 (aggressive SQL injection testing)
# - Extended IDOR enumeration (1000 random UUIDs)
# - Load testing with 500+ concurrent users
```

---

## Test Categories

### 1. Authentication Security (`scripts/auth_bypass_test.py`)

**Tests:**
- ✅ JWT signature tampering
- ✅ Algorithm confusion attack (alg: none)
- ✅ Expired token acceptance
- ✅ Logout blacklist bypass (race conditions)
- ✅ Token replay attacks
- ✅ Session fixation (JTI reuse)
- ✅ Brute-force protection

**Run Individually:**
```bash
python3 tests/security/scripts/auth_bypass_test.py \
  --url https://gauzian.pupin.fr \
  --user test@example.com \
  --password SecurePass123!
```

**Expected Output:**
```
================================
  GAUZIAN AUTHENTICATION SECURITY TEST SUITE
================================

Target: https://gauzian.pupin.fr
Test User: test@example.com

✓ PASS - Signature Tampering: Server rejected tampered token (401)
✓ PASS - Algorithm Confusion: Server rejected 'none' algorithm (401)
...

================================
  TEST SUMMARY
================================

✅ All tests passed! No authentication vulnerabilities detected.
```

---

### 2. Authorization Controls (`scripts/idor_enumeration.py`)

**Tests:**
- ✅ Horizontal privilege escalation (User A → User B's files)
- ✅ Vertical privilege escalation (Viewer → Delete)
- ✅ UUID enumeration (random UUID probing)
- ✅ Sequential UUID attack (adjacent file discovery)
- ✅ Folder hierarchy bypass

**Run Individually:**
```bash
python3 tests/security/scripts/idor_enumeration.py \
  --url https://gauzian.pupin.fr \
  --user-a alice@example.com \
  --password-a AlicePass123! \
  --user-b bob@example.com \
  --password-b BobPass123!
```

**What It Tests:**
- Creates test files/folders as User A
- Attempts to access them as User B (should fail)
- Shares files with different permission levels (viewer, editor, owner)
- Validates permission enforcement

---

### 3. SQL Injection Testing (`sqlmap_test.sh`, `sqlmap_quick_test.sh`)

**SQLMap Configuration:**
- **Database**: PostgreSQL
- **Quick Mode**: Level 2, Risk 1 (5-10 min)
- **Full Mode**: Level 5, Risk 3 (60-90 min)
- **Endpoints Tested**: 14 (public + authenticated)

**Run Quick Test:**
```bash
./tests/security/sqlmap_quick_test.sh
```

**Run Full Test:**
```bash
./tests/security/sqlmap_test.sh
# Prompts for authentication credentials
# Tests all 32 drive endpoints + auth endpoints
```

**Interpreting Results:**
```bash
# Check for vulnerabilities
grep -r "sqlmap identified.*injection" sqlmap_reports/

# No output = ✅ No SQL injection vulnerabilities found
# Output found = ❌ Review sqlmap_reports/ for details
```

---

### 4. Rate Limiting & DoS Protection (`k6/pentest/auth-brute-force.js`)

**k6 Load Testing:**
- Simulates brute-force attacks on login endpoint
- Tests rate limiting (expected: HTTP 429 after 100 req/s)
- Validates timing attack protection (consistent response times)

**Run Test:**
```bash
k6 run tests/k6/pentest/auth-brute-force.js \
  --env API_URL=https://gauzian.pupin.fr \
  --env TEST_EMAIL=test@example.com
```

**Expected Metrics:**
- ✅ `rate_limited_requests > 0` (rate limiting triggered)
- ✅ `http_req_duration p(95) < 2000ms` (95% requests under 2s)
- ✅ Timing variance < 500ms (no timing attacks)

---

## Prerequisites

### System Requirements

```bash
# Operating System
- Linux (Ubuntu 20.04+, Debian 11+) or macOS
- Windows (WSL2 recommended)

# Software Dependencies
- Python 3.8+
- curl
- jq (JSON processor)
- Optional: k6 (load testing)
- Optional: sqlmap (SQL injection testing)
```

### Install Dependencies

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install Python and tools
sudo apt install -y python3 python3-pip curl jq

# Install Python packages
pip3 install requests pyjwt

# Install k6 (optional but recommended)
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6

# Install SQLMap (optional)
sudo apt install sqlmap
```

#### macOS

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install python curl jq k6 sqlmap

# Install Python packages
pip3 install requests pyjwt
```

#### Docker (Alternative)

```bash
# Run tests in Docker container (all dependencies included)
docker run -it --rm \
  -v $(pwd)/tests:/tests \
  -e API_URL=https://gauzian.pupin.fr \
  python:3.11-slim bash

# Inside container:
apt update && apt install -y curl jq sqlmap
pip install requests pyjwt
cd /tests/security
./run_all_tests.sh --quick
```

---

## Running Tests

### Master Test Suite

```bash
# Quick test suite (~10-15 min)
./tests/security/run_all_tests.sh --quick

# Full test suite (~60-90 min)
./tests/security/run_all_tests.sh --full

# Skip SQLMap (faster for CI/CD)
./tests/security/run_all_tests.sh --quick --skip-sqlmap
```

**What It Does:**
1. Validates prerequisites (Python, k6, sqlmap)
2. Prompts for test credentials (User A, User B)
3. Runs all test categories in sequence
4. Generates comprehensive Markdown report
5. Opens report for review (interactive mode)

---

### Individual Test Scripts

#### Authentication Tests

```bash
python3 tests/security/scripts/auth_bypass_test.py \
  --url https://gauzian.pupin.fr \
  --user your_email@example.com \
  --password YourPassword123!

# Exit code: 0 = all tests passed, 1+ = vulnerabilities found
```

#### Authorization Tests

```bash
python3 tests/security/scripts/idor_enumeration.py \
  --url https://gauzian.pupin.fr \
  --user-a user1@example.com \
  --password-a Pass1 \
  --user-b user2@example.com \
  --password-b Pass2
```

#### SQL Injection Tests

```bash
# Quick test (3 endpoints, 5-10 min)
./tests/security/sqlmap_quick_test.sh

# Full test (14 endpoints, 60-90 min)
./tests/security/sqlmap_test.sh
```

#### Load Tests

```bash
# Brute-force protection
k6 run tests/k6/pentest/auth-brute-force.js

# Custom VUs and duration
k6 run --vus 200 --duration 5m tests/k6/pentest/auth-brute-force.js
```

---

## Understanding Results

### Test Report Structure

Reports are saved in `tests/security/reports/pentest_report_YYYYMMDD_HHMMSS.md`:

```markdown
# GAUZIAN Security Test Report

## Executive Summary
- Target: https://gauzian.pupin.fr
- Test Mode: quick
- Vulnerabilities Found: 0

## Test Results

### 1. Authentication Security Tests
✅ PASS - No authentication vulnerabilities detected

### 2. Authorization Controls (IDOR) Tests
✅ PASS - No IDOR vulnerabilities detected

### 3. SQL Injection Tests (SQLMap)
✅ PASS - No SQL injection vulnerabilities

### 4. Rate Limiting Tests (k6)
✅ PASS - Rate limiting is active

## Summary
✅ PASS - The application shows no critical security vulnerabilities.
```

---

### Vulnerability Severity Levels

| Severity | CVSS Score | Description | Action Required |
|----------|------------|-------------|-----------------|
| **CRITICAL** | 9.0-10.0 | Allows complete system compromise | Fix immediately, do not deploy |
| **HIGH** | 7.0-8.9 | Allows significant unauthorized access | Fix before production deployment |
| **MEDIUM** | 4.0-6.9 | Allows limited unauthorized access | Fix within 30 days |
| **LOW** | 0.1-3.9 | Minor security concerns | Fix in next release cycle |

---

### Exit Codes

```bash
# Run test suite
./tests/security/run_all_tests.sh --quick
echo $?  # Check exit code

# Exit codes:
#   0 = All tests passed (no vulnerabilities)
#   1+ = Number of test categories with vulnerabilities
```

**Use in CI/CD:**
```yaml
# .github/workflows/security.yml
- name: Run Security Tests
  run: ./tests/security/run_all_tests.sh --quick --skip-sqlmap
  continue-on-error: false  # Fail pipeline if vulnerabilities found
```

---

## Directory Structure

```
tests/security/
├── README.md                      # This file
├── PENTEST_GUIDE.md              # Comprehensive testing guide (70 pages)
├── SECURITY_CHECKLIST.md         # Pre-deployment checklist
├── run_all_tests.sh              # Master test runner
├── sqlmap_test.sh                # Full SQLMap test
├── sqlmap_quick_test.sh          # Quick SQLMap test
│
├── scripts/                       # Python test scripts
│   ├── auth_bypass_test.py       # Authentication testing (7 tests)
│   ├── idor_enumeration.py       # Authorization testing (5 tests)
│   └── e2ee_validation.py        # E2EE verification (TODO)
│
└── reports/                       # Test results (auto-generated)
    ├── pentest_report_20260217_143022.md
    └── k6_brute_force_report.json
```

---

## Troubleshooting

### Issue: "Login failed: 401 Unauthorized"

**Cause:** Invalid test credentials.

**Solution:**
```bash
# Verify credentials manually
curl -X POST https://gauzian.pupin.fr/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"YourPassword"}'

# Should return: {"token": "eyJ..."}
```

---

### Issue: "Rate limited (HTTP 429)" During Setup

**Cause:** Too many requests in short time.

**Solution:**
```bash
# Wait 60 seconds for rate limit to reset
sleep 60

# Or test against staging environment
./tests/security/run_all_tests.sh --quick --url https://staging.gauzian.pupin.fr
```

---

### Issue: "sqlmap not found"

**Cause:** SQLMap not installed.

**Solution:**
```bash
# Ubuntu/Debian
sudo apt install sqlmap

# macOS
brew install sqlmap

# Or skip SQLMap tests
./tests/security/run_all_tests.sh --quick --skip-sqlmap
```

---

### Issue: "ImportError: No module named 'jwt'"

**Cause:** Missing Python dependencies.

**Solution:**
```bash
pip3 install requests pyjwt

# Or use virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r tests/security/requirements.txt  # Create this file if needed
```

---

### Issue: k6 Tests Show "No Rate Limiting Detected"

**Cause:** Rate limiting might not be configured or threshold is too high.

**Expected Behavior:**
- Traefik middleware should limit to 100 req/s per IP
- Check Traefik IngressRoute configuration

**Debug:**
```bash
# Check Traefik middleware
kubectl get middleware -n gauzian-v2

# Check backend IngressRoute
kubectl get ingressroute -n gauzian-v2 backend-ingressroute -o yaml | grep -A 10 middlewares

# Expected:
#   middlewares:
#     - name: rate-limit
```

---

## Best Practices

### Before Production Deployment

1. ✅ Run full test suite: `./tests/security/run_all_tests.sh --full`
2. ✅ Review and remediate all HIGH/CRITICAL findings
3. ✅ Complete `SECURITY_CHECKLIST.md`
4. ✅ Document accepted risks in `SECURITY_RISKS.md`
5. ✅ Test in staging environment first

---

### Continuous Testing

```bash
# Weekly: Quick security scan
./tests/security/run_all_tests.sh --quick --skip-sqlmap

# Monthly: Full security audit
./tests/security/run_all_tests.sh --full

# After security-related code changes: Re-run affected tests
python3 tests/security/scripts/auth_bypass_test.py ...
```

---

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: Security Tests

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday 2am

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install requests pyjwt
          sudo apt install -y curl jq

      - name: Run security tests
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}
          TEST_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: |
          ./tests/security/run_all_tests.sh --quick --skip-sqlmap

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: tests/security/reports/
```

---

## Additional Resources

### Documentation

- **Pentest Guide**: `PENTEST_GUIDE.md` - Comprehensive 70-page testing methodology
- **Security Checklist**: `SECURITY_CHECKLIST.md` - Pre-deployment validation checklist
- **Database Schema**: `../gauzian_back/docs/DATABASE_SCHEMA.md` - Understand data model
- **Crypto Architecture**: `../gauzian_front/docs/CRYPTO_ARCHITECTURE.md` - E2EE implementation

### External Tools

- **SQLMap**: https://sqlmap.org/
- **k6**: https://k6.io/docs/
- **OWASP ZAP**: https://www.zaproxy.org/
- **Burp Suite**: https://portswigger.net/burp/communitydownload

### Security Standards

- **OWASP Top 10**: https://owasp.org/Top10/
- **OWASP ASVS**: https://owasp.org/www-project-application-security-verification-standard/
- **CWE Top 25**: https://cwe.mitre.org/top25/

---

## Support

### Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Instead:
1. Email: security@gauzian.pupin.fr (if configured)
2. Or use GitHub Security Advisories (private disclosure)
3. Or contact project maintainer directly

### Getting Help

- **Testing Issues**: Open GitHub issue with label `testing`
- **False Positives**: Review `PENTEST_GUIDE.md` for expected behavior
- **Tool Errors**: Check `Troubleshooting` section above

---

## License

This security testing suite is part of the GAUZIAN project.

**⚠️ IMPORTANT:** These tests should ONLY be run:
- Against systems you own or have explicit permission to test
- In staging/development environments (not production during business hours)
- With awareness that aggressive tests (SQLMap level 5) can impact performance

**Unauthorized security testing is illegal in many jurisdictions.**

---

**Last Updated:** 2026-02-17
**Version:** 1.0
**Maintained By:** GAUZIAN Security Team
