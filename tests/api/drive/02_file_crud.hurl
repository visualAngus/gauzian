# File CRUD Tests
# Tests file creation, upload, retrieval, renaming, and deletion

# Setup: Login user A to get a valid token
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.data.token"

# Setup: Create a folder to hold our test files
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"encrypted_metadata": "ZmlsZWZvbGRlci1tZXRhZGF0YQ==", "parent_folder_id": "null", "encrypted_folder_key": "ZmlsZWZvbGRlci1rZXk="}
HTTP 201
[Captures]
folder_id: jsonpath "$.data.folder_id"

# Test 1: Initialize file upload - Should succeed with 200
POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"size": 1024, "encrypted_metadata": "ZmlsZS1tZXRhZGF0YQ==", "mime_type": "text/plain", "folder_id": "{{folder_id}}", "encrypted_file_key": "ZmlsZS1rZXk="}
HTTP 200
[Captures]
file_id: jsonpath "$.data.file_id"

# Test 2: Upload a chunk - Should succeed with 200
POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id}}", "chunk_index": 0, "total_chunks": 1, "encrypted_chunk": "dGVzdC1jaHVuaw==", "iv": "dGVzdC1pdg=="}
HTTP 200
[Asserts]
status == 200

# Test 3: Finalize upload with etat "success" - Should succeed with 200
POST {{base_url}}/drive/finalize_upload/{{file_id}}/success
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 4: GET /drive/file/{{file_id}} - Should succeed with 200
GET {{base_url}}/drive/file/{{file_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 5: Rename file - Should succeed with 200
POST {{base_url}}/drive/rename_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id}}", "encrypted_metadata": "cmVuYW1lZC1maWxlLW1ldGFkYXRh"}
HTTP 200
[Asserts]
status == 200

# Test 6: Delete file - Should succeed with 200
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id}}"}
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
POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"folder_id": "{{folder_id}}"}
HTTP 200
[Asserts]
status == 200
