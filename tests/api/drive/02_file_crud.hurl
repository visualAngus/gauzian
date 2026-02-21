# File CRUD Tests
# Tests file creation, upload, retrieval, renaming, and deletion

# Setup: Login user A to get a valid token
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.token"

# Setup: Create a folder to hold our test files
POST {{base_url}}/drive/folders
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"encrypted_metadata": "ZmlsZWZvbGRlci1tZXRhZGF0YQ==", "parent_folder_id": "root", "encrypted_folder_key": "ZmlsZWZvbGRlci1rZXk="}
HTTP 200
[Captures]
folder_id: jsonpath "$.folder_id"

# Test 1: Initialize file upload - Should succeed with 200
POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"size": 1024, "encrypted_metadata": "ZmlsZS1tZXRhZGF0YQ==", "mime_type": "text/plain", "folder_id": "{{folder_id}}", "encrypted_file_key": "ZmlsZS1rZXk="}
HTTP 200
[Captures]
file_id: jsonpath "$.file_id"

# Test 2: Upload a chunk - Should succeed with 200
POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id}}", "index": 0, "chunk_data": "dGVzdC1jaHVuaw==", "iv": "dGVzdC1pdg=="}
HTTP 200
[Asserts]
status == 200

# Test 3: Finalize upload with etat "success" - Should succeed with 200
POST {{base_url}}/drive/finalize_upload/{{file_id}}/completed
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 4: GET /drive/file/{{file_id}} - Should succeed with 200
GET {{base_url}}/drive/files/{{file_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 5: Rename file - Should succeed with 200
PATCH {{base_url}}/drive/files/{{file_id}}
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"new_encrypted_metadata": "cmVuYW1lZC1maWxlLW1ldGFkYXRh"}
HTTP 200
[Asserts]
status == 200

# Test 6: Delete file - Should succeed with 200
DELETE {{base_url}}/drive/files/{{file_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 7: Initialize file WITHOUT auth - Should fail with 401
POST {{base_url}}/drive/initialize_file
Content-Type: application/json
{"size": 1024, "encrypted_metadata": "ZmlsZS1tZXRhZGF0YQ==", "mime_type": "text/plain", "folder_id": "{{folder_id}}", "encrypted_file_key": "ZmlsZS1rZXk="}
HTTP 401
[Asserts]
status == 401

# Test 8: Delete folder - Should succeed with 200
DELETE {{base_url}}/drive/folders/{{folder_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200
