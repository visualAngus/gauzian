# GAUZIAN Pre-Deployment Security Checklist

**Version:** 1.0
**Last Updated:** 2026-02-17
**Purpose:** Comprehensive security validation before production deployment

---

## How to Use This Checklist

1. **Before Each Release**: Go through all sections and check off completed items
2. **Document Exceptions**: If an item cannot be completed, document why in `SECURITY_RISKS.md`
3. **Re-Test After Fixes**: Re-run security tests after any security-related code changes
4. **Track Progress**: Use this as a living document, updating as new security controls are added

---

## 🔐 1. Authentication & Session Management

### Password Security

- [ ] **Password hashing uses Argon2id** (not MD5, SHA1, plain SHA256)
  - Verify: Check `auth/services.rs::hash_password()` uses `Argon2::default()`
  - Test: Create new user, inspect `password_hash` in DB (should start with `$argon2id$`)

- [ ] **Legacy SHA256 hashes are being migrated**
  - Plan: Add migration script to re-hash on next login
  - Document: Track % of users still on SHA256 in metrics

- [ ] **Password complexity enforced**
  - Frontend: Minimum 12 characters, mixed case, numbers, special chars
  - Backend: Validate in `register_handler()` (not just frontend)
  - Test: Try registering with weak passwords

- [ ] **Password reset mechanism is secure** (if implemented)
  - Uses cryptographically random tokens (not predictable)
  - Tokens expire after 1 hour
  - Tokens are single-use only
  - Old password required for password change

---

### JWT Security

- [ ] **JWT_SECRET is strong and random**
  ```bash
  # Verify secret is 256+ bits (64 hex chars minimum)
  kubectl get secret backend-secrets -n gauzian-v2 -o json | \
    jq -r '.data.JWT_SECRET' | base64 -d | wc -c
  # Should output: ≥ 32 (bytes)
  ```

- [ ] **JWT expiration is reasonable**
  - Current: 10 days (`auth/services.rs::create_jwt()`)
  - Consider: Shorter expiry (1-7 days) + refresh token mechanism

- [ ] **JWT signature algorithm is secure**
  - Verify: `jsonwebtoken::Header::default()` uses HS256 (not `none`)
  - Test: Run `auth_bypass_test.py --test algorithm_confusion`

- [ ] **JWT blacklist (logout) works correctly**
  - Verify: Redis key `revoked:<jti>` is set on logout
  - Test: Login → Logout → Try to use token (should fail with 401)
  - Fail-closed: Test with Redis down (should deny access, not bypass)

- [ ] **JWT contains minimal information**
  - Current claims: `id`, `role`, `jti`, `exp`
  - ⚠️ Do NOT include: `password_hash`, `encrypted_private_key`, sensitive data

---

### Brute-Force Protection

- [ ] **Login endpoint has rate limiting**
  - Traefik middleware: 100 req/s per IP
  - **TODO**: Implement per-user rate limiting (5 failed attempts per 15 min)
  - Test: Run `k6 run tests/k6/pentest/auth-brute-force.js`
  - Expected: HTTP 429 after threshold

- [ ] **Account lockout after failed attempts** (optional but recommended)
  - Implementation: Add `failed_login_attempts` counter in Redis
  - Lock account for 15 minutes after 5 failed attempts
  - Notify user via email

- [ ] **CAPTCHA on repeated failures** (optional)
  - After 3 failed attempts, require CAPTCHA
  - Use: hCaptcha or reCAPTCHA v3

---

### Session Security

- [ ] **Cookie flags are secure**
  ```rust
  // Verify in response.rs::IntoResponse
  Cookie::build(("auth_token", token))
      .http_only(true)       // ✅ Prevents XSS access
      .secure(true)          // ✅ HTTPS only (check COOKIE_SECURE env var)
      .same_site(SameSite::Lax)  // ✅ CSRF protection
  ```

- [ ] **Session fixation prevented**
  - New JTI generated on each login (not reused)
  - Test: Run `auth_bypass_test.py --test session_fixation`

- [ ] **Concurrent session limit** (optional)
  - Track active sessions per user in Redis
  - Invalidate oldest session when limit exceeded

---

## 🛡️ 2. Authorization & Access Control

### IDOR (Insecure Direct Object Reference) Prevention

- [ ] **All file operations check ownership**
  - `drive/handlers.rs::download_file_handler()` → `repo::check_file_access()`
  - `drive/handlers.rs::delete_file_handler()` → verify `access_level = 'owner'`
  - Test: Run `idor_enumeration.py` with two different users

- [ ] **UUID validation is strict**
  - All UUIDs parsed via `services::parse_uuid_or_error()`
  - Invalid UUIDs return 400 Bad Request (not 500 Internal Server Error)
  - Test: Send malformed UUIDs like `'; DROP TABLE files; --`

- [ ] **Horizontal privilege escalation prevented**
  - User A cannot access User B's files
  - Test: User A creates file → User B tries to access (should fail)

- [ ] **Vertical privilege escalation prevented**
  - `viewer` cannot delete files
  - `editor` cannot share files (only `owner`)
  - Test: Share file as `viewer` → try to delete (should fail)

---

### Permission Hierarchy

- [ ] **Folder permissions cascade correctly**
  - Share folder → all children inherit permissions
  - Test: `propagate_folder_access()` with nested folders

- [ ] **Revoke access is complete**
  - Revoking folder access removes access to all children
  - Test: Share folder → revoke → verify child files inaccessible

- [ ] **Default permissions are least-privilege**
  - New files default to `private` (no sharing)
  - New shares default to `viewer` (not `owner`)

---

## 🔒 3. Cryptographic Controls

### End-to-End Encryption (E2EE)

- [ ] **Server never sees plaintext data**
  - All file names encrypted (stored as `encrypted_metadata` in DB)
  - All file content encrypted (chunks in S3)
  - Test: Upload file → inspect DB & S3 → no plaintext found

- [ ] **Encryption algorithms are strong**
  - RSA-4096 (OAEP, SHA-256) for key wrapping
  - AES-256-GCM for file encryption
  - PBKDF2 (SHA-256, 310k iterations) for password derivation
  - ⚠️ Consider: Argon2 for password KDF (more secure than PBKDF2)

- [ ] **IVs are unique per encryption**
  - Each chunk uses a unique IV
  - IVs are cryptographically random (not sequential/predictable)

- [ ] **Private keys are protected**
  - Encrypted with user's password before storage
  - Never sent to server in plaintext
  - Test: Inspect `encrypted_private_key` column (should be AES-GCM ciphertext)

---

### Key Management

- [ ] **No hardcoded secrets in code**
  ```bash
  # Search for potential secrets
  grep -r "password\s*=\s*['\"]" gauzian_back/src/
  grep -r "secret\s*=\s*['\"]" gauzian_back/src/
  grep -r "apiKey\s*=\s*['\"]" gauzian_back/src/
  ```

- [ ] **Secrets stored in Kubernetes Secrets**
  - JWT_SECRET
  - DATABASE_PASSWORD
  - REDIS_PASSWORD
  - S3_ACCESS_KEY, S3_SECRET_KEY
  - MINIO_ROOT_PASSWORD
  - Verify: `kubectl get secrets -n gauzian-v2`

- [ ] **Secrets are rotated regularly** (recommended: quarterly)
  - Document rotation procedure in `docs/SECRET_ROTATION.md`
  - Test rotation in staging before production

- [ ] **TLS certificates are valid and auto-renewed**
  - Check expiry: `echo | openssl s_client -connect gauzian.pupin.fr:443 2>/dev/null | openssl x509 -noout -dates`
  - Verify Let's Encrypt auto-renewal is configured (Traefik cert-manager)

---

## 🚫 4. Injection Prevention

### SQL Injection

- [ ] **SQLx compile-time query validation**
  - All queries use `sqlx::query!()` macro (not raw `query()`)
  - Test: Run SQLMap full test suite
  ```bash
  ./tests/security/sqlmap_test.sh
  ```

- [ ] **No dynamic SQL construction**
  - Search for string concatenation in SQL:
  ```bash
  grep -r "format!.*SELECT" gauzian_back/src/
  grep -r "format!.*INSERT" gauzian_back/src/
  ```

- [ ] **Input validation on all parameters**
  - UUIDs validated via `Uuid::parse_str()`
  - Emails validated via regex (RFC 5322 subset)
  - File sizes checked against quotas

---

### NoSQL Injection (Redis)

- [ ] **Redis commands use parameterized queries**
  - Verify `redis::Commands` trait methods (not raw `CMD`)
  - JTI values sanitized before Redis `SET` command

- [ ] **No user input in Redis keys**
  - Keys follow pattern: `revoked:<jti>` (JTI is UUID, not user input)

---

### Command Injection

- [ ] **No shell commands executed with user input**
  ```bash
  # Search for potential command injection
  grep -r "Command::new" gauzian_back/src/
  grep -r "std::process" gauzian_back/src/
  ```

- [ ] **S3 keys sanitized**
  - Pattern: `chunks/<file_id>/<chunk_index>`
  - No path traversal: `../../etc/passwd`
  - Test: Try uploading chunk with malicious `s3_key`

---

## 🌐 5. Network Security

### TLS/SSL Configuration

- [ ] **TLS 1.3 enabled, TLS 1.0/1.1 disabled**
  ```bash
  testssl.sh https://gauzian.pupin.fr
  ```

- [ ] **Strong cipher suites only**
  - Prefer: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256
  - Disable: RC4, DES, 3DES, MD5-based ciphers

- [ ] **HSTS header configured**
  ```bash
  curl -I https://gauzian.pupin.fr | grep -i strict-transport-security
  # Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains
  ```

- [ ] **HSTS preload list submission** (optional but recommended)
  - Submit to: https://hstspreload.org/
  - Requires: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

---

### CORS Policy

- [ ] **CORS allows only trusted origins**
  ```bash
  # Test CORS with malicious origin
  curl -H "Origin: https://evil.com" \
       -H "Access-Control-Request-Method: POST" \
       -X OPTIONS https://gauzian.pupin.fr/api/login -v
  # Expected: No Access-Control-Allow-Origin header
  ```

- [ ] **Credentials not allowed for wildcard origins**
  - Never: `Access-Control-Allow-Origin: *` + `Access-Control-Allow-Credentials: true`

---

### Security Headers

- [ ] **All security headers present**
  ```bash
  curl -I https://gauzian.pupin.fr
  ```
  Expected headers:
  - ✅ `X-Content-Type-Options: nosniff`
  - ✅ `X-Frame-Options: DENY`
  - ✅ `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'`
  - ✅ `Referrer-Policy: strict-origin-when-cross-origin`
  - ✅ `Permissions-Policy: geolocation=(), camera=(), microphone=()`

---

## 📊 6. Logging & Monitoring

### Security Event Logging

- [ ] **Authentication events logged**
  - Successful logins (user_id, IP, timestamp)
  - Failed logins (email, IP, timestamp)
  - Logout events
  - Verify: Check Grafana dashboard or `kubectl logs -n gauzian-v2 -l app=backend`

- [ ] **Authorization failures logged**
  - IDOR attempts (user tried to access file_id they don't own)
  - Privilege escalation attempts

- [ ] **Sensitive data NOT logged**
  - ⚠️ Never log: `password`, `password_hash`, `JWT_SECRET`, `encrypted_private_key`
  - Search logs for leaks:
  ```bash
  kubectl logs -n gauzian-v2 -l app=backend --tail=1000 | grep -i "password"
  ```

---

### Monitoring & Alerting

- [ ] **Prometheus metrics configured**
  - `gauzian_request_duration_seconds`
  - `gauzian_requests_total`
  - `gauzian_active_connections`
  - `gauzian_db_pool_active`
  - `gauzian_redis_cache_hits`
  - `gauzian_file_operations_total`
  - Verify: `curl https://gauzian.pupin.fr/metrics`

- [ ] **Grafana dashboards created**
  - Application performance dashboard
  - Security monitoring dashboard (failed logins, IDOR attempts)

- [ ] **Alerts configured** (optional but recommended)
  - High error rate (> 5% 5xx responses)
  - Database connection pool exhausted
  - Redis down (fail-closed triggers)
  - Unusual spike in failed logins

---

## 🏗️ 7. Infrastructure Security (Kubernetes)

### Pod Security

- [ ] **Pods run as non-root user**
  ```yaml
  # Check deployment.yaml
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
  ```

- [ ] **Read-only root filesystem** (where applicable)
  ```yaml
  securityContext:
    readOnlyRootFilesystem: true
  ```

- [ ] **No privileged containers**
  ```bash
  kubectl get pods -n gauzian-v2 -o json | jq '.items[].spec.containers[].securityContext.privileged'
  # Should all be: null or false
  ```

---

### Network Policies

- [ ] **Backend can only talk to DB, Redis, MinIO**
  ```bash
  kubectl get networkpolicies -n gauzian-v2
  ```

- [ ] **PostgreSQL not accessible from outside cluster**
  ```bash
  kubectl get svc -n gauzian-v2 postgres
  # Type should be: ClusterIP (not LoadBalancer or NodePort)
  ```

- [ ] **Redis not accessible from outside cluster**
  ```bash
  kubectl get svc -n gauzian-v2 redis
  # Type should be: ClusterIP
  ```

---

### Secrets Management

- [ ] **Secrets not in ConfigMaps**
  ```bash
  kubectl get configmaps -n gauzian-v2 -o yaml | grep -i "password\|secret\|key"
  # Should return: nothing
  ```

- [ ] **Secrets encrypted at rest** (etcd encryption)
  - Verify K8s cluster has encryption-at-rest enabled
  - Check with cluster admin if uncertain

- [ ] **Secrets not committed to Git**
  ```bash
  git log --all --full-history --oneline --source -- '*secret*.yaml' '*password*'
  ```

---

### Resource Limits

- [ ] **CPU and memory limits set**
  ```yaml
  resources:
    limits:
      cpu: 500m
      memory: 1Gi
    requests:
      cpu: 100m
      memory: 512Mi
  ```

- [ ] **HPA (Horizontal Pod Autoscaler) configured**
  ```bash
  kubectl get hpa -n gauzian-v2
  # Should show backend HPA with min=2, max=10
  ```

---

## 🧪 8. Security Testing

### Automated Tests

- [ ] **All security tests passing**
  ```bash
  ./tests/security/run_all_tests.sh --full
  ```

- [ ] **SQLMap finds no SQL injections**
  ```bash
  ./tests/security/sqlmap_test.sh
  grep -r "sqlmap identified.*injection" ./sqlmap_reports/
  # Should return: nothing
  ```

- [ ] **IDOR tests all pass**
  ```bash
  python3 tests/security/scripts/idor_enumeration.py \
    --user-a user1@example.com --password-a pass1 \
    --user-b user2@example.com --password-b pass2
  # Exit code should be: 0
  ```

- [ ] **Auth bypass tests all pass**
  ```bash
  python3 tests/security/scripts/auth_bypass_test.py \
    --user test@example.com --password SecurePass123!
  # Exit code should be: 0
  ```

---

### Dependency Security

- [ ] **No known vulnerabilities in dependencies**
  ```bash
  cd gauzian_back
  cargo audit
  # Should report: no vulnerabilities found
  ```

- [ ] **Dependencies are up-to-date**
  ```bash
  cargo outdated
  # Update critical security patches
  ```

- [ ] **Docker base images are up-to-date**
  ```dockerfile
  # Check Dockerfile
  FROM rust:1.75-alpine  # Use latest stable
  ```

- [ ] **Scan Docker images for vulnerabilities**
  ```bash
  docker scan angusvisual/gauzian-backend:dev
  # Or use: trivy image angusvisual/gauzian-backend:dev
  ```

---

## 📝 9. Compliance & Documentation

### Documentation

- [ ] **Security architecture documented**
  - `docs/SECURITY_ARCHITECTURE.md` exists and is current
  - E2EE workflow documented in `gauzian_front/docs/CRYPTO_ARCHITECTURE.md`

- [ ] **Security testing procedures documented**
  - `tests/security/PENTEST_GUIDE.md` is complete
  - Test results saved in `tests/security/reports/`

- [ ] **Incident response plan exists**
  - `docs/INCIDENT_RESPONSE.md` (who to contact, steps to take)

- [ ] **Accepted security risks documented**
  - `SECURITY_RISKS.md` lists known issues with mitigation plans

---

### Privacy & Data Protection

- [ ] **Privacy policy exists and is accurate**
  - Explains E2EE, what data is stored, data retention

- [ ] **GDPR compliance** (if applicable)
  - Users can export their data
  - Users can delete their account (right to be forgotten)
  - Data minimization: only collect necessary data

- [ ] **Data breach notification procedure**
  - How to detect breaches (monitoring)
  - Who to notify (users, authorities)
  - Timeline for notification

---

## ✅ 10. Final Checks

### Pre-Deployment

- [ ] **All items in this checklist completed or documented as accepted risk**

- [ ] **Security test report reviewed by team lead**

- [ ] **Critical vulnerabilities remediated**

- [ ] **Staging environment matches production** (same configs, same secrets rotation)

- [ ] **Rollback plan prepared** (in case security issue found post-deployment)

---

### Post-Deployment

- [ ] **Monitor logs for 24 hours after deployment**

- [ ] **Run smoke tests on production**
  ```bash
  ./tests/security/run_all_tests.sh --quick --url https://gauzian.pupin.fr
  ```

- [ ] **Verify monitoring/alerting is working**

- [ ] **Document deployment in DEVELOPMENT_LOG.md**

---

## 📅 Recurring Tasks

### Weekly

- [ ] Review authentication logs for suspicious activity
- [ ] Check Grafana dashboards for anomalies

### Monthly

- [ ] Run `cargo audit`
- [ ] Update dependencies with security patches
- [ ] Review and rotate secrets if needed

### Quarterly

- [ ] Full security test suite (`run_all_tests.sh --full`)
- [ ] External penetration test (if budget allows)
- [ ] Review and update this checklist

---

## 📞 Contacts

**Security Team:**
- Security Lead: [Name] ([email])
- DevOps Lead: [Name] ([email])

**External Resources:**
- Bug Bounty Program: [Link if applicable]
- Security Email: security@gauzian.pupin.fr

---

**Last Review:** [Date]
**Next Review:** [Date + 3 months]
**Reviewed By:** [Name]
