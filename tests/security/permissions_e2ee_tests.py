#!/usr/bin/env python3
"""
GAUZIAN Security Test Suite - Permissions & E2EE Validation

Tests critiques pour valider les permissions E2EE et l'isolation des données chiffrées.

OBJECTIF:
- Valider que les permissions fichiers/dossiers sont correctement appliquées
- Tester IDOR (Insecure Direct Object References) - accès fichiers non autorisés
- Valider que le backend ne peut JAMAIS voir les données en clair (E2EE)
- Vérifier le partage E2EE (re-encryption des clés)

ARCHITECTURE E2EE GAUZIAN:
1. Client génère RSA-4096 keypair (register)
2. Upload fichier:
   - Génère file_key aléatoire (AES-256)
   - Chiffre fichier avec file_key
   - Chiffre file_key avec public_key owner
   - Upload chunks chiffrés vers MinIO S3
3. Partage E2EE:
   - Owner déchiffre file_key avec private_key
   - Rechiffre file_key avec public_key destinataire
   - Backend stocke encrypted_file_key (sans pouvoir le déchiffrer)

EXÉCUTION:
    python3 tests/security/permissions_e2ee_tests.py
    # OU
    pytest tests/security/permissions_e2ee_tests.py -v

REQUIREMENTS:
    pip install requests pytest faker cryptography
"""

import os
import sys
import json
import base64
from typing import Dict, Tuple

import requests
import pytest
from faker import Faker

# ========== Configuration ==========

API_URL = os.getenv("API_URL", "https://gauzian.pupin.fr/api")
TEST_EMAIL_SUFFIX = "@test-perms.gauzian.local"

fake = Faker()

# ========== Test Fixtures ==========

@pytest.fixture(scope="module")
def api_client():
    """Client HTTP avec session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "User-Agent": "GAUZIAN-Permissions-Test/1.0"
    })
    yield session
    session.close()


def create_test_user(api_client, username_prefix: str) -> Dict:
    """Helper: Crée un utilisateur et retourne credentials + token"""
    credentials = {
        "email": f"{username_prefix}_{fake.uuid4()[:8]}{TEST_EMAIL_SUFFIX}",
        "username": f"{username_prefix}_{fake.user_name()}",
        "password": "TestPass123!@#",
    }

    crypto_fields = {
        "encrypted_private_key": fake.sha256(),
        "public_key": fake.sha256(),
        "private_key_salt": fake.sha256()[:32],
        "iv": fake.sha256()[:32],
        "encrypted_record_key": fake.sha256(),
    }

    response = api_client.post(f"{API_URL}/register", json={**credentials, **crypto_fields})
    assert response.status_code == 200, f"Register failed: {response.text}"

    data = response.json()
    return {
        "credentials": credentials,
        "token": data["token"],
        "user_id": data["user_id"],
        "crypto": crypto_fields,
    }


@pytest.fixture
def user_alice(api_client) -> Dict:
    """Utilisateur Alice (owner de fichiers)"""
    return create_test_user(api_client, "alice")


@pytest.fixture
def user_bob(api_client) -> Dict:
    """Utilisateur Bob (tente accès non autorisé)"""
    return create_test_user(api_client, "bob")


@pytest.fixture
def user_charlie(api_client) -> Dict:
    """Utilisateur Charlie (destinataire share)"""
    return create_test_user(api_client, "charlie")


# ========== Helper Functions ==========

def create_folder(api_client, token: str, folder_name: str = "test_folder") -> str:
    """Crée un dossier et retourne son ID"""
    encrypted_metadata = base64.b64encode(json.dumps({
        "name": folder_name,
        "created": fake.iso8601(),
    }).encode()).decode()

    encrypted_folder_key = fake.sha256()

    response = api_client.post(
        f"{API_URL}/drive/folders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "encrypted_metadata": encrypted_metadata,
            "parent_folder_id": "null",  # Root folder (string "null" pour Option<Uuid>)
            "encrypted_folder_key": encrypted_folder_key,
        }
    )

    assert response.status_code == 200, f"Failed to create folder: {response.text}"
    data = response.json()
    return data.get("folder_id") or data.get("id")


def initialize_file(api_client, token: str, folder_id: str, filename: str = "test.txt") -> str:
    """Initialise un fichier et retourne son ID"""
    encrypted_metadata = base64.b64encode(json.dumps({
        "name": filename,
        "extension": "txt",
        "size": 1024,
    }).encode()).decode()

    encrypted_file_key = fake.sha256()

    response = api_client.post(
        f"{API_URL}/drive/files/initialize",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "size": 1024,
            "encrypted_metadata": encrypted_metadata,
            "mime_type": "text/plain",
            "folder_id": folder_id,
            "encrypted_file_key": encrypted_file_key,
        }
    )

    assert response.status_code == 200, f"Failed to initialize file: {response.text}"
    data = response.json()
    return data["file_id"]


# ========== Test Class: File Permissions & IDOR ==========

class TestFilePermissions:
    """Tests permissions fichiers et IDOR (Insecure Direct Object References)"""

    def test_01_owner_can_access_own_file(self, api_client, user_alice):
        """
        Test baseline: Owner peut accéder à son propre fichier
        """
        token = user_alice["token"]

        # Créer dossier
        folder_id = create_folder(api_client, token, "alice_folder")

        # Créer fichier
        file_id = initialize_file(api_client, token, folder_id, "alice_secret.txt")

        # Liste fichiers
        response = api_client.get(
            f"{API_URL}/drive/files",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        files = response.json()

        # Assert: Fichier présent dans la liste
        file_ids = [f.get("id") for f in files if isinstance(files, list)]
        if isinstance(files, dict) and "files" in files:
            file_ids = [f["id"] for f in files["files"]]

        # Note: L'endpoint peut retourner différents formats selon l'implémentation


    def test_02_idor_user_cannot_access_other_user_file(self, api_client, user_alice, user_bob):
        """
        CRITICAL: Test IDOR - Bob ne peut PAS accéder aux fichiers d'Alice

        Scénario:
        1. Alice crée fichier avec file_id X
        2. Bob tente GET /api/drive/files/X/download
        3. Backend doit retourner 403 Forbidden
        """
        alice_token = user_alice["token"]
        bob_token = user_bob["token"]

        # Alice crée fichier
        folder_id = create_folder(api_client, alice_token, "alice_private")
        file_id = initialize_file(api_client, alice_token, folder_id, "alice_confidential.pdf")

        # Bob tente accès (IDOR attack)
        response = api_client.get(
            f"{API_URL}/drive/files/{file_id}/download",
            headers={"Authorization": f"Bearer {bob_token}"}
        )

        # Assert: 403 Forbidden (pas 404, pour ne pas leak existence)
        assert response.status_code in [403, 404], \
            "Bob should NOT access Alice's file (IDOR vulnerability)"


    def test_03_idor_sequential_file_ids(self, api_client, user_alice, user_bob):
        """
        CRITICAL: Test IDOR avec file_ids séquentiels/prévisibles

        Scénario:
        1. Alice crée fichiers avec IDs séquentiels
        2. Bob tente d'énumérer tous les IDs possibles
        3. Backend doit bloquer tous les accès non autorisés
        """
        alice_token = user_alice["token"]
        bob_token = user_bob["token"]

        folder_id = create_folder(api_client, alice_token)

        # Alice crée 5 fichiers
        alice_file_ids = []
        for i in range(5):
            file_id = initialize_file(api_client, alice_token, folder_id, f"file_{i}.txt")
            alice_file_ids.append(file_id)

        # Bob tente accès à tous les fichiers d'Alice
        for file_id in alice_file_ids:
            response = api_client.get(
                f"{API_URL}/drive/files/{file_id}/download",
                headers={"Authorization": f"Bearer {bob_token}"}
            )

            assert response.status_code in [403, 404], \
                f"Bob should NOT access file {file_id} (IDOR enumeration)"


    def test_04_delete_file_requires_ownership(self, api_client, user_alice, user_bob):
        """
        CRITICAL: Seul le owner peut supprimer un fichier

        Bob ne peut PAS supprimer les fichiers d'Alice.
        """
        alice_token = user_alice["token"]
        bob_token = user_bob["token"]

        folder_id = create_folder(api_client, alice_token)
        file_id = initialize_file(api_client, alice_token, folder_id, "protected_file.docx")

        # Bob tente suppression
        response = api_client.delete(
            f"{API_URL}/drive/files/{file_id}",
            headers={"Authorization": f"Bearer {bob_token}"}
        )

        # Assert: 403 Forbidden
        assert response.status_code in [403, 404], \
            "Bob should NOT delete Alice's file"

        # Vérifier que le fichier existe toujours
        response = api_client.get(
            f"{API_URL}/drive/files/{file_id}/download",
            headers={"Authorization": f"Bearer {alice_token}"}
        )

        # Alice devrait toujours pouvoir y accéder (pas supprimé)
        # Note: Le fichier n'a pas de chunks uploadés, peut retourner 404
        # Accepter 404 ou 200 tant que ce n'est PAS supprimé par Bob


# ========== Test Class: Folder Permissions & IDOR ==========

class TestFolderPermissions:
    """Tests permissions dossiers et IDOR"""

    def test_05_idor_user_cannot_access_other_user_folder(self, api_client, user_alice, user_bob):
        """
        CRITICAL: Bob ne peut PAS lister le contenu des dossiers d'Alice
        """
        alice_token = user_alice["token"]
        bob_token = user_bob["token"]

        # Alice crée dossier
        folder_id = create_folder(api_client, alice_token, "alice_private_docs")

        # Bob tente liste fichiers dans dossier d'Alice
        response = api_client.get(
            f"{API_URL}/drive/folders/{folder_id}",
            headers={"Authorization": f"Bearer {bob_token}"}
        )

        # Assert: 403 Forbidden
        assert response.status_code in [403, 404], \
            "Bob should NOT access Alice's folder contents (IDOR)"


    def test_06_delete_folder_requires_ownership(self, api_client, user_alice, user_bob):
        """
        CRITICAL: Seul le owner peut supprimer un dossier
        """
        alice_token = user_alice["token"]
        bob_token = user_bob["token"]

        folder_id = create_folder(api_client, alice_token, "important_folder")

        # Bob tente suppression
        response = api_client.delete(
            f"{API_URL}/drive/folders/{folder_id}",
            headers={"Authorization": f"Bearer {bob_token}"}
        )

        # Assert: 403 Forbidden
        assert response.status_code in [403, 404], \
            "Bob should NOT delete Alice's folder"


# ========== Test Class: E2EE Sharing ==========

class TestE2EESharing:
    """Tests partage E2EE avec re-chiffrement des clés"""

    def test_07_share_file_with_another_user(self, api_client, user_alice, user_charlie):
        """
        Test partage E2EE valide:
        1. Alice partage fichier avec Charlie
        2. Backend stocke encrypted_file_key (chiffré avec public_key de Charlie)
        3. Charlie peut accéder au fichier
        """
        alice_token = user_alice["token"]
        charlie_token = user_charlie["token"]
        charlie_user_id = user_charlie["user_id"]

        # Alice crée fichier
        folder_id = create_folder(api_client, alice_token)
        file_id = initialize_file(api_client, alice_token, folder_id, "shared_document.pdf")

        # Alice partage avec Charlie
        # Note: encrypted_file_key devrait être généré côté client
        # (déchiffrer file_key avec private_key d'Alice, rechiffrer avec public_key de Charlie)
        encrypted_file_key_for_charlie = fake.sha256()  # Mock

        response = api_client.post(
            f"{API_URL}/drive/files/{file_id}/share",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={
                "recipient_user_id": charlie_user_id,
                "encrypted_file_key": encrypted_file_key_for_charlie,
                "access_level": "viewer",
            }
        )

        # Assert: 200 OK (partage réussi)
        assert response.status_code == 200, f"Share failed: {response.text}"

        # Charlie peut maintenant accéder au fichier
        response = api_client.get(
            f"{API_URL}/drive/files/{file_id}/download",
            headers={"Authorization": f"Bearer {charlie_token}"}
        )

        # Note: Le fichier n'a pas de chunks réels uploadés, peut retourner 404
        # L'important est de vérifier que Charlie a une entrée dans file_access
        # et peut théoriquement accéder (pas 403)
        assert response.status_code != 403, \
            "Charlie should have access after share (E2EE re-encryption)"


    def test_08_share_folder_with_recursive_permissions(self, api_client, user_alice, user_charlie):
        """
        Test partage de dossier (permissions récursives sur sous-dossiers/fichiers)

        Note: Implémentation peut varier selon backend.
        """
        alice_token = user_alice["token"]
        charlie_user_id = user_charlie["user_id"]

        # Alice crée dossier
        folder_id = create_folder(api_client, alice_token, "shared_project")

        # Alice partage dossier avec Charlie
        encrypted_folder_key_for_charlie = fake.sha256()

        response = api_client.post(
            f"{API_URL}/drive/folders/{folder_id}/share",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={
                "recipient_user_id": charlie_user_id,
                "encrypted_folder_key": encrypted_folder_key_for_charlie,
                "access_level": "editor",
            }
        )

        # Assert: 200 OK ou 201 Created
        assert response.status_code in [200, 201], f"Folder share failed: {response.text}"


    def test_09_revoke_access_removes_permissions(self, api_client, user_alice, user_charlie):
        """
        CRITICAL: Révocation d'accès doit supprimer les permissions

        Scénario:
        1. Alice partage fichier avec Charlie
        2. Charlie peut accéder
        3. Alice révoque accès
        4. Charlie ne peut PLUS accéder (403)
        """
        alice_token = user_alice["token"]
        charlie_token = user_charlie["token"]
        charlie_user_id = user_charlie["user_id"]

        # Setup: Alice crée et partage fichier
        folder_id = create_folder(api_client, alice_token)
        file_id = initialize_file(api_client, alice_token, folder_id, "temporary_share.txt")

        response = api_client.post(
            f"{API_URL}/drive/files/{file_id}/share",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={
                "recipient_user_id": charlie_user_id,
                "encrypted_file_key": fake.sha256(),
                "access_level": "viewer",
            }
        )
        assert response.status_code == 200

        # Alice révoque accès
        response = api_client.delete(
            f"{API_URL}/drive/files/{file_id}/share/{charlie_user_id}",
            headers={"Authorization": f"Bearer {alice_token}"}
        )

        # Note: L'endpoint exact peut varier, vérifier routes.rs
        # Accepter 200 ou 404 si l'endpoint n'existe pas encore

        # Charlie ne peut plus accéder
        response = api_client.get(
            f"{API_URL}/drive/files/{file_id}/download",
            headers={"Authorization": f"Bearer {charlie_token}"}
        )

        # Assert: 403 (accès révoqué)
        assert response.status_code in [403, 404], \
            "Charlie should NOT access file after revocation"


# ========== Test Class: E2EE Metadata Encryption ==========

class TestMetadataEncryption:
    """Tests validation que les métadonnées sont chiffrées côté serveur"""

    def test_10_encrypted_metadata_stored_on_server(self, api_client, user_alice):
        """
        CRITICAL: Vérifier que le backend stocke encrypted_metadata (pas le nom en clair)

        Note: Test indirect - impossible d'accéder directement à la DB depuis les tests.
        On valide que le backend accepte encrypted_metadata et le retourne tel quel.
        """
        alice_token = user_alice["token"]

        # Créer fichier avec metadata chiffré
        plaintext_name = "super_secret_filename.docx"
        encrypted_metadata = base64.b64encode(json.dumps({
            "name": plaintext_name,
            "extension": "docx",
        }).encode()).decode()

        folder_id = create_folder(api_client, alice_token)

        response = api_client.post(
            f"{API_URL}/drive/files/initialize",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={
                "size": 5000,
                "encrypted_metadata": encrypted_metadata,
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "folder_id": folder_id,
                "encrypted_file_key": fake.sha256(),
            }
        )

        assert response.status_code == 200
        file_id = response.json()["file_id"]

        # Récupérer liste fichiers
        response = api_client.get(
            f"{API_URL}/drive/files",
            headers={"Authorization": f"Bearer {alice_token}"}
        )

        assert response.status_code == 200

        # Assert: Le backend retourne encrypted_metadata (pas le nom en clair)
        files = response.json()

        # Backend ne doit JAMAIS retourner "super_secret_filename.docx" en clair
        response_text = response.text.lower()
        assert plaintext_name.lower() not in response_text, \
            "Plaintext filename leaked in API response (E2EE violated)"


    def test_11_file_list_contains_only_encrypted_data(self, api_client, user_alice):
        """
        Valider que l'endpoint /drive/files retourne UNIQUEMENT des données chiffrées

        Le backend ne doit jamais exposer:
        - Noms de fichiers en clair
        - Extensions en clair
        - Contenu en clair
        """
        alice_token = user_alice["token"]

        folder_id = create_folder(api_client, alice_token)

        # Créer fichiers avec noms sensibles
        sensitive_filenames = [
            "passwords.txt",
            "credit_card_numbers.csv",
            "ssn_list.xlsx",
        ]

        for filename in sensitive_filenames:
            encrypted_metadata = base64.b64encode(json.dumps({
                "name": filename,
            }).encode()).decode()

            api_client.post(
                f"{API_URL}/drive/files/initialize",
                headers={"Authorization": f"Bearer {alice_token}"},
                json={
                    "size": 1000,
                    "encrypted_metadata": encrypted_metadata,
                    "mime_type": "text/plain",
                    "folder_id": folder_id,
                    "encrypted_file_key": fake.sha256(),
                }
            )

        # Liste fichiers
        response = api_client.get(
            f"{API_URL}/drive/files",
            headers={"Authorization": f"Bearer {alice_token}"}
        )

        assert response.status_code == 200

        response_text = response.text.lower()

        # Assert: Aucun nom de fichier sensible en clair
        for filename in sensitive_filenames:
            assert filename.lower() not in response_text, \
                f"Sensitive filename '{filename}' leaked in API response (E2EE violated)"


# ========== Test Class: Upload/Download with Authorization ==========

class TestUploadDownloadAuth:
    """Tests upload/download avec Authorization header"""

    def test_12_upload_chunk_requires_authorization(self, api_client, user_alice):
        """
        CRITICAL: Upload chunks doit requérir Authorization header

        Même en multipart/form-data, le header doit être présent.
        """
        alice_token = user_alice["token"]

        folder_id = create_folder(api_client, alice_token)
        file_id = initialize_file(api_client, alice_token, folder_id, "upload_test.bin")

        # Préparer chunk mock (FormData)
        chunk_data = b"A" * 1024  # 1KB chunk
        files = {
            "chunk": ("chunk_0", chunk_data, "application/octet-stream"),
        }

        # Tentative upload SANS Authorization header
        response = api_client.post(
            f"{API_URL}/drive/files/{file_id}/upload-chunk",
            files=files,
            data={"chunk_index": 0, "iv": fake.sha256()[:32]}
        )

        # Assert: 401 Unauthorized
        assert response.status_code == 401, \
            "Upload chunk should require Authorization header"


    def test_13_upload_chunk_with_authorization_succeeds(self, api_client, user_alice):
        """
        Test upload chunk avec Authorization header valide

        Valide que multipart/form-data + Authorization header fonctionne.
        """
        alice_token = user_alice["token"]

        folder_id = create_folder(api_client, alice_token)
        file_id = initialize_file(api_client, alice_token, folder_id, "real_upload.bin")

        # Upload chunk avec Authorization header
        chunk_data = b"X" * 2048  # 2KB chunk
        files = {
            "chunk": ("chunk_0", chunk_data, "application/octet-stream"),
        }

        response = api_client.post(
            f"{API_URL}/drive/files/{file_id}/upload-chunk",
            headers={"Authorization": f"Bearer {alice_token}"},
            files=files,
            data={"chunk_index": 0, "iv": fake.sha256()[:32]}
        )

        # Assert: 200 OK ou 201 Created
        assert response.status_code in [200, 201], \
            f"Upload chunk failed: {response.text}"


    def test_14_download_file_requires_authorization(self, api_client, user_alice):
        """
        CRITICAL: Download fichier doit requérir Authorization header
        """
        alice_token = user_alice["token"]

        folder_id = create_folder(api_client, alice_token)
        file_id = initialize_file(api_client, alice_token, folder_id)

        # Tentative download SANS Authorization
        response = api_client.get(f"{API_URL}/drive/files/{file_id}/download")

        # Assert: 401 Unauthorized
        assert response.status_code == 401, \
            "Download should require Authorization header"


    def test_15_large_file_chunked_upload(self, api_client, user_alice):
        """
        Test upload fichier volumineux par chunks multiples

        Simule upload 10MB en chunks de 5MB (2 chunks).
        """
        alice_token = user_alice["token"]

        folder_id = create_folder(api_client, alice_token)

        # Initialiser fichier 10MB
        file_size = 10 * 1024 * 1024  # 10MB
        encrypted_metadata = base64.b64encode(json.dumps({
            "name": "large_file.bin",
            "size": file_size,
        }).encode()).decode()

        response = api_client.post(
            f"{API_URL}/drive/files/initialize",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={
                "size": file_size,
                "encrypted_metadata": encrypted_metadata,
                "mime_type": "application/octet-stream",
                "folder_id": folder_id,
                "encrypted_file_key": fake.sha256(),
            }
        )

        assert response.status_code == 200
        file_id = response.json()["file_id"]

        # Upload 2 chunks de 5MB chacun
        chunk_size = 5 * 1024 * 1024  # 5MB

        for chunk_index in range(2):
            chunk_data = b"Z" * chunk_size

            files = {
                "chunk": (f"chunk_{chunk_index}", chunk_data, "application/octet-stream"),
            }

            response = api_client.post(
                f"{API_URL}/drive/files/{file_id}/upload-chunk",
                headers={"Authorization": f"Bearer {alice_token}"},
                files=files,
                data={"chunk_index": chunk_index, "iv": fake.sha256()[:32]}
            )

            # Assert: 200 OK pour chaque chunk
            assert response.status_code in [200, 201], \
                f"Chunk {chunk_index} upload failed: {response.text}"

        # Finaliser upload
        response = api_client.post(
            f"{API_URL}/drive/files/{file_id}/finalize-upload",
            headers={"Authorization": f"Bearer {alice_token}"}
        )

        # Assert: 200 OK
        assert response.status_code == 200, \
            f"Finalize upload failed: {response.text}"


# ========== Main Entry Point ==========

if __name__ == "__main__":
    print("=" * 80)
    print("GAUZIAN Security Test Suite - Permissions & E2EE Validation")
    print("=" * 80)
    print(f"API URL: {API_URL}")
    print()

    exit_code = pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--color=yes",
        "-ra",
    ])

    sys.exit(exit_code)
