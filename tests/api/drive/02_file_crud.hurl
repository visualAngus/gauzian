# File CRUD Tests
# Tests file creation, upload, retrieval, renaming, and deletion

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

# Setup: Create a folder to hold our test files
POST {{base_url}}/drive/create_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "ZmlsZWZvbGRlci1tZXRhZGF0YQ==",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_id_test: jsonpath "$.folder_id"

# Test 1: Initialize file upload - Should succeed with 200
POST {{base_url}}/drive/initialize_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "ZmlsZS1tZXRhZGF0YQ==",
    "folder_id": "{{folder_id_test}}",
    "size": 1024,
    "mime_type": "text/plain",
    "total_chunks": 1
}
HTTP 200
[Captures]
file_id: jsonpath "$.file_id"

# Test 2: Upload a chunk - Should succeed with 200
POST {{base_url}}/drive/upload_chunk
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id}}",
    "chunk_index": 0,
    "encrypted_data": "dGVzdC1jaHVuay1kYXRh",
    "s3_key": "test/{{file_id}}/chunk_0"
}
HTTP 200
[Asserts]
status == 200

# Test 3: Finalize upload with state "completed" - Should succeed with 200
POST {{base_url}}/drive/finalize_upload/{{file_id}}/completed
Cookie: auth_token={{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 4: Get file/folder info - Should succeed with 200
GET {{base_url}}/drive/get_file_folder/{{file_id}}
Cookie: auth_token={{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 5: Rename file - Should succeed with 200
POST {{base_url}}/drive/rename_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id}}",
    "encrypted_metadata": "cmVuYW1lZC1maWxlLW1ldGFkYXRh"
}
HTTP 200
[Asserts]
status == 200

# Test 6: Try to get file info without auth - Should fail with 401
GET {{base_url}}/drive/get_file_folder/{{file_id}}
HTTP 401
[Asserts]
status == 401

# Test 7: Delete file - Should succeed with 200
POST {{base_url}}/drive/delete_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id}}"
}
HTTP 200
[Asserts]
status == 200

# Test 8: Verify file is deleted - Should return 404
GET {{base_url}}/drive/get_file_folder/{{file_id}}
Cookie: auth_token={{token_a}}
HTTP 404
[Asserts]
status == 404

# Test 9: Initialize file WITHOUT auth - Should fail with 401
POST {{base_url}}/drive/initialize_file
Content-Type: application/json
{
    "encrypted_metadata": "ZmlsZS1tZXRhZGF0YQ==",
    "folder_id": "{{folder_id_test}}",
    "size": 1024,
    "mime_type": "text/plain",
    "total_chunks": 1
}
HTTP 401
[Asserts]
status == 401

# Test 10: Initialize file with invalid folder_id - Should return 400 or 404
POST {{base_url}}/drive/initialize_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "ZmlsZS1tZXRhZGF0YQ==",
    "folder_id": "00000000-0000-0000-0000-000000000000",
    "size": 1024,
    "mime_type": "text/plain",
    "total_chunks": 1
}
HTTP 404

# Test 11: Try to upload chunk for non-existent file - Should return 404
POST {{base_url}}/drive/upload_chunk
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "00000000-0000-0000-0000-000000000000",
    "chunk_index": 0,
    "encrypted_data": "dGVzdC1jaHVuay1kYXRh",
    "s3_key": "test/chunk_0"
}
HTTP 404

# Test 12: Finalize upload with invalid file_id - Should return 404
POST {{base_url}}/drive/finalize_upload/00000000-0000-0000-0000-000000000000/completed
Cookie: auth_token={{token_a}}
HTTP 404

# Test 13: Rename file that doesn't exist - Should return 404
POST {{base_url}}/drive/rename_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "00000000-0000-0000-0000-000000000000",
    "encrypted_metadata": "cmVuYW1lZC1maWxlLW1ldGFkYXRh"
}
HTTP 404

# Test 14: Delete file that doesn't exist - Should return 404
POST {{base_url}}/drive/delete_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "00000000-0000-0000-0000-000000000000"
}
HTTP 404

# Test 15: Initialize file with invalid UUID format - Should return 400 (not 500)
POST {{base_url}}/drive/initialize_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "ZmlsZS1tZXRhZGF0YQ==",
    "folder_id": "not-a-valid-uuid",
    "size": 1024,
    "mime_type": "text/plain",
    "total_chunks": 1
}
HTTP 400
[Asserts]
status == 400

# Test 16: Create another file and test get_all_drive_info
POST {{base_url}}/drive/initialize_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "YW5vdGhlci1maWxlLW1ldGFkYXRh",
    "folder_id": "{{folder_id_test}}",
    "size": 2048,
    "mime_type": "application/pdf",
    "total_chunks": 2
}
HTTP 200
[Captures]
file_id_2: jsonpath "$.file_id"

# Test 17: Get all drive info for the test folder
GET {{base_url}}/drive/get_all_drive_info/{{folder_id_test}}
Cookie: auth_token={{token_a}}
HTTP 200
[Asserts]
status == 200

# Cleanup: Delete test files and folder
POST {{base_url}}/drive/delete_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_2}}"
}
HTTP 200

POST {{base_url}}/drive/delete_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_test}}"
}
HTTP 200
