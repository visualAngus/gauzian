# API Documentation - GAUZIAN Backend

Documentation complète de l'API REST du backend GAUZIAN (Rust / Axum).

**Version** : 1.0
**Base URL** : `https://api.gauzian.com`
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
8. [Module Agenda](#module-agenda)
9. [Schémas de Données](#schémas-de-données)
10. [Codes d'Erreur](#codes-derreur)
11. [Exemples d'Utilisation](#exemples-dutilisation)

---

## Introduction

L'API GAUZIAN est une API REST **zero-knowledge, end-to-end encrypted (E2EE)**. Le serveur ne voit jamais les données en clair.

### Caractéristiques

- **E2EE** : Toutes les données sensibles sont chiffrées côté client
- **Chunked Upload** : Support de fichiers volumineux (chunks de 2MB)
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
curl -X POST https://api.gauzian.com/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Réponse** :

```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Le cookie `auth_token` est automatiquement set avec HttpOnly.

### Token Révocation

Au logout, le token est ajouté à une **blacklist Redis** (TTL = durée restante du token).

---

## Endpoints Système

### GET `/`

**Description** : Health check pour Clever Cloud.

**Authentification** : ❌ Non requise

**Réponse** :

```
OK
```

---

### GET `/health/ready`

**Description** : Health check Kubernetes readiness probe.

**Authentification** : ❌ Non requise

**Réponse** :

```
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
gauzian_request_duration_seconds_bucket{method="POST",endpoint="/files/initialize",le="0.1"} 456
...
```

**Métriques disponibles** :
- `gauzian_requests_total` (counter) - Total requêtes HTTP
- `gauzian_request_duration_seconds` (histogram) - Durée des requêtes
- `gauzian_active_connections` (gauge) - Connexions actives
- `gauzian_db_pool_active` (gauge) - Connexions DB actives
- `gauzian_redis_cache_hits` / `gauzian_redis_cache_misses` (counter)
- `gauzian_s3_uploads_total` / `gauzian_s3_downloads_total` (counter)
- `gauzian_file_operations_total` (counter) - Opérations fichiers par type
- ... (voir `metrics.rs` pour liste complète)

---

## Module Auth

### POST `/login`

**Description** : Authentifie un utilisateur et retourne un JWT.

**Authentification** : ❌ Non requise

**Request Body** :

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** : `200 OK`

```json
{
  "ok": true,
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
curl -X POST https://api.gauzian.com/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

---

### POST `/register`

**Description** : Crée un nouvel utilisateur avec clés E2EE.

**Authentification** : ❌ Non requise

**Request Body** :

```json
{
  "email": "user@example.com",
  "username": "john_doe",
  "password": "password123",
  "encrypted_private_key": "<base64_encrypted_rsa_private_key>",
  "public_key": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0...",
  "private_key_salt": "<base64_salt>",
  "iv": "<base64_iv>",
  "encrypted_record_key": "<base64_encrypted_aes_key>"
}
```

**Champs E2EE** :
- `encrypted_private_key` : Clé privée RSA-4096 chiffrée avec password-derived key (PBKDF2 310k iterations)
- `public_key` : Clé publique RSA-4096 au format PEM
- `encrypted_record_key` : Clé AES-256 pour chiffrer les métadonnées (nom de fichier, dossier)
- `private_key_salt` : Salt pour dérivation de clé
- `iv` : Initialization Vector pour AES-GCM

**Response** : `201 Created`

```json
{
  "ok": true,
  "data": "User registered successfully"
}
```

**Errors** :
- `400 Bad Request` - Validation error (email invalid, password too short)
- `409 Conflict` - Email already exists
- `500 Internal Server Error` - Database error

**Exemple curl** :

```bash
curl -X POST https://api.gauzian.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "john_doe",
    "password": "password123",
    "encrypted_private_key": "U2FsdGVkX1...",
    "public_key": "-----BEGIN PUBLIC KEY-----\n...",
    "private_key_salt": "abc123",
    "iv": "def456",
    "encrypted_record_key": "ghi789"
  }'
```

---

### POST `/logout`

**Description** : Révoque le JWT (ajout à la blacklist Redis).

**Authentification** : ✅ Requise

**Request Body** : Aucun

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": "Logged out successfully"
}
```

**Effet** : Le JWT est ajouté à Redis avec TTL = durée restante du token.

**Exemple curl** :

```bash
curl -X POST https://api.gauzian.com/logout \
  -b cookies.txt
```

---

### GET `/autologin`

**Description** : Vérifie si le JWT actuel est valide et retourne les infos utilisateur.

**Authentification** : ✅ Requise

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "john_doe",
    "encrypted_private_key": "U2FsdGVkX1...",
    "public_key": "-----BEGIN PUBLIC KEY-----\n...",
    "encrypted_record_key": "ghi789",
    "private_key_salt": "abc123",
    "iv": "def456"
  }
}
```

**Errors** :
- `401 Unauthorized` - Token invalide ou révoqué

**Exemple curl** :

```bash
curl -X GET https://api.gauzian.com/autologin \
  -b cookies.txt
```

---

### GET `/protected`

**Description** : Endpoint de test pour vérifier l'authentification.

**Authentification** : ✅ Requise

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": "Bienvenue 550e8400-e29b-41d4-a716-446655440000 ! Tu es authentifié via Cookie."
}
```

---

### GET `/info`

**Description** : Retourne les informations complètes de l'utilisateur authentifié.

**Authentification** : ✅ Requise

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "john_doe",
    "encrypted_private_key": "U2FsdGVkX1...",
    "public_key": "-----BEGIN PUBLIC KEY-----\n...",
    "encrypted_record_key": "ghi789",
    "private_key_salt": "abc123",
    "iv": "def456",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

---

### GET `/contacts/get_public_key/{email}`

**Description** : Récupère la clé publique RSA d'un utilisateur (pour partage E2EE).

**Authentification** : ✅ Requise

**Path Parameters** :
- `email` (string) - Email de l'utilisateur dont on veut la clé publique

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "user_id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "recipient@example.com",
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0..."
  }
}
```

**Errors** :
- `404 Not Found` - Utilisateur introuvable

**Exemple curl** :

```bash
curl -X GET https://api.gauzian.com/contacts/get_public_key/recipient@example.com \
  -b cookies.txt
```

**Usage** : Utilisé par le frontend pour récupérer la clé publique du destinataire lors d'un partage de fichier.

---

## Module Drive - Files

### POST `/drive/initialize_file`

**Description** : Initialise un upload de fichier (crée l'enregistrement DB).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "size": 10485760,
  "encrypted_metadata": "iv:ciphertext_base64",
  "mime_type": "application/pdf",
  "folder_id": "770e8400-e29b-41d4-a716-446655440002",
  "encrypted_file_key": "encrypted_aes_key_base64"
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

**Workflow** :

```
1. Client génère fileKey (AES-256)
2. Client chiffre filename avec recordKey → encrypted_metadata
3. Client chiffre fileKey avec recordKey → encrypted_file_key
4. POST /drive/initialize_file
5. Serveur crée file record (is_fully_uploaded = false)
6. Serveur retourne file_id
7. Client upload chunks avec POST /drive/upload_chunk
8. Client finalise avec POST /drive/finalize_upload/{file_id}/success
```

**Exemple curl** :

```bash
curl -X POST https://api.gauzian.com/drive/initialize_file \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "size": 10485760,
    "encrypted_metadata": "abc123:def456",
    "mime_type": "application/pdf",
    "folder_id": "770e8400-e29b-41d4-a716-446655440002",
    "encrypted_file_key": "ghi789"
  }'
```

---

### POST `/drive/upload_chunk`

**Description** : Upload un chunk chiffré (format JSON base64).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003",
  "chunk_index": 0,
  "total_chunks": 10,
  "encrypted_chunk": "<base64_encrypted_data>",
  "iv": "<base64_iv>"
}
```

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": "Chunk uploaded successfully"
}
```

**Limite** : 2 MB par chunk (DefaultBodyLimit)

**Errors** :
- `400 Bad Request` - file_id invalide ou chunk trop gros
- `404 Not Found` - Fichier introuvable
- `500 Internal Server Error` - S3 error

---

### POST `/drive/upload_chunk_binary`

**Description** : Upload un chunk chiffré (format binaire multipart).

**Authentification** : ✅ Requise

**Request Body** : `multipart/form-data`

```
file_id: 880e8400-e29b-41d4-a716-446655440003
chunk_index: 0
total_chunks: 10
chunk: <binary encrypted data>
iv: <base64_iv>
```

**Response** : `200 OK`

**Limite** : 2 MB par chunk

**Exemple curl** :

```bash
curl -X POST https://api.gauzian.com/drive/upload_chunk_binary \
  -b cookies.txt \
  -F "file_id=880e8400-e29b-41d4-a716-446655440003" \
  -F "chunk_index=0" \
  -F "total_chunks=10" \
  -F "chunk=@chunk_0.enc" \
  -F "iv=abc123=="
```

**Performance** : Plus rapide que `/upload_chunk` (pas de base64 overhead).

---

### POST `/drive/finalize_upload/{file_id}/{etat}`

**Description** : Finalise l'upload (marque `is_fully_uploaded = true` ou annule).

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID) - ID du fichier
- `etat` (string) - `"success"` ou `"failure"`

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": "Upload finalized successfully"
}
```

**Effet** :
- `etat = "success"` → `UPDATE files SET is_fully_uploaded = true`
- `etat = "failure"` → Soft delete du fichier + suppression des chunks S3

**Exemple curl** :

```bash
curl -X POST https://api.gauzian.com/drive/finalize_upload/880e8400-e29b-41d4-a716-446655440003/success \
  -b cookies.txt
```

---

### POST `/drive/abort_upload`

**Description** : Annule un upload en cours (soft delete + cleanup S3).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003"
}
```

**Response** : `200 OK`

**Effet** : Supprime les chunks S3 et marque le fichier comme `is_deleted = true`.

---

### GET `/drive/file/{file_id}`

**Description** : Récupère les métadonnées d'un fichier.

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "encrypted_metadata": "iv:ciphertext_base64",
    "encrypted_file_key": "encrypted_aes_key_base64",
    "size": 10485760,
    "mime_type": "application/pdf",
    "folder_id": "770e8400-e29b-41d4-a716-446655440002",
    "is_fully_uploaded": true,
    "is_deleted": false,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:35:00Z"
  }
}
```

**Errors** :
- `403 Forbidden` - Pas de permission
- `404 Not Found` - Fichier introuvable

---

### GET `/drive/download/{file_id}`

**Description** : Retourne la liste des `s3_key` pour download des chunks.

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "file_id": "880e8400-e29b-41d4-a716-446655440003",
    "encrypted_metadata": "iv:ciphertext_base64",
    "encrypted_file_key": "encrypted_aes_key_base64",
    "s3_keys": [
      "chunks/880e8400-e29b-41d4-a716-446655440003/0",
      "chunks/880e8400-e29b-41d4-a716-446655440003/1",
      "chunks/880e8400-e29b-41d4-a716-446655440003/2"
    ]
  }
}
```

**Workflow** :

```
1. Client appelle GET /drive/download/{file_id}
2. Serveur retourne s3_keys[]
3. Client déchiffre encrypted_file_key avec recordKey → fileKey
4. Pour chaque s3_key, client appelle GET /drive/download_chunk/{s3_key}
5. Client déchiffre chunk avec fileKey
6. Client reconstruit le fichier complet
```

---

### GET `/drive/download_chunk/{s3_key}`

**Description** : Download un chunk chiffré (format JSON base64).

**Authentification** : ✅ Requise

**Path Parameters** :
- `s3_key` (string) - Clé S3 du chunk (URL-encoded)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "encrypted_chunk": "<base64_encrypted_data>",
    "iv": "<base64_iv>"
  }
}
```

**Errors** :
- `403 Forbidden` - Pas de permission
- `404 Not Found` - Chunk introuvable dans S3

**Exemple curl** :

```bash
curl -X GET "https://api.gauzian.com/drive/download_chunk/chunks%2F880e8400%2F0" \
  -b cookies.txt
```

---

### GET `/drive/download_chunk_binary/{s3_key}`

**Description** : Download un chunk chiffré (format binaire).

**Authentification** : ✅ Requise

**Path Parameters** :
- `s3_key` (string) - Clé S3 du chunk (URL-encoded)

**Response** : `200 OK` (binary stream)

```
Content-Type: application/octet-stream
Content-Length: 2097152

<binary encrypted chunk data>
```

**Performance** : Plus rapide que `/download_chunk` (pas de base64 overhead).

**Exemple curl** :

```bash
curl -X GET "https://api.gauzian.com/drive/download_chunk_binary/chunks%2F880e8400%2F0" \
  -b cookies.txt \
  -o chunk_0.enc
```

---

### POST `/drive/delete_file`

**Description** : Soft delete d'un fichier (marque `is_deleted = true`).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003"
}
```

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

### POST `/drive/rename_file`

**Description** : Renomme un fichier (update `encrypted_metadata`).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003",
  "encrypted_metadata": "new_iv:new_ciphertext_base64"
}
```

**Response** : `200 OK`

**Errors** :
- `403 Forbidden` - Pas de permission (seul `owner` et `editor` peuvent renommer)

---

### POST `/drive/move_file`

**Description** : Déplace un fichier vers un autre dossier.

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003",
  "new_folder_id": "990e8400-e29b-41d4-a716-446655440004"
}
```

**Response** : `200 OK`

**Errors** :
- `403 Forbidden` - Pas de permission sur le fichier ou le dossier de destination

---

### POST `/drive/restore_file`

**Description** : Restaure un fichier soft-deleted (marque `is_deleted = false`).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003"
}
```

**Response** : `200 OK`

---

### POST `/drive/share_file`

**Description** : Partage un fichier avec un utilisateur (E2EE).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003",
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
1. Client récupère la clé publique du destinataire (GET /contacts/get_public_key/{email})
2. Client déchiffre file_key avec sa record_key
3. Client chiffre file_key avec la clé publique RSA du destinataire (RSA-OAEP)
4. Client envoie encrypted_file_key au serveur (POST /drive/share_file)
5. Serveur crée un file_access record
6. Destinataire pourra déchiffrer file_key avec sa clé privée RSA
```

**Exemple curl** :

```bash
curl -X POST https://api.gauzian.com/drive/share_file \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "880e8400-e29b-41d4-a716-446655440003",
    "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
    "encrypted_file_key": "wrapped_key_base64",
    "access_level": "viewer"
  }'
```

---

### GET `/drive/file/{file_id}/InfoItem`

**Description** : Récupère les métadonnées complètes d'un fichier (incluant permissions).

**Authentification** : ✅ Requise

**Path Parameters** :
- `file_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "encrypted_metadata": "iv:ciphertext_base64",
    "encrypted_file_key": "encrypted_aes_key_base64",
    "size": 10485760,
    "mime_type": "application/pdf",
    "access_level": "owner",
    "shared_with": [
      {
        "user_id": "660e8400-e29b-41d4-a716-446655440001",
        "email": "recipient@example.com",
        "access_level": "viewer"
      }
    ],
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

---

## Module Drive - Folders

### POST `/drive/create_folder`

**Description** : Crée un nouveau dossier.

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "encrypted_metadata": "iv:ciphertext_base64",
  "parent_folder_id": "770e8400-e29b-41d4-a716-446655440002",
  "encrypted_folder_key": "encrypted_aes_key_base64"
}
```

**Response** : `201 Created`

```json
{
  "ok": true,
  "data": {
    "folder_id": "aa0e8400-e29b-41d4-a716-446655440005"
  }
}
```

**Note** : Si `parent_folder_id = null`, crée un dossier racine (`is_root = true`).

---

### GET `/drive/get_folder/{folder_id}`

**Description** : Récupère les métadonnées d'un dossier.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "encrypted_metadata": "iv:ciphertext_base64",
    "encrypted_folder_key": "encrypted_aes_key_base64",
    "parent_folder_id": "770e8400-e29b-41d4-a716-446655440002",
    "is_root": false,
    "is_deleted": false,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

---

### GET `/drive/folder_contents/{folder_id}`

**Description** : Liste les fichiers et sous-dossiers d'un dossier.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "files": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "encrypted_metadata": "iv:ciphertext_base64",
        "encrypted_file_key": "encrypted_aes_key_base64",
        "size": 10485760,
        "mime_type": "application/pdf",
        "created_at": "2025-01-15T10:30:00Z"
      }
    ],
    "folders": [
      {
        "id": "bb0e8400-e29b-41d4-a716-446655440006",
        "encrypted_metadata": "iv:ciphertext_base64",
        "encrypted_folder_key": "encrypted_aes_key_base64",
        "created_at": "2025-01-15T11:00:00Z"
      }
    ]
  }
}
```

---

### POST `/drive/delete_folder`

**Description** : Soft delete d'un dossier (et récursivement tous ses enfants).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005"
}
```

**Response** : `200 OK`

**Effet** : Marque `is_deleted = true` pour le dossier ET tous ses fichiers/sous-dossiers (récursif).

---

### POST `/drive/rename_folder`

**Description** : Renomme un dossier.

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "encrypted_metadata": "new_iv:new_ciphertext_base64"
}
```

**Response** : `200 OK`

---

### POST `/drive/move_folder`

**Description** : Déplace un dossier vers un autre dossier parent.

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "new_parent_folder_id": "cc0e8400-e29b-41d4-a716-446655440007"
}
```

**Response** : `200 OK`

**Validation** : Empêche les déplacements circulaires (dossier ne peut pas être son propre parent).

---

### POST `/drive/restore_folder`

**Description** : Restaure un dossier soft-deleted (et récursivement tous ses enfants).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005"
}
```

**Response** : `200 OK`

---

### POST `/drive/share_folder`

**Description** : Partage un dossier avec un utilisateur (E2EE).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "encrypted_folder_key": "<folder_key_wrapped_with_recipient_rsa>",
  "access_level": "editor"
}
```

**Response** : `200 OK`

**Note** : Partage uniquement le dossier (pas les fichiers à l'intérieur). Utiliser `/drive/share_folder_batch` pour partager récursivement.

---

### POST `/drive/share_folder_batch`

**Description** : Partage un dossier ET tous ses fichiers/sous-dossiers récursivement (E2EE).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "encrypted_folder_key": "<folder_key_wrapped_with_recipient_rsa>",
  "encrypted_file_keys": {
    "880e8400-e29b-41d4-a716-446655440003": "<file_key_wrapped>",
    "990e8400-e29b-41d4-a716-446655440008": "<file_key_wrapped>"
  },
  "access_level": "editor"
}
```

**Champs** :
- `encrypted_file_keys` : Map de `file_id` → `encrypted_file_key` pour tous les fichiers du dossier

**Response** : `200 OK`

**Workflow** :

```
1. Client récupère récursivement tous les fichiers du dossier
2. Client chiffre folder_key et chaque file_key avec la clé publique RSA du destinataire
3. Client envoie le tout au serveur (POST /drive/share_folder_batch)
4. Serveur crée folder_access + file_access pour chaque fichier
```

---

### GET `/drive/folder/{folder_id}/shared_users`

**Description** : Liste les utilisateurs avec qui le dossier est partagé.

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": [
    {
      "user_id": "660e8400-e29b-41d4-a716-446655440001",
      "email": "recipient@example.com",
      "access_level": "editor"
    }
  ]
}
```

---

### GET `/drive/folder/{folder_id}/InfoItem`

**Description** : Récupère les métadonnées complètes d'un dossier (incluant permissions).

**Authentification** : ✅ Requise

**Path Parameters** :
- `folder_id` (UUID)

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "encrypted_metadata": "iv:ciphertext_base64",
    "encrypted_folder_key": "encrypted_aes_key_base64",
    "access_level": "owner",
    "shared_with": [
      {
        "user_id": "660e8400-e29b-41d4-a716-446655440001",
        "email": "recipient@example.com",
        "access_level": "editor"
      }
    ],
    "files_count": 15,
    "subfolders_count": 3,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

---

## Module Drive - Access

### POST `/drive/propagate_file_access`

**Description** : Propage les permissions d'un fichier à un utilisateur (après partage).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003",
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "access_level": "viewer"
}
```

**Response** : `200 OK`

**Note** : Utilisé en interne par `/drive/share_file`.

---

### POST `/drive/propagate_folder_access`

**Description** : Propage les permissions d'un dossier à un utilisateur (après partage).

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "folder_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "recipient_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "access_level": "editor"
}
```

**Response** : `200 OK`

---

### POST `/drive/revoke-access`

**Description** : Révoque les permissions d'un fichier ou dossier pour un utilisateur.

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "file_id": "880e8400-e29b-41d4-a716-446655440003",
  "user_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Ou pour un dossier** :

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

**Description** : Récupère les informations complètes du drive (files, folders, quota).

**Authentification** : ✅ Requise

**Path Parameters** :
- `parent_id` (string) - UUID du dossier parent ou `"corbeille"` pour la corbeille

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "username": "john_doe"
    },
    "current_folder": {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "encrypted_metadata": "iv:ciphertext_base64",
      "parent_folder_id": "770e8400-e29b-41d4-a716-446655440002"
    },
    "files": [ /* ... */ ],
    "folders": [ /* ... */ ],
    "total_size": 104857600,
    "files_count": 25,
    "folders_count": 8
  }
}
```

**Usage** : Endpoint principal pour charger le drive dans le frontend.

---

### GET `/drive/get_file_folder/{parent_id}`

**Description** : Liste les fichiers et dossiers d'un parent_id (alias de `/folder_contents`).

**Authentification** : ✅ Requise

**Path Parameters** :
- `parent_id` (UUID)

**Response** : `200 OK` (même format que `/folder_contents/{folder_id}`)

---

### POST `/drive/empty_trash`

**Description** : Vide la corbeille (hard delete de tous les fichiers/dossiers soft-deleted).

**Authentification** : ✅ Requise

**Request Body** : Aucun

**Response** : `200 OK`

```json
{
  "ok": true,
  "data": {
    "deleted_files_count": 12,
    "deleted_folders_count": 4,
    "freed_space_bytes": 52428800
  }
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

**Description** : Liste les événements d'agenda de l'utilisateur.

**Authentification** : ✅ Requise

**Query Parameters** :
- `start_date` (ISO 8601) - Date de début (optionnel)
- `end_date` (ISO 8601) - Date de fin (optionnel)

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
curl -X GET "https://api.gauzian.com/agenda/events?start_date=2025-01-01T00:00:00Z&end_date=2025-01-31T23:59:59Z" \
  -b cookies.txt
```

---

### POST `/agenda/events`

**Description** : Crée un nouvel événement d'agenda.

**Authentification** : ✅ Requise

**Request Body** :

```json
{
  "encrypted_title": "iv:ciphertext_base64",
  "encrypted_description": "iv:ciphertext_base64",
  "encrypted_data_key": "encrypted_aes_key_base64",
  "start_time": "2025-01-20T14:00:00Z",
  "end_time": "2025-01-20T15:00:00Z",
  "is_all_day": false,
  "category_id": "ee0e8400-e29b-41d4-a716-446655440010"
}
```

**Response** : `201 Created`

```json
{
  "ok": true,
  "data": {
    "event_id": "dd0e8400-e29b-41d4-a716-446655440009"
  }
}
```

**Champs E2EE** :
- `encrypted_title` : Titre chiffré avec `data_key` (AES-256-GCM)
- `encrypted_description` : Description chiffrée avec `data_key`
- `encrypted_data_key` : Clé AES-256 de l'événement, chiffrée avec `record_key`

**Workflow** :

```
1. Client génère dataKey (AES-256)
2. Client chiffre title et description avec dataKey
3. Client chiffre dataKey avec recordKey → encrypted_data_key
4. POST /agenda/events
5. Serveur crée agenda_event record
```

---

## Schémas de Données

### User

```typescript
interface User {
  id: string;                       // UUID
  email: string;
  username: string;
  password_hash: string;            // Argon2 hash
  encrypted_private_key: string;    // RSA-4096 private key chiffré avec password
  public_key: string;               // RSA-4096 public key (PEM format)
  encrypted_record_key: string;     // AES-256 record_key chiffré avec password
  private_key_salt: string;         // Salt pour PBKDF2
  iv: string;                       // IV pour AES-GCM
  auth_salt: string | null;         // Legacy salt (pour compatibilité)
  created_at: string;               // ISO 8601
}
```

---

### File

```typescript
interface File {
  id: string;                       // UUID
  encrypted_metadata: string;       // Nom du fichier chiffré (format: "iv:ciphertext")
  encrypted_file_key: string;       // AES-256 file_key chiffré avec record_key
  size: number;                     // Taille en bytes
  mime_type: string;                // Type MIME
  folder_id: string;                // UUID du dossier parent
  is_fully_uploaded: boolean;       // false pendant upload, true après finalize
  is_deleted: boolean;              // Soft delete flag
  created_at: string;               // ISO 8601
  updated_at: string;               // ISO 8601
}
```

---

### Folder

```typescript
interface Folder {
  id: string;                       // UUID
  encrypted_metadata: string;       // Nom du dossier chiffré (format: "iv:ciphertext")
  encrypted_folder_key: string;     // AES-256 folder_key chiffré avec record_key
  parent_folder_id: string | null;  // UUID du parent (null si root)
  is_root: boolean;                 // true si dossier racine
  is_deleted: boolean;              // Soft delete flag
  created_at: string;               // ISO 8601
  updated_at: string;               // ISO 8601
}
```

---

### FileAccess

```typescript
interface FileAccess {
  id: string;                       // UUID
  file_id: string;                  // UUID du fichier
  user_id: string;                  // UUID de l'utilisateur
  encrypted_file_key: string;       // file_key chiffré avec RSA public key du user
  access_level: "owner" | "editor" | "viewer";
  created_at: string;               // ISO 8601
}
```

**Permissions** :
- `owner` : Full access (read, write, delete, share, revoke)
- `editor` : Read, write, rename, move
- `viewer` : Read only

---

### FolderAccess

```typescript
interface FolderAccess {
  id: string;                       // UUID
  folder_id: string;                // UUID du dossier
  user_id: string;                  // UUID de l'utilisateur
  encrypted_folder_key: string;     // folder_key chiffré avec RSA public key du user
  access_level: "owner" | "editor" | "viewer";
  created_at: string;               // ISO 8601
}
```

---

### AgendaEvent

```typescript
interface AgendaEvent {
  id: string;                       // UUID
  encrypted_title: string;          // Titre chiffré avec data_key
  encrypted_description: string;    // Description chiffrée avec data_key
  encrypted_data_key: string;       // data_key chiffré avec record_key
  start_time: string;               // ISO 8601
  end_time: string;                 // ISO 8601
  is_all_day: boolean;
  category_id: string | null;       // UUID de la catégorie
  is_deleted: boolean;
  created_at: string;               // ISO 8601
  updated_at: string;               // ISO 8601
}
```

---

## Codes d'Erreur

### HTTP Status Codes

| Code | Nom | Description |
|------|-----|-------------|
| `200` | OK | Requête réussie |
| `201` | Created | Ressource créée avec succès |
| `204` | No Content | Requête réussie, pas de contenu à retourner |
| `400` | Bad Request | Validation error (champs manquants, UUID invalide) |
| `401` | Unauthorized | JWT manquant, invalide, ou révoqué |
| `403` | Forbidden | Pas de permission pour cette ressource |
| `404` | Not Found | Ressource introuvable |
| `409` | Conflict | Conflit (email déjà existant) |
| `500` | Internal Server Error | Erreur serveur (database, S3, etc.) |

---

### Error Response Format

```json
{
  "ok": false,
  "error": "Invalid credentials"
}
```

**Exemples** :

```json
// 401 Unauthorized
{
  "ok": false,
  "error": "Unauthorized: Token expired"
}

// 403 Forbidden
{
  "ok": false,
  "error": "Forbidden: You don't have permission to access this file"
}

// 404 Not Found
{
  "ok": false,
  "error": "File not found"
}

// 500 Internal Server Error
{
  "ok": false,
  "error": "Database error: connection pool exhausted"
}
```

---

## Exemples d'Utilisation

### Workflow Complet : Upload Fichier E2EE

```bash
#!/bin/bash

# Variables
API_URL="https://api.gauzian.com"
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

# 4. Upload chunks
echo "4. Uploading chunks..."
CHUNK_INDEX=0
for chunk in chunk_*; do
  echo "  Uploading chunk $CHUNK_INDEX..."
  curl -s -X POST $API_URL/drive/upload_chunk_binary \
    -b cookies.txt \
    -F "file_id=$FILE_ID" \
    -F "chunk_index=$CHUNK_INDEX" \
    -F "total_chunks=10" \
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

API_URL="https://api.gauzian.com"
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
# (Ce chiffrement se fait côté client avec crypto.ts)
# Pour cet exemple, on suppose que wrapped_file_key est déjà généré
WRAPPED_FILE_KEY="wrapped_file_key_example_base64"

# 3. Partager le fichier
echo "2. Sharing file..."
curl -s -X POST $API_URL/drive/share_file \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d "{
    \"file_id\": \"$FILE_ID\",
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

API_URL="https://api.gauzian.com"
FILE_ID="880e8400-e29b-41d4-a716-446655440003"
OUTPUT_FILE="downloaded_file.pdf"

# 1. Récupérer les s3_keys du fichier
echo "1. Getting file s3_keys..."
DOWNLOAD_INFO=$(curl -s -X GET "$API_URL/drive/download/$FILE_ID" \
  -b cookies.txt)

ENCRYPTED_FILE_KEY=$(echo $DOWNLOAD_INFO | jq -r '.data.encrypted_file_key')
S3_KEYS=($(echo $DOWNLOAD_INFO | jq -r '.data.s3_keys[]'))

echo "Total chunks: ${#S3_KEYS[@]}"

# 2. Download chaque chunk
echo "2. Downloading chunks..."
rm -f chunk_*.enc  # Cleanup previous chunks

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
# Pour cet exemple, on suppose que les chunks sont déjà déchiffrés
echo "3. Reconstructing file..."
cat chunk_*.enc > "$OUTPUT_FILE"

echo "Download complete: $OUTPUT_FILE"

# Cleanup
rm chunk_*.enc
```

---

## OpenAPI Specification (YAML)

Pour une intégration avec Swagger UI ou d'autres outils, une spec OpenAPI 3.0 complète est disponible ici :

**Fichier** : `openapi.yaml` (à créer à la racine du projet)

Exemple minimal :

```yaml
openapi: 3.0.0
info:
  title: GAUZIAN API
  version: 1.0.0
  description: Zero-Knowledge E2EE Cloud Storage API
servers:
  - url: https://api.gauzian.com
    description: Production server
paths:
  /login:
    post:
      summary: Authenticate user
      tags:
        - Auth
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  format: password
              required:
                - email
                - password
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok:
                    type: boolean
                  data:
                    type: object
                    properties:
                      token:
                        type: string
                      user_id:
                        type: string
                        format: uuid
        '401':
          description: Invalid credentials
  # ... (continuer pour tous les endpoints)
```

**Note** : Pour générer automatiquement une spec OpenAPI complète depuis le code Rust, utiliser la crate [`utoipa`](https://github.com/juhaku/utoipa).

---

## Monitoring & Observabilité

### Prometheus Metrics

Toutes les requêtes sont trackées automatiquement via le middleware `metrics::track_metrics`.

**Dashboard Grafana** : `http://grafana.gauzian.com/d/gauzian-api`

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

**Dernière mise à jour** : 2026-02-11
**Version API** : 1.0
**Backend Version** : Rust stable, Axum 0.7+, SQLx 0.7+
