# Registration Tests
# Tests user registration functionality including edge cases and security

# Test 1: Register User A - Successful registration
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "username": "{{test_username_a}}",
    "password": "{{test_password}}",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 200
[Captures]
user_id_a: jsonpath "$.user_id"

# Test 2: Register with SAME email - Should fail with 409 Conflict
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "username": "different_username",
    "password": "{{test_password}}",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 409
[Asserts]
status == 409

# Test 3: Register with missing password field - Should fail with 400
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "newuser@example.com",
    "username": "newuser",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 400
[Asserts]
status == 400

# Test 4: Register with missing email field - Should fail with 400
POST {{base_url}}/register
Content-Type: application/json
{
    "username": "anotheruser",
    "password": "{{test_password}}",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 400
[Asserts]
status == 400

# Test 5: Register with invalid email format - Should fail with 400
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "not-an-email",
    "username": "invalidemail",
    "password": "{{test_password}}",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 400
[Asserts]
status == 400

# Test 6: Register with empty string email - Should fail with 400
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "",
    "username": "emptyemail",
    "password": "{{test_password}}",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 400
[Asserts]
status == 400

# Test 7: Register with missing username - Should fail with 400
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "missingusername@example.com",
    "password": "{{test_password}}",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 400
[Asserts]
status == 400

# Test 8: Register with missing required E2EE fields - Should fail with 400
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "missingkeys@example.com",
    "username": "missingkeys",
    "password": "{{test_password}}"
}
HTTP 400
[Asserts]
status == 400

# Test 9: Register with empty password - Should fail with 400
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "emptypassword@example.com",
    "username": "emptypassword",
    "password": "",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 400
[Asserts]
status == 400
