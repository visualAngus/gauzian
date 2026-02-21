# IDOR Security Tests (Most Critical)
# Tests for Insecure Direct Object Reference vulnerabilities
# Verifies that users cannot access or modify other users' resources

# ===== Setup: Login User A =====
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_a}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_a: jsonpath "$.data.token"
user_a_id: jsonpath "$.data.user_id"

# User A creates a folder
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"encrypted_metadata": "dXNlci1hLWZvbGRlci1tZXRhZGF0YQ==", "parent_folder_id": "null", "encrypted_folder_key": "dXNlci1hLWZvbGRlci1rZXk="}
HTTP 201
[Captures]
folder_id_a: jsonpath "$.data.folder_id"

# User A creates a file (initialize + upload + finalize)
POST {{base_url}}/drive/initialize_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"size": 1024, "encrypted_metadata": "dXNlci1hLWZpbGUtbWV0YWRhdGE=", "mime_type": "text/plain", "folder_id": "{{folder_id_a}}", "encrypted_file_key": "dXNlci1hLWZpbGUta2V5"}
HTTP 200
[Captures]
file_id_a: jsonpath "$.data.file_id"

POST {{base_url}}/drive/upload_chunk
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id_a}}", "chunk_index": 0, "total_chunks": 1, "encrypted_chunk": "dXNlci1hLWZpbGUtY2h1bms=", "iv": "dXNlci1hLWl2"}
HTTP 200

POST {{base_url}}/drive/finalize_upload/{{file_id_a}}/success
Authorization: Bearer {{token_a}}
HTTP 200

# ===== Setup: Login User B =====
POST {{base_url}}/login
Content-Type: application/json
{"email": "{{test_email_b}}", "password": "{{test_password}}"}
HTTP 200
[Captures]
token_b: jsonpath "$.data.token"
user_b_id: jsonpath "$.data.user_id"

# User B creates their own folder
POST {{base_url}}/drive/create_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"encrypted_metadata": "dXNlci1iLWZvbGRlci1tZXRhZGF0YQ==", "parent_folder_id": "null", "encrypted_folder_key": "dXNlci1iLWZvbGRlci1rZXk="}
HTTP 201
[Captures]
folder_id_b: jsonpath "$.data.folder_id"

# ===== IDOR Tests: User B trying to access User A's resources =====

# Test 1: IDOR - User B tries to GET folder_contents of User A's folder
GET {{base_url}}/drive/folder_contents/{{folder_id_a}}
Authorization: Bearer {{token_b}}
HTTP 403

# Test 2: IDOR - User B tries to GET file of User A's file
GET {{base_url}}/drive/file/{{file_id_a}}
Authorization: Bearer {{token_b}}
HTTP 403

# Test 3: IDOR - User B tries to RENAME User A's folder
POST {{base_url}}/drive/rename_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"folder_id": "{{folder_id_a}}", "encrypted_metadata": "c2FsdGktcmVuYW1lLWZvbGRlcg=="}
HTTP 403

# Test 4: IDOR - User B tries to DELETE User A's folder
POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"folder_id": "{{folder_id_a}}"}
HTTP 403

# Test 5: IDOR - User B tries to RENAME User A's file
POST {{base_url}}/drive/rename_file
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"file_id": "{{file_id_a}}", "encrypted_metadata": "c2FsdGktcmVuYW1lLWZpbGU="}
HTTP 403

# Test 6: IDOR - User B tries to DELETE User A's file
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"file_id": "{{file_id_a}}"}
HTTP 403

# Test 7: IDOR - User B tries to SHARE User A's file
POST {{base_url}}/drive/share_file
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"file_id": "{{file_id_a}}", "recipient_user_id": "{{user_b_id}}", "encrypted_file_key": "c2FsdGgtZW5jcnlwdGVkLWZpbGUta2V5", "access_level": "viewer"}
HTTP 403

# Test 8: IDOR - User B tries to SHARE User A's folder
POST {{base_url}}/drive/share_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"folder_id": "{{folder_id_a}}", "recipient_user_id": "{{user_b_id}}", "encrypted_folder_key": "c2FsdGgtZW5jcnlwdGVkLWZvbGRlci1rZXk=", "access_level": "viewer"}
HTTP 403

# Test 9: IDOR - User B tries to REVOKE access to User A's file
POST {{base_url}}/drive/revoke-access
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"file_id": "{{file_id_a}}", "user_id": "{{user_b_id}}"}
HTTP 403

# Test 10: IDOR - User B tries to get all drive info of User A's folder
GET {{base_url}}/drive/get_all_drive_info/{{folder_id_a}}
Authorization: Bearer {{token_b}}
HTTP 403

# ===== UUID Manipulation Tests =====

# Test 11: UUID Manipulation - GET folder_contents with invalid UUID format
GET {{base_url}}/drive/folder_contents/not-a-uuid
Authorization: Bearer {{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 12: UUID Manipulation - GET file with invalid UUID format
GET {{base_url}}/drive/file/not-a-uuid
Authorization: Bearer {{token_a}}
HTTP 400
[Asserts]
status == 400

# Test 13: UUID Manipulation - Path traversal attempt in file_id
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "../../../etc/passwd"}
HTTP 400
[Asserts]
status == 400

# Test 14: UUID Manipulation - Attempt with SQL injection in UUID field
GET {{base_url}}/drive/folder_contents/1%27%20OR%20%271%27%3D%271
Authorization: Bearer {{token_a}}
HTTP 400
[Asserts]
status == 400

# ===== Verify User A's resources are still intact after IDOR attempts =====

# Test 15: Verify User A can still access their own folder
GET {{base_url}}/drive/folder_contents/{{folder_id_a}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# Test 16: Verify User A can still access their own file
GET {{base_url}}/drive/file/{{file_id_a}}
Authorization: Bearer {{token_a}}
HTTP 200
[Asserts]
status == 200

# ===== Cleanup =====

# User A deletes their own resources
POST {{base_url}}/drive/delete_file
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"file_id": "{{file_id_a}}"}
HTTP 200

POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_a}}
Content-Type: application/json
{"folder_id": "{{folder_id_a}}"}
HTTP 200

# User B deletes their own resources
POST {{base_url}}/drive/delete_folder
Authorization: Bearer {{token_b}}
Content-Type: application/json
{"folder_id": "{{folder_id_b}}"}
HTTP 200
