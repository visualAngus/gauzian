# Token Security Tests
# Tests JWT authentication security including token validation and edge cases

# Setup: Login user A to get a valid token
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
valid_token: cookie "auth_token"

# Test 1: GET /autologin with valid token - Should succeed with 200
GET {{base_url}}/autologin
Cookie: auth_token={{valid_token}}
HTTP 200
[Asserts]
status == 200
jsonpath "$.user_id" exists

# Test 2: GET /autologin without auth cookie - Should fail with 401
GET {{base_url}}/autologin
HTTP 401
[Asserts]
status == 401

# Test 3: GET /autologin with tampered JWT (change last char) - Should fail with 401
GET {{base_url}}/autologin
Cookie: auth_token={{valid_token}}X
HTTP 401
[Asserts]
status == 401

# Test 4: GET /autologin with completely fake JWT - Should fail with 401
GET {{base_url}}/autologin
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
HTTP 401
[Asserts]
status == 401

# Test 5: GET /autologin with expired JWT - Crafted expired token
# This token has exp: 1600000000 (Sep 13, 2020)
GET {{base_url}}/autologin
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsInJvbGUiOiJ1c2VyIiwiZXhwIjoxNjAwMDAwMDAwLCJqdGkiOiJ0ZXN0In0.fake
HTTP 401
[Asserts]
status == 401

# Test 6: GET /autologin with malformed JWT (missing parts) - Should fail with 401
GET {{base_url}}/autologin
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
HTTP 401
[Asserts]
status == 401

# Test 7: GET /autologin with JWT that has invalid signature - Should fail with 401
GET {{base_url}}/autologin
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsInJvbGUiOiJ1c2VyIiwiZXhwIjo5OTk5OTk5OTk5LCJqdGkiOiJ0ZXN0In0.invalid_signature_that_does_not_match
HTTP 401
[Asserts]
status == 401

# Test 8: GET /autologin with JWT that has invalid algorithm (none) - Should fail with 401
GET {{base_url}}/autologin
Cookie: auth_token=eyJhbGciOiJub25lIiwInR5cCI6IkpXVCJ9.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCJ9.
HTTP 401
[Asserts]
status == 401

# Test 9: GET /info without auth - Should fail with 401
GET {{base_url}}/info
HTTP 401
[Asserts]
status == 401

# Test 10: GET /info with valid token - Should succeed with 200
GET {{base_url}}/info
Cookie: auth_token={{valid_token}}
HTTP 200
[Asserts]
status == 200

# Test 11: GET /contacts/get_public_key/any@email.com without auth - Should fail with 401
GET {{base_url}}/contacts/get_public_key/any@email.com
HTTP 401
[Asserts]
status == 401

# Test 12: GET /contacts/get_public_key/any@email.com with valid token - Should succeed (returns 404 if not found)
GET {{base_url}}/contacts/get_public_key/any@email.com
Cookie: auth_token={{valid_token}}
HTTP 404

# Test 13: GET /info with empty token - Should fail with 401
GET {{base_url}}/info
Cookie: auth_token=
HTTP 401
[Asserts]
status == 401

# Test 14: GET /info with token that has extra whitespace - Should fail with 401
GET {{base_url}}/info
Cookie: auth_token=  {{valid_token}}
HTTP 401
[Asserts]
status == 401
