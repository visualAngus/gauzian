#!/usr/bin/env python3
"""
GAUZIAN Security Test Suite - Authentication & Authorization Headers Validation

Tests critiques pour valider la migration de l'authentification par cookies vers Authorization headers.

MIGRATION CONTEXT:
- AVANT: JWT stocké dans cookie `auth_token` (HttpOnly, Secure)
- APRÈS: JWT stocké dans localStorage + envoyé via `Authorization: Bearer <token>` header

ENDPOINTS TESTÉS:
- POST /api/login - Authentification (retourne token dans JSON)
- POST /api/register - Inscription (retourne token + auto-login)
- GET /api/autologin - Vérification validité token (requiert Authorization header)
- POST /api/logout - Révocation token (blacklist Redis)

EXÉCUTION:
    python3 tests/security/auth_header_validation.py
    # OU
    pytest tests/security/auth_header_validation.py -v --tb=short

REQUIREMENTS:
    pip install requests pytest pyjwt faker python-dotenv
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

import requests
import jwt
import pytest
from faker import Faker

# ========== Configuration ==========

API_URL = os.getenv("API_URL", "https://gauzian.pupin.fr/api")
TEST_EMAIL_SUFFIX = os.getenv("TEST_EMAIL_SUFFIX", "@test-security.gauzian.local")

fake = Faker()

# ========== Test Fixtures ==========

@pytest.fixture(scope="module")
def api_client():
    """Client HTTP avec session persistante"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "User-Agent": "GAUZIAN-SecurityTest/1.0"
    })
    yield session
    session.close()


@pytest.fixture
def test_user_credentials():
    """Génère des credentials uniques pour chaque test"""
    return {
        "email": f"test_{fake.uuid4()[:8]}{TEST_EMAIL_SUFFIX}",
        "username": fake.user_name(),
        "password": "SecureTestPass123!@#",
    }


@pytest.fixture
def crypto_fields():
    """Champs crypto mock (E2EE) pour register"""
    # En production, ces champs sont générés par crypto.ts côté client
    # Ici on utilise des mock valides pour tester l'authentification
    return {
        "encrypted_private_key": fake.sha256(),
        "public_key": fake.sha256(),
        "private_key_salt": fake.sha256()[:32],
        "iv": fake.sha256()[:32],
        "encrypted_record_key": fake.sha256(),
    }


@pytest.fixture
def registered_user(api_client, test_user_credentials, crypto_fields) -> Dict:
    """Crée un utilisateur et retourne ses credentials + token"""
    register_data = {
        **test_user_credentials,
        **crypto_fields,
    }

    response = api_client.post(f"{API_URL}/register", json=register_data)
    assert response.status_code == 200, f"Register failed: {response.text}"

    data = response.json()
    return {
        "credentials": test_user_credentials,
        "token": data["token"],
        "user_id": data["user_id"],
        "crypto": crypto_fields,
    }


# ========== Helper Functions ==========

def decode_jwt_unsafe(token: str) -> Dict:
    """Décode JWT sans vérifier la signature (tests only)"""
    try:
        return jwt.decode(token, options={"verify_signature": False})
    except Exception as e:
        pytest.fail(f"Failed to decode JWT: {e}")


def create_expired_jwt(user_id: str, secret: str = "test_secret") -> str:
    """Crée un JWT expiré pour les tests"""
    payload = {
        "id": user_id,
        "role": "user",
        "exp": int((datetime.utcnow() - timedelta(days=1)).timestamp()),
        "jti": fake.uuid4(),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def create_invalid_jwt(user_id: str) -> str:
    """Crée un JWT avec signature invalide"""
    payload = {
        "id": user_id,
        "role": "user",
        "exp": int((datetime.utcnow() + timedelta(days=10)).timestamp()),
        "jti": fake.uuid4(),
    }
    # Signer avec un secret différent pour invalider la signature
    return jwt.encode(payload, "wrong_secret_12345", algorithm="HS256")


# ========== Test Class: Authentication Flow ==========

class TestAuthenticationFlow:
    """Tests du workflow d'authentification complet"""

    def test_01_login_valid_credentials(self, api_client, registered_user):
        """
        Test 1.1: Login avec credentials valides

        CRITICAL: Vérifie que le token JWT est retourné dans le JSON (pas cookie).
        Valide également l'absence de cookie Set-Cookie dans la réponse.
        """
        credentials = registered_user["credentials"]

        response = api_client.post(f"{API_URL}/login", json={
            "email": credentials["email"],
            "password": credentials["password"],
        })

        # Assert: 200 OK
        assert response.status_code == 200, f"Login failed: {response.text}"

        data = response.json()

        # Assert: Token présent dans JSON
        assert "token" in data, "Missing 'token' in response"
        assert isinstance(data["token"], str), "Token should be string"
        assert len(data["token"]) > 100, "Token too short (invalid JWT?)"

        # Assert: AUCUN cookie auth_token (migration complète)
        assert "Set-Cookie" not in response.headers, "Should NOT set auth_token cookie"

        # Assert: JWT valide et décodable
        decoded = decode_jwt_unsafe(data["token"])
        assert "id" in decoded, "Missing 'id' claim"
        assert "exp" in decoded, "Missing 'exp' claim"
        assert "jti" in decoded, "Missing 'jti' claim (needed for blacklist)"

        # Assert: Token non expiré
        exp_timestamp = decoded["exp"]
        assert exp_timestamp > datetime.utcnow().timestamp(), "Token already expired"

        # Assert: Expiration ~10 jours (±1h tolerance)
        expected_exp = datetime.utcnow() + timedelta(days=10)
        exp_datetime = datetime.fromtimestamp(exp_timestamp)
        delta = abs((exp_datetime - expected_exp).total_seconds())
        assert delta < 3600, f"Token expiration mismatch: expected ~10 days, got {delta}s delta"

        # Assert: Champs crypto présents (pour E2EE)
        assert "encrypted_private_key" in data, "Missing crypto field"
        assert "public_key" in data, "Missing crypto field"
        assert "private_key_salt" in data, "Missing crypto field"
        assert "iv" in data, "Missing crypto field"


    def test_02_register_valid_creates_user_and_returns_token(self, api_client, test_user_credentials, crypto_fields):
        """
        Test 1.2: Register avec données valides

        CRITICAL: Vérifie que register retourne immédiatement un token (auto-login).
        """
        register_data = {
            **test_user_credentials,
            **crypto_fields,
        }

        response = api_client.post(f"{API_URL}/register", json=register_data)

        # Assert: 200 OK
        assert response.status_code == 200, f"Register failed: {response.text}"

        data = response.json()

        # Assert: Token présent (auto-login après inscription)
        assert "token" in data, "Missing token in register response"
        assert "user_id" in data, "Missing user_id"

        # Assert: Token immédiatement utilisable
        decoded = decode_jwt_unsafe(data["token"])
        assert decoded["id"] == data["user_id"], "Token user_id mismatch"

        # Assert: AUCUN cookie
        assert "Set-Cookie" not in response.headers, "Should NOT set cookie"


    def test_03_login_with_invalid_password(self, api_client, registered_user):
        """
        Test 1.3: Login avec mauvais mot de passe

        CRITICAL: Vérifie 401 Unauthorized + rate limiting après N tentatives.
        """
        credentials = registered_user["credentials"]

        response = api_client.post(f"{API_URL}/login", json={
            "email": credentials["email"],
            "password": "WrongPassword123!",
        })

        # Assert: 401 Unauthorized
        assert response.status_code == 401, "Should reject invalid password"

        # Assert: Error message générique (pas de leak d'info)
        data = response.json()
        assert "error" in data or "message" in data, "Missing error message"


    def test_04_login_brute_force_rate_limiting(self, api_client, test_user_credentials, crypto_fields):
        """
        Test 1.3 (suite): Rate limiting après 5 tentatives échouées

        CRITICAL: Vérifie que le backend bloque après MAX_LOGIN_ATTEMPTS (5 selon services.rs).
        """
        # Créer un user pour ce test
        register_data = {**test_user_credentials, **crypto_fields}
        response = api_client.post(f"{API_URL}/register", json=register_data)
        assert response.status_code == 200

        email = test_user_credentials["email"]

        # Tenter 6 login échoués
        for i in range(6):
            response = api_client.post(f"{API_URL}/login", json={
                "email": email,
                "password": f"WrongPass{i}",
            })

            if i < 5:
                # Premières 5 tentatives: 401 Unauthorized
                assert response.status_code == 401, f"Attempt {i+1} should return 401"
            else:
                # 6ème tentative: 429 Too Many Requests (rate limited)
                assert response.status_code == 429, "Should be rate limited after 5 failures"
                data = response.json()
                assert "rate" in str(data).lower() or "too many" in str(data).lower(), \
                    "Error message should mention rate limiting"


    def test_05_autologin_with_valid_token(self, api_client, registered_user):
        """
        Test 1.4: Autologin avec token valide dans Authorization header

        CRITICAL: Endpoint protégé, requiert Authorization: Bearer <token>.
        """
        token = registered_user["token"]

        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {token}"}
        )

        # Assert: 200 OK
        assert response.status_code == 200, f"Autologin failed: {response.text}"

        # Assert: Response contains user confirmation
        data = response.json()
        assert "user" in str(data).lower() or "authenticated" in str(data).lower(), \
            "Response should confirm authentication"


    def test_06_autologin_without_authorization_header(self, api_client):
        """
        Test 1.5: Autologin SANS Authorization header

        CRITICAL: Doit retourner 401 (backend ne lit plus les cookies).
        """
        response = api_client.get(f"{API_URL}/autologin")

        # Assert: 401 Unauthorized
        assert response.status_code == 401, "Should reject request without Authorization header"


    def test_07_autologin_with_invalid_token(self, api_client):
        """
        Test 1.6: Autologin avec token invalide (signature incorrecte)

        CRITICAL: Backend doit rejeter les JWT avec signature invalide.
        """
        invalid_token = create_invalid_jwt("00000000-0000-0000-0000-000000000000")

        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {invalid_token}"}
        )

        # Assert: 401 Unauthorized
        assert response.status_code == 401, "Should reject JWT with invalid signature"


    def test_08_autologin_with_expired_token(self, api_client):
        """
        Test 1.7: Autologin avec token expiré

        CRITICAL: JWT expiré doit être rejeté.
        """
        expired_token = create_expired_jwt("00000000-0000-0000-0000-000000000000")

        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {expired_token}"}
        )

        # Assert: 401 Unauthorized
        assert response.status_code == 401, "Should reject expired JWT"


    def test_09_autologin_with_malformed_token(self, api_client):
        """
        Test 1.6 (variante): Autologin avec token malformé

        Tests edge cases: token non-JWT, token tronqué, etc.
        """
        test_cases = [
            ("NotAJWT", "Plain string"),
            ("Bearer.Malformed.Token", "Malformed JWT structure"),
            ("", "Empty token"),
            ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "Only header part"),
        ]

        for token, description in test_cases:
            response = api_client.get(
                f"{API_URL}/autologin",
                headers={"Authorization": f"Bearer {token}"}
            )

            assert response.status_code == 401, \
                f"Should reject {description}: {token}"


# ========== Test Class: Authorization Bypass Attempts ==========

class TestAuthorizationBypass:
    """Tests tentatives de bypass de l'authentification"""

    def test_10_protected_endpoint_without_token(self, api_client):
        """
        Test 3.1: Accès endpoint protégé sans token

        CRITICAL: Tous les endpoints drive/* doivent être protégés.
        """
        protected_endpoints = [
            "/drive/files",
            "/drive/folders",
            "/info",
        ]

        for endpoint in protected_endpoints:
            response = api_client.get(f"{API_URL}{endpoint}")

            assert response.status_code == 401, \
                f"Endpoint {endpoint} should require authentication"


    def test_11_token_in_query_params_rejected(self, api_client, registered_user):
        """
        Test 3.2: Token dans query params (doit échouer)

        CRITICAL: Backend ne doit accepter QUE Authorization header.
        """
        token = registered_user["token"]

        # Tentative avec ?token=<jwt>
        response = api_client.get(f"{API_URL}/autologin?token={token}")

        # Assert: 401 (token non extrait depuis query params)
        assert response.status_code == 401, "Should NOT accept token in query params"


    def test_12_token_in_body_rejected(self, api_client, registered_user):
        """
        Test 3.3: Token dans request body (doit échouer)

        CRITICAL: Backend ne doit PAS extraire token depuis le body.
        """
        token = registered_user["token"]

        # Tentative POST avec token dans body
        response = api_client.post(
            f"{API_URL}/drive/folders",
            json={"token": token, "name": "test_folder"}
        )

        # Assert: 401 (pas de token dans Authorization header)
        assert response.status_code == 401, "Should NOT accept token in request body"


    def test_13_jwt_with_modified_payload(self, api_client, registered_user):
        """
        Test 3.4: JWT avec payload modifié (signature invalide)

        CRITICAL: Attaque classique - modifier claims sans re-signer.
        """
        token = registered_user["token"]

        # Décoder, modifier le user_id, re-encoder SANS re-signer
        decoded = decode_jwt_unsafe(token)
        decoded["id"] = "00000000-0000-0000-0000-000000000000"  # Admin UUID mock

        # Encoder sans signature valide
        header, payload, signature = token.split(".")
        modified_payload = jwt.utils.base64url_encode(json.dumps(decoded).encode())
        forged_token = f"{header}.{modified_payload.decode()}.{signature}"

        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {forged_token}"}
        )

        # Assert: 401 (signature invalide)
        assert response.status_code == 401, "Should reject JWT with modified payload"


    def test_14_token_revoked_via_logout(self, api_client, registered_user):
        """
        Test 3.5: Token révoqué via blacklist Redis (logout)

        CRITICAL: Après logout, le token doit être blacklisté et inutilisable.
        """
        token = registered_user["token"]

        # 1. Vérifier que token est valide AVANT logout
        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, "Token should be valid before logout"

        # 2. Logout (blacklist token)
        response = api_client.post(
            f"{API_URL}/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Logout failed: {response.text}"

        # 3. Tenter réutilisation du token révoqué
        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {token}"}
        )

        # Assert: 401 (token blacklisté)
        assert response.status_code == 401, "Should reject revoked token"

        # Assert: Error message mentions revocation
        data = response.json()
        error_str = str(data).lower()
        assert "revoked" in error_str or "invalid" in error_str, \
            "Error should indicate token was revoked"


# ========== Test Class: Token Lifecycle ==========

class TestTokenLifecycle:
    """Tests cycle de vie des JWT"""

    def test_15_token_expiration_10_days(self, api_client, registered_user):
        """
        Test 7.1: Vérifier expiration token à 10 jours

        Valide que le token est configuré pour expirer après 10 jours (pas 1h, pas 30j).
        """
        token = registered_user["token"]
        decoded = decode_jwt_unsafe(token)

        exp_timestamp = decoded["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp)
        now = datetime.utcnow()

        delta_days = (exp_datetime - now).days

        # Assert: ~10 jours (±1 jour tolerance)
        assert 9 <= delta_days <= 11, \
            f"Token should expire in ~10 days, got {delta_days} days"


    def test_16_logout_blacklists_jti_in_redis(self, api_client, registered_user):
        """
        Test 7.2: Logout ajoute jti à blacklist Redis

        Vérifie que le mécanisme de révocation fonctionne correctement.
        Note: Ce test valide le comportement E2E, pas l'état Redis directement.
        """
        token = registered_user["token"]
        decoded = decode_jwt_unsafe(token)
        jti = decoded["jti"]

        # Logout
        response = api_client.post(
            f"{API_URL}/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200

        # Vérifier que le token est inutilisable
        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401, \
            f"Token with jti={jti} should be blacklisted after logout"


    def test_17_multiple_tokens_same_user(self, api_client, registered_user):
        """
        Test edge case: Plusieurs tokens pour un même user (multi-device)

        Chaque login génère un nouveau JWT avec jti unique.
        Logout d'un token ne doit PAS invalider les autres.
        """
        credentials = registered_user["credentials"]

        # Login 1
        response = api_client.post(f"{API_URL}/login", json={
            "email": credentials["email"],
            "password": credentials["password"],
        })
        token1 = response.json()["token"]

        # Login 2 (même user, nouveau token)
        response = api_client.post(f"{API_URL}/login", json={
            "email": credentials["email"],
            "password": credentials["password"],
        })
        token2 = response.json()["token"]

        # Assert: Tokens différents (jti unique)
        assert token1 != token2, "Each login should generate unique JWT"

        jti1 = decode_jwt_unsafe(token1)["jti"]
        jti2 = decode_jwt_unsafe(token2)["jti"]
        assert jti1 != jti2, "JTI should be unique per token"

        # Logout token1
        response = api_client.post(
            f"{API_URL}/logout",
            headers={"Authorization": f"Bearer {token1}"}
        )
        assert response.status_code == 200

        # Token1 invalidé
        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {token1}"}
        )
        assert response.status_code == 401, "Token1 should be revoked"

        # Token2 TOUJOURS valide
        response = api_client.get(
            f"{API_URL}/autologin",
            headers={"Authorization": f"Bearer {token2}"}
        )
        assert response.status_code == 200, "Token2 should remain valid"


# ========== Test Class: CSRF Protection ==========

class TestCSRFProtection:
    """Tests protection CSRF (doit être effective maintenant que cookies sont abandonnés)"""

    def test_18_csrf_with_cookie_fails(self, api_client, registered_user):
        """
        Test 2.1: CSRF avec cookie forgé (doit échouer)

        CRITICAL: Backend ne doit PLUS lire le cookie auth_token.
        Migration vers Authorization header élimine CSRF.
        """
        token = registered_user["token"]

        # Tenter requête avec cookie forgé (pas Authorization header)
        response = api_client.get(
            f"{API_URL}/autologin",
            cookies={"auth_token": token}  # Ancien mécanisme
        )

        # Assert: 401 (cookie ignoré)
        assert response.status_code == 401, \
            "Backend should NOT read auth_token cookie (migration completed)"


    def test_19_state_changing_operations_require_token(self, api_client):
        """
        Test 2.2: Opérations sensibles requièrent Authorization header

        CRITICAL: POST/PUT/DELETE doivent être protégés.
        """
        state_changing_ops = [
            ("POST", "/drive/folders", {"encrypted_metadata": "test"}),
            ("DELETE", "/drive/files/00000000-0000-0000-0000-000000000000", None),
        ]

        for method, endpoint, data in state_changing_ops:
            if method == "POST":
                response = api_client.post(f"{API_URL}{endpoint}", json=data)
            elif method == "DELETE":
                response = api_client.delete(f"{API_URL}{endpoint}")

            assert response.status_code == 401, \
                f"{method} {endpoint} should require Authorization header"


# ========== Main Entry Point ==========

if __name__ == "__main__":
    print("=" * 80)
    print("GAUZIAN Security Test Suite - Authentication & Authorization Headers")
    print("=" * 80)
    print(f"API URL: {API_URL}")
    print(f"Test Email Suffix: {TEST_EMAIL_SUFFIX}")
    print()

    # Run pytest with verbose output
    exit_code = pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--color=yes",
        "-ra",  # Show summary of all test results
    ])

    sys.exit(exit_code)
