#!/usr/bin/env bash
set -euo pipefail

# Config
URL="http://0.0.0.0:3000/auth/register"
EMAIL="gael@pupin.fr"
PASSWORD="P@ssw0rd!"
DATE_OF_BIRTH="1990-01-01"
TIME_ZONE="Europe/Paris"
LANG_HEADER="fr"

# Generate realistic random values (base64)
# - salt_e2e: 32 bytes
# - storage_key_encrypted, private_key_encrypted_recuperation: ~160 bytes (nonce+ciphertext simulation)
SALT_E2E=$(openssl rand -base64 16 | tr -d '=')
SALT_AUTH=$(openssl rand -base64 16 | tr -d '=')
STORAGE_KEY=$(openssl rand -base64 160 | tr -d '\n')

echo $STORAGE_KEY

# encrypted password with Argon2 + salt_auth
encrypted_password=$(python3 - <<PY
import os, base64
from nacl import pwhash

def b64d(s):
  s = s.strip()
  pad = (-len(s)) % 4
  if pad:
    s = s + ('=' * pad)
  return base64.b64decode(s)

salt_auth = b64d('$SALT_AUTH')
password = b'$PASSWORD'
hashed = pwhash.argon2id.kdf(32, password, salt_auth, opslimit=pwhash.argon2id.OPSLIMIT_MODERATE, memlimit=pwhash.argon2id.MEMLIMIT_MODERATE)
print(base64.b64encode(hashed).decode())
PY
)



# encrypted storage key with Argon2 + salt_e2e + encrypted_password

STORAGE_KEY_ENC=$(python3 - <<PY
import os, base64
from nacl import pwhash, secret, utils
from nacl.bindings import crypto_aead_xchacha20poly1305_ietf_encrypt

def b64d(s):
  s = s.strip()
  pad = (-len(s)) % 4
  if pad:
    s = s + ('=' * pad)
  return base64.b64decode(s)

salt_e2e = b64d('$SALT_E2E')
encrypted_password = b64d('$encrypted_password')
storage_key = b64d('$STORAGE_KEY')
derived_key = pwhash.argon2id.kdf(32, encrypted_password, salt_e2e, opslimit=pwhash.argon2id.OPSLIMIT_MODERATE, memlimit=pwhash.argon2id.MEMLIMIT_MODERATE)
nonce = utils.random(secret.SecretBox.NONCE_SIZE)
ciphertext = crypto_aead_xchacha20poly1305_ietf_encrypt(storage_key, None, nonce, derived_key)
encrypted_storage_key = nonce + ciphertext
print(base64.b64encode(encrypted_storage_key).decode())
PY
)

STORAGE_KEY_ENC_REC=$(openssl rand -base64 160)

# Build JSON payload and POST
cat <<JSON | curl -i -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Accept-Language: $LANG_HEADER" \
  -d @-
{
    "email": "${EMAIL}",
    "password": "${PASSWORD}",
    "salt_e2e": "${SALT_E2E}",  
    "salt_auth": "${SALT_AUTH}",
    "storage_key_encrypted": "${STORAGE_KEY_ENC}",
    "private_key_encrypted_recuperation": "${STORAGE_KEY_ENC_REC}",
    "last_name": "Dupont",
    "first_name": "Jean",
    "date_of_birth": "${DATE_OF_BIRTH}",
    "time_zone": "${TIME_ZONE}"
}
JSON