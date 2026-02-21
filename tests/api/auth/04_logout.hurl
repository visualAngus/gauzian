# Logout Tests
# Tests logout functionality and token blacklisting after logout

# Test 1: Login user A to get a valid token
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.data.token"

# Test 2: Verify token works before logout
GET {{base_url}}/autologin
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 3: Logout with valid token - Should succeed with 200
POST {{base_url}}/logout
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 4: Try to use the same token after logout - Should fail with 401 (token blacklisted)
GET {{base_url}}/autologin
Authorization: Bearer {{token_a}}
HTTP 401
[Asserts]
status == 401

# Test 5: Try to logout again with the same (now blacklisted) token - Should fail with 401
POST {{base_url}}/logout
Authorization: Bearer {{token_a}}
HTTP 401
[Asserts]
status == 401

# Test 6: Login again to get a fresh token
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
fresh_token: jsonpath "$.data.token"

# Test 7: Verify fresh token works
GET {{base_url}}/autologin
Authorization: Bearer {{fresh_token}}
HTTP 200
[Asserts]
status == 200

# Test 8: Logout with the fresh token
POST {{base_url}}/logout
Authorization: Bearer {{fresh_token}}
HTTP 200

# Test 9: Verify fresh token is now blacklisted
GET {{base_url}}/autologin
Authorization: Bearer {{fresh_token}}
HTTP 401

# Test 10: Logout without any token - Should fail with 401
POST {{base_url}}/logout
HTTP 401
[Asserts]
status == 401

# Test 11: Try to access protected endpoint with just "Bearer " prefix - Should fail
GET {{base_url}}/info
Authorization: Bearer 
HTTP 401

# Test 12: Try to access protected endpoint with invalid Bearer token - Should fail
GET {{base_url}}/info
Authorization: Bearer invalid_token_here
HTTP 401
