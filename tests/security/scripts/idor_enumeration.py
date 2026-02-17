#!/usr/bin/env python3
"""
GAUZIAN IDOR (Insecure Direct Object Reference) Testing Suite

Tests for authorization bypass via direct object references:
1. Horizontal privilege escalation (User A accessing User B's files)
2. Vertical privilege escalation (Viewer trying to delete files)
3. UUID enumeration (discovering files via UUID guessing)
4. Folder hierarchy bypass
5. Share permission validation
"""

import requests
import json
import uuid
import argparse
import sys
from typing import Optional, List, Dict, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

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


class User:
    def __init__(self, email: str, password: str):
        self.email = email
        self.password = password
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.files: List[str] = []  # List of file IDs owned by user
        self.folders: List[str] = []  # List of folder IDs owned by user


class GauzianIDORTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.vulnerabilities = []

    def login(self, user: User) -> bool:
        """Login and populate user token"""
        url = f"{self.base_url}/api/login"
        payload = {
            "email": user.email,
            "password": user.password
        }

        try:
            response = self.session.post(url, json=payload, timeout=10)
            if response.status_code == 200:
                data = response.json()
                user.token = data.get('token')
                user.user_id = data.get('user_id')
                print(f"{Colors.OKGREEN}✓{Colors.ENDC} Logged in as {user.email} (user_id: {user.user_id})")
                return True
            else:
                print(f"{Colors.FAIL}✗ Login failed for {user.email}: {response.status_code}{Colors.ENDC}")
                return False
        except Exception as e:
            print(f"{Colors.FAIL}✗ Login error for {user.email}: {e}{Colors.ENDC}")
            return False

    def create_test_file(self, user: User, filename: str = "test_idor.txt") -> Optional[str]:
        """Create a test file and return its ID"""
        url = f"{self.base_url}/api/drive/initialize_file"
        payload = {
            "size": 1024,
            "encrypted_metadata": f"{{\"name\": \"{filename}\"}}",
            "mime_type": "text/plain",
            "folder_id": "null",
            "encrypted_file_key": "test_encrypted_key"
        }

        try:
            headers = {"Authorization": f"Bearer {user.token}"}
            response = self.session.post(url, json=payload, headers=headers, timeout=10)

            if response.status_code == 200:
                data = response.json()
                file_id = data.get('file_id')
                user.files.append(file_id)
                print(f"{Colors.OKGREEN}✓{Colors.ENDC} Created file '{filename}' with ID: {file_id}")
                return file_id
            else:
                print(f"{Colors.FAIL}✗ Failed to create file: {response.status_code}{Colors.ENDC}")
                return None
        except Exception as e:
            print(f"{Colors.FAIL}✗ Error creating file: {e}{Colors.ENDC}")
            return None

    def create_test_folder(self, user: User, folder_name: str = "test_idor_folder") -> Optional[str]:
        """Create a test folder and return its ID"""
        url = f"{self.base_url}/api/drive/create_folder"
        payload = {
            "name": folder_name,
            "parent_id": "null",
            "encrypted_metadata": f"{{\"name\": \"{folder_name}\"}}"
        }

        try:
            headers = {"Authorization": f"Bearer {user.token}"}
            response = self.session.post(url, json=payload, headers=headers, timeout=10)

            if response.status_code == 200:
                data = response.json()
                folder_id = data.get('folder_id')
                user.folders.append(folder_id)
                print(f"{Colors.OKGREEN}✓{Colors.ENDC} Created folder '{folder_name}' with ID: {folder_id}")
                return folder_id
            else:
                print(f"{Colors.FAIL}✗ Failed to create folder: {response.status_code}{Colors.ENDC}")
                return None
        except Exception as e:
            print(f"{Colors.FAIL}✗ Error creating folder: {e}{Colors.ENDC}")
            return None

    def try_access_file(self, user: User, file_id: str) -> Tuple[int, str]:
        """Try to access file metadata (returns status code and response)"""
        url = f"{self.base_url}/api/drive/file/{file_id}"
        headers = {"Authorization": f"Bearer {user.token}"}

        try:
            response = self.session.get(url, headers=headers, timeout=10)
            return response.status_code, response.text
        except Exception as e:
            return 0, str(e)

    def try_delete_file(self, user: User, file_id: str) -> Tuple[int, str]:
        """Try to delete a file (returns status code and response)"""
        url = f"{self.base_url}/api/drive/delete_file"
        payload = {"file_id": file_id}
        headers = {"Authorization": f"Bearer {user.token}"}

        try:
            response = self.session.post(url, json=payload, headers=headers, timeout=10)
            return response.status_code, response.text
        except Exception as e:
            return 0, str(e)

    def share_file(self, owner: User, file_id: str, recipient_email: str, access_level: str = "viewer") -> bool:
        """Share a file with another user"""
        url = f"{self.base_url}/api/drive/share_file"
        payload = {
            "file_id": file_id,
            "target_user_email": recipient_email,
            "access_level": access_level,
            "encrypted_file_key": "test_encrypted_key_for_recipient"
        }
        headers = {"Authorization": f"Bearer {owner.token}"}

        try:
            response = self.session.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                print(f"{Colors.OKGREEN}✓{Colors.ENDC} Shared file {file_id} with {recipient_email} ({access_level})")
                return True
            else:
                print(f"{Colors.FAIL}✗ Failed to share file: {response.status_code}{Colors.ENDC}")
                return False
        except Exception as e:
            print(f"{Colors.FAIL}✗ Error sharing file: {e}{Colors.ENDC}")
            return False


    # ============================
    # Test 1: Horizontal Privilege Escalation (User A → User B's Files)
    # ============================
    def test_horizontal_privilege_escalation(self, user_a: User, user_b: User):
        print_test_header("Horizontal Privilege Escalation (User A → User B's Files)")

        # User A creates a file
        file_id_a = self.create_test_file(user_a, "userA_private_file.txt")
        if not file_id_a:
            print_result("Horizontal Privilege Escalation", False, "Could not create test file")
            return

        # User B tries to access User A's file
        print(f"\n{Colors.OKCYAN}User B attempting to access User A's file...{Colors.ENDC}")
        status, response = self.try_access_file(user_b, file_id_a)

        if status == 403 or status == 404 or status == 401:
            print_result("Horizontal Privilege Escalation", True, f"User B denied access (HTTP {status})")
        else:
            print_result("Horizontal Privilege Escalation", False, f"User B accessed User A's file! (HTTP {status})")
            print_vulnerability(
                "Horizontal Privilege Escalation (IDOR)",
                "CRITICAL",
                f"User B can access User A's private file. Response: {response[:200]}"
            )
            self.vulnerabilities.append({
                "name": "Horizontal Privilege Escalation",
                "severity": "CRITICAL",
                "cvss": 9.1,
                "description": f"User {user_b.email} accessed file owned by {user_a.email}",
                "file_id": file_id_a
            })


    # ============================
    # Test 2: Vertical Privilege Escalation (Viewer → Delete)
    # ============================
    def test_vertical_privilege_escalation(self, owner: User, viewer: User):
        print_test_header("Vertical Privilege Escalation (Viewer → Delete)")

        # Owner creates a file
        file_id = self.create_test_file(owner, "shared_file.txt")
        if not file_id:
            print_result("Vertical Privilege Escalation", False, "Could not create test file")
            return

        # Owner shares file with viewer (read-only)
        if not self.share_file(owner, file_id, viewer.email, "viewer"):
            print_result("Vertical Privilege Escalation", False, "Could not share file")
            return

        # Viewer tries to delete the file (should fail)
        print(f"\n{Colors.OKCYAN}Viewer attempting to delete file...{Colors.ENDC}")
        status, response = self.try_delete_file(viewer, file_id)

        if status in [403, 404, 401]:
            print_result("Vertical Privilege Escalation", True, f"Viewer denied delete permission (HTTP {status})")
        else:
            print_result("Vertical Privilege Escalation", False, f"Viewer deleted file! (HTTP {status})")
            print_vulnerability(
                "Vertical Privilege Escalation",
                "CRITICAL",
                f"Viewer with read-only access deleted file. Response: {response[:200]}"
            )
            self.vulnerabilities.append({
                "name": "Vertical Privilege Escalation (Viewer → Owner)",
                "severity": "CRITICAL",
                "cvss": 8.8,
                "description": f"User {viewer.email} with viewer access deleted file {file_id}",
                "file_id": file_id
            })


    # ============================
    # Test 3: UUID Enumeration
    # ============================
    def test_uuid_enumeration(self, user: User):
        print_test_header("UUID Enumeration (Random UUID Probing)")

        print(f"{Colors.OKCYAN}Testing 100 random UUIDs for information disclosure...{Colors.ENDC}")

        accessible_files = []
        tested_uuids = []

        for i in range(100):
            random_uuid = str(uuid.uuid4())
            tested_uuids.append(random_uuid)

            status, response = self.try_access_file(user, random_uuid)

            if status == 200:
                accessible_files.append(random_uuid)
                print(f"  {Colors.WARNING}Found accessible file: {random_uuid} (HTTP 200){Colors.ENDC}")
            elif i % 25 == 0:
                print(f"  Tested {i+1}/100 UUIDs...")

        if accessible_files:
            print_result("UUID Enumeration", False, f"Found {len(accessible_files)} accessible files from random UUIDs")
            print_vulnerability(
                "UUID Enumeration / Information Disclosure",
                "HIGH",
                f"Random UUID probing revealed {len(accessible_files)} accessible files: {accessible_files}"
            )
            self.vulnerabilities.append({
                "name": "UUID Enumeration",
                "severity": "HIGH",
                "cvss": 7.5,
                "description": f"Random UUID probing succeeded for {len(accessible_files)} files",
                "found_uuids": accessible_files
            })
        else:
            print_result("UUID Enumeration", True, "No files accessible via random UUID probing (0/100 succeeded)")


    # ============================
    # Test 4: Sequential UUID Attack
    # ============================
    def test_sequential_uuid_attack(self, user: User, known_file_id: str):
        """
        Try incrementing/decrementing UUID to find adjacent files.
        Note: UUIDs are random, so this is low probability, but worth testing.
        """
        print_test_header("Sequential UUID Attack (Adjacent File Discovery)")

        print(f"{Colors.OKCYAN}Known file ID: {known_file_id}{Colors.ENDC}")
        print(f"{Colors.OKCYAN}Attempting to access adjacent UUIDs...{Colors.ENDC}")

        # Parse UUID
        try:
            base_uuid = uuid.UUID(known_file_id)
        except ValueError:
            print_result("Sequential UUID Attack", False, "Invalid UUID format")
            return

        # Try ±10 variations
        accessible_adjacent = []

        for offset in range(-10, 11):
            if offset == 0:
                continue  # Skip the known file

            # Increment UUID integer representation
            new_int = base_uuid.int + offset
            if new_int < 0:
                continue

            try:
                new_uuid = uuid.UUID(int=new_int)
                status, response = self.try_access_file(user, str(new_uuid))

                if status == 200:
                    accessible_adjacent.append(str(new_uuid))
                    print(f"  {Colors.WARNING}Found adjacent file: {new_uuid} (offset {offset:+d}){Colors.ENDC}")

            except Exception:
                continue

        if accessible_adjacent:
            print_result("Sequential UUID Attack", False, f"Found {len(accessible_adjacent)} adjacent files")
            print_vulnerability(
                "Predictable UUID Pattern",
                "MEDIUM",
                f"Adjacent UUIDs are accessible: {accessible_adjacent}"
            )
            self.vulnerabilities.append({
                "name": "Sequential UUID Access",
                "severity": "MEDIUM",
                "cvss": 6.5,
                "description": f"Found {len(accessible_adjacent)} adjacent files via UUID incrementing",
                "found_uuids": accessible_adjacent
            })
        else:
            print_result("Sequential UUID Attack", True, "No adjacent files accessible (UUIDs are non-sequential)")


    # ============================
    # Test 5: Folder Hierarchy Bypass
    # ============================
    def test_folder_hierarchy_bypass(self, user_a: User, user_b: User):
        print_test_header("Folder Hierarchy Bypass (Parent Folder Protection)")

        # User A creates parent folder
        parent_folder_id = self.create_test_folder(user_a, "parent_folder")
        if not parent_folder_id:
            print_result("Folder Hierarchy Bypass", False, "Could not create parent folder")
            return

        # User A creates child file in parent folder
        url = f"{self.base_url}/api/drive/initialize_file"
        payload = {
            "size": 1024,
            "encrypted_metadata": "{\"name\": \"child_file.txt\"}",
            "mime_type": "text/plain",
            "folder_id": parent_folder_id,
            "encrypted_file_key": "test_key"
        }
        headers = {"Authorization": f"Bearer {user_a.token}"}

        try:
            response = self.session.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                child_file_id = response.json().get('file_id')
                print(f"{Colors.OKGREEN}✓{Colors.ENDC} Created child file in parent folder: {child_file_id}")

                # User B tries to access child file directly (bypassing folder permissions)
                print(f"\n{Colors.OKCYAN}User B attempting to access child file directly...{Colors.ENDC}")
                status, response = self.try_access_file(user_b, child_file_id)

                if status in [403, 404, 401]:
                    print_result("Folder Hierarchy Bypass", True, f"User B denied access to child file (HTTP {status})")
                else:
                    print_result("Folder Hierarchy Bypass", False, f"User B accessed child file! (HTTP {status})")
                    print_vulnerability(
                        "Folder Hierarchy Bypass",
                        "HIGH",
                        f"User B accessed file inside User A's private folder. Response: {response[:200]}"
                    )
                    self.vulnerabilities.append({
                        "name": "Folder Hierarchy Bypass",
                        "severity": "HIGH",
                        "cvss": 7.8,
                        "description": f"User {user_b.email} accessed file {child_file_id} in private folder {parent_folder_id}",
                        "file_id": child_file_id,
                        "folder_id": parent_folder_id
                    })
            else:
                print_result("Folder Hierarchy Bypass", False, f"Could not create child file: {response.status_code}")

        except Exception as e:
            print_result("Folder Hierarchy Bypass", False, f"Error: {e}")


    # ============================
    # Run All Tests
    # ============================
    def run_all_tests(self, user_a: User, user_b: User):
        print(f"\n{Colors.BOLD}{Colors.HEADER}")
        print("="*70)
        print("  GAUZIAN IDOR SECURITY TEST SUITE")
        print("="*70)
        print(f"{Colors.ENDC}\n")

        print(f"Target: {Colors.OKBLUE}{self.base_url}{Colors.ENDC}")
        print(f"User A: {Colors.OKBLUE}{user_a.email}{Colors.ENDC}")
        print(f"User B: {Colors.OKBLUE}{user_b.email}{Colors.ENDC}\n")

        # Login both users
        if not self.login(user_a):
            print(f"{Colors.FAIL}Cannot proceed without User A login{Colors.ENDC}")
            return 1

        if not self.login(user_b):
            print(f"{Colors.FAIL}Cannot proceed without User B login{Colors.ENDC}")
            return 1

        # Run all tests
        self.test_horizontal_privilege_escalation(user_a, user_b)
        self.test_vertical_privilege_escalation(user_a, user_b)
        self.test_uuid_enumeration(user_b)

        # For sequential test, use a known file from user_a
        if user_a.files:
            self.test_sequential_uuid_attack(user_b, user_a.files[0])

        self.test_folder_hierarchy_bypass(user_a, user_b)

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

            return 1
        else:
            print(f"{Colors.OKGREEN}✓ All tests passed! No IDOR vulnerabilities detected.{Colors.ENDC}\n")
            return 0


def main():
    parser = argparse.ArgumentParser(description='GAUZIAN IDOR Security Testing')
    parser.add_argument('--url', default='https://gauzian.pupin.fr', help='Base URL')
    parser.add_argument('--user-a', required=True, help='User A email')
    parser.add_argument('--password-a', required=True, help='User A password')
    parser.add_argument('--user-b', required=True, help='User B email')
    parser.add_argument('--password-b', required=True, help='User B password')

    args = parser.parse_args()

    user_a = User(args.user_a, args.password_a)
    user_b = User(args.user_b, args.password_b)

    tester = GauzianIDORTester(args.url)
    exit_code = tester.run_all_tests(user_a, user_b)

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
