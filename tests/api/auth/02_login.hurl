# Login Tests
# Tests authentication functionality including security scenarios

# Test 1: Login with valid credentials - Successful login
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.token"
user_a_id: jsonpath "$.user_id"

# Test 2: Login with wrong password - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "wrong_password_123"}
HTTP 401
[Asserts]
status == 401

# Test 3: Login with non-existent email - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "nonexistent@example.com", "password": "{{test_password}}"}
HTTP 401
[Asserts]
status == 401

# Test 4: Login with missing email field - Should fail with 422 (unprocessable entity)
POST {{base_url}}/login
Content-Type: application/json
{"password": "{{test_password}}"}
HTTP 422

# Test 5: Login with missing password field - Should fail with 422 (unprocessable entity)
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}"}
HTTP 422

# Test 6: SQL Injection attempt in email field - Should fail with 401 (NOT 500)
POST {{base_url}}/login
Content-Type: application/json
{"email": "' OR '1'='1", "password": "anything"}
HTTP 401
[Asserts]
status == 401

# Test 7: SQL Injection attempt with UNION - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "' UNION SELECT * FROM users--", "password": "anything"}
HTTP 401
[Asserts]
status == 401

# Test 8: Empty email field - Should fail with 401 or 422
POST {{base_url}}/login
Content-Type: application/json
{"email": "", "password": "{{test_password}}"}
HTTP *

# Test 9: Empty password field - Should fail with 401 or 422
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": ""}
HTTP *

# Test 10: JSON injection attempt in password - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{\"$ne\": null}"}
HTTP 401
[Asserts]
status == 401

# Test 11: XSS attempt in email - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "<script>alert('xss')</script>@example.com", "password": "{{test_password}}"}
HTTP 401

# Test 12: Brute force attempt 1 - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "wrong1"}
HTTP 401

# Test 13: Brute force attempt 2 - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "wrong2"}
HTTP 401

# Test 14: Brute force attempt 3 - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "wrong3"}
HTTP 401

# Test 15: Brute force attempt 4 - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "wrong4"}
HTTP 401

# Test 16: Brute force attempt 5 - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "wrong5"}
HTTP 401

# Test 17: Brute force attempt 6 - This should trigger rate limiting (429)
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "wrong6"}
HTTP 429

# Test 18: Valid login with USER B (not rate-limited) to confirm API still works
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_b}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_b: jsonpath "$.token"
user_b_id: jsonpath "$.user_id"
