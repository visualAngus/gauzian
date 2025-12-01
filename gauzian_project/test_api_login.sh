#!/usr/bin/env bash
set -euo pipefail

# Config
URL="http://0.0.0.0:3000/auth/login"
EMAIL="gael@pupin.fr"
PASSWORD="P@ssw0rd!"
LANG_HEADER="fr"

# Ensure required tools
command -v python3 >/dev/null 2>&1 || { echo "python3 is required. Install it and retry." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required. Install it and retry." >&2; exit 1; }

# Perform login request
resp=$(cat <<JSON | curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Accept-Language: $LANG_HEADER" \
  -d @-
{
  "email": "${EMAIL}",
  "password": "${PASSWORD}"
}
JSON
)

# Pretty print if jq available
if command -v jq >/dev/null 2>&1; then
  echo "Server response:"
  echo "$resp" | jq .
else
  echo "Server response:"; echo "$resp"
fi

# Extract server-provided fields (if any)
storage_key_encrypted=$(echo "$resp" | (command -v jq >/dev/null 2>&1 && jq -r '.storage_key_encrypted // empty' || sed -n 's/.*"storage_key_encrypted"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'))
salt_e2e=$(echo "$resp" | (command -v jq >/dev/null 2>&1 && jq -r '.salt_e2e // empty' || sed -n 's/.*"salt_e2e"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'))
salt_auth=$(echo "$resp" | (command -v jq >/dev/null 2>&1 && jq -r '.salt_auth // empty' || sed -n 's/.*"salt_auth"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'))

if [ -z "$storage_key_encrypted" ] || [ -z "$salt_e2e" ] || [ -z "$salt_auth" ]; then
  echo "No 'storage_key_encrypted', 'salt_e2e' or 'salt_auth' found in login response."
  echo "The script is configured to only use login; aborting."
  exit 1
fi

echo "Found storage_key_encrypted (prefix): ${storage_key_encrypted:0:40}..."
echo "Found salt_e2e (prefix): ${salt_e2e:0:40}..."

# Export variables for the Python decryption helper
export storage_key_encrypted
export salt_e2e
export PASSWORD
export salt_auth

python3 - <<'PY'
import os, sys, base64

# Simple login-side decryption using PyNaCl only (two-step Argon2id derivation)
vault_b64 = os.environ.get('storage_key_encrypted', '')
salt_e2e_b64 = os.environ.get('salt_e2e', '')
salt_auth_b64 = os.environ.get('salt_auth', '')
password = os.environ.get('PASSWORD', '')

if not vault_b64 or not salt_e2e_b64 or not salt_auth_b64 or not password:
    print('Missing required fields from server response or environment.')
    sys.exit(1)

def b64d(s):
    s = s.strip()
    pad = (-len(s)) % 4
    if pad:
        s = s + ('=' * pad)
    return base64.b64decode(s)

try:
    vault = b64d(vault_b64)
    salt_e2e = b64d(salt_e2e_b64)
    salt_auth = b64d(salt_auth_b64)
except Exception as e:
    print('Base64 decode error:', e)
    sys.exit(1)

try:
    from nacl import pwhash
    from nacl.bindings import crypto_aead_xchacha20poly1305_ietf_decrypt, crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
except Exception:
    print('PyNaCl is required (pip install --user pynacl)')
    sys.exit(2)

print('Decoded salt_auth length:', len(salt_auth))
print('Decoded salt_e2e length:', len(salt_e2e))

# Derive password_key from password + salt_auth
try:
    password_key = pwhash.argon2id.kdf(32, password.encode('utf8'), salt_auth,
                                       opslimit=pwhash.argon2id.OPSLIMIT_MODERATE,
                                       memlimit=pwhash.argon2id.MEMLIMIT_MODERATE)
except Exception as e:
    print('password_key derivation failed:', e)
    sys.exit(1)

# Derive KEK from password_key + salt_e2e
try:
    kek = pwhash.argon2id.kdf(32, password_key, salt_e2e,
                              opslimit=pwhash.argon2id.OPSLIMIT_MODERATE,
                              memlimit=pwhash.argon2id.MEMLIMIT_MODERATE)
except Exception as e:
    print('kek derivation failed:', e)
    sys.exit(1)

NONCE_LEN = crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
nonce = vault[:NONCE_LEN]
ciphertext = vault[NONCE_LEN:]
try:
    plaintext = crypto_aead_xchacha20poly1305_ietf_decrypt(ciphertext, None, nonce, kek)
    try:
        print('\nDecrypted storage key (utf-8):')
        print(plaintext.decode('utf8'))
    except Exception:
        print('\nDecrypted storage key (base64):')
        print(base64.b64encode(plaintext).decode())
    sys.exit(0)
except Exception as e:
    print('Decryption failed:', e)
    sys.exit(1)
PY

echo "Decryption attempt finished."