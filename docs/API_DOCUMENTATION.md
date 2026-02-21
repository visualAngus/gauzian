# API Documentation Gauzian

## Introduction

L'API Gauzian est une API REST permettant la gestion sécurisée de fichiers et d'événements calendrier avec chiffrement de bout en bout (E2EE). Tous les échanges sont chiffrés et les clés de chiffrement ne sont jamais transmises au serveur en clair.

### Base URL

| Environment | URL |
|-------------|-----|
| **Production** | `https://gauzian.pupin.fr/api` |
| **Local** | `http://localhost:3000` |

### Authentication

L'authentification utilise des tokens JWT stockés dans des cookies sécurisés. Le token est automatiquement inclus dans les requêtes via le cookie `auth_token`.

### Response Format

All responses follow this standard format:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": "Descriptive error message"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `429` | Too Many Requests (rate limiting) |
| `500` | Internal Server Error |

---

## System Endpoints

### GET /

Basic health check for cloud platforms (Clever Cloud).

**Response:**

```http
HTTP/1.1 200 OK
OK
```

---

### GET /health/ready

Complete health check verifying service availability (DB, Redis, S3).

**Response:**

```http
HTTP/1.1 200 OK
OK
```

---

### GET /metrics

Prometheus metrics for monitoring.

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: text/plain

# HELP gauzian_http_requests_total Total HTTP requests
# TYPE gauzian_http_requests_total counter
gauzian_http_requests_total{method="GET",endpoint="/drive/files",status="200"} 142
...
```

---

## Auth Module

### POST /login

Authenticate a user with email and password.

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "motdepasse123"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "encrypted_private_key": "base64_encoded_encrypted_private_key",
    "private_key_salt": "base64_salt",
    "iv": "base64_iv",
    "public_key": "base64_public_key"
  },
  "error": null
}
```

---

### POST /register

Create a new user account.

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "motdepasse123",
  "encrypted_private_key": "base64_encoded_encrypted_private_key",
  "public_key": "base64_public_key",
  "private_key_salt": "base64_salt",
  "iv": "base64_iv",
  "encrypted_record_key": "base64_encrypted_record_key"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "encrypted_private_key": "base64_encoded_encrypted_private_key",
    "private_key_salt": "base64_salt",
    "iv": "base64_iv",
    "public_key": "base64_public_key"
  },
  "error": null
}
```

---

### POST /logout

Revoke the JWT token by adding it to the Redis blacklist.

**Success Response:**

```json
{
  "success": true,
  "data": "Logged out successfully",
  "error": null
}
```

---

### GET /autologin

Check if the JWT token is still valid. Used to maintain session.

**Success Response:**

```json
{
  "success": true,
  "data": "Authenticated as user 550e8400-e29b-41d4-a716-446655440000",
  "error": null
}
```

---

### GET /protected

Protected endpoint example - returns authenticated user information.

**Success Response:**

```json
{
  "success": true,
  "data": "Hello user 550e8400-e29b-41d4-a716-446655440000 with role user",
  "error": null
}
```

---

### GET /info

Retrieve complete information of the logged-in user.

**Success Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "user@example.com",
    "public_key": "base64_public_key",
    "encrypted_private_key": "base64_encrypted_private_key",
    "private_key_salt": "base64_salt",
    "iv": "base64_iv"
  },
  "error": null
}
```

---

### GET /contacts/get_public_key/{email}

Retrieve the public key of a user for E2EE encryption.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `email` | path | User email |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "public_key": "base64_public_key"
  },
  "error": null
}
```

**Not Found Response:**

```json
{
  "success": false,
  "data": null,
  "error": "User not found"
}
```

---

## Drive Module - Files

### File Upload

The system uses chunked upload with **max 6 MB per request**. This allows:
- Resume interrupted uploads
- Reduce memory usage
- Handle large files

#### POST /drive/files/initialize

Initialize a new file and create database entry.

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "size": 10485760,
  "encrypted_metadata": "base64_encrypted_filename_and_metadata",
  "mime_type": "application/pdf",
  "folder_id": "550e8400-e29b-41d4-a716-446655440000",
  "encrypted_file_key": "base64_encrypted_file_key"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "file_id": "660e8400-e29b-41d4-a716-446655440001"
  },
  "error": null
}
```

---

#### POST /drive/files/{file_id}/upload-chunk

Upload a chunk via multipart form (RESTful).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `chunk` | binary | Chunk data (max 6MB) |
| `chunk_index` | string | Chunk index |
| `iv` | string | Initialization vector Base64 |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "s3_record_id": "770e8400-e29b-41d4-a716-446655440002",
    "s3_id": "chunks/660e8400.../0",
    "index": 0,
    "date_upload": "2026-02-21T10:30:00Z",
    "data_hash": "sha256_hash_of_chunk"
  },
  "error": null
}
```

---

#### POST /drive/finalize_upload/{file_id}/{etat} *(Non-RESTful)*

Finalize or abort a file upload.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |
| `etat` | path | State: `completed` or `aborted` |

**Success Response (completed):**

```json
{
  "success": true,
  "data": "File upload finalized successfully",
  "error": null
}
```

**Success Response (aborted):**

```json
{
  "success": true,
  "data": "File upload aborted successfully",
  "error": null
}
```

---

### File Download

#### GET /drive/files/{file_id}/download

Download a file (RESTful).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Response:**

```
HTTP/1.1 200 OK
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="document.pdf"

<binary data>
```

---

### File Operations

#### GET /drive/files

List all user files.

**Success Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "encrypted_metadata": "base64_encrypted_metadata",
      "mime_type": "application/pdf",
      "size": 10485760,
      "folder_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  ],
  "error": null
}
```

---

#### GET /drive/files/{file_id}

Retrieve file metadata.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "encrypted_metadata": "base64_encrypted_metadata",
    "mime_type": "application/pdf",
    "size": 10485760,
    "folder_id": "550e8400-e29b-41d4-a716-446655440000",
    "chunks": [
      {
        "s3_key": "chunks/660e8400.../0",
        "index": 0
      }
    ],
    "created_at": "2026-02-21T10:00:00Z",
    "updated_at": "2026-02-21T10:30:00Z"
  },
  "error": null
}
```

---

#### PATCH /drive/files/{file_id}

Rename a file (partial update).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Request Body:**

```json
{
  "new_encrypted_metadata": "base64_new_encrypted_metadata"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "File renamed successfully",
  "error": null
}
```

---

#### DELETE /drive/files/{file_id}

Delete a file (move to trash).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "File deleted successfully",
  "error": null
}
```

---

#### PATCH /drive/files/{file_id}/move

Move a file to another folder.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Request Body:**

```json
{
  "new_parent_folder_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "File moved successfully",
  "error": null
}
```

---

#### POST /drive/files/{file_id}/share

Share a file with another user.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Request Body:**

```json
{
  "contact_id": "770e8400-e29b-41d4-a716-446655440003",
  "encrypted_item_key": "base64_encrypted_file_key_for_contact",
  "access_level": "write"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "File shared successfully",
  "error": null
}
```

---

#### DELETE /drive/files/{file_id}/share/{user_id}

Revoke a user's access to a file.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |
| `user_id` | path | User UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "Access revoked successfully",
  "error": null
}
```

---

#### POST /drive/files/{file_id}/accept

Accept a file shared with the user.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "File accepted successfully",
  "error": null
}
```

---

#### POST /drive/files/{file_id}/reject

Reject a file shared with the user.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "File rejected successfully",
  "error": null
}
```

---

#### GET /drive/files/{file_id}/InfoItem *(Non-RESTful)*

Get sharing information for a file (for side panel).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "file_id": "660e8400-e29b-41d4-a716-446655440001",
    "shared_users": [
      {
        "user_id": "770e8400-e29b-41d4-a716-446655440003",
        "username": "johndoe",
        "access_level": "write",
        "public_key": "base64_public_key"
      }
    ]
  },
  "error": null
}
```

---

#### POST /drive/restore_file *(Non-RESTful)*

Restore a file from trash.

**Request Body:**

```json
{
  "file_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "File restored successfully",
  "error": null
}
```

---

## Drive Module - Folders

### POST /drive/folders

Create a new folder.

**Request Body:**

```json
{
  "encrypted_metadata": "base64_encrypted_folder_name_and_metadata",
  "parent_folder_id": "550e8400-e29b-41d4-a716-446655440000",
  "encrypted_folder_key": "base64_encrypted_folder_key"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "folder_id": "880e8400-e29b-41d4-a716-446655440004"
  },
  "error": null
}
```

---

### GET /drive/folders/{folder_id}

Get folder contents.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID (or "root" for root) |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "folder_contents": [
      {
        "type": "folder",
        "id": "880e8400-e29b-41d4-a716-446655440004",
        "encrypted_metadata": "base64_encrypted_metadata"
      },
      {
        "type": "file",
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "encrypted_metadata": "base64_encrypted_metadata"
      }
    ]
  },
  "error": null
}
```

---

### PATCH /drive/folders/{folder_id}

Rename a folder.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Request Body:**

```json
{
  "new_encrypted_metadata": "base64_new_encrypted_metadata"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Folder renamed successfully",
  "error": null
}
```

---

### DELETE /drive/folders/{folder_id}

Delete a folder (move to trash).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "Folder deleted successfully",
  "error": null
}
```

---

### PATCH /drive/folders/{folder_id}/move

Move a folder to another parent folder.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Request Body:**

```json
{
  "new_parent_folder_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Folder moved successfully",
  "error": null
}
```

---

### POST /drive/folders/{folder_id}/share

Share a folder with another user.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Request Body:**

```json
{
  "contact_id": "770e8400-e29b-41d4-a716-446655440003",
  "encrypted_item_key": "base64_encrypted_folder_key_for_contact",
  "access_level": "write"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Folder shared successfully",
  "error": null
}
```

---

### DELETE /drive/folders/{folder_id}/share/{user_id}

Revoke a user's access to a folder.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |
| `user_id` | path | User UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "Access revoked successfully",
  "error": null
}
```

---

### POST /drive/folders/{folder_id}/accept

Accept a shared folder.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "Folder accepted successfully",
  "error": null
}
```

---

### POST /drive/folders/{folder_id}/reject

Reject a shared folder.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Success Response:**

```json
{
  "success": true,
  "data": "Folder rejected successfully",
  "error": null
}
```

---

### GET /drive/folder/{folder_id}/shared_users *(Non-RESTful)*

Get list of users with access to a folder.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "shared_users": [
      {
        "user_id": "770e8400-e29b-41d4-a716-446655440003",
        "username": "johndoe",
        "access_level": "write",
        "public_key": "base64_public_key"
      }
    ]
  },
  "error": null
}
```

---

### POST /drive/share_folder_batch *(Non-RESTful)*

Share a folder and all its contents (files and subfolders) with a user.

**Request Body:**

```json
{
  "folder_id": "880e8400-e29b-41d4-a716-446655440004",
  "contact_id": "770e8400-e29b-41d4-a716-446655440003",
  "access_level": "write",
  "folder_keys": [
    {
      "folder_id": "990e8400-e29b-41d4-a716-446655440005",
      "encrypted_folder_key": "base64_encrypted_subfolder_key"
    }
  ],
  "file_keys": [
    {
      "file_id": "660e8400-e29b-41d4-a716-446655440001",
      "encrypted_file_key": "base64_encrypted_file_key"
    }
  ]
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Folder and contents shared successfully",
  "error": null
}
```

---

### POST /drive/restore_folder *(Non-RESTful)*

Restore a folder from trash.

**Request Body:**

```json
{
  "folder_id": "880e8400-e29b-41d4-a716-446655440004"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Folder restored successfully",
  "error": null
}
```

---

## Drive Module - Access Management

### POST /drive/propagate_file_access *(Non-RESTful)*

Propagate file access to parent subfolders (for access inheritance).

**Request Body:**

```json
{
  "file_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Access propagated successfully",
  "error": null
}
```

---

### POST /drive/propagate_folder_access *(Non-RESTful)*

Propagate folder access to all its contents (files and subfolders).

**Request Body:**

```json
{
  "folder_id": "880e8400-e29b-41d4-a716-446655440004"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Access propagated successfully",
  "error": null
}
```

---

### POST /drive/revoke-access *(Non-RESTful)*

Revoke access to a resource (file or folder).

**Request Body:**

```json
{
  "item_id": "660e8400-e29b-41d4-a716-446655440001",
  "item_type": "file",
  "user_id": "770e8400-e29b-41d4-a716-446655440003"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": "Access revoked successfully",
  "error": null
}
```

---

## Drive Module - Global Views

### GET /drive/get_all_drive_info/{parent_id} *(Non-RESTful)*

Get complete drive information: user, used space, files and folders, full path.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `parent_id` | path | Parent folder UUID, "corbeille" for trash, or special ID |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "user_info": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "johndoe",
      "email": "user@example.com"
    },
    "drive_info": {
      "used_space": 1073741824,
      "file_count": 42,
      "folder_count": 10
    },
    "files_and_folders": [
      {
        "type": "folder",
        "id": "880e8400-e29b-41d4-a716-446655440004",
        "encrypted_metadata": "base64_encrypted_metadata"
      },
      {
        "type": "file",
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "encrypted_metadata": "base64_encrypted_metadata"
      }
    ],
    "full_path": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "root"
      }
    ]
  },
  "error": null
}
```

**For trash:**

```json
{
  "success": true,
  "data": {
    "corbeille_info": {
      "used_space": 52428800,
      "file_count": 5,
      "folder_count": 2
    },
    "files_and_folders": [],
    "drive_info": {
      "used_space": 1073741824,
      "file_count": 42,
      "folder_count": 10
    },
    "full_path": []
  },
  "error": null
}
```

---

### GET /drive/get_file_folder/{parent_id} *(Non-RESTful)*

Get files and folders of a parent with full path. Also supports "corbeille" and "shared-with-me".

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `parent_id` | path | Folder UUID, "corbeille", or "shared-with-me" |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "files_and_folders": [],
    "full_path": [],
    "drive_info": {
      "used_space": 1073741824,
      "file_count": 42,
      "folder_count": 10
    }
  },
  "error": null
}
```

---

### POST /drive/empty_trash *(Non-RESTful)*

Permanently empty the trash.

**Success Response:**

```json
{
  "success": true,
  "data": "Corbeille emptied successfully",
  "error": null
}
```

---

## Drive Module - Internal Endpoints

### POST /drive/upload_chunk *(Non-RESTful - Internal)*

Upload a chunk encoded in Base64.

**Request Body:**

```json
{
  "file_id": "660e8400-e29b-41d4-a716-446655440001",
  "index": 0,
  "chunk_data": "base64_encrypted_chunk_data",
  "iv": "base64_iv_for_this_chunk"
}
```

---

### POST /drive/upload_chunk_binary *(Non-RESTful - Internal)*

Upload a chunk in raw binary format.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | query | File UUID |
| `index` | query | Chunk index |
| `iv` | query | Initialization vector Base64 |

**Headers:**

```
Content-Type: application/octet-stream
```

**Body:** Raw binary chunk data (max 6MB)

---

### GET /drive/download_chunk/{s3_key} *(Non-RESTful - Internal)*

Download a specific chunk encoded in Base64.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `s3_key` | path | S3 chunk key |

---

### GET /drive/download_chunk_binary/{s3_key} *(Non-RESTful - Internal)*

Download a specific chunk in raw binary format.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `s3_key` | path | S3 chunk key |

---

### GET /drive/folder_contents/{folder_id} *(Non-RESTful - Internal)*

Get recursive folder contents.

---

## Agenda Module

### GET /agenda/events

Retrieve calendar events in a date range.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDayId` | query | Start day ID (encrypted format) |
| `endDayId` | query | End day ID (encrypted format) |

**Success Response:**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440006",
        "title": "Réunion équipe",
        "description": "Discussion hebdomadaire",
        "dayId": 738150,
        "startDayId": "encrypted_start_day",
        "endDayId": "encrypted_end_day",
        "startHour": "encrypted_09:00",
        "endHour": "encrypted_10:30",
        "isAllDay": false,
        "isMultiDay": false,
        "category": "work",
        "color": "#4A90E2",
        "encryptedDataKey": "base64_encrypted_data_key",
        "created_at": "2026-02-21T10:00:00Z",
        "updated_at": "2026-02-21T10:00:00Z"
      }
    ]
  },
  "error": null
}
```

---

### POST /agenda/events

Create a new calendar event.

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```json
{
  "title": "Réunion équipe",
  "description": "Discussion hebdomadaire",
  "dayId": 738150,
  "startDayId": "encrypted_start_day",
  "endDayId": "encrypted_end_day",
  "startHour": "encrypted_09:00",
  "endHour": "encrypted_10:30",
  "isAllDay": false,
  "isMultiDay": false,
  "category": "work",
  "color": "#4A90E2",
  "encryptedDataKey": "base64_encrypted_data_key"
}
```

**Success Response:**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440006",
        "title": "Réunion équipe",
        "description": "Discussion hebdomadaire",
        "dayId": 738150,
        "startDayId": "encrypted_start_day",
        "endDayId": "encrypted_end_day",
        "startHour": "encrypted_09:00",
        "endHour": "encrypted_10:30",
        "isAllDay": false,
        "isMultiDay": false,
        "category": "work",
        "color": "#4A90E2",
        "encryptedDataKey": "base64_encrypted_data_key",
        "created_at": "2026-02-21T10:00:00Z",
        "updated_at": "2026-02-21T10:00:00Z"
      }
    ]
  },
  "error": null
}
```

---

## Important Notes

### E2EE Encryption

- All file and folder metadata is encrypted client-side with AES-256-GCM
- Encryption keys are stored encrypted by the user key (master key)
- The server never sees encryption keys in plaintext
- File names and contents are fully encrypted

### File Upload

- **Maximum chunk size: 6 MB**
- Chunks are uploaded sequentially with an index
- Each chunk has its own initialization vector (IV)
- After all chunks, call `finalize_upload` with state `completed`

### Rate Limiting

Authentication endpoints are protected by Redis rate limiting:
- 5 failed login attempts → blocked for 15 minutes
- Counters are stored in Redis with key `failed_login:{email}`

### Error Handling

- Validation errors return `400 Bad Request`
- Resources not found return `404 Not Found`
- Unauthorized access returns `403 Forbidden`
- Internal errors return `500 Internal Server Error` with a correlation ID

---

Last updated: 2026-02-21
