#!/usr/bin/env python3
"""
GAUZIAN Authentication Bypass Testing Suite

Tests various JWT-based authentication bypass techniques:
1. Token manipulation (signature tampering, algorithm confusion)
2. Expired token acceptance
3. Blacklist bypass (logout race conditions)
4. Session fixation
5. Token replay attacks
"""

import requests
import json
import time
import jwt
import base64
import hashlib
import hmac
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import argparse
import sys
from typing import Optional, Tuple

# ANSI color codes
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_test_header(test_name: str):
    print(f"\n{Colors.HEADER}{'='*70}{Colors.ENDC}")
    print(f"{Colors.BOLD}TEST: {test_name}{Colors.ENDC}")
    print(f"{Colors.HEADER}{'='*70}{Colors.ENDC}\n")

def print_result(test_name: str, passed: bool, details: str = ""):
    status = f"{Colors.OKGREEN}✓ PASS{Colors.ENDC}" if passed else f"{Colors.FAIL}✗ FAIL{Colors.ENDC}"
    print(f"{status} - {test_name}")
    if details:
        print(f"  {Colors.OKCYAN}Details: {details}{Colors.ENDC}")

def print_vulnerability(vuln_name: str, severity: str, description: str):
    severity_colors = {
        "CRITICAL": Colors.FAIL,
        "HIGH": Colors.WARNING,
        "MEDIUM": Colors.WARNING,
        "LOW": Colors.OKBLUE
    }
    color = severity_colors.get(severity, Colors.ENDC)
    print(f"\n{color}[{severity}] VULNERABILITY FOUND: {vuln_name}{Colors.ENDC}")
    print(f"{color}{description}{Colors.ENDC}\n")


class GauzianAuthTester:
    def __init__(self, base_url: str, test_user: str, test_password: str):
        self.base_url = base_url.rstrip('/')
        self.test_user = test_user
        self.test_password = test_password
        self.session = requests.Session()
        self.vulnerabilities = []

    def login(self) -> Optional[str]:
        """Perform login and return JWT token"""
        url = f"{self.base_url}/api/login"
        payload = {
            "email": self.test_user,
            "password": self.test_password
        }

        try:
            response = self.session.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get('token')
            else:
                print(f"{Colors.FAIL}Login failed: {response.status_code} - {response.text}{Colors.ENDC}")
                return None
        except Exception as e:
            print(f"{Colors.FAIL}Login error: {e}{Colors.ENDC}")
            return None

    def test_protected_endpoint(self, token: str) -> Tuple[int, str]:
        """Test access to protected endpoint with given token"""
        url = f"{self.base_url}/api/info"
        headers = {"Authorization": f"Bearer {token}"}

        try:
            response = self.session.get(url, headers=headers, timeout=10)
            return response.status_code, response.text
        except Exception as e:
            return 0, str(e)


    # ============================
    # Test 1: Token Signature Tampering
    # ============================
    def test_signature_tampering(self):
        print_test_header("Token Signature Tampering")

        token = self.login()
        if not token:
            print_result("Signature Tampering", False, "Could not obtain valid token")
            return

        # Decode token without verification
        try:
            header, payload, signature = token.split('.')

            # Decode payload
            payload_decoded = json.loads(base64.urlsafe_b64decode(payload + '=='))
            print(f"Original payload: {json.dumps(payload_decoded, indent=2)}")

            # Tamper with user_id
            payload_decoded['id'] = '00000000-0000-0000-0000-000000000000'  # Try to impersonate another user

            # Re-encode payload
            payload_tampered = base64.urlsafe_b64encode(
                json.dumps(payload_decoded).encode()
            ).decode().rstrip('=')

            # Keep original signature (invalid)
            tampered_token = f"{header}.{payload_tampered}.{signature}"

            # Test with tampered token
            status, response = self.test_protected_endpoint(tampered_token)

            if status == 401:
                print_result("Signature Tampering", True, "Server rejected tampered token (401 Unauthorized)")
            else:
                print_result("Signature Tampering", False, f"Server accepted tampered token! (HTTP {status})")
                print_vulnerability(
                    "JWT Signature Not Verified",
                    "CRITICAL",
                    f"Server accepted token with invalid signature. Response: {response[:200]}"
                )
                self.vulnerabilities.append({
                    "name": "JWT Signature Not Verified",
                    "severity": "CRITICAL",
                    "cvss": 9.8,
                    "description": "Server does not validate JWT signatures, allowing attackers to forge tokens"
                })

        except Exception as e:
            print_result("Signature Tampering", False, f"Error during test: {e}")


    # ============================
    # Test 2: Algorithm Confusion Attack (None algorithm)
    # ============================
    def test_algorithm_confusion(self):
        print_test_header("Algorithm Confusion Attack (alg: none)")

        token = self.login()
        if not token:
            print_result("Algorithm Confusion", False, "Could not obtain valid token")
            return

        try:
            header, payload, signature = token.split('.')

            # Decode header and change algorithm to 'none'
            header_decoded = json.loads(base64.urlsafe_b64decode(header + '=='))
            header_decoded['alg'] = 'none'

            # Re-encode header
            header_tampered = base64.urlsafe_b64encode(
                json.dumps(header_decoded).encode()
            ).decode().rstrip('=')

            # Create token with no signature
            tampered_token = f"{header_tampered}.{payload}."

            # Test with tampered token
            status, response = self.test_protected_endpoint(tampered_token)

            if status == 401:
                print_result("Algorithm Confusion", True, "Server rejected 'none' algorithm (401 Unauthorized)")
            else:
                print_result("Algorithm Confusion", False, f"Server accepted 'none' algorithm! (HTTP {status})")
                print_vulnerability(
                    "Algorithm Confusion Vulnerability",
                    "CRITICAL",
                    f"Server accepts JWT with 'none' algorithm. Response: {response[:200]}"
                )
                self.vulnerabilities.append({
                    "name": "Algorithm Confusion (alg: none)",
                    "severity": "CRITICAL",
                    "cvss": 9.8,
                    "description": "Server accepts unsigned JWTs with 'none' algorithm"
                })

        except Exception as e:
            print_result("Algorithm Confusion", False, f"Error during test: {e}")


    # ============================
    # Test 3: Expired Token Acceptance
    # ============================
    def test_expired_token(self):
        print_test_header("Expired Token Acceptance")

        # Create a token with expired timestamp
        try:
            # First, get a valid token to extract structure
            valid_token = self.login()
            if not valid_token:
                print_result("Expired Token", False, "Could not obtain valid token")
                return

            header, payload, signature = valid_token.split('.')
            payload_decoded = json.loads(base64.urlsafe_b64decode(payload + '=='))

            # Create expired token (1 day ago)
            payload_decoded['exp'] = int((datetime.utcnow() - timedelta(days=1)).timestamp())

            # Re-encode (note: signature will be invalid, but we're testing expiration check order)
            payload_expired = base64.urlsafe_b64encode(
                json.dumps(payload_decoded).encode()
            ).decode().rstrip('=')

            expired_token = f"{header}.{payload_expired}.{signature}"

            # Test with expired token
            status, response = self.test_protected_endpoint(expired_token)

            if status == 401:
                print_result("Expired Token", True, "Server rejected expired token (401 Unauthorized)")
            else:
                print_result("Expired Token", False, f"Server may accept expired tokens (HTTP {status})")
                # Note: This might also fail due to signature, so severity is lower
                print_vulnerability(
                    "Expired Token Accepted",
                    "MEDIUM",
                    f"Server did not properly reject expired token. Response: {response[:200]}"
                )

        except Exception as e:
            print_result("Expired Token", False, f"Error during test: {e}")


    # ============================
    # Test 4: Logout Blacklist Bypass (Race Condition)
    # ============================
    def test_logout_race_condition(self):
        print_test_header("Logout Blacklist Bypass (Race Condition)")

        # Login to get fresh token
        token = self.login()
        if not token:
            print_result("Logout Race Condition", False, "Could not obtain valid token")
            return

        # Verify token works before logout
        status_before, _ = self.test_protected_endpoint(token)
        if status_before != 200:
            print_result("Logout Race Condition", False, f"Token not valid before logout (HTTP {status_before})")
            return

        print(f"Token valid before logout: {Colors.OKGREEN}✓{Colors.ENDC}")

        # Logout
        logout_url = f"{self.base_url}/api/logout"
        logout_response = self.session.post(
            logout_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )

        if logout_response.status_code != 200:
            print_result("Logout Race Condition", False, f"Logout failed (HTTP {logout_response.status_code})")
            return

        print(f"Logout successful: {Colors.OKGREEN}✓{Colors.ENDC}")

        # Try to use token immediately after logout (race condition)
        # Use multiple threads to increase race window
        results = []

        def attempt_access():
            status, response = self.test_protected_endpoint(token)
            results.append((status, response))

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(attempt_access) for _ in range(20)]
            for future in futures:
                future.result()

        # Check if any request succeeded
        successful_requests = [r for r in results if r[0] == 200]

        if successful_requests:
            print_result("Logout Race Condition", False, f"{len(successful_requests)}/20 requests succeeded after logout!")
            print_vulnerability(
                "Logout Blacklist Race Condition",
                "HIGH",
                f"Token remained valid briefly after logout. {len(successful_requests)} out of 20 concurrent requests succeeded."
            )
            self.vulnerabilities.append({
                "name": "Logout Blacklist Race Condition",
                "severity": "HIGH",
                "cvss": 7.5,
                "description": f"Token usable after logout due to race condition ({len(successful_requests)}/20 succeeded)"
            })
        else:
            print_result("Logout Race Condition", True, "All requests rejected after logout (0/20 succeeded)")


    # ============================
    # Test 5: Token Replay After Extended Time
    # ============================
    def test_token_replay(self):
        print_test_header("Token Replay After Extended Time")

        token = self.login()
        if not token:
            print_result("Token Replay", False, "Could not obtain valid token")
            return

        # Test immediate access
        status_immediate, _ = self.test_protected_endpoint(token)
        if status_immediate != 200:
            print_result("Token Replay", False, f"Token not valid immediately (HTTP {status_immediate})")
            return

        print(f"Token valid immediately: {Colors.OKGREEN}✓{Colors.ENDC}")

        # Wait 5 seconds and test again
        print("Waiting 5 seconds...")
        time.sleep(5)

        status_delayed, _ = self.test_protected_endpoint(token)

        if status_delayed == 200:
            print_result("Token Replay", True, "Token remains valid after delay (expected for 10-day expiry)")
            print(f"{Colors.OKCYAN}Note: Tokens are valid for 10 days. Consider shorter expiry + refresh tokens.{Colors.ENDC}")
        else:
            print_result("Token Replay", False, f"Token became invalid after 5s (HTTP {status_delayed}) - unexpected!")


    # ============================
    # Test 6: Session Fixation (JTI Reuse)
    # ============================
    def test_session_fixation(self):
        print_test_header("Session Fixation (JTI Uniqueness)")

        # Login twice with same credentials
        token1 = self.login()
        time.sleep(0.5)  # Small delay
        token2 = self.login()

        if not token1 or not token2:
            print_result("Session Fixation", False, "Could not obtain tokens")
            return

        # Decode JTI from both tokens
        try:
            payload1 = json.loads(base64.urlsafe_b64decode(token1.split('.')[1] + '=='))
            payload2 = json.loads(base64.urlsafe_b64decode(token2.split('.')[1] + '=='))

            jti1 = payload1.get('jti')
            jti2 = payload2.get('jti')

            print(f"JTI 1: {jti1}")
            print(f"JTI 2: {jti2}")

            if jti1 != jti2:
                print_result("Session Fixation", True, "Each login generates unique JTI (good)")
            else:
                print_result("Session Fixation", False, "Same JTI reused across logins!")
                print_vulnerability(
                    "JTI Reuse / Session Fixation",
                    "HIGH",
                    "Same JTI used across multiple logins, allowing session fixation attacks"
                )
                self.vulnerabilities.append({
                    "name": "JTI Reuse",
                    "severity": "HIGH",
                    "cvss": 7.3,
                    "description": "JTI (JWT ID) is reused across multiple logins, enabling session fixation"
                })

        except Exception as e:
            print_result("Session Fixation", False, f"Error decoding tokens: {e}")


    # ============================
    # Test 7: Brute-Force Protection
    # ============================
    def test_brute_force_protection(self):
        print_test_header("Brute-Force Protection")

        url = f"{self.base_url}/api/login"

        # Attempt 10 failed logins
        failed_attempts = 0
        rate_limited = False

        print("Attempting 10 failed logins with wrong password...")

        for i in range(10):
            payload = {
                "email": self.test_user,
                "password": f"wrong_password_{i}"
            }

            try:
                response = self.session.post(url, json=payload, timeout=10)

                if response.status_code == 429:  # Too Many Requests
                    rate_limited = True
                    print(f"  Attempt {i+1}: {Colors.WARNING}HTTP 429 (Rate Limited){Colors.ENDC}")
                    break
                elif response.status_code == 401:
                    failed_attempts += 1
                    print(f"  Attempt {i+1}: HTTP 401 (Unauthorized)")
                else:
                    print(f"  Attempt {i+1}: HTTP {response.status_code}")

                time.sleep(0.1)  # Small delay between attempts

            except Exception as e:
                print(f"  Attempt {i+1}: Error - {e}")

        if rate_limited:
            print_result("Brute-Force Protection", True, f"Rate limiting triggered after {failed_attempts} attempts")
        else:
            print_result("Brute-Force Protection", False, f"No rate limiting after {failed_attempts} failed attempts")
            print_vulnerability(
                "No Brute-Force Protection",
                "HIGH",
                "Login endpoint does not implement rate limiting per user/IP"
            )
            self.vulnerabilities.append({
                "name": "Missing Brute-Force Protection",
                "severity": "HIGH",
                "cvss": 7.5,
                "description": f"No rate limiting detected after {failed_attempts} failed login attempts"
            })


    # ============================
    # Run All Tests
    # ============================
    def run_all_tests(self):
        print(f"\n{Colors.BOLD}{Colors.HEADER}")
        print("="*70)
        print("  GAUZIAN AUTHENTICATION SECURITY TEST SUITE")
        print("="*70)
        print(f"{Colors.ENDC}\n")

        print(f"Target: {Colors.OKBLUE}{self.base_url}{Colors.ENDC}")
        print(f"Test User: {Colors.OKBLUE}{self.test_user}{Colors.ENDC}")
        print(f"Timestamp: {Colors.OKBLUE}{datetime.now().isoformat()}{Colors.ENDC}\n")

        # Run all tests
        self.test_signature_tampering()
        self.test_algorithm_confusion()
        self.test_expired_token()
        self.test_logout_race_condition()
        self.test_token_replay()
        self.test_session_fixation()
        self.test_brute_force_protection()

        # Summary
        print(f"\n{Colors.BOLD}{Colors.HEADER}")
        print("="*70)
        print("  TEST SUMMARY")
        print("="*70)
        print(f"{Colors.ENDC}\n")

        if self.vulnerabilities:
            print(f"{Colors.FAIL}Found {len(self.vulnerabilities)} vulnerabilities:{Colors.ENDC}\n")

            for vuln in self.vulnerabilities:
                severity_color = Colors.FAIL if vuln['severity'] in ['CRITICAL', 'HIGH'] else Colors.WARNING
                print(f"{severity_color}[{vuln['severity']}] {vuln['name']} (CVSS: {vuln['cvss']}){Colors.ENDC}")
                print(f"  {vuln['description']}\n")

            return 1  # Exit code 1 for failures
        else:
            print(f"{Colors.OKGREEN}✓ All tests passed! No authentication vulnerabilities detected.{Colors.ENDC}\n")
            return 0


def main():
    parser = argparse.ArgumentParser(description='GAUZIAN Authentication Security Testing')
    parser.add_argument('--url', default='https://gauzian.pupin.fr', help='Base URL (default: https://gauzian.pupin.fr)')
    parser.add_argument('--user', required=True, help='Test user email')
    parser.add_argument('--password', required=True, help='Test user password')

    args = parser.parse_args()

    tester = GauzianAuthTester(args.url, args.user, args.password)
    exit_code = tester.run_all_tests()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
