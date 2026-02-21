# Login Tests
# Tests authentication functionality including security scenarios

# Test 1: Login with valid credentials - Successful login
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_a: cookie "auth_token"

# Test 2: Login with wrong password - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "wrong_password_123"
}
HTTP 401
[Asserts]
status == 401

# Test 3: Login with non-existent email - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "nonexistent@example.com",
    "password": "{{test_password}}"
}
HTTP 401
[Asserts]
status == 401

# Test 4: Login with missing email field - Should fail with 400
POST {{base_url}}/login
Content-Type: application/json
{
    "password": "{{test_password}}"
}
HTTP 400
[Asserts]
status == 400

# Test 5: Login with missing password field - Should fail with 400
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}"
}
HTTP 400
[Asserts]
status == 400

# Test 6: SQL Injection attempt in email field - Should fail with 401 (NOT 500)
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "' OR '1'='1",
    "password": "anything"
}
HTTP 401
[Asserts]
status == 401

# Test 7: SQL Injection attempt with UNION - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "' UNION SELECT * FROM users--",
    "password": "anything"
}
HTTP 401
[Asserts]
status == 401

# Test 8: Very long email (500 chars) - Should not cause 500 error
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "test@example.comaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "password": "{{test_password}}"
}
HTTP 400
[Asserts]
status != 500

# Test 9: Empty email field - Should fail with 400
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "",
    "password": "{{test_password}}"
}
HTTP 400
[Asserts]
status == 400

# Test 10: Empty password field - Should fail with 400
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": ""
}
HTTP 400
[Asserts]
status == 400

# Test 11: JSON injection attempt in password - Should fail with 401
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "{\"$ne\": null}"
}
HTTP 401
[Asserts]
status == 401

# Test 12: XSS attempt in email - Should fail with 400 or 401
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "<script>alert('xss')</script>@example.com",
    "password": "{{test_password}}"
}
HTTP 401

# Test 13: Brute force simulation - 6 rapid failed logins - Should trigger rate limiting
# Attempt 1
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "wrong1"
}
HTTP 401

# Attempt 2
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "wrong2"
}
HTTP 401

# Attempt 3
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "wrong3"
}
HTTP 401

# Attempt 4
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "wrong4"
}
HTTP 401

# Attempt 5
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "wrong5"
}
HTTP 401

# Attempt 6 - This should be rate limited (429 Too Many Requests)
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "wrong6"
}
HTTP 429

# Note: Test 14 (valid login after rate limit cooldown) is intentionally omitted.
# The rate limit window must expire server-side before user_a can login again.
# This is verified separately by the CI pipeline after sufficient delay,
# or by using a different email not subject to the rate limit.

# Test 14: Valid login with USER B (not rate-limited) to confirm API still works
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_b}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_b: cookie "auth_token"
