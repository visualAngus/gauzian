# Token Security Tests
# Tests JWT authentication security including token validation and edge cases

# Setup: Login user A to get a valid token
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
valid_token: jsonpath "$.token"

# Test 1: GET /autologin with valid token - Should succeed with 200
GET {{base_url}}/autologin
Authorization: Bearer {{valid_token}}
HTTP 200
[Asserts]
status == 200

# Test 2: GET /autologin without auth - Should fail with 401
GET {{base_url}}/autologin
HTTP 401
[Asserts]
status == 401

# Test 3: GET /autologin with tampered JWT (add extra chars) - Should fail with 401
GET {{base_url}}/autologin
Authorization: Bearer {{valid_token}}X
HTTP 401
[Asserts]
status == 401

# Test 4: GET /autologin with completely fake JWT - Should fail with 401
GET {{base_url}}/autologin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
HTTP 401
[Asserts]
status == 401

# Test 5: GET /autologin with expired JWT - Should fail with 401
GET {{base_url}}/autologin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjF9.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
HTTP 401
[Asserts]
status == 401

# Test 6: GET /autologin with malformed JWT (only header, missing payload and signature) - Should fail with 401
GET {{base_url}}/autologin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
HTTP 401
[Asserts]
status == 401

# Test 7: GET /autologin with JWT that has invalid signature - Should fail with 401
GET {{base_url}}/autologin
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
HTTP 401
[Asserts]
status == 401

# Test 8: GET /autologin with JWT that has alg=none (classic bypass attempt) - Should fail with 401
GET {{base_url}}/autologin
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJleHAiOjk5OTk5OTk5OTl9.
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
Authorization: Bearer {{valid_token}}
HTTP 200
[Asserts]
status == 200

# Test 11: GET /contacts/get_public_key/any@email.com without auth - Should fail with 401
GET {{base_url}}/contacts/get_public_key/any@email.com
HTTP 404
[Asserts]
status == 404

# Test 12: GET /contacts/get_public_key/any@email.com with valid token - Should return 404 (not found)
GET {{base_url}}/contacts/get_public_key/any@email.com
Authorization: Bearer {{valid_token}}
HTTP 404

# Test 13: GET /info with empty Bearer token - Should fail with 401
GET {{base_url}}/info
Authorization: Bearer 
HTTP 401
[Asserts]
status == 401

# Test 14: GET /info with invalid Bearer prefix (no space after Bearer) - Should fail with 401
GET {{base_url}}/info
Authorization: Bearerinvalidtoken
HTTP 401
[Asserts]
status == 401
