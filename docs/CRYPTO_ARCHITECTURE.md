# Architecture Cryptographique - crypto.ts

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Algorithmes Utilisés](#algorithmes-utilisés)
3. [Architecture du Fichier](#architecture-du-fichier)
4. [Fonctions par Catégorie](#fonctions-par-catégorie)
5. [Workflows Cryptographiques](#workflows-cryptographiques)
6. [Stockage Sécurisé (IndexedDB)](#stockage-sécurisé-indexeddb)
7. [Cas d'Usage Détaillés](#cas-dusage-détaillés)
8. [Sécurité et Best Practices](#sécurité-et-best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Audit et Tests](#audit-et-tests)

---

## Vue d'Ensemble

Le fichier **`app/utils/crypto.ts`** (725 lignes) est le **cœur du système E2EE (End-to-End Encryption)** de GAUZIAN. Il implémente toutes les opérations cryptographiques nécessaires pour :

- ✅ **Génération de paires de clés RSA-4096**
- ✅ **Chiffrement/déchiffrement asymétrique** (RSA-OAEP)
- ✅ **Chiffrement/déchiffrement symétrique** (AES-256-GCM)
- ✅ **Dérivation de clés depuis mot de passe** (PBKDF2)
- ✅ **Stockage sécurisé de clés** (IndexedDB non-extractable)
- ✅ **Recovery keys** pour restauration de compte
- ✅ **Conversions** (base64, PEM, ArrayBuffer, Uint8Array)

### Principes de Sécurité

1. **Zero-Knowledge** : Le serveur ne voit jamais les données en clair
2. **Client-Side Only** : Toutes les opérations crypto se font dans le navigateur
3. **Web Crypto API** : Pas de librairie externe (sécurité + performance)
4. **Non-Extractable Keys** : Clés privées impossibles à exporter via JavaScript
5. **Authenticated Encryption** : AES-GCM (AEAD) garantit intégrité + confidentialité

---

## Algorithmes Utilisés

### Tableau Récapitulatif

| Opération | Algorithme | Paramètres | Usage |
|-----------|------------|------------|-------|
| **Asymétrique (partage clés)** | RSA-OAEP | 4096 bits, SHA-256 | Partage de fichiers/événements |
| **Symétrique (données)** | AES-GCM | 256 bits, IV 12 bytes | Chiffrement fichiers/métadonnées |
| **Dérivation clé (password)** | PBKDF2 | SHA-256, 310k iterations | Chiffrer clé privée avec mot de passe |
| **Stockage clés** | IndexedDB | CryptoKey `extractable: false` | Persistance clés dans navigateur |
| **Encoding** | Base64 | UTF-8 → Binary | Transport JSON/REST |
| **Format clés** | PEM | SPKI (public), PKCS#8 (private) | Interopérabilité |

### Justifications Techniques

#### RSA-4096 (vs RSA-2048)

**Choix** : RSA-OAEP avec 4096 bits

**Raisons** :
- **Sécurité à long terme** : Résistance ≥ 150 ans (vs 30 ans pour RSA-2048)
- **Post-Quantum** : Meilleure résistance aux attaques quantiques (Shor's algorithm)
- **Norme GAUZIAN** : Fichiers chiffrés peuvent rester sécurisés pendant des décennies

**Trade-off** :
- ❌ **Performance** : 4x plus lent que RSA-2048 (génération clés, encrypt/decrypt)
- ✅ **Sécurité** : Largement supérieure (recommandé pour données ultra-sensibles)

---

#### AES-GCM (vs AES-CBC)

**Choix** : AES-256-GCM (Galois/Counter Mode)

**Raisons** :
- **AEAD** (Authenticated Encryption with Associated Data) : Chiffrement + authentification intégrée
- **Intégrité garantie** : Détecte toute modification du ciphertext (MAC inclus)
- **Protection contre padding oracle** : Pas de padding (mode stream)
- **Performance** : Parallélisable (vs CBC séquentiel)

**Comparaison avec CBC** :

| Aspect | AES-GCM | AES-CBC |
|--------|---------|---------|
| **Authentification** | ✅ Intégrée (AEAD) | ❌ Nécessite HMAC séparé |
| **Padding oracle** | ✅ Immunisé | ❌ Vulnérable |
| **Parallélisation** | ✅ Oui | ❌ Non (séquentiel) |
| **Complexité** | ✅ Simple (1 opération) | ❌ Complexe (encrypt + HMAC) |

**⚠️ CRITIQUE** : GCM **exige** un IV unique par message. Réutiliser un IV **casse totalement la sécurité**.

---

#### PBKDF2 (310k iterations)

**Choix** : PBKDF2-SHA256 avec 310,000 iterations

**Raisons** :
- **OWASP 2024 Recommendation** : 310k iterations minimum pour PBKDF2-SHA256
- **Protection brute-force** : ~0.3s par tentative (rend attaque par dictionnaire impraticable)
- **Balance** : Assez lent pour attaquant, assez rapide pour UX (~300ms sur client moderne)

**Évolution** :

| Année | Standard | Iterations |
|-------|----------|------------|
| 2010 | OWASP | 10,000 |
| 2017 | OWASP | 100,000 |
| 2021 | OWASP | 210,000 |
| **2024** | **OWASP** | **310,000** |

**Alternative future** : Argon2id (meilleure résistance GPU/ASIC, mais pas encore Web Crypto API standard).

---

#### IndexedDB Non-Extractable

**Choix** : Stocker `CryptoKey` avec `extractable: false`

**Raisons** :
- **Protection XSS** : Impossible d'exporter la clé privée via `exportKey()` (bloqué par navigateur)
- **Isolation origine** : IndexedDB suit Same-Origin Policy (attaquant ne peut pas lire depuis autre domaine)
- **Persistance** : Clés survivent au refresh de page (vs `sessionStorage` volatil)

**Exemple** :

```typescript
// ✅ Clé NON-EXTRACTABLE (sécurisé)
const privateKey = await window.crypto.subtle.importKey(
  "pkcs8",
  binaryKey,
  { name: "RSA-OAEP", hash: "SHA-256" },
  false,  // ⚠️ extractable = false
  ["decrypt"]
);

// ❌ Tentative export échouera
await window.crypto.subtle.exportKey("pkcs8", privateKey); // DOMException: key is not extractable
```

---

## Architecture du Fichier

### Structure (725 lignes)

```
crypto.ts
│
├── Types & Config (1-16)
│   ├── KeyType, U8, KeyStoreConfig
│   └── DEFAULT_KEYSTORE
│
├── Utilitaires Bas-Niveau (18-107)
│   ├── assertClient()
│   ├── normalizeU8(), toArrayBuffer()
│   ├── buffToB64(), b64ToBuff()
│   ├── strToBuff()
│   ├── toPem(), pemToArrayBuffer()
│   └── Validation base64 stricte
│
├── Génération Clés RSA (109-133)
│   ├── generateRsaKeyPairPem()
│   └── Export PEM (SPKI + PKCS#8)
│
├── Recovery Key (135-213)
│   ├── generateRecordKey()
│   └── decryptRecordKey()
│
├── IndexedDB (215-256)
│   ├── openDB()
│   ├── idbGet(), idbPut()
│   └── Gestion transactions
│
├── Gestion Clés Utilisateur (258-328)
│   ├── saveUserKeysToIndexedDb()
│   ├── getUserPublicKeyFromIndexedDb()
│   ├── getUserPrivateKeyFromIndexedDb()
│   ├── getKeyStatus()
│   └── deleteKeyStore()
│
├── Chiffrement RSA (330-408)
│   ├── encryptWithStoredPublicKey()
│   ├── decryptWithStoredPrivateKey()
│   ├── importPublicKeyFromPem()
│   └── encryptWithPublicKey()
│
├── Chiffrement Clé Privée avec Password (410-503)
│   ├── encryptPrivateKeyPemWithPassword()
│   └── decryptPrivateKeyPemWithPassword()
│
├── Data Keys (515-527)
│   └── generateDataKey()
│
├── Chiffrement Métadonnées (529-587)
│   ├── encryptSimpleDataWithDataKey()
│   └── decryptSimpleDataWithDataKey()
│   (IV combiné avec ciphertext)
│
└── Chiffrement Fichiers (589-724)
    ├── encryptDataWithDataKey()
    ├── decryptDataWithDataKey()
    ├── encryptDataWithDataKeyRaw()
    └── decryptDataWithDataKeyRaw()
    (IV séparé, versions base64 + binaire)
```

---

## Fonctions par Catégorie

### 1. Conversions & Encodage

#### `buffToB64(buff: ArrayBuffer | ArrayBufferView): string`

Convertit ArrayBuffer/Uint8Array → Base64.

**Optimisation** : Utilise boucle `for` au lieu de spread operator (`...`) pour éviter stack overflow sur gros buffers.

**Exemple** :
```typescript
const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
const b64 = buffToB64(data); // "SGVsbG8="
```

---

#### `b64ToBuff(str: string): U8`

Convertit Base64 → Uint8Array.

**Validation stricte** :
- Trim whitespace (newlines, espaces)
- Regex `/^[A-Za-z0-9+/]*={0,2}$/` (caractères valides)
- Longueur multiple de 4
- Gestion erreurs avec contexte (affiche 50 premiers caractères)

**Exemple** :
```typescript
const b64 = "SGVsbG8=";
const buff = b64ToBuff(b64); // Uint8Array([72, 101, 108, 108, 111])
```

---

#### `toPem(buffer: ArrayBuffer, type: KeyType): string`

Convertit clé binaire (SPKI/PKCS#8) → format PEM.

**Format** :
```
-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA...
(64 caractères par ligne)
-----END PUBLIC KEY-----
```

---

#### `pemToArrayBuffer(pem: string): ArrayBuffer`

Inverse de `toPem`. Supprime headers PEM et retours à la ligne, puis decode base64.

---

### 2. Génération de Clés

#### `generateRsaKeyPairPem(): Promise<{ publicKey: string; privateKey: string }>`

Génère paire RSA-4096 (OAEP, SHA-256).

**Retour** :
- `publicKey` : Format PEM (SPKI)
- `privateKey` : Format PEM (PKCS#8)

**Usage** : Register (création compte).

**Performance** : ~2-5 secondes sur desktop moderne (4096 bits = calcul intensif).

**Exemple** :
```typescript
const { publicKey, privateKey } = await generateRsaKeyPairPem();
console.log(publicKey);
/*
-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA...
-----END PUBLIC KEY-----
*/
```

---

### 3. Recovery Key

#### `generateRecordKey(privateKey: string): Promise<{ encrypted_private_key_reco: string; recovery_key: string }>`

Génère **recovery key** pour restauration de compte (alternative au mot de passe).

**Workflow** :
1. Génère clé AES-256 aléatoire
2. Chiffre `privateKey` (PEM) avec AES-GCM
3. Exporte clé AES → `recovery_key` (base64)
4. Retourne `encrypted_private_key_reco` (IV + ciphertext) et `recovery_key`

**Usage** : Utilisateur sauvegarde `recovery_key` (imprimé ou password manager) pour récupérer compte si mot de passe oublié.

**⚠️ Sécurité** : `recovery_key` = clé symétrique brute → **aussi sensible que mot de passe**.

---

#### `decryptRecordKey(encrypted_private_key_reco: string, recovery_key: string): Promise<string>`

Déchiffre clé privée avec recovery key.

**Workflow** :
1. Decode `recovery_key` (base64 → clé AES)
2. Importe clé AES
3. Extrait IV (12 bytes) et ciphertext depuis `encrypted_private_key_reco`
4. Déchiffre → retourne `privateKey` (PEM)

---

### 4. IndexedDB (Stockage Sécurisé)

#### Configuration

```typescript
export const DEFAULT_KEYSTORE: KeyStoreConfig = {
  dbName: "GauzianSecureDB",
  dbVersion: 2,
  storeName: "keys",
};
```

**Structure** :
- **Database** : `GauzianSecureDB`
- **ObjectStore** : `keys` (keyPath: `id`)
- **Records** :
  - `{ id: "user_private_key", key: CryptoKey, expires: timestamp }`
  - `{ id: "user_public_key", key: CryptoKey }`

---

#### `saveUserKeysToIndexedDb(privateKeyPem: string, publicKeyPem: string): Promise<void>`

Importe clés PEM et stocke dans IndexedDB.

**Workflow** :
1. Convertit PEM → ArrayBuffer
2. Importe `privateKey` avec `extractable: false` ⚠️ (non-exportable)
3. Importe `publicKey` avec `extractable: true` (peut être partagée)
4. Stocke dans IndexedDB avec expiration 10 jours

**Sécurité** :
- **Private key** : `extractable: false` → impossible d'exporter via `exportKey()`
- **Expiration** : Force re-login après 10 jours (sécurité)

---

#### `getUserPrivateKeyFromIndexedDb(): Promise<CryptoKey>`

Récupère clé privée depuis IndexedDB.

**Erreur** : `throw Error("No private key found")` si absente.

---

#### `getKeyStatus(): Promise<KeyStatus>`

Vérifie état des clés stockées.

**Retour** :
- `"none"` : Aucune clé stockée (utilisateur doit se connecter)
- `"expired"` : Clé expirée (re-login requis)
- `"ready"` : Clés valides

**Usage** : Check au démarrage de l'app (`mounted` hook).

---

#### `deleteKeyStore(): Promise<void>`

Supprime complètement la database IndexedDB.

**Usage** : Logout ou réinitialisation compte.

**⚠️ IRRÉVERSIBLE** : Perte définitive des clés locales (fichiers chiffrés inaccessibles sans recovery key).

---

### 5. Chiffrement RSA

#### `encryptWithStoredPublicKey(data: string): Promise<string>`

Chiffre données avec clé publique de l'utilisateur courant (depuis IndexedDB).

**Usage** : Auto-chiffrement (ex: note pour soi-même).

**Limite** : RSA-OAEP max **190 bytes** (4096 bits - overhead OAEP).

**⚠️ Important** : Pour données > 190 bytes, utiliser **hybrid encryption** (RSA pour clé AES, AES pour données).

---

#### `encryptWithPublicKey(publicKeyPem: string, data: string): Promise<string>`

Chiffre données avec clé publique d'un **autre utilisateur** (partage).

**Workflow** :
1. Importe clé publique PEM
2. Encode `data` (UTF-8)
3. Chiffre avec RSA-OAEP
4. Retourne base64

**Usage** : Partage de `file_key` ou `folder_key` avec autre utilisateur.

**Exemple** :
```typescript
// Owner partage fichier avec user2
const fileKey = "aB3cD9eF..."; // Clé AES-256 (base64)
const user2PublicKey = await fetchPublicKey(user2Id); // Récupère depuis serveur

const encryptedFileKey = await encryptWithPublicKey(user2PublicKey, fileKey);
// Envoie au serveur → stocké dans file_access.encrypted_file_key
```

---

#### `decryptWithStoredPrivateKey(cipherB64: string): Promise<string>`

Déchiffre données avec clé privée de l'utilisateur courant.

**Usage** : Déchiffrement de `encrypted_file_key` récupéré depuis serveur.

---

### 6. Chiffrement Clé Privée avec Password

#### `encryptPrivateKeyPemWithPassword(privateKeyPem: string, password: string): Promise<{ encrypted_private_key: string; private_key_salt: string; iv: string }>`

Chiffre clé privée RSA avec mot de passe utilisateur (PBKDF2 + AES-GCM).

**Workflow** :
1. Génère `salt` aléatoire (16 bytes)
2. Génère `iv` aléatoire (12 bytes)
3. Dérive clé AES depuis `password` + `salt` (PBKDF2, 310k iterations)
4. Chiffre `privateKeyPem` avec AES-GCM
5. Retourne `{ encrypted_private_key, private_key_salt, iv }`

**Usage** : Register (création compte). Serveur stocke `encrypted_private_key`, `private_key_salt`, `iv` (ne peut pas déchiffrer car n'a pas le mot de passe).

**Sécurité** :
- **Salt unique** par utilisateur (empêche rainbow tables)
- **IV unique** par chiffrement (sécurité AES-GCM)
- **310k iterations** (résistance brute-force)

**Performance** : ~300ms sur desktop moderne (volontairement lent pour ralentir attaques).

---

#### `decryptPrivateKeyPemWithPassword(params: { encrypted_private_key, private_key_salt, iv, password }): Promise<string>`

Déchiffre clé privée avec mot de passe.

**Workflow** :
1. Decode `salt`, `iv`, `encrypted_private_key` (base64 → Uint8Array)
2. Dérive clé AES depuis `password` + `salt` (PBKDF2, 310k iterations)
3. Déchiffre avec AES-GCM
4. Retourne `privateKeyPem` (PEM string)

**Usage** : Login. Client récupère `encrypted_private_key`, `salt`, `iv` depuis serveur, déchiffre avec mot de passe saisi, puis stocke dans IndexedDB.

**Erreur** : `throw Error("Failed to decrypt private key with provided password")` si mot de passe incorrect.

---

### 7. Data Keys (Clés Symétriques)

#### `generateDataKey(): Promise<string>`

Génère clé AES-256 aléatoire.

**Retour** : Base64 (32 bytes bruts = 44 caractères base64).

**Usage** :
- **File key** : 1 data key par fichier (chiffre chunks)
- **Folder key** : 1 data key par dossier (chiffre métadonnées)
- **Event key** : 1 data key par événement agenda (chiffre title, description, etc.)

**Exemple** :
```typescript
const fileKey = await generateDataKey(); // "aB3cD9eFgH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ0..."
```

---

### 8. Chiffrement Métadonnées (Simple)

#### `encryptSimpleDataWithDataKey(data: string, dataKeyB64: string): Promise<string>`

Chiffre string avec data key (AES-GCM). **IV combiné** avec ciphertext.

**Workflow** :
1. Génère IV aléatoire (12 bytes)
2. Chiffre `data` avec AES-GCM
3. Combine `IV + ciphertext` → 1 seul Uint8Array
4. Retourne base64

**Retour** : Base64 de `[IV (12 bytes)][ciphertext]`.

**Usage** : Chiffrer métadonnées simples (ex: nom fichier, description dossier).

**Avantage** : 1 seul champ en DB (pas besoin de 2 colonnes `iv` + `ciphertext`).

**Exemple** :
```typescript
const dataKey = await generateDataKey();
const encryptedName = await encryptSimpleDataWithDataKey("Mon fichier secret.pdf", dataKey);
// Stocke encryptedName dans DB (encrypted_metadata)
```

---

#### `decryptSimpleDataWithDataKey(cipherTextB64: string, dataKeyB64: string): Promise<string>`

Déchiffre données chiffrées avec `encryptSimpleDataWithDataKey`.

**Workflow** :
1. Decode base64
2. Extrait IV (12 premiers bytes)
3. Extrait ciphertext (bytes restants)
4. Déchiffre avec AES-GCM
5. Retourne string UTF-8

---

### 9. Chiffrement Fichiers (avec IV séparé)

#### `encryptDataWithDataKey(data: string | ArrayBuffer | Blob, dataKeyB64: string): Promise<{ cipherText: string; iv: string }>`

Chiffre données (fichier ou chunk) avec data key. **IV séparé** du ciphertext.

**Workflow** :
1. Génère IV aléatoire (12 bytes)
2. Convertit `data` en ArrayBuffer (selon type : string/Blob/ArrayBuffer)
3. Chiffre avec AES-GCM
4. Retourne `{ cipherText: base64, iv: base64 }` (2 champs distincts)

**Usage** : Upload de chunks (serveur peut stocker `iv` en clair pour optimisations futures).

**Exemple** :
```typescript
const fileKey = await generateDataKey();
const chunk = new Blob([/* ... */]);

const { cipherText, iv } = await encryptDataWithDataKey(chunk, fileKey);

// Upload au serveur
await fetch(`/api/files/${fileId}/chunks`, {
  method: 'POST',
  body: JSON.stringify({ cipherText, iv, chunkIndex: 0 }),
});
```

---

#### `decryptDataWithDataKey(cipherTextB64: string, ivB64: string, dataKeyB64: string): Promise<Uint8Array>`

Déchiffre données chiffrées avec `encryptDataWithDataKey`.

**Retour** : Uint8Array (données binaires brutes).

---

#### `encryptDataWithDataKeyRaw(data, dataKeyB64): Promise<{ cipherBytes: Uint8Array; iv: string }>`

**Variante binaire** de `encryptDataWithDataKey` (pas de base64 pour ciphertext).

**Usage** : Upload de chunks via `multipart/form-data` ou `application/octet-stream` (évite overhead base64 ~33%).

**Retour** : `{ cipherBytes: Uint8Array, iv: base64 }`.

---

#### `decryptDataWithDataKeyRaw(cipherBytes, ivB64, dataKeyB64): Promise<Uint8Array>`

Déchiffre données chiffrées avec `encryptDataWithDataKeyRaw`.

**Input** : `cipherBytes` peut être `ArrayBuffer` ou `Uint8Array`.

---

## Workflows Cryptographiques

### Workflow 1 : Register (Création Compte)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
└─────────────────────────────────────────────────────────────┘

1. Utilisateur saisit username, email, password

2. Génération clés RSA
   ↓
   generateRsaKeyPairPem()
   → { publicKey (PEM), privateKey (PEM) }

3. Chiffrement clé privée avec password
   ↓
   encryptPrivateKeyPemWithPassword(privateKey, password)
   → { encrypted_private_key, private_key_salt, iv }

4. Génération recovery key
   ↓
   generateRecordKey(privateKey)
   → { encrypted_private_key_reco, recovery_key }

5. Hash password côté client
   ↓
   SHA256(password + auth_salt) → password_hash

6. Envoi au serveur
   ↓
   POST /auth/register
   {
     username,
     email,
     password_hash,
     auth_salt,
     public_key (PEM),
     encrypted_private_key,
     private_key_salt,
     iv,
     encrypted_record_key (similaire à encrypted_private_key_reco)
   }

┌─────────────────────────────────────────────────────────────┐
│                        SERVEUR                              │
└─────────────────────────────────────────────────────────────┘

7. Stocke dans DB (ne peut PAS déchiffrer encrypted_private_key)

8. Retourne succès → Client affiche recovery_key à l'utilisateur
   ⚠️ "Sauvegardez cette clé : [recovery_key]"
```

**Sécurité** :
- Serveur ne connaît jamais le mot de passe en clair
- Serveur ne peut jamais déchiffrer `encrypted_private_key`
- Recovery key = backup hors-ligne (impression papier recommandée)

---

### Workflow 2 : Login

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
└─────────────────────────────────────────────────────────────┘

1. Utilisateur saisit username/email + password

2. Envoi credentials au serveur
   ↓
   POST /auth/login
   { username, password_hash: SHA256(password + auth_salt) }

┌─────────────────────────────────────────────────────────────┐
│                        SERVEUR                              │
└─────────────────────────────────────────────────────────────┘

3. Vérifie password_hash

4. Retourne JWT cookie + clés chiffrées
   ↓
   {
     user: { username, email },
     encrypted_private_key,
     private_key_salt,
     iv,
     public_key
   }

┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
└─────────────────────────────────────────────────────────────┘

5. Déchiffre clé privée avec password
   ↓
   decryptPrivateKeyPemWithPassword({
     encrypted_private_key,
     private_key_salt,
     iv,
     password
   })
   → privateKey (PEM)

6. Stocke clés dans IndexedDB (non-extractable)
   ↓
   saveUserKeysToIndexedDb(privateKey, publicKey)

7. Redirect vers /drive
```

**Sécurité** :
- Password jamais envoyé en clair (seulement hash SHA256)
- Clé privée déchiffrée **uniquement côté client**
- Clés stockées en IndexedDB avec `extractable: false`

---

### Workflow 3 : Upload Fichier Chiffré

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                               │
└─────────────────────────────────────────────────────────────┘

1. Utilisateur sélectionne fichier (ex: photo.jpg, 15 MB)

2. Génère file_key (AES-256)
   ↓
   const fileKey = await generateDataKey()

3. Chiffre métadonnées (nom, extension)
   ↓
   const metadata = JSON.stringify({ name: "photo.jpg", ext: ".jpg" })
   const encryptedMetadata = await encryptSimpleDataWithDataKey(metadata, fileKey)

4. Divise fichier en chunks de 5 MB
   ↓
   chunks = [chunk0 (5MB), chunk1 (5MB), chunk2 (5MB)]

5. Chiffre chaque chunk
   ↓
   for (const chunk of chunks) {
     const { cipherBytes, iv } = await encryptDataWithDataKeyRaw(chunk, fileKey)
     // Upload chunk au serveur (multipart/form-data)
   }

6. Chiffre file_key avec clé publique de l'owner
   ↓
   const userPublicKey = await getUserPublicKeyFromIndexedDb()
   const encryptedFileKey = await encryptWithStoredPublicKey(fileKey)

7. Initialise upload sur serveur
   ↓
   POST /api/files/initialize
   {
     encrypted_metadata: encryptedMetadata,
     size: 15728640,
     mime_type: "image/jpeg",
     folder_id: "...",
     encrypted_file_key: encryptedFileKey
   }

8. Upload chunks
   ↓
   for (let i = 0; i < chunks.length; i++) {
     POST /api/files/{fileId}/chunks
     FormData: { chunk: cipherBytes[i], iv: iv[i], chunk_index: i }
   }

9. Finalise upload
   ↓
   POST /api/files/{fileId}/finalize

┌─────────────────────────────────────────────────────────────┐
│                        SERVEUR                              │
└─────────────────────────────────────────────────────────────┘

10. Stocke chunks chiffrés dans MinIO S3
11. Stocke encrypted_metadata, encrypted_file_key dans DB
12. Marque is_fully_uploaded = true
```

**Sécurité** :
- Serveur ne voit **jamais** le nom réel du fichier
- Serveur ne peut **jamais** déchiffrer les chunks (n'a pas `file_key`)
- `file_key` chiffré avec clé publique owner (stocké dans `file_access.encrypted_file_key`)

---

### Workflow 4 : Partage Fichier (E2EE)

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Owner)                          │
└─────────────────────────────────────────────────────────────┘

1. Owner veut partager fileId avec user2

2. Récupère clé publique de user2
   ↓
   GET /api/users/{user2Id}/public-key
   → user2PublicKey (PEM)

3. Déchiffre file_key (chiffré avec sa propre clé privée)
   ↓
   const encryptedFileKey = await fetchEncryptedFileKey(fileId) // Depuis DB
   const fileKey = await decryptWithStoredPrivateKey(encryptedFileKey)

4. Rechiffre file_key avec clé publique de user2
   ↓
   const encryptedFileKeyForUser2 = await encryptWithPublicKey(user2PublicKey, fileKey)

5. Envoie au serveur
   ↓
   POST /api/files/{fileId}/share
   {
     user_id: user2Id,
     encrypted_file_key: encryptedFileKeyForUser2,
     access_level: "viewer"
   }

┌─────────────────────────────────────────────────────────────┐
│                        SERVEUR                              │
└─────────────────────────────────────────────────────────────┘

6. Insère dans file_access
   INSERT INTO file_access (file_id, user_id, encrypted_file_key, access_level)
   VALUES (fileId, user2Id, encryptedFileKeyForUser2, 'viewer')

┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (User2)                          │
└─────────────────────────────────────────────────────────────┘

7. User2 liste ses fichiers
   ↓
   GET /api/files
   → Inclut fileId partagé

8. User2 télécharge fichier
   ↓
   a) Récupère encrypted_file_key depuis file_access
   b) Déchiffre file_key avec sa clé privée :
      const fileKey = await decryptWithStoredPrivateKey(encryptedFileKeyForUser2)
   c) Télécharge chunks depuis S3
   d) Déchiffre chaque chunk avec fileKey
   e) Reconstruit fichier original
```

**Magie E2EE** :
- Serveur ne connaît **jamais** `file_key` en clair
- Owner et User2 peuvent déchiffrer (chacun avec sa clé privée)
- Serveur agit comme **transporteur aveugle** (stocke encrypted_file_key sans pouvoir le déchiffrer)

---

## Stockage Sécurisé (IndexedDB)

### Structure de la Database

**Database** : `GauzianSecureDB` (version 2)

**ObjectStore** : `keys`

**Records** :

| id | key (CryptoKey) | expires (timestamp) |
|----|-----------------|---------------------|
| `user_private_key` | RSA-4096 private (non-extractable) | Date.now() + 10 jours |
| `user_public_key` | RSA-4096 public (extractable) | - |

### Propriétés de Sécurité

#### Non-Extractable

```typescript
const privateKey = await window.crypto.subtle.importKey(
  "pkcs8",
  binaryKey,
  { name: "RSA-OAEP", hash: "SHA-256" },
  false,  // ⚠️ extractable = false → NON-EXPORTABLE
  ["decrypt"]
);
```

**Conséquence** :
```typescript
// ✅ Utilisation autorisée
const decrypted = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, ciphertext);

// ❌ Export interdit par navigateur
await window.crypto.subtle.exportKey("pkcs8", privateKey);
// DOMException: key is not extractable
```

**Protection** :
- ✅ **XSS** : Impossible d'exfiltrer la clé via JavaScript malveillant
- ✅ **Browser Extensions** : Extensions ne peuvent pas lire la clé
- ✅ **DevTools** : Même en inspectant IndexedDB, la clé est opaque (`CryptoKey { type: "private" }`)

---

#### Same-Origin Policy

IndexedDB suit **Same-Origin Policy** :
- `https://gauzian.pupin.fr` → DB isolée
- `https://malicious.com` → Aucun accès à DB de gauzian.pupin.fr

**Protection** :
- ✅ **CSRF** : Attaquant externe ne peut pas lire IndexedDB
- ✅ **Subdomain Isolation** : Même `https://subdomain.gauzian.pupin.fr` ne peut pas accéder

---

#### Expiration (10 jours)

```typescript
await idbPut({
  id: "user_private_key",
  key: privateKey,
  expires: Date.now() + 10 * 24 * 60 * 60 * 1000, // 10 jours
});
```

**Vérification** :
```typescript
const status = await getKeyStatus();
if (status === "expired") {
  // Force re-login
  navigateTo('/login');
}
```

**Raison** : Limite fenêtre d'attaque si appareil compromis (ex: laptop volé).

---

### Gestion du Lifecycle

#### Création (Register/Login)

```typescript
// Après déchiffrement de encrypted_private_key
await saveUserKeysToIndexedDb(privateKeyPem, publicKeyPem);
```

#### Vérification (App Init)

```typescript
// Dans app.vue ou middleware
onMounted(async () => {
  const status = await getKeyStatus();
  if (status === "none" || status === "expired") {
    navigateTo('/login');
  }
});
```

#### Destruction (Logout)

```typescript
// Logout complet
await deleteKeyStore(); // Supprime database complètement
```

---

## Cas d'Usage Détaillés

### Cas 1 : Upload Fichier de 100 MB

**Challenge** : Fichier trop gros pour RAM navigateur.

**Solution** : Chunking + streaming.

**Code** :

```typescript
// 1. Générer file_key
const fileKey = await generateDataKey();

// 2. Diviser fichier en chunks de 5 MB
const CHUNK_SIZE = 5 * 1024 * 1024;
const file = document.getElementById('fileInput').files[0]; // 100 MB

for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
  const chunk = file.slice(offset, offset + CHUNK_SIZE);

  // 3. Chiffrer chunk (streaming, pas de charge RAM complète)
  const { cipherBytes, iv } = await encryptDataWithDataKeyRaw(chunk, fileKey);

  // 4. Upload chunk (multipart)
  const formData = new FormData();
  formData.append('chunk', new Blob([cipherBytes]));
  formData.append('iv', iv);
  formData.append('chunk_index', String(offset / CHUNK_SIZE));

  await fetch(`/api/files/${fileId}/chunks`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
}
```

**Avantages** :
- ✅ RAM constante (~5 MB max)
- ✅ Reprise upload en cas d'erreur (chunks indépendants)
- ✅ Progress bar (chunk_index / total_chunks * 100)

---

### Cas 2 : Partage Dossier (Hiérarchie)

**Challenge** : Partager dossier → doit partager tous les sous-dossiers/fichiers.

**Solution** : Parcours récursif + re-chiffrement `folder_key` pour chaque sous-dossier.

**Code** :

```typescript
async function shareFolderRecursive(folderId: string, targetUserId: string) {
  // 1. Récupère public key du destinataire
  const targetPublicKey = await fetchPublicKey(targetUserId);

  // 2. Déchiffre folder_key du dossier racine
  const encryptedFolderKey = await fetchEncryptedFolderKey(folderId);
  const folderKey = await decryptWithStoredPrivateKey(encryptedFolderKey);

  // 3. Rechiffre folder_key pour destinataire
  const encryptedFolderKeyForTarget = await encryptWithPublicKey(targetPublicKey, folderKey);

  // 4. Partage dossier racine
  await shareFolder(folderId, targetUserId, encryptedFolderKeyForTarget);

  // 5. Récupère sous-dossiers et fichiers
  const { folders, files } = await fetchFolderContents(folderId);

  // 6. Partage récursif sous-dossiers
  for (const subfolder of folders) {
    await shareFolderRecursive(subfolder.id, targetUserId);
  }

  // 7. Partage fichiers
  for (const file of files) {
    const fileKey = await decryptWithStoredPrivateKey(file.encrypted_file_key);
    const encryptedFileKeyForTarget = await encryptWithPublicKey(targetPublicKey, fileKey);
    await shareFile(file.id, targetUserId, encryptedFileKeyForTarget);
  }
}
```

**Performance** : O(n) où n = nombre total de fichiers/dossiers dans l'arbre.

---

### Cas 3 : Recovery Account avec Recovery Key

**Scénario** : Utilisateur a oublié son mot de passe mais a sauvegardé `recovery_key`.

**Workflow** :

```typescript
// Page /recover

1. Utilisateur saisit username + recovery_key

2. Serveur retourne encrypted_private_key_reco

3. Client déchiffre clé privée
   ↓
   const privateKeyPem = await decryptRecordKey(encrypted_private_key_reco, recovery_key);

4. Utilisateur saisit nouveau mot de passe

5. Re-chiffre clé privée avec nouveau mot de passe
   ↓
   const { encrypted_private_key, private_key_salt, iv } =
     await encryptPrivateKeyPemWithPassword(privateKeyPem, newPassword);

6. Envoi au serveur pour mise à jour
   ↓
   PUT /api/auth/reset-password
   { username, encrypted_private_key, private_key_salt, iv, recovery_key_proof }

7. Serveur met à jour DB

8. Redirect vers /login avec nouveau mot de passe
```

**Sécurité** :
- ✅ Serveur ne voit jamais le nouveau mot de passe
- ✅ Recovery key = unique point de défaillance (à protéger absolument)
- ⚠️ Si recovery key perdue + password oublié = **PERTE DÉFINITIVE** (E2EE by design)

---

## Sécurité et Best Practices

### ✅ DO (Bonnes Pratiques)

#### 1. Toujours Générer IV Unique

```typescript
// ✅ CORRECT : IV unique par chiffrement
const iv = new Uint8Array(12);
window.crypto.getRandomValues(iv);

const encrypted = await window.crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  aesKey,
  data
);
```

**Raison** : Réutiliser IV **casse complètement** AES-GCM (permet de déduire XOR des plaintexts).

---

#### 2. Utiliser Web Crypto API (Pas de Librairie Externe)

```typescript
// ✅ CORRECT : Web Crypto API native
await window.crypto.subtle.encrypt(...)

// ❌ ÉVITER : Librairie externe (CryptoJS, forge, etc.)
// Raisons : Performance inférieure, risque de vulnérabilités, taille bundle
```

---

#### 3. Valider Base64 Avant Décodage

```typescript
// ✅ CORRECT : Validation stricte dans b64ToBuff()
const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
if (!base64Regex.test(trimmedStr)) {
  throw new Error(`Invalid base64 string`);
}
```

**Raison** : Évite erreurs obscures et potentiels exploits.

---

#### 4. Limiter Taille Données RSA

```typescript
// ✅ CORRECT : RSA pour clés AES seulement (32 bytes)
const fileKey = await generateDataKey(); // 32 bytes
const encryptedFileKey = await encryptWithPublicKey(publicKey, fileKey);

// ❌ INCORRECT : RSA pour fichier entier (crash si > 190 bytes)
const encryptedFile = await encryptWithPublicKey(publicKey, largeFile); // ERREUR !
```

**Limite** : RSA-4096 OAEP SHA-256 = max **190 bytes** de plaintext.

---

### ❌ DON'T (Pièges à Éviter)

#### 1. NE JAMAIS Réutiliser IV

```typescript
// ❌ DANGER : IV fixe
const iv = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // TOUJOURS LE MÊME

for (const chunk of chunks) {
  await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, chunk);
  // ⚠️ CATASTROPHE : Permet d'extraire plaintext par XOR
}
```

**Fix** : Générer IV aléatoire **par chiffrement**.

---

#### 2. NE JAMAIS Logger Clés ou Données Sensibles

```typescript
// ❌ DANGER : Log clé privée
console.log('Private key:', privateKeyPem);

// ❌ DANGER : Log file_key déchiffré
console.log('Decrypted file key:', fileKey);
```

**Raison** : Console logs peuvent être :
- Interceptés par browser extensions
- Sauvegardés dans logs navigateur
- Exfiltrés par XSS

---

#### 3. NE JAMAIS Stocker Clés en LocalStorage

```typescript
// ❌ DANGER : localStorage = extractable en clair
localStorage.setItem('privateKey', privateKeyPem);

// ✅ CORRECT : IndexedDB avec CryptoKey non-extractable
await saveUserKeysToIndexedDb(privateKeyPem, publicKeyPem);
```

**Raison** : localStorage :
- Accessible via JavaScript (XSS)
- Lisible en DevTools
- Pas de protection Same-Origin stricte

---

#### 4. NE JAMAIS Exporter Clé Privée

```typescript
// ❌ DANGER : Rend clé extractable
const exportedKey = await window.crypto.subtle.exportKey("pkcs8", privateKey);
// DOMException si importé avec extractable: false (BIEN)
```

**Raison** : Si export réussit → clé devient vulnérable.

---

### Checklist Audit Crypto

Avant déploiement production :

- [ ] **RSA-4096** (pas RSA-2048)
- [ ] **AES-256-GCM** (pas AES-CBC ou AES-ECB)
- [ ] **PBKDF2 ≥ 310k iterations** (ligne 437, 485 de crypto.ts)
- [ ] **IV unique** par chiffrement AES (généré avec `crypto.getRandomValues`)
- [ ] **Clés IndexedDB** avec `extractable: false` (ligne 271 de crypto.ts)
- [ ] **Pas de console.log** avec clés/passwords
- [ ] **Validation base64** stricte (b64ToBuff avec regex)
- [ ] **HTTPS obligatoire** en production (cookies Secure, no MITM)
- [ ] **Recovery key** bien expliqué à l'utilisateur (sauvegarde hors-ligne)
- [ ] **Test XSS** : Vérifier qu'attaquant XSS ne peut pas exfiltrer clés
- [ ] **Test CSRF** : Vérifier `credentials: 'include'` + SameSite cookies
- [ ] **Expiration clés** : 10 jours (force re-login, limite fenêtre attaque)

---

## Troubleshooting

### Erreur : "No private key found"

**Symptôme** : `getUserPrivateKeyFromIndexedDb()` throw erreur.

**Causes** :
1. Utilisateur non connecté (jamais de `saveUserKeysToIndexedDb()`)
2. IndexedDB vidée (clear cache navigateur, navigation privée)
3. Clé expirée (> 10 jours)

**Solutions** :
```typescript
const status = await getKeyStatus();
if (status !== "ready") {
  navigateTo('/login'); // Force re-login
}
```

---

### Erreur : "Failed to decrypt private key with provided password"

**Symptôme** : `decryptPrivateKeyPemWithPassword()` throw erreur.

**Causes** :
1. Mot de passe incorrect
2. `encrypted_private_key` corrompu
3. `salt` ou `iv` incorrect

**Debug** :
```typescript
try {
  const privateKey = await decryptPrivateKeyPemWithPassword({ ... });
} catch (error) {
  console.error('Decryption failed:', error);
  // Afficher message utilisateur : "Mot de passe incorrect"
}
```

---

### Erreur : "Invalid base64 string"

**Symptôme** : `b64ToBuff()` throw erreur avec détails.

**Causes** :
1. String contient caractères invalides (espaces, newlines mal formatés)
2. Longueur non multiple de 4
3. Données corrompues

**Fix** :
```typescript
// Serveur doit retourner base64 valide (pas de \n, espaces, etc.)
const cleanB64 = dirtyB64.replace(/\s/g, ''); // Trim whitespace
const decoded = b64ToBuff(cleanB64);
```

---

### Performance : PBKDF2 trop lent

**Symptôme** : Login/register prend > 1 seconde.

**Raison** : PBKDF2 310k iterations = **volontairement lent** (sécurité).

**Optimisations** :
1. ✅ Afficher spinner pendant dérivation clé
2. ✅ Utiliser Web Workers pour ne pas bloquer UI (futur)
3. ❌ NE PAS réduire iterations (affaiblit sécurité)

**Code avec feedback** :
```typescript
const loginButton = document.getElementById('login-btn');
loginButton.textContent = 'Déchiffrement en cours...';
loginButton.disabled = true;

const privateKey = await decryptPrivateKeyPemWithPassword({ ... });

loginButton.textContent = 'Connexion';
loginButton.disabled = false;
```

---

## Audit et Tests

### Tests Unitaires Recommandés

#### Test 1 : Round-Trip Encryption

```typescript
test('RSA encrypt/decrypt round-trip', async () => {
  const { publicKey, privateKey } = await generateRsaKeyPairPem();

  const plaintext = "Hello GAUZIAN!";
  const encrypted = await encryptWithPublicKey(publicKey, plaintext);

  // Stocke clés dans IndexedDB temporaire
  await saveUserKeysToIndexedDb(privateKey, publicKey);

  const decrypted = await decryptWithStoredPrivateKey(encrypted);

  expect(decrypted).toBe(plaintext);
});
```

---

#### Test 2 : IV Unicité

```typescript
test('AES-GCM generates unique IV per encryption', async () => {
  const dataKey = await generateDataKey();
  const plaintext = "Test data";

  const { cipherText: cipher1, iv: iv1 } = await encryptDataWithDataKey(plaintext, dataKey);
  const { cipherText: cipher2, iv: iv2 } = await encryptDataWithDataKey(plaintext, dataKey);

  // Même plaintext, mais ciphertext différent (grâce à IV unique)
  expect(cipher1).not.toBe(cipher2);
  expect(iv1).not.toBe(iv2);
});
```

---

#### Test 3 : Password Derivation Consistency

```typescript
test('PBKDF2 derives same key from same password + salt', async () => {
  const password = "MySecurePassword123!";
  const privateKey = "-----BEGIN PRIVATE KEY-----...";

  const { encrypted_private_key, private_key_salt, iv } =
    await encryptPrivateKeyPemWithPassword(privateKey, password);

  const decrypted1 = await decryptPrivateKeyPemWithPassword({
    encrypted_private_key, private_key_salt, iv, password
  });

  const decrypted2 = await decryptPrivateKeyPemWithPassword({
    encrypted_private_key, private_key_salt, iv, password
  });

  expect(decrypted1).toBe(privateKey);
  expect(decrypted2).toBe(privateKey);
  expect(decrypted1).toBe(decrypted2);
});
```

---

#### Test 4 : IndexedDB Non-Extractable

```typescript
test('Private key is non-extractable in IndexedDB', async () => {
  const { publicKey, privateKey } = await generateRsaKeyPairPem();
  await saveUserKeysToIndexedDb(privateKey, publicKey);

  const storedPrivateKey = await getUserPrivateKeyFromIndexedDb();

  // Tentative export doit échouer
  await expect(
    window.crypto.subtle.exportKey("pkcs8", storedPrivateKey)
  ).rejects.toThrow(/not extractable/);
});
```

---

### Audit de Sécurité

#### Checklist OWASP

| Item | Status | Notes |
|------|--------|-------|
| **Cryptographic Storage** | ✅ | IndexedDB non-extractable |
| **Strong Cryptography** | ✅ | RSA-4096, AES-256-GCM, PBKDF2 310k |
| **Key Management** | ✅ | Clés jamais en clair côté serveur |
| **Input Validation** | ✅ | Base64 validation stricte |
| **Error Handling** | ⚠️ | Améliorer messages (pas de détails crypto) |
| **Logging** | ⚠️ | Vérifier aucun log de clés (info.vue, crypto.ts) |
| **HTTPS Enforcement** | ✅ | Production only |
| **Session Management** | ✅ | JWT + expiration 10j |

#### Vulnérabilités Potentielles

1. **Timing Attacks sur PBKDF2** :
   - **Risque** : Faible (Web Crypto API implémentation native)
   - **Mitigation** : Utiliser `crypto.subtle` (constant-time par défaut)

2. **XSS → Vol Clés IndexedDB** :
   - **Risque** : Faible (non-extractable)
   - **Mitigation** : CSP headers, sanitize inputs

3. **MITM sur Login** :
   - **Risque** : Critique si HTTP
   - **Mitigation** : HTTPS obligatoire, HSTS, certificate pinning (futur)

4. **Recovery Key Compromise** :
   - **Risque** : Élevé (recovery_key = full access)
   - **Mitigation** : Éduquer utilisateurs (stocker hors-ligne, paper backup)

---

## Conclusion

Le fichier **`crypto.ts`** implémente un **système E2EE de niveau production** avec :

✅ **Algorithmes modernes** (RSA-4096, AES-256-GCM, PBKDF2 310k)
✅ **Sécurité maximale** (Zero-Knowledge, non-extractable keys)
✅ **Performance optimisée** (chunking, streaming, Web Crypto API)
✅ **Flexibilité** (4 variantes de chiffrement selon contexte)

**Points d'amélioration futurs** :
1. Migration PBKDF2 → **Argon2id** (quand Web Crypto API supporté)
2. **Web Workers** pour PBKDF2 (éviter freeze UI)
3. **Biometric unlock** (WebAuthn pour déchiffrer clé privée)
4. **Hardware Security Module** (HSM) pour entreprises

---

**Auteur** : GAUZIAN Development Team
**Dernière mise à jour** : 2026-02-11
**Version crypto.ts** : 725 lignes
**Audité** : Non (audit externe recommandé avant production critique)
