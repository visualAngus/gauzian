# Trash Tests
# Tests trash/empty trash functionality and permanent deletion

# Setup: Login User A
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_a: jsonpath "$.token"

# Setup: Create a test folder
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dHJhc2gtZm9sZGVyLW1ldGFkYXRh",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_id_trash: jsonpath "$.folder_id"

# Setup: Create a test file
POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dHJhc2gtZmlsZS1tZXRhZGF0YQ==",
    "folder_id": "{{folder_id_trash}}",
    "size": 1024,
    "mime_type": "text/plain",
    "total_chunks": 1
}
HTTP 200
[Captures]
file_id_trash: jsonpath "$.file_id"

# Upload chunk and finalize
POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_trash}}",
    "chunk_index": 0,
    "encrypted_data": "dHJhc2gtZmlsZS1jaHVuaw==",
    "s3_key": "trash/{{file_id_trash}}/chunk_0"
}
HTTP 200

POST {{base_url}}/drive/finalize_upload/{{file_id_trash}}/completed
Authorization: Bearer {{token_a}}
HTTP 200

# Test 1: Verify folder exists before deletion
GET {{base_url}}/drive/folder_contents/{{folder_id_trash}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 2: Delete folder - Should succeed with 200 (moves to trash)
POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_trash}}"
}
HTTP 200
[Asserts]
status == 200

# Test 3: Verify folder is now in trash (should not be accessible in normal view)
GET {{base_url}}/drive/folder_contents/{{folder_id_trash}}
Authorization: Bearer {{token_a}}
HTTP 404

# Test 4: Empty trash - Should succeed with 200
POST {{base_url}}/drive/empty_trash
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 5: Try to restore folder after empty trash - Should return 404 (permanently deleted)
GET {{base_url}}/drive/folder_contents/{{folder_id_trash}}
Authorization: Bearer {{token_a}}
HTTP 404
[Asserts]
status == 404

# Test 6: Create another folder and file to test trash again
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dHJhc2gyLWZvbGRlci1tZXRhZGF0YQ==",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_id_trash2: jsonpath "$.folder_id"

POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dHJhc2gyLWZpbGUtbWV0YWRhdGE=",
    "folder_id": "{{folder_id_trash2}}",
    "size": 2048,
    "mime_type": "application/pdf",
    "total_chunks": 2
}
HTTP 200
[Captures]
file_id_trash2: jsonpath "$.file_id"

POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_trash2}}",
    "chunk_index": 0,
    "encrypted_data": "dHJhc2gyLWZpbGUtY2h1bmsx",
    "s3_key": "trash2/{{file_id_trash2}}/chunk_0"
}
HTTP 200

POST {{base_url}}/drive/finalize_upload/{{file_id_trash2}}/completed
Authorization: Bearer {{token_a}}
HTTP 200

# Test 7: Delete file first - Should succeed with 200
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_trash2}}"
}
HTTP 200
[Asserts]
status == 200

# Test 8: Delete folder - Should succeed with 200
POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_trash2}}"
}
HTTP 200
[Asserts]
status == 200

# Test 9: Empty trash again - Should succeed with 200
POST {{base_url}}/drive/empty_trash
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 10: Verify file is permanently deleted
GET {{base_url}}/drive/get_file_folder/{{file_id_trash2}}
Authorization: Bearer {{token_a}}
HTTP 404

# Test 11: Verify folder is permanently deleted
GET {{base_url}}/drive/folder_contents/{{folder_id_trash2}}
Authorization: Bearer {{token_a}}
HTTP 404

# Test 12: Empty trash without auth - Should fail with 401
POST {{base_url}}/drive/empty_trash
HTTP 401
[Asserts]
status == 401

# Test 13: Delete file without auth - Should fail with 401
POST {{base_url}}/drive/delete_file
Content-Type: application/json
{
    "file_id": "00000000-0000-0000-0000-000000000000"
}
HTTP 401
[Asserts]
status == 401

# Test 14: Delete folder without auth - Should fail with 401
POST {{base_url}}/drive/delete_folder
Content-Type: application/json
{
    "folder_id": "00000000-0000-0000-0000-000000000000"
}
HTTP 401
[Asserts]
status == 401

# Test 15: Create folder, delete, then restore should not work after empty trash
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "c2hvcnR0ZXJtLW1ldGFkYXRh",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_short: jsonpath "$.folder_id"

POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_short}}"
}
HTTP 200

POST {{base_url}}/drive/empty_trash
Authorization: Bearer {{token_a}}
HTTP 200

# Test 16: Verify deleted folder cannot be accessed after empty trash
GET {{base_url}}/drive/folder_contents/{{folder_short}}
Authorization: Bearer {{token_a}}
HTTP 404
