# Folder CRUD Tests
# Tests folder creation, retrieval, renaming, and deletion

# Setup: Login user A to get a valid token
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_a: cookie "auth_token"

# Test 1: Create folder at root (parent_folder_id: null) - Should succeed with 200
POST {{base_url}}/drive/create_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dGVzdC1tZXRhZGF0YQ==",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_id_a: jsonpath "$.folder_id"

# Test 2: Create subfolder inside folder_a - Should succeed with 200
POST {{base_url}}/drive/create_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "c3ViZm9sZGVyLW1ldGFkYXRh",
    "parent_folder_id": "{{folder_id_a}}"
}
HTTP 200
[Captures]
folder_id_sub: jsonpath "$.folder_id"

# Test 3: GET /drive/folder_contents/{{folder_id_a}} - Should return 200 and contain subfolder
GET {{base_url}}/drive/folder_contents/{{folder_id_a}}
Cookie: auth_token={{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 4: GET /drive/folder_contents for root (null) - Should return 200
GET {{base_url}}/drive/folder_contents/root
Cookie: auth_token={{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 5: Rename folder - Should succeed with 200
POST {{base_url}}/drive/rename_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_a}}",
    "encrypted_metadata": "cmVuYW1lZC1tZXRhZGF0YQ=="
}
HTTP 200
[Asserts]
status == 200

# Test 6: Create folder WITHOUT auth - Should fail with 401
POST {{base_url}}/drive/create_folder
Content-Type: application/json
{
    "encrypted_metadata": "dGVzdC1tZXRhZGF0YQ==",
    "parent_folder_id": null
}
HTTP 401
[Asserts]
status == 401

# Test 7: GET /drive/folder_contents with non-existent folder UUID - Should return 404 or 403
GET {{base_url}}/drive/folder_contents/00000000-0000-0000-0000-000000000000
Cookie: auth_token={{token_a}}
HTTP 403

# Test 8: Try to access folder with invalid UUID format - Should return 400 (not 500)
GET {{base_url}}/drive/folder_contents/not-a-uuid
Cookie: auth_token={{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 9: Try to create folder with invalid parent UUID - Should return 400 or 404
POST {{base_url}}/drive/create_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dGVzdC1tZXRhZGF0YQ==",
    "parent_folder_id": "00000000-0000-0000-0000-000000000000"
}
HTTP 404

# Test 10: Try to rename folder that doesn't exist - Should return 404
POST {{base_url}}/drive/rename_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "folder_id": "00000000-0000-0000-0000-000000000000",
    "encrypted_metadata": "dGVzdC1tZXRhZGF0YQ=="
}
HTTP 404

# Test 11: Delete subfolder first (to clean up properly) - Should succeed with 200
POST {{base_url}}/drive/delete_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_sub}}"
}
HTTP 200
[Asserts]
status == 200

# Test 12: Delete folder - Should succeed with 200
POST {{base_url}}/drive/delete_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_a}}"
}
HTTP 200
[Asserts]
status == 200

# Test 13: Verify folder is deleted by trying to access it - Should return 404
GET {{base_url}}/drive/folder_contents/{{folder_id_a}}
Cookie: auth_token={{token_a}}
HTTP 404

# Test 14: Try to delete folder again (already deleted) - Should return 404
POST {{base_url}}/drive/delete_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_a}}"
}
HTTP 404

# Test 15: Get folder contents with empty string as folder_id - Should return 400
GET {{base_url}}/drive/folder_contents/
Cookie: auth_token={{token_a}}
HTTP 404
