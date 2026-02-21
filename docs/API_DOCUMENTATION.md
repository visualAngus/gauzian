# API Documentation - GAUZIAN Backend

Documentation complète de l'API REST du backend GAUZIAN (Rust / Axum).

**Version** : 1.1
**Base URL** : `https://gauzian.pupin.fr/api`
**Format** : JSON
**Authentification** : JWT (Cookie `auth_token` ou Header `Authorization: Bearer <token>`)

---

## Table des Matières

1. [Introduction](#introduction)
2. [Authentification](#authentification)
3. [Endpoints Système](#endpoints-système)
4. [Module Auth](#module-auth)
5. [Module Drive - Files](#module-drive---files)
6. [Module Drive - Folders](#module-drive---folders)
7. [Module Drive - Access](#module-drive---access)
8. [Module Drive - Global](#module-drive---global)
9. [Module Agenda](#module-agenda)
10. [Schémas de Données](#schémas-de-données)
11. [Codes d'Erreur](#codes-derreur)
12. [Exemples d'Utilisation](#exemples-dutilisation)

---

## Introduction

L'API GAUZIAN est une API REST **zero-knowledge, end-to-end encrypted (E2EE)**. Le serveur ne voit jamais les données en clair.

### Caractéristiques

- **E2EE** : Toutes les données sensibles sont chiffrées côté client
- **Chunked Upload** : Support de fichiers volumineux (chunks de 2MB, format binaire multipart)
- **Soft Delete** : Les fichiers/dossiers sont marqués `is_deleted = true` (pas supprimés immédiatement)
- **Permission System** : Ownership (`owner`, `editor`, `viewer`) avec partage E2EE
- **JWT Authentication** : Tokens valides 10 jours, révoqués au logout

### Technologies

- **Backend** : Rust (Axum 0.7+, SQLx, Tokio)
- **Database** : PostgreSQL 17
- **Cache** : Redis 7 (token revocation)
- **Storage** : MinIO S3 (chunks chiffrés)
- **Monitoring** : Prometheus (17 métriques custom)

---

## Authentification

### Méthodes d'Authentification

L'API supporte **deux méthodes** pour envoyer le JWT :

#### 1. Cookie (Recommandé)

```http
Cookie: auth_token=<jwt_token>
```

- ✅ Automatiquement envoyé par le navigateur
- ✅ HttpOnly, Secure, SameSite=None
- ✅ Durée : 10 jours

#### 2. Authorization Header

```http
Authorization: Bearer <jwt_token>
```

- Utile pour les clients non-browser (mobile apps, scripts)

### Obtenir un JWT

**Endpoint** : `POST /login`

```bash
curl -X POST https://gauzian.pupin.fr/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Réponse** :

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

## Endpoints Système

### GET `/`

**Description** : Health check.

**Authentification** : ❌ Non requise

**Réponse** :

```
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

### GET `/metrics`

**Description** : Métriques Prometheus (17 métriques custom).

**Authentification** : ❌ Non requise

**Réponse** : Format Prometheus text

```
# HELP gauzian_requests_total Total number of HTTP requests
# TYPE gauzian_requests_total counter
gauzian_requests_total{method="GET",status="200"} 1234

# HELP gauzian_request_duration_seconds Request duration histogram
# TYPE gauzian_request_duration_seconds histogram
gauzian_request_duration_seconds_bucket{method="POST",endpoint="/drive/initialize_file",le="0.1"} 456
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
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Cookie Set** : `auth_token=<token>` (HttpOnly, Secure, 10 jours)

**Errors** :
- `401 Unauthorized` - Invalid credentials
- `500 Internal Server Error` - JWT generation failed

**Exemple curl** :

```bash
curl -X POST https://gauzian.pupin.fr/api/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
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
  "ok": true,
  "data": "User created with ID: 550e8400-e29b-41d4-a716-446655440000"
}
```

**Cookie Set** : `auth_token=<token>` (HttpOnly, Secure, 10 jours)

**⭐ Auto-Login** : `/register` retourne automatiquement un JWT et set le cookie `auth_token`. L'utilisateur est connecté immédiatement après inscription (pas besoin d'appeler `/login`).

**Errors** :
- `400 Bad Request` - Validation error (email invalid, password too short)
- `409 Conflict` - Email already exists
- `500 Internal Server Error` - Database error

---

### POST /logout

Revoke the JWT token by adding it to the Redis blacklist.

**Success Response:**

```json
{
  "ok": true,
  "data": "Logged out successfully"
}
```

**Effet** : Le JWT est ajouté à Redis avec TTL = durée restante du token.

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

**Errors** :
- `401 Unauthorized` - Token invalide ou révoqué

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
    "user_id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "recipient@example.com",
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0..."
  }
}
```

**Errors** :
- `404 Not Found` - Utilisateur introuvable

**Usage** : Utilisé par le frontend pour récupérer la clé publique du destinataire lors d'un partage de fichier/dossier.

---

## Module Drive - Files

### POST `/drive/initialize_file`

**Not Found Response:**

```json
{
  "success": false,
  "data": null,
  "error": "User not found"
}
```

**Champs** :
- `size` (i64) - Taille du fichier en bytes
- `encrypted_metadata` (string) - Nom du fichier chiffré avec AES-256-GCM (format: `"iv:ciphertext"`)
- `mime_type` (string) - Type MIME (`application/pdf`, `image/png`, etc.)
- `folder_id` (string UUID) - ID du dossier parent
- `encrypted_file_key` (string) - Clé AES-256 du fichier, chiffrée avec `record_key`

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "file_id": "880e8400-e29b-41d4-a716-446655440003"
  }
}
```

**Errors** :
- `400 Bad Request` - folder_id invalide
- `404 Not Found` - Dossier introuvable
- `500 Internal Server Error` - Database error

**Workflow Upload** :

```
1. Client génère fileKey (AES-256)
2. Client chiffre filename avec recordKey → encrypted_metadata
3. Client chiffre fileKey avec recordKey → encrypted_file_key
4. POST /drive/initialize_file → retourne file_id
5. Client upload chunks : POST /drive/files/{file_id}/upload-chunk
6. Client finalise : POST /drive/finalize_upload/{file_id}/success
```

---

### POST `/drive/files/{file_id}/upload-chunk`

**Description** : Upload un chunk chiffré (format binaire multipart).

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID) - ID du fichier

**Request Body** : `multipart/form-data`

```
chunk_index: 0
total_chunks: 10
chunk: <binary encrypted data>
iv: <base64_iv>
```

**Success Response:**

```json
{
  "ok": true,
  "data": "Chunk uploaded successfully"
}
```

**Limite** : 6 MB par chunk (DefaultBodyLimit)

**Errors** :
- `400 Bad Request` - chunk_index invalide ou chunk trop gros
- `404 Not Found` - Fichier introuvable
- `500 Internal Server Error` - S3 error

**Exemple curl** :

```bash
curl -X POST https://gauzian.pupin.fr/api/drive/files/880e8400-e29b-41d4-a716-446655440003/upload-chunk \
  -b cookies.txt \
  -F "chunk_index=0" \
  -F "total_chunks=10" \
  -F "chunk=@chunk_0.enc" \
  -F "iv=abc123=="
```

---

### POST `/drive/finalize_upload/{file_id}/{etat}`

**Description** : Finalise l'upload (marque `is_fully_uploaded = true` ou annule).

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

**Effet** :
- `etat = "success"` → `UPDATE files SET is_fully_uploaded = true`
- `etat = "failure"` → Soft delete du fichier + suppression des chunks S3

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

**Errors** :
- `403 Forbidden` - Pas de permission
- `404 Not Found` - Fichier introuvable

---

#### DELETE /drive/files/{file_id}

Delete a file (move to trash).

**Authentification** : ✅ Requise

**Path Parameters** :
- `s3_key` (string) - Clé S3 du chunk (URL-encoded)

**Response** : `200 OK` (binary stream)

```
Content-Type: application/octet-stream
Content-Length: 2097152

<binary encrypted chunk data>
```

**Workflow Download** :

```
1. GET /drive/file/{file_id} → récupérer encrypted_file_key + s3_keys
2. Pour chaque s3_key : GET /drive/download_chunk_binary/{s3_key}
3. Client déchiffre encrypted_file_key avec recordKey → fileKey
4. Client déchiffre chaque chunk avec fileKey + IV
5. Client reconstruit le fichier complet
```

**Exemple curl** :

```bash
curl -X GET "https://gauzian.pupin.fr/api/drive/download_chunk_binary/chunks%2F880e8400%2F0" \
  -b cookies.txt \
  -o chunk_0.enc
```

---

### PATCH `/drive/files/{file_id}`

**Description** : Renomme un fichier (update `encrypted_metadata`).

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Request Body** :

```json
{
  "encrypted_metadata": "new_iv:new_ciphertext_base64"
}
```

**Success Response:**

**Errors** :
- `403 Forbidden` - Pas de permission (seul `owner` et `editor` peuvent renommer)
- `404 Not Found` - Fichier introuvable

---

### PATCH `/drive/files/{file_id}/move`

**Description** : Déplace un fichier vers un autre dossier.

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Request Body** :

```json
{
  "new_folder_id": "990e8400-e29b-41d4-a716-446655440004",
  "encrypted_file_key": "new_encrypted_file_key_base64"
}
```

**Response** : `200 OK`

**Errors** :
- `403 Forbidden` - Pas de permission sur le fichier ou le dossier de destination

---

### DELETE `/drive/files/{file_id}`

**Description** : Soft delete d'un fichier (marque `is_deleted = true`).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | path | File UUID |
| `user_id` | path | User UUID |

**Path Parameters** :
- `file_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": "File deleted successfully"
}
```

**Effet** : `UPDATE files SET is_deleted = true, updated_at = NOW()`

**Note** : Les chunks S3 ne sont **pas** supprimés immédiatement (optimisation pour restore).

---

### POST `/drive/restore_file`

**Description** : Restaure un fichier soft-deleted (marque `is_deleted = false`).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "success": true,
  "data": "File accepted successfully",
  "error": null
}
```

---

### POST `/drive/files/{file_id}/share`

**Description** : Partage un fichier avec un utilisateur (E2EE).

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Success Response:**

```json
{
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "encrypted_file_key": "<file_key_wrapped_with_recipient_rsa_public_key>",
  "access_level": "viewer"
}
```

**Champs** :
- `encrypted_file_key` : `file_key` chiffrée avec la clé publique RSA du destinataire
- `access_level` : `"owner"`, `"editor"`, ou `"viewer"`

**Response** : `200 OK`

**Workflow E2EE** :

```
1. GET /contacts/get_public_key/{email} → clé publique du destinataire
2. Client déchiffre file_key avec sa record_key
3. Client chiffre file_key avec la clé publique RSA du destinataire (RSA-OAEP)
4. POST /drive/files/{file_id}/share
5. Serveur crée un file_access record
6. Destinataire déchiffre file_key avec sa clé privée RSA
```

---

### POST `/drive/files/{file_id}/accept`

**Description** : Accepte un partage de fichier reçu.

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Response** : `200 OK`

---

### POST `/drive/files/{file_id}/reject`

**Description** : Rejette un partage de fichier reçu.

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Response** : `200 OK`

---

### GET `/drive/file/{file_id}/InfoItem`

**Description** : Récupère les métadonnées complètes d'un fichier (incluant permissions et liste de partage).

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Response** : `200 OK`

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

### PATCH `/drive/folders/{folder_id}`

**Description** : Renomme un dossier.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Request Body** :

```json
{
  "encrypted_metadata": "new_iv:new_ciphertext_base64"
}
```

**Response** : `200 OK`

**Errors** :
- `403 Forbidden` - Pas de permission (seul `owner` et `editor` peuvent renommer)

---

### PATCH `/drive/folders/{folder_id}/move`

**Description** : Déplace un dossier vers un nouveau dossier parent.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Request Body** :

```json
{
  "new_parent_folder_id": "cc0e8400-e29b-41d4-a716-446655440007"
}
```

**Response** : `200 OK`

**Validation** : Empêche les déplacements circulaires (dossier ne peut pas être son propre parent).

---

### DELETE `/drive/folders/{folder_id}`

**Description** : Soft delete d'un dossier (et récursivement tous ses enfants).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

**Effet** : Marque `is_deleted = true` pour le dossier ET tous ses fichiers/sous-dossiers (récursif).

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

**Response** : `200 OK`

---

### POST `/drive/share_folder_batch`

**Description** : Partage un dossier ET tous ses fichiers/sous-dossiers récursivement (E2EE).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "contact_id": "770e8400-e29b-41d4-a716-446655440003",
  "encrypted_item_key": "base64_encrypted_folder_key_for_contact",
  "access_level": "write"
}
```

**Champs** :
- `encrypted_file_keys` : Map de `file_id` → `encrypted_file_key` pour tous les fichiers du dossier

**Response** : `200 OK`

**Workflow** :

```
1. GET /contacts/get_public_key/{email} → clé publique du destinataire
2. Client récupère récursivement tous les fichiers du dossier
3. Client chiffre folder_key et chaque file_key avec la clé publique RSA du destinataire
4. POST /drive/share_folder_batch
5. Serveur crée folder_access + file_access pour chaque fichier
```

---

### POST `/drive/folders/{folder_id}/accept`

**Description** : Accepte un partage de dossier reçu.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

---

### POST `/drive/folders/{folder_id}/reject`

**Description** : Rejette un partage de dossier reçu.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

---

### GET `/drive/folder/{folder_id}/shared_users`

**Description** : Liste les utilisateurs avec qui le dossier est partagé.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

```json
{
  "success": true,
  "data": "Access revoked successfully",
  "error": null
}
```

---

### POST /drive/folders/{folder_id}/accept

**Description** : Récupère les métadonnées complètes d'un dossier (incluant permissions et liste de partage).

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

**Description** : Propage les permissions d'un fichier à un utilisateur (après partage de dossier parent).

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Success Response:**

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003",
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "encrypted_file_key": "encrypted_file_key_base64",
  "access_level": "viewer"
}
```

**Response** : `200 OK`

---

### POST `/drive/propagate_folder_access`

**Description** : Propage les permissions d'un dossier à un utilisateur (après partage de dossier parent).

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | path | Folder UUID |

**Success Response:**

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "encrypted_folder_key": "encrypted_folder_key_base64",
  "access_level": "editor"
}
```

**Response** : `200 OK`

---

### POST `/drive/revoke-access`

**Description** : Révoque les permissions d'un fichier ou dossier pour un utilisateur.

**Authentification** : ✅ Requise

**Request Body (fichier)** :

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

**Request Body (dossier)** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "user_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response** : `200 OK`

**Effet** : Supprime le `file_access` ou `folder_access` record.

---

## Module Drive - Global

### GET `/drive/get_all_drive_info/{parent_id}`

**Description** : Récupère les informations complètes du drive (fichiers, dossiers, quota). Endpoint principal utilisé au chargement de la page drive.

**Authentification** : ✅ Requise

**Path Parameters** :
- `parent_id` (string) - UUID du dossier parent, `"root"`, `"corbeille"`, ou `"shared_with_me"`

**Response** : `200 OK`

```json
{
  "folder_id": "880e8400-e29b-41d4-a716-446655440004"
}
```

---

### GET `/drive/get_file_folder/{parent_id}`

**Description** : Liste les fichiers et dossiers d'un dossier. Supporte les vues virtuelles `root`, `corbeille`, `shared_with_me`.

**Authentification** : ✅ Requise

**Path Parameters** :
- `parent_id` (string) - UUID du dossier, `"root"`, `"corbeille"`, ou `"shared_with_me"`

**Response** : `200 OK` (même format que `/drive/folder_contents/{folder_id}`)

---

### POST `/drive/empty_trash`

**Description** : Vide la corbeille (hard delete de tous les fichiers/dossiers soft-deleted).

**Authentification** : ✅ Requise

**Request Body** : Aucun

**Response** : `200 OK`

```json
{
  "success": true,
  "data": "Folder restored successfully",
  "error": null
}
```

**Effet** :
1. Supprime tous les chunks S3 des fichiers soft-deleted
2. Hard delete tous les `files` et `folders` où `is_deleted = true`
3. Libère l'espace de stockage

**⚠️ Attention** : Opération **irréversible**.

---

## Module Agenda

### GET `/agenda/events`

**Description** : Liste les événements d'agenda de l'utilisateur pour une plage de jours.

**Authentification** : ✅ Requise

**Query Parameters** :
- `startDayId` (integer) - ID du jour de début
- `endDayId` (integer) - ID du jour de fin

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "id": "dd0e8400-e29b-41d4-a716-446655440009",
      "encrypted_title": "iv:ciphertext_base64",
      "encrypted_description": "iv:ciphertext_base64",
      "encrypted_data_key": "encrypted_aes_key_base64",
      "start_time": "2025-01-20T14:00:00Z",
      "end_time": "2025-01-20T15:00:00Z",
      "is_all_day": false,
      "category_id": "ee0e8400-e29b-41d4-a716-446655440010",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

**Exemple curl** :

```bash
curl -X GET "https://gauzian.pupin.fr/api/agenda/events?startDayId=20250101&endDayId=20250131" \
  -b cookies.txt
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

## Exemples d'Utilisation

### Workflow Complet : Upload Fichier E2EE

```bash
#!/bin/bash

API_URL="https://gauzian.pupin.fr/api"
EMAIL="user@example.com"
PASSWORD="password123"
FILE_PATH="document.pdf"
FOLDER_ID="770e8400-e29b-41d4-a716-446655440002"

# 1. Login
echo "1. Login..."
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo $LOGIN_RESPONSE

# 2. Initialize file
echo "2. Initialize file..."
FILE_SIZE=$(stat -f%z "$FILE_PATH")
INIT_RESPONSE=$(curl -s -X POST $API_URL/drive/initialize_file \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d "{
    \"size\": $FILE_SIZE,
    \"encrypted_metadata\": \"iv_example:encrypted_filename_example\",
    \"mime_type\": \"application/pdf\",
    \"folder_id\": \"$FOLDER_ID\",
    \"encrypted_file_key\": \"encrypted_file_key_example\"
  }")

FILE_ID=$(echo $INIT_RESPONSE | jq -r '.data.file_id')
echo "File ID: $FILE_ID"

# 3. Split file into chunks (2MB each)
echo "3. Splitting file into chunks..."
split -b 2097152 "$FILE_PATH" chunk_
TOTAL_CHUNKS=$(ls chunk_* | wc -l)

# 4. Upload chunks (binary multipart)
echo "4. Uploading chunks..."
CHUNK_INDEX=0
for chunk in chunk_*; do
  echo "  Uploading chunk $CHUNK_INDEX..."
  curl -s -X POST "$API_URL/drive/files/$FILE_ID/upload-chunk" \
    -b cookies.txt \
    -F "chunk_index=$CHUNK_INDEX" \
    -F "total_chunks=$TOTAL_CHUNKS" \
    -F "chunk=@$chunk" \
    -F "iv=iv_example"

  CHUNK_INDEX=$((CHUNK_INDEX + 1))
done

# 5. Finalize upload
echo "5. Finalizing upload..."
curl -s -X POST $API_URL/drive/finalize_upload/$FILE_ID/success \
  -b cookies.txt

echo "Upload complete!"

# Cleanup
rm chunk_*
```

---

### Workflow Complet : Partage E2EE

```bash
#!/bin/bash

API_URL="https://gauzian.pupin.fr/api"
FILE_ID="880e8400-e29b-41d4-a716-446655440003"
RECIPIENT_EMAIL="recipient@example.com"

# 1. Récupérer la clé publique du destinataire
echo "1. Getting recipient's public key..."
PUBLIC_KEY_RESPONSE=$(curl -s -X GET "$API_URL/contacts/get_public_key/$RECIPIENT_EMAIL" \
  -b cookies.txt)

RECIPIENT_PUBLIC_KEY=$(echo $PUBLIC_KEY_RESPONSE | jq -r '.data.public_key')
RECIPIENT_USER_ID=$(echo $PUBLIC_KEY_RESPONSE | jq -r '.data.user_id')

echo "Recipient User ID: $RECIPIENT_USER_ID"

# 2. Chiffrer file_key avec la clé publique RSA du destinataire
# (Ce chiffrement se fait côté client avec crypto.ts / RSA-OAEP)
WRAPPED_FILE_KEY="wrapped_file_key_example_base64"

# 3. Partager le fichier
echo "2. Sharing file..."
curl -s -X POST "$API_URL/drive/files/$FILE_ID/share" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d "{
    \"recipient_user_id\": \"$RECIPIENT_USER_ID\",
    \"encrypted_file_key\": \"$WRAPPED_FILE_KEY\",
    \"access_level\": \"viewer\"
  }"

echo "File shared successfully!"
```

---

### Workflow Complet : Download Fichier E2EE

```bash
#!/bin/bash

API_URL="https://gauzian.pupin.fr/api"
FILE_ID="880e8400-e29b-41d4-a716-446655440003"
OUTPUT_FILE="downloaded_file.pdf"

# 1. Récupérer les métadonnées du fichier (s3_keys inclus)
echo "1. Getting file metadata..."
FILE_INFO=$(curl -s -X GET "$API_URL/drive/file/$FILE_ID" \
  -b cookies.txt)

ENCRYPTED_FILE_KEY=$(echo $FILE_INFO | jq -r '.data.encrypted_file_key')
S3_KEYS=($(echo $FILE_INFO | jq -r '.data.s3_keys[]'))

echo "Total chunks: ${#S3_KEYS[@]}"

# 2. Download chaque chunk
echo "2. Downloading chunks..."
rm -f chunk_*.enc

for i in "${!S3_KEYS[@]}"; do
  S3_KEY="${S3_KEYS[$i]}"
  S3_KEY_ENCODED=$(printf %s "$S3_KEY" | jq -sRr @uri)

  echo "  Downloading chunk $i..."
  curl -s -X GET "$API_URL/drive/download_chunk_binary/$S3_KEY_ENCODED" \
    -b cookies.txt \
    -o "chunk_$i.enc"
done

# 3. Déchiffrer et reconstruire le fichier
# (Le déchiffrement se fait côté client avec crypto.ts)
echo "3. Reconstructing file..."
cat chunk_*.enc > "$OUTPUT_FILE"

echo "Download complete: $OUTPUT_FILE"

# Cleanup
rm chunk_*.enc
```

---

## Monitoring & Observabilité

### Prometheus Metrics

Toutes les requêtes sont trackées automatiquement via le middleware `metrics::track_metrics`.

**Requêtes utiles** :

```promql
# Latence p99 par endpoint
histogram_quantile(0.99,
  rate(gauzian_request_duration_seconds_bucket[5m])
)

# Taux d'erreur 5xx
rate(gauzian_requests_total{status=~"5.."}[5m])
/
rate(gauzian_requests_total[5m])

# Uploads S3 par minute
rate(gauzian_s3_uploads_total[1m]) * 60
```

**Alerts configurées** :
- `HighErrorRate` : Taux d'erreur > 5%
- `HighLatency` : P99 latency > 1s
- `DatabasePoolExhausted` : `gauzian_db_pool_active` > 18/20
- `RedisDown` : `gauzian_redis_cache_hits == 0` pendant 5 min

---

## Notes de Sécurité

### Zero-Knowledge Architecture

⚠️ **Le serveur ne voit JAMAIS les données en clair.**

**Ce qui est chiffré côté client** :
- Noms de fichiers / dossiers (`encrypted_metadata`)
- Contenu des fichiers (chunks S3)
- Titres / descriptions d'événements d'agenda
- Toutes les clés AES (`encrypted_file_key`, `encrypted_folder_key`, `encrypted_data_key`)

**Ce qui est en clair côté serveur** :
- Emails
- Password hashes (Argon2)
- Métadonnées non-sensibles (taille fichier, MIME type, timestamps)
- Clés publiques RSA (nécessaires pour le partage E2EE)

### Bonnes Pratiques

✅ **DO** :
- Toujours utiliser HTTPS en production
- Générer des IV uniques pour chaque chiffrement AES
- Utiliser des clés RSA-4096 minimum
- Utiliser PBKDF2 avec 310k iterations minimum
- Nettoyer IndexedDB au logout

❌ **DON'T** :
- Ne jamais logger les clés crypto ou les JWTs
- Ne jamais réutiliser le même IV
- Ne jamais envoyer les clés en clair (même en HTTPS)
- Ne jamais stocker les clés côté serveur

---

**Dernière mise à jour** : 2026-02-21
**Version API** : 1.1
**Backend Version** : Rust stable, Axum 0.7+, SQLx 0.7+
