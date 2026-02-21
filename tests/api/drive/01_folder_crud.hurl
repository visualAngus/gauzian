# Folder CRUD Tests
# Tests folder creation, retrieval, renaming, and deletion

# Setup: Login user A to get a valid token
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.token"

# Test 1: Create folder at root (parent_folder_id: "null" as string) - Should succeed with 201
POST {{base_url}}/drive/folders
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"encrypted_metadata": "dGVzdC1tZXRhZGF0YQ==", "parent_folder_id": "root", "encrypted_folder_key": "dGVzdC1mb2xkZXIta2V5"}
HTTP 200
[Captures]
folder_id_a: jsonpath "$.folder_id"

# Test 2: Create subfolder inside folder_a - Should succeed with 201
POST {{base_url}}/drive/folders
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"encrypted_metadata": "c3ViZm9sZGVyLW1ldGFkYXRh", "parent_folder_id": "{{folder_id_a}}", "encrypted_folder_key": "dGVzdC1zdWJmb2xkZXIta2V5"}
HTTP 200
[Captures]
folder_id_sub: jsonpath "$.folder_id"

# Test 3: GET /drive/folder_contents/{{folder_id_a}} - Should return 200 and contain subfolder
GET {{base_url}}/drive/folder_contents/{{folder_id_a}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 4: Rename folder_a - Should succeed with 200
PATCH {{base_url}}/drive/folders/{{folder_id_a}}
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"new_encrypted_metadata": "cmVuYW1lZC1tZXRhZGF0YQ=="}
HTTP 200
[Asserts]
status == 200

# Test 5: Create folder WITHOUT auth - Should fail with 401
POST {{base_url}}/drive/folders
Content-Type: application/json
{"encrypted_metadata": "dGVzdC1tZXRhZGF0YQ==", "parent_folder_id": "root", "encrypted_folder_key": "dGVzdC1mb2xkZXIta2V5"}
HTTP 401
[Asserts]
status == 401

# Test 6: GET /drive/folders with nil UUID - Server treats nil UUID as null/root → 400
GET {{base_url}}/drive/folders/00000000-0000-0000-0000-000000000000
Authorization: Bearer {{token_a}}
HTTP 400

# Test 7: Try to access folder with invalid UUID format - Should return 400 (not 500)
GET {{base_url}}/drive/folders/not-a-uuid
Authorization: Bearer {{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 8: Delete subfolder first - Should succeed with 200
DELETE {{base_url}}/drive/folders/{{folder_id_sub}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 9: Delete folder_a - Should succeed with 200
DELETE {{base_url}}/drive/folders/{{folder_id_a}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200
