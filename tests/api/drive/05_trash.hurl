# Trash Tests
# Tests trash/empty trash functionality and permanent deletion

# Setup: Login User A
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.token"

# Setup: Create a test folder
POST {{base_url}}/drive/folders
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"encrypted_metadata": "dHJhc2gtZm9sZGVyLW1ldGFkYXRh", "parent_folder_id": "root", "encrypted_folder_key": "dHJhc2gtZm9sZGVyLWtleQ=="}
HTTP 200
[Captures]
folder_id: jsonpath "$.folder_id"

# Setup: Create a test file
POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"size": 1024, "encrypted_metadata": "dHJhc2gtZmlsZS1tZXRhZGF0YQ==", "mime_type": "text/plain", "folder_id": "{{folder_id}}", "encrypted_file_key": "dHJhc2gtZmlsZS1rZXk="}
HTTP 200
[Captures]
file_id: jsonpath "$.file_id"

# Upload chunk and finalize
POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id}}", "index": 0, "chunk_data": "dHJhc2gtZmlsZS1jaHVuaw==", "iv": "dHJhc2g="}
HTTP 200

POST {{base_url}}/drive/finalize_upload/{{file_id}}/completed
Authorization: Bearer {{token_a}}
HTTP 200

# Test 1: Verify file exists before deletion
GET {{base_url}}/drive/files/{{file_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 2: Delete file (soft delete) - Should succeed with 200
DELETE {{base_url}}/drive/files/{{file_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 3: Delete folder (soft delete) - Should succeed with 200
DELETE {{base_url}}/drive/folders/{{folder_id}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 4: Empty trash - Should succeed with 200
POST {{base_url}}/drive/empty_trash
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 5: Try to restore file after empty trash - Should return 404 (permanently deleted)
POST {{base_url}}/drive/restore_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id}}"}
HTTP 404

# Test 6: Try to restore folder after empty trash - Should return 404 (permanently deleted)
POST {{base_url}}/drive/restore_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"folder_id": "{{folder_id}}"}
HTTP 404

# Test 7: Verify file is permanently deleted
GET {{base_url}}/drive/files/{{file_id}}
Authorization: Bearer {{token_a}}
HTTP 404
