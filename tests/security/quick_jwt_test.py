#!/usr/bin/env python3
import requests
import json
import base64
import sys

if len(sys.argv) < 3:
    print("Usage: python3 quick_jwt_test.py <email> <password>")
    sys.exit(1)

email = sys.argv[1]
password = sys.argv[2]

# Login
resp = requests.post('https://gauzian.pupin.fr/api/login', json={
    'email': email,
    'password': password
})
print(f'Login status: {resp.status_code}')
print(f'Response: {resp.text[:200]}')
data = resp.json()
token = data.get('data', {}).get('token') or data.get('token')
if not token:
    print(f'Full response: {data}')
    sys.exit(1)
print(f'\n✓ Token obtenu: {token[:50]}...\n')

# Test 1: Token valide
r1 = requests.get('https://gauzian.pupin.fr/api/info',
                  headers={'Authorization': f'Bearer {token}'})
print(f'1. Token VALIDE: HTTP {r1.status_code}')

# Test 2: Token avec payload modifié (signature devient invalide)
parts = token.split('.')
payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
print(f'   Payload original: id={payload["id"]}')
payload['id'] = '00000000-0000-0000-0000-000000000000'
parts[1] = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
tampered = '.'.join(parts)

r2 = requests.get('https://gauzian.pupin.fr/api/info',
                  headers={'Authorization': f'Bearer {tampered}'})
print(f'\n2. Token MODIFIÉ (signature invalide): HTTP {r2.status_code}')
if r2.status_code == 200:
    print('   ❌ VULNERABLE: Serveur accepte la signature invalide!')
    print(f'   Response: {r2.text[:200]}')
elif r2.status_code == 401:
    print('   ✓ SÉCURISÉ: Serveur rejette la signature invalide')
else:
    print(f'   ? Status inattendu: {r2.status_code}')
