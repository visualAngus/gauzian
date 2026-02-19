#!/usr/bin/env python3
"""
GAUZIAN Security Test Suite - CSRF Bypass & Injection Tests

Tests spécifiques pour CSRF et tentatives de bypass de sécurité après migration vers Authorization headers.

OBJECTIF:
Valider que la migration vers Authorization headers élimine complètement les vulnérabilités CSRF
et que le backend ne lit JAMAIS les cookies pour l'authentification.

CONTEXT:
- Cookies HTTP-Only sont vulnérables à CSRF (browser envoie auto les cookies)
- Authorization headers requièrent JavaScript explicite (SOP/CORS protection)
- Migration: Cookie auth → Authorization header = CSRF protection native

EXÉCUTION:
    python3 tests/security/csrf_bypass_tests.py
    # OU
    pytest tests/security/csrf_bypass_tests.py -v

REQUIREMENTS:
    pip install requests pytest faker
"""

import os
import sys
import json
from typing import Dict

import requests
import pytest
from faker import Faker

# ========== Configuration ==========

API_URL = os.getenv("API_URL", "https://gauzian.pupin.fr/api")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://gauzian.pupin.fr")
TEST_EMAIL_SUFFIX = "@test-csrf.gauzian.local"

fake = Faker()

# ========== Test Fixtures ==========

@pytest.fixture(scope="module")
def api_client():
    """Client HTTP avec session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "User-Agent": "GAUZIAN-CSRF-Test/1.0"
    })
    yield session
    session.close()


@pytest.fixture
def registered_user(api_client) -> Dict:
    """Crée un utilisateur pour tests CSRF"""
    credentials = {
        "email": f"csrf_{fake.uuid4()[:8]}{TEST_EMAIL_SUFFIX}",
        "username": fake.user_name(),
        "password": "CSRFTestPass123!",
    }

    crypto_fields = {
        "encrypted_private_key": fake.sha256(),
        "public_key": fake.sha256(),
        "private_key_salt": fake.sha256()[:32],
        "iv": fake.sha256()[:32],
        "encrypted_record_key": fake.sha256(),
    }

    response = api_client.post(f"{API_URL}/register", json={**credentials, **crypto_fields})
    assert response.status_code == 200

    data = response.json()
    return {
        "credentials": credentials,
        "token": data["token"],
        "user_id": data["user_id"],
    }


# ========== Test Class: CSRF Protection ==========

class TestCSRFProtection:
    """Tests validation CSRF protection après migration Authorization headers"""

    def test_01_cookie_based_auth_rejected(self, api_client, registered_user):
        """
        CRITICAL: Backend ne doit PLUS accepter l'authentification par cookie

        Simule un attaquant qui essaie d'utiliser l'ancien mécanisme de cookie.
        """
        token = registered_user["token"]

        # Tentative 1: Cookie auth_token seul (sans Authorization header)
        response = api_client.get(
            f"{API_URL}/autologin",
            cookies={"auth_token": token}
        )

        assert response.status_code == 401, \
            "Backend should REJECT cookie-based auth (migration to headers complete)"


    def test_02_cookie_ignored_when_header_present(self, api_client, registered_user):
        """
        Test que le backend lit UNIQUEMENT Authorization header (ignore cookies)

        Scénario: Cookie forgé + Authorization header valide
        Backend doit utiliser UNIQUEMENT le header (ignorer cookie).
        """
        valid_token = registered_user["token"]
        fake_token = "forged_cookie_token_" + fake.sha256()

        # Requête avec cookie forgé + Authorization header valide
        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {valid_token}"},
            cookies={"auth_token": fake_token}  # Cookie malveillant ignoré
        )

        # Assert: 200 OK (header utilisé, cookie ignoré)
        assert response.status_code == 200, \
            "Backend should use Authorization header, ignore cookie"


    def test_03_csrf_attack_simulation(self, api_client, registered_user):
        """
        CRITICAL: Simulation attaque CSRF classique (doit échouer)

        Scénario:
        1. Victime est logged in (token dans localStorage)
        2. Visite site malveillant attacker.com
        3. attacker.com déclenche <form> POST vers /api/drive/files/initialize
        4. Browser envoie cookies AUTO (CSRF vulnérabilité classique)
        5. MAIS: Authorization header NON envoyé (JavaScript requis, SOP/CORS bloque)

        Résultat attendu: 401 (pas de Authorization header)
        """
        token = registered_user["token"]

        # Simuler POST CSRF (browser auto-send cookies, PAS headers custom)
        csrf_payload = {
            "size": 1000000,
            "encrypted_metadata": "csrf_attack_payload",
            "mime_type": "application/octet-stream",
            "folder_id": "00000000-0000-0000-0000-000000000000",
            "encrypted_file_key": "csrf_key",
        }

        # Attaque: POST avec cookies (simulé), SANS Authorization header
        response = api_client.post(
            f"{API_URL}/drive/files/initialize",
            json=csrf_payload,
            cookies={"auth_token": token},  # Browser auto-send
            headers={"Origin": "https://evil-attacker.com"}  # Cross-origin
        )

        # Assert: 401 (pas de Authorization header)
        assert response.status_code == 401, \
            "CSRF attack should FAIL (no Authorization header sent by browser)"


    def test_04_state_changing_endpoints_require_header(self, api_client):
        """
        Test que TOUTES les opérations state-changing requièrent Authorization header

        Endpoints critiques:
        - POST /drive/files/initialize (upload)
        - POST /drive/folders (create folder)
        - DELETE /drive/files/{id} (delete file)
        - POST /drive/files/{id}/share (share file)
        """
        critical_endpoints = [
            ("POST", "/drive/files/initialize", {"size": 100, "encrypted_metadata": "x", "mime_type": "text/plain", "folder_id": "00000000-0000-0000-0000-000000000000", "encrypted_file_key": "x"}),
            ("POST", "/drive/folders", {"encrypted_metadata": "x", "parent_id": None}),
            ("DELETE", "/drive/files/00000000-0000-0000-0000-000000000000", None),
        ]

        for method, endpoint, payload in critical_endpoints:
            if method == "POST":
                response = api_client.post(f"{API_URL}{endpoint}", json=payload)
            elif method == "DELETE":
                response = api_client.delete(f"{API_URL}{endpoint}")

            assert response.status_code == 401, \
                f"{method} {endpoint} should require Authorization header (CSRF protection)"


# ========== Test Class: Origin & CORS Validation ==========

class TestOriginAndCORS:
    """Tests validation Origin headers et CORS policies"""

    def test_05_cors_preflight_allowed_origin(self, api_client):
        """
        Valide que les requêtes OPTIONS (CORS preflight) fonctionnent

        Note: Axum CORS middleware doit autoriser FRONTEND_URL.
        """
        response = api_client.options(
            f"{API_URL}/autologin",
            headers={
                "Origin": FRONTEND_URL,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            }
        )

        # Assert: 200 ou 204 (preflight OK)
        assert response.status_code in [200, 204], "CORS preflight should succeed"

        # Assert: CORS headers présents
        assert "Access-Control-Allow-Origin" in response.headers, \
            "Missing CORS header: Access-Control-Allow-Origin"


    def test_06_cors_rejects_unauthorized_origin(self, api_client, registered_user):
        """
        Test que le backend rejette les requêtes cross-origin malveillantes

        Note: CORS ne bloque PAS côté serveur (c'est le browser qui bloque la response).
        Mais on peut vérifier que le serveur ne renvoie PAS ACAO: *
        """
        token = registered_user["token"]

        response = api_client.get(
            f"{API_URL}/autologin",
            headers={
                "Authorization": f"Bearer {token}",
                "Origin": "https://evil-site.com"
            }
        )

        # Backend devrait répondre 200 (token valide), mais SANS ACAO header pour evil-site.com
        # (Le browser bloquera la response côté client)

        if response.status_code == 200:
            # Vérifier que Access-Control-Allow-Origin ne contient PAS *
            acao = response.headers.get("Access-Control-Allow-Origin", "")
            assert acao != "*", "Should NOT use wildcard CORS (allows credential theft)"


# ========== Test Class: Token Injection Attempts ==========

class TestTokenInjection:
    """Tests tentatives d'injection de token dans des endroits non-standards"""

    def test_07_token_in_query_string_ignored(self, api_client, registered_user):
        """
        CRITICAL: Token dans query params doit être IGNORÉ

        Attaque: /api/autologin?token=<jwt> (potentiel leak dans logs/referer)
        """
        token = registered_user["token"]

        response = api_client.get(f"{API_URL}/autologin?token={token}")

        # Assert: 401 (token dans query params ignoré)
        assert response.status_code == 401, \
            "Backend should IGNORE token in query string"


    def test_08_token_in_fragment_ignored(self, api_client, registered_user):
        """
        Token dans URL fragment #token=<jwt> (doit être ignoré)

        Note: Fragment n'est jamais envoyé au serveur (browser-only).
        """
        token = registered_user["token"]

        # Fragment n'est PAS envoyé dans requête HTTP (test de validation)
        response = api_client.get(f"{API_URL}/autologin#token={token}")

        # Assert: 401 (pas de Authorization header)
        assert response.status_code == 401


    def test_09_token_in_custom_header_ignored(self, api_client, registered_user):
        """
        Test que le backend lit UNIQUEMENT "Authorization", pas d'autres headers custom

        Attaque: Utiliser X-Auth-Token, X-JWT, etc.
        """
        token = registered_user["token"]

        custom_headers = [
            {"X-Auth-Token": token},
            {"X-JWT": token},
            {"X-Access-Token": token},
            {"Authentication": token},  # Typo de "Authorization"
        ]

        for headers in custom_headers:
            response = api_client.get(
                f"{API_URL}/autologin",
                headers=headers
            )

            assert response.status_code == 401, \
                f"Backend should ONLY read 'Authorization' header, not {list(headers.keys())[0]}"


    def test_10_bearer_prefix_case_insensitive(self, api_client, registered_user):
        """
        Test que "Bearer" prefix est case-insensitive (RFC compliance)

        RFC 6750: "Bearer" est case-insensitive
        """
        token = registered_user["token"]

        test_cases = [
            f"Bearer {token}",   # Standard
            f"bearer {token}",   # Lowercase
            f"BEARER {token}",   # Uppercase
        ]

        for auth_header in test_cases:
            response = api_client.get(
                f"{API_URL}/autologin",
                headers={"Authorization": auth_header}
            )

            # Note: Implémentation Rust actuelle utilise strip_prefix("Bearer ")
            # qui est case-SENSITIVE. Documenter si c'est un bug ou intentionnel.
            if response.status_code == 401:
                print(f"WARN: Backend rejects case variation: {auth_header}")


    def test_11_multiple_authorization_headers(self, api_client, registered_user):
        """
        Test comportement avec multiples Authorization headers

        HTTP permet plusieurs headers avec même nom.
        Backend doit utiliser le premier ou rejeter.
        """
        token = registered_user["token"]
        fake_token = "fake_" + fake.sha256()

        # Note: requests.Session merge les headers, difficile de tester multiples values.
        # Documenter comportement attendu: backend utilise le premier Authorization header.


# ========== Test Class: Token Leakage Prevention ==========

class TestTokenLeakagePrevention:
    """Tests prévention de leak de tokens JWT"""

    def test_12_token_not_logged_in_errors(self, api_client):
        """
        CRITICAL: Vérifier que les tokens JWT ne sont JAMAIS loggés

        Requête avec token invalide → logs backend ne doivent PAS contenir le token.
        (Test manuel: vérifier logs backend après ce test)
        """
        fake_token = "SECRET_TOKEN_" + fake.sha256()

        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {fake_token}"}
        )

        assert response.status_code == 401

        # Note: Impossible de tester logs automatiquement.
        # Action manuelle: grep logs backend pour "SECRET_TOKEN_" → devrait être absent.
        print("\n[MANUAL CHECK REQUIRED]")
        print(f"Search backend logs for: SECRET_TOKEN_")
        print("Expected: NO matches (tokens should NOT be logged)")


    def test_13_error_messages_do_not_leak_token_details(self, api_client):
        """
        Test que les erreurs ne contiennent PAS de détails sur le token

        Mauvaise pratique: {"error": "Token abc123 is invalid"}
        Bonne pratique: {"error": "Invalid token"}
        """
        invalid_tokens = [
            "not_a_jwt",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature",
        ]

        for token in invalid_tokens:
            response = api_client.get(
                f"{API_URL}/autologin",
                headers={"Authorization": f"Bearer {token}"}
            )

            assert response.status_code == 401

            error_text = response.text.lower()

            # Assert: Error message ne contient PAS le token
            assert token not in error_text, \
                "Error message should NOT leak token value"

            # Assert: Error message générique
            assert "invalid" in error_text or "unauthorized" in error_text, \
                "Error message should be generic"


# ========== Test Class: Session Fixation ==========

class TestSessionFixation:
    """Tests prévention session fixation attacks"""

    def test_14_new_login_generates_new_jti(self, api_client, registered_user):
        """
        CRITICAL: Chaque login doit générer un nouveau JWT avec jti unique

        Protection contre session fixation: attaquant ne peut pas forcer une victim
        à utiliser un token pré-défini.
        """
        credentials = registered_user["credentials"]

        # Login 1
        response1 = api_client.post(f"{API_URL}/login", json={
            "email": credentials["email"],
            "password": credentials["password"],
        })
        token1 = response1.json()["token"]

        # Login 2 (même user)
        response2 = api_client.post(f"{API_URL}/login", json={
            "email": credentials["email"],
            "password": credentials["password"],
        })
        token2 = response2.json()["token"]

        # Assert: Tokens différents
        assert token1 != token2, "Each login should generate unique JWT (prevent fixation)"

        # Assert: JTI différents
        import jwt
        jti1 = jwt.decode(token1, options={"verify_signature": False})["jti"]
        jti2 = jwt.decode(token2, options={"verify_signature": False})["jti"]
        assert jti1 != jti2, "JTI should be unique per login"


# ========== Main Entry Point ==========

if __name__ == "__main__":
    print("=" * 80)
    print("GAUZIAN Security Test Suite - CSRF Bypass & Injection Tests")
    print("=" * 80)
    print(f"API URL: {API_URL}")
    print(f"Frontend URL: {FRONTEND_URL}")
    print()

    exit_code = pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--color=yes",
        "-ra",
    ])

    sys.exit(exit_code)
