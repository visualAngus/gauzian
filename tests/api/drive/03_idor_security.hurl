# IDOR Security Tests (Most Critical)
# Tests for Insecure Direct Object Reference vulnerabilities
# Verifies that users cannot access or modify other users' resources

# ===== Setup: Create User A and resources =====
# Register User A
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
user_a_id: jsonpath "$.user_id"

# Login User A
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_a}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_a: cookie "auth_token"

# User A creates a folder
POST {{base_url}}/drive/create_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dXNlci1hLWZvbGRlci1tZXRhZGF0YQ==",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_id_a: jsonpath "$.folder_id"

# User A creates a file
POST {{base_url}}/drive/initialize_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "encrypted_metadata": "dXNlci1hLWZpbGUtbWV0YWRhdGE=",
    "folder_id": "{{folder_id_a}}",
    "size": 1024,
    "mime_type": "text/plain",
    "total_chunks": 1
}
HTTP 200
[Captures]
file_id_a: jsonpath "$.file_id"

# Upload chunk and finalize for file_id_a
POST {{base_url}}/drive/upload_chunk
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_a}}",
    "chunk_index": 0,
    "encrypted_data": "dXNlci1hLWZpbGUtY2h1bms=",
    "s3_key": "user_a/{{file_id_a}}/chunk_0"
}
HTTP 200

POST {{base_url}}/drive/finalize_upload/{{file_id_a}}/completed
Cookie: auth_token={{token_a}}
HTTP 200

# ===== Setup: Create User B =====
# Register User B
POST {{base_url}}/register
Content-Type: application/json
{
    "email": "{{test_email_b}}",
    "username": "{{test_username_b}}",
    "password": "{{test_password}}",
    "encrypted_private_key": "dGVzdC1lbmNyeXB0ZWQta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "public_key": "dGVzdC1wdWJsaWMta2V5LWZvci10ZXN0aW5nLW9ubHk=",
    "private_key_salt": "dGVzdC1zYWx0",
    "iv": "dGVzdC1pdg==",
    "encrypted_record_key": "dGVzdC1yZWNvcmQta2V5"
}
HTTP 200
[Captures]
user_b_id: jsonpath "$.user_id"

# Login User B
POST {{base_url}}/login
Content-Type: application/json
{
    "email": "{{test_email_b}}",
    "password": "{{test_password}}"
}
HTTP 200
[Captures]
token_b: cookie "auth_token"

# User B creates their own folder (to verify their own access works)
POST {{base_url}}/drive/create_folder
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "encrypted_metadata": "dXNlci1iLWZvbGRlci1tZXRhZGF0YQ==",
    "parent_folder_id": null
}
HTTP 200
[Captures]
folder_id_b: jsonpath "$.folder_id"

# ===== IDOR Tests: User B trying to access User A's resources =====

# Test 1: IDOR - User B tries to GET folder_contents of User A's folder
# MUST be 403 or 404, NOT 200
GET {{base_url}}/drive/folder_contents/{{folder_id_a}}
Cookie: auth_token={{token_b}}
HTTP 403

# Test 2: IDOR - User B tries to GET file info of User A's file
# MUST be 403 or 404, NOT 200
GET {{base_url}}/drive/get_file_folder/{{file_id_a}}
Cookie: auth_token={{token_b}}
HTTP 403

# Test 3: IDOR - User B tries to RENAME User A's folder
# MUST be 403 or 404, NOT 200
POST {{base_url}}/drive/rename_folder
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_a}}",
    "encrypted_metadata": "c2FsdGktcmVuYW1lLWZvbGRlcg=="
}
HTTP 403

# Test 4: IDOR - User B tries to DELETE User A's folder
# MUST be 403 or 404, NOT 200
POST {{base_url}}/drive/delete_folder
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_a}}"
}
HTTP 403

# Test 5: IDOR - User B tries to RENAME User A's file
# MUST be 403 or 404, NOT 200
POST {{base_url}}/drive/rename_file
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "file_id": "{{file_id_a}}",
    "encrypted_metadata": "c2FsdGktcmVuYW1lLWZpbGU="
}
HTTP 403

# Test 6: IDOR - User B tries to DELETE User A's file
# MUST be 403 or 404, NOT 200
POST {{base_url}}/drive/delete_file
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "file_id": "{{file_id_a}}"
}
HTTP 403

# Test 7: IDOR - User B tries to SHARE User A's file (can't share what they don't own)
# MUST be 403 or 404, NOT 200
POST {{base_url}}/drive/share_file
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "file_id": "{{file_id_a}}",
    "recipient_email": "{{test_email_b}}",
    "encrypted_file_key": "c2FsdGgtZW5jcnlwdGVkLWZpbGUta2V5"
}
HTTP 403

# Test 8: IDOR - User B tries to REVOKE access to User A's file
# MUST be 403 or 404, NOT 200
POST {{base_url}}/drive/revoke-access
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "item_id": "{{file_id_a}}",
    "item_type": "file",
    "user_id": "{{user_b_id}}"
}
HTTP 403

# Test 9: IDOR - User B tries to share User A's folder
POST {{base_url}}/drive/share_folder
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_a}}",
    "recipient_email": "{{test_email_b}}",
    "encrypted_folder_key": "c2FsdGgtZW5jcnlwdGVkLWZvbGRlci1rZXk="
}
HTTP 403

# ===== UUID Manipulation Tests =====

# Test 10: UUID Manipulation - GET folder_contents with invalid UUID format
# MUST be 400, NOT 500 (no internal server error)
GET {{base_url}}/drive/folder_contents/not-a-uuid
Cookie: auth_token={{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 11: UUID Manipulation - GET file info with invalid UUID format
# MUST be 400, NOT 500
GET {{base_url}}/drive/get_file_folder/not-a-uuid
Cookie: auth_token={{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 12: UUID Manipulation - Path traversal attempt in file_id
# MUST be 400, NOT 500
POST {{base_url}}/drive/delete_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "../../../etc/passwd"
}
HTTP 400
[Asserts]
status == 400

# Test 13: UUID Manipulation - Attempt with SQL injection in UUID field
# MUST be 400 or 404, NOT 500
GET {{base_url}}/drive/folder_contents/1' OR '1'='1
Cookie: auth_token={{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 14: UUID Manipulation - Attempt with very long UUID
GET {{base_url}}/drive/folder_contents/00000000-0000-0000-0000-000000000000000000000000000000000000000000000000000000000000
Cookie: auth_token={{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 15: UUID Manipulation - Null bytes in UUID (should be rejected)
GET {{base_url}}/drive/folder_contents/00000000%00-0000-0000-0000-000000000000
Cookie: auth_token={{token_a}}
HTTP 400
[Asserts]
status != 500

# ===== Verify User A's resources are still intact after IDOR attempts =====

# Test 16: Verify User A can still access their own folder
GET {{base_url}}/drive/folder_contents/{{folder_id_a}}
Cookie: auth_token={{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 17: Verify User A can still access their own file
GET {{base_url}}/drive/get_file_folder/{{file_id_a}}
Cookie: auth_token={{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 18: Verify User B cannot access User A's folder contents
GET {{base_url}}/drive/get_all_drive_info/{{folder_id_a}}
Cookie: auth_token={{token_b}}
HTTP 403

# ===== Cleanup =====

# User A deletes their own resources
POST {{base_url}}/drive/delete_file
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "file_id": "{{file_id_a}}"
}
HTTP 200

POST {{base_url}}/drive/delete_folder
Cookie: auth_token={{token_a}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_a}}"
}
HTTP 200

# User B deletes their own resources
POST {{base_url}}/drive/delete_folder
Cookie: auth_token={{token_b}}
Content-Type: application/json
{
    "folder_id": "{{folder_id_b}}"
}
HTTP 200
