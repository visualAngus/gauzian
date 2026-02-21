# Sharing Security Tests
# Tests file and folder sharing functionality and security

# ===== Setup: Login User A =====
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.token"
user_a_id: jsonpath "$.user_id"

# User A creates a folder to share
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"encrypted_metadata": "c2hhcmluZy1mb2xkZXItbWV0YWRhdGE=", "parent_folder_id": "null", "encrypted_folder_key": "c2hhcmluZy1mb2xkZXIta2V5"}
HTTP 200
[Captures]
folder_id_share: jsonpath "$.folder_id"

# User A creates a file to share
POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"size": 1024, "encrypted_metadata": "c2hhcmluZy1maWxlLW1ldGFkYXRh", "mime_type": "text/plain", "folder_id": "{{folder_id_share}}", "encrypted_file_key": "c2hhcmluZy1maWxlLWtleQ=="}
HTTP 200
[Captures]
file_id_share: jsonpath "$.data.file_id"

# User A uploads and finalizes the file
POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id_share}}", "chunk_index": 0, "total_chunks": 1, "encrypted_chunk": "c2hhcmluZy1maWxlLWNodW5r", "iv": "c2hhcmluZw=="}
HTTP 200

POST {{base_url}}/drive/finalize_upload/{{file_id_share}}/success
Authorization: Bearer {{token_a}}
HTTP 200

# ===== Setup: Login User B =====
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_b}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_b: jsonpath "$.token"
user_b_id: jsonpath "$.user_id"

# ===== Sharing Tests =====

# Test 1: User A shares folder with User B - Should succeed with 200
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"folder_id": "{{folder_id_share}}", "recipient_user_id": "{{user_b_id}}", "encrypted_folder_key": "c2hhcmVkLWZvbGRlci1rZXkta2V5", "access_level": "viewer"}
HTTP 200
[Asserts]
status == 200

# Test 2: User B accesses shared folder_contents - Should succeed with 200
GET {{base_url}}/drive/folder_contents/{{folder_id_share}}
Authorization: Bearer {{token_b}}
HTTP 200
[Asserts]
status == 200

# Test 3: User A revokes User B access to folder - Should succeed with 200
POST {{base_url}}/drive/revoke-access
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"folder_id": "{{folder_id_share}}", "user_id": "{{user_b_id}}"}
HTTP 200
[Asserts]
status == 200

# Test 4: User B tries folder_contents after revocation - Should fail with 403
GET {{base_url}}/drive/folder_contents/{{folder_id_share}}
Authorization: Bearer {{token_b}}
HTTP 403

# Test 5: User B tries to share User A's folder (that B can't access anymore) - Should fail with 403
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"folder_id": "{{folder_id_share}}", "recipient_user_id": "{{user_a_id}}", "encrypted_folder_key": "dHJ1c3RlZC1rZXk=", "access_level": "viewer"}
HTTP 403

# Test 6: Share with non-existent user_id - Should return 404 or 400
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"folder_id": "{{folder_id_share}}", "recipient_user_id": "00000000-0000-0000-0000-000000000000", "encrypted_folder_key": "c2hhcmVkLWZvbGRlci1rZXkta2V5", "access_level": "viewer"}
HTTP 404

# Cleanup: User A deletes file and folder
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id_share}}"}
HTTP 200

POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"folder_id": "{{folder_id_share}}"}
HTTP 200
