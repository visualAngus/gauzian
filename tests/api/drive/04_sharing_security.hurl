# Sharing Security Tests
# Tests file and folder sharing functionality and security

# ===== Setup: Login User A (account pre-created via setup_test_accounts.sh) =====
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_a: jsonpath "$.token"

# User A creates a folder to share
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "c2hhcmluZy1mb2xkZXItbWV0YWRhdGE=",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_id_share: jsonpath "$.folder_id"

# User A creates a file to share
POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "c2hhcmluZy1maWxlLW1ldGFkYXRh",
    "folder_id": "{{folder_id_share}}",
    "size": 1024,
    "mime_type": "text/plain",
    "total_chunks": 1
}
HTTP 200
[Captures]
file_id_share: jsonpath "$.file_id"

# User A uploads and finalizes the file
POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_share}}",
    "chunk_index": 0,
    "encrypted_data": "c2hhcmluZy1maWxlLWNodW5r",
    "s3_key": "share/{{file_id_share}}/chunk_0"
}
HTTP 200

POST {{base_url}}/drive/finalize_upload/{{file_id_share}}/completed
Authorization: Bearer {{token_a}}
HTTP 200

# ===== Setup: Login User B =====
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_b}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_b: jsonpath "$.token"

# ===== Sharing Tests =====

# Test 1: User A shares folder with User B - Should succeed with 200
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_share}}",
    "recipient_email": "{{test_email_b}}",
    "encrypted_folder_key": "c2hhcmVkLWZvbGRlci1rZXkta2V5"
}
HTTP 200
[Asserts]
status == 200

# Test 2: User B accesses shared folder - Should succeed with 200
GET {{base_url}}/drive/folder_contents/{{folder_id_share}}
Authorization: Bearer {{token_b}}
HTTP 200
[Asserts]
status == 200

# Test 3: User A shares file with User B - Should succeed with 200
POST {{base_url}}/drive/share_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_share}}",
    "recipient_email": "{{test_email_b}}",
    "encrypted_file_key": "c2hhcmVkLWZpbGUta2V5LWtleQ=="
}
HTTP 200
[Asserts]
status == 200

# Test 4: User B accesses shared file - Should succeed with 200
GET {{base_url}}/drive/get_file_folder/{{file_id_share}}
Authorization: Bearer {{token_b}}
HTTP 200
[Asserts]
status == 200

# Test 5: User A revokes User B's access to the folder - Should succeed with 200
# First get User B's user_id
GET {{base_url}}/info
Authorization: Bearer {{token_b}}
HTTP 200
[Captures]
user_b_id: jsonpath "$.user_id"

POST {{base_url}}/drive/revoke-access
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "item_id": "{{folder_id_share}}",
    "item_type": "folder",
    "user_id": "{{user_b_id}}"
}
HTTP 200
[Asserts]
status == 200

# Test 6: User B tries to access shared folder after revocation - Should fail with 403 or 404
GET {{base_url}}/drive/folder_contents/{{folder_id_share}}
Authorization: Bearer {{token_b}}
HTTP 403

# Test 7: User A revokes User B's access to the file - Should succeed with 200
POST {{base_url}}/drive/revoke-access
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "item_id": "{{file_id_share}}",
    "item_type": "file",
    "user_id": "{{user_b_id}}"
}
HTTP 200
[Asserts]
status == 200

# Test 8: User B tries to access shared file after revocation - Should fail with 403 or 404
GET {{base_url}}/drive/get_file_folder/{{file_id_share}}
Authorization: Bearer {{token_b}}
HTTP 403

# ===== Privilege Escalation Tests =====

# Test 9: User B tries to share User A's folder that was shared with them (view-only)
# Should fail with 403 - User B should not be able to re-share
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_share}}",
    "recipient_email": "{{test_email_a}}",
    "encrypted_folder_key": "dHJ1c3RlZC1rZXk="
}
HTTP 403

# Test 10: User B tries to share User A's file that was shared with them
# Should fail with 403 - User B should not be able to re-share
POST {{base_url}}/drive/share_file
Authorization: Bearer {{token_b}}
Content-Type: application/json
{
    "file_id": "{{file_id_share}}",
    "recipient_email": "{{test_email_a}}",
    "encrypted_file_key": "dHJ1c3RlZC1rZXk="
}
HTTP 403

# Test 11: User B tries to delete User A's shared folder - Should fail with 403
POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_share}}"
}
HTTP 403

# Test 12: User B tries to delete User A's shared file - Should fail with 403
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_b}}
Content-Type: application/json
{
    "file_id": "{{file_id_share}}"
}
HTTP 403

# ===== Negative Tests =====

# Test 13: Share with non-existent email - Should return 404
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_share}}",
    "recipient_email": "nonexistent@example.com",
    "encrypted_folder_key": "c2hhcmVkLWZvbGRlci1rZXkta2V5"
}
HTTP 404

# Test 14: Share file with non-existent email - Should return 404
POST {{base_url}}/drive/share_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_share}}",
    "recipient_email": "nonexistent@example.com",
    "encrypted_file_key": "c2hhcmVkLWZpbGUta2V5LWtleQ=="
}
HTTP 404

# Test 15: Share folder with invalid UUID - Should return 400
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "folder_id": "not-a-uuid",
    "recipient_email": "{{test_email_b}}",
    "encrypted_folder_key": "c2hhcmVkLWZvbGRlci1rZXkta2V5"
}
HTTP 400

# Test 16: Share file with invalid UUID - Should return 400
POST {{base_url}}/drive/share_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "not-a-uuid",
    "recipient_email": "{{test_email_b}}",
    "encrypted_file_key": "c2hhcmVkLWZpbGUta2V5LWtleQ=="
}
HTTP 400

# Test 17: Share without auth - Should fail with 401
POST {{base_url}}/drive/share_folder
Content-Type: application/json
{
    "folder_id": "{{folder_id_share}}",
    "recipient_email": "{{test_email_b}}",
    "encrypted_folder_key": "c2hhcmVkLWZvbGRlci1rZXkta2V5"
}
HTTP 401

# ===== Cleanup =====

# User A deletes their shared resources
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_share}}"
}
HTTP 200

POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_share}}"
}
HTTP 200
