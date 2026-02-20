# CLAUDE.md - Frontend (Nuxt 4 / Vue 3)

Ce fichier fournit des directives à Claude Code pour travailler avec le frontend Nuxt.js de GAUZIAN.

## 📚 Quick Links

**Documentation Frontend :**
- ⭐ [`README.md`](./README.md) - Architecture complète du frontend (~1100 lignes)
- ⭐ [`docs/CRYPTO_ARCHITECTURE.md`](./docs/CRYPTO_ARCHITECTURE.md) - Documentation technique E2EE (~1000 lignes)

**Documentation Projet :**
- [`../CLAUDE.md`](../CLAUDE.md) - Vue d'ensemble du projet (root)
- [`../gauzian_back/CLAUDE.md`](../gauzian_back/CLAUDE.md) - Documentation backend
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) - Guide de déploiement (VPS K8s + Clever Cloud)

**Note importante :** ⚠️ **Pas de développement local** - Le frontend est déployé uniquement sur **VPS K8s** ou **Clever Cloud**.

---

## ⚡ Build & Run Commands

### Installation
```bash
cd gauzian_front
npm install                    # Installer les dépendances
```

### Développement (si vraiment nécessaire)
```bash
npm run dev                    # Serveur dev (localhost:3000)
# Note: Pas utilisé en pratique, développement direct sur VPS K8s
```

### Production
```bash
npm run build                  # Build production (.output/)
npm run preview                # Preview du build production
```

### Docker
```bash
# Build image frontend
docker build -t angusvisual/gauzian-front:latest .

# Build + push vers Docker Hub
docker build -t angusvisual/gauzian-front:latest . && \
docker push angusvisual/gauzian-front:latest
```

---

## 🏗️ Architecture

### Structure des Répertoires

```
gauzian_front/
├── app/
│   ├── pages/
│   │   ├── index.vue              # Page d'accueil (redirection)
│   │   ├── login.vue              # Authentification (login + register)
│   │   ├── drive.vue              # Gestionnaire de fichiers principal
│   │   ├── agenda.vue             # Calendrier et événements
│   │   └── info.vue               # Infos utilisateur + tests crypto
│   ├── composables/
│   │   ├── useAuth.js             # État d'authentification global
│   │   ├── useDriveData.js        # État du drive (files, folders, breadcrumb)
│   │   ├── useFileActions.js      # Actions fichiers (upload, delete, rename)
│   │   ├── useEvents.js           # Gestion des événements d'agenda
│   │   └── useNotification.js     # Système de notifications toast
│   ├── components/
│   │   ├── FileItem.vue           # Item fichier/dossier dans le drive
│   │   ├── BreadcrumbNav.vue      # Navigation breadcrumb
│   │   ├── UploadModal.vue        # Modal d'upload avec chunked upload
│   │   ├── ShareModal.vue         # Modal de partage E2EE
│   │   ├── EventCard.vue          # Carte d'événement agenda
│   │   └── ...                    # Autres composants UI
│   └── utils/
│       └── crypto.ts              # ⭐ CORE - Toutes les fonctions E2EE (725 lignes)
├── public/                        # Assets statiques
├── Dockerfile                     # Image production (Node.js standalone)
├── nuxt.config.ts                 # Configuration Nuxt 4
└── package.json                   # Dépendances npm
```

### Pages Principales

| Page | Route | Rôle |
|------|-------|------|
| `index.vue` | `/` | Redirection vers `/drive` ou `/login` selon auth |
| `login.vue` | `/login` | Formulaire login + register avec crypto client-side |
| `drive.vue` | `/drive` | Gestionnaire de fichiers (upload, download, folders, E2EE sharing) |
| `agenda.vue` | `/agenda` | Calendrier avec événements chiffrés E2EE |
| `info.vue` | `/info` | Infos utilisateur + tests crypto (dev/debug) |

### Composables

| Composable | Rôle |
|------------|------|
| `useAuth` | Gestion de l'état d'authentification (user, isAuthenticated, login, register, logout) |
| `useDriveData` | État du drive (files, folders, currentFolderId, breadcrumb, refresh) |
| `useFileActions` | Actions fichiers (uploadFile, deleteFile, renameFile, downloadFile, shareFile) |
| `useEvents` | Gestion des événements d'agenda (fetchEvents, createEvent, updateEvent, deleteEvent) |
| `useNotification` | Notifications toast (success, error, info, warning) |

---

## 🔑 Key Patterns

### 1. useAuth Pattern (Composition API)

**Utilisation dans les pages :**
```typescript
// Dans login.vue
import { useAuth } from '~/composables/useAuth';

const { user, isAuthenticated, login, register, logout } = useAuth();

async function handleLogin() {
  try {
    await login(email.value, password.value);
    navigateTo('/drive');
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

**Implémentation (useAuth.js) :**
```javascript
export const useAuth = () => {
  const user = useState('auth-user', () => null);
  const isAuthenticated = computed(() => !!user.value);

  const login = async (email, password) => {
    // 1. Générer clé de chiffrement depuis le mot de passe
    const passwordKey = await derivePasswordKey(password, email);

    // 2. Envoyer requête au backend
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include', // ⚠️ CRITIQUE pour les cookies JWT
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password_hash: await hashPassword(password, email) })
    });

    if (!response.ok) throw new Error('Login failed');
    const data = await response.json();

    // 3. Déchiffrer la clé privée RSA avec la clé de mot de passe
    const privateKey = await unwrapPrivateKey(
      data.encrypted_private_key,
      passwordKey
    );

    // 4. Stocker les clés dans IndexedDB
    await saveKeysToIndexedDB({
      publicKey: data.public_key,
      privateKey,
      recordKey: await unwrapRecordKey(data.encrypted_record_key, passwordKey)
    });

    user.value = { email, userId: data.user_id };
  };

  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    user.value = null;
    await clearIndexedDB(); // Supprimer toutes les clés crypto
  };

  return { user, isAuthenticated, login, register, logout };
};
```

**⚠️ Points critiques :**
- Toujours utiliser `credentials: 'include'` pour les cookies JWT
- Nettoyer IndexedDB au logout (sécurité)
- Dérivation de clé PBKDF2 avec 310k iterations (OAEP 2024)

---

### 2. crypto.ts Core Functions

**Fichier : `app/utils/crypto.ts` (725 lignes)**

**Génération de paire de clés RSA-4096 :**
```typescript
import { generateKeyPair } from '~/utils/crypto';

// Au register
const { publicKey, privateKey } = await generateKeyPair();
// publicKey: CryptoKey (extractable)
// privateKey: CryptoKey (non-extractable, stocké dans IndexedDB)
```

**Chiffrement / Déchiffrement AES-256-GCM :**
```typescript
import { encrypt, decrypt } from '~/utils/crypto';

// Chiffrer des métadonnées (nom de fichier, dossier)
const encryptedName = await encrypt(fileName, recordKey);
// Format: "iv:ciphertext" (Base64)

// Déchiffrer
const decryptedName = await decrypt(encryptedName, recordKey);
```

**Wrapping / Unwrapping de clés :**
```typescript
import { wrapPrivateKey, unwrapPrivateKey } from '~/utils/crypto';

// Au register - Chiffrer la clé privée avec le mot de passe
const passwordKey = await derivePasswordKey(password, email);
const encryptedPrivateKey = await wrapPrivateKey(privateKey, passwordKey);

// Au login - Déchiffrer la clé privée
const privateKey = await unwrapPrivateKey(encryptedPrivateKey, passwordKey);
```

**Partage E2EE avec RSA :**
```typescript
import { wrapKeyWithRSA, unwrapKeyWithRSA } from '~/utils/crypto';

// Partager un fichier - Chiffrer la clé du fichier avec la clé publique du destinataire
const wrappedFileKey = await wrapKeyWithRSA(fileKey, recipientPublicKey);

// Recevoir un fichier partagé - Déchiffrer avec sa clé privée
const fileKey = await unwrapKeyWithRSA(wrappedFileKey, myPrivateKey);
```

**Dérivation de clé depuis mot de passe (PBKDF2) :**
```typescript
import { derivePasswordKey } from '~/utils/crypto';

// 310,000 iterations (OWASP 2024 recommendation)
const passwordKey = await derivePasswordKey(password, email);
// Utilisé pour chiffrer encrypted_private_key et encrypted_record_key
```

**⭐ Insight ─────────────────────────────────────**
`crypto.ts` utilise **AES-256-GCM** (mode AEAD - Authenticated Encryption with Associated Data) au lieu de AES-CBC. Avantages :
1. **Authentification intégrée** : Pas besoin de HMAC séparé pour vérifier l'intégrité
2. **Protection contre les attaques par modification** : Le tag d'authentification (128 bits) garantit que les données n'ont pas été modifiées
3. **Performance** : Un seul passage pour chiffrer + authentifier (vs CBC + HMAC = 2 passages)

**Séparation des IV (Initialization Vector) :**
- **Métadonnées simples** (nom de fichier, dossier) : IV combiné dans le résultat `"iv:ciphertext"` (Base64)
- **Fichiers volumineux** : IV stocké séparément dans `encrypted_iv` (optimisation pour éviter de dupliquer l'IV pour chaque chunk de 5MB)
`─────────────────────────────────────────────────`

---

### 3. E2EE Workflows

#### Workflow 1 : Register (Création de compte)

```typescript
// Dans login.vue - handleRegister()

// 1. Générer paire de clés RSA-4096
const { publicKey, privateKey } = await generateKeyPair();

// 2. Générer une record_key (AES-256) pour chiffrer les métadonnées
const recordKey = await generateAESKey();

// 3. Dériver une clé depuis le mot de passe (PBKDF2 310k iterations)
const passwordKey = await derivePasswordKey(password, email);

// 4. Chiffrer la clé privée RSA avec la clé de mot de passe
const encryptedPrivateKey = await wrapPrivateKey(privateKey, passwordKey);

// 5. Chiffrer la record_key avec la clé de mot de passe
const encryptedRecordKey = await wrapKey(recordKey, passwordKey);

// 6. Exporter la clé publique RSA en format PEM
const publicKeyPem = await exportPublicKey(publicKey);

// 7. Hasher le mot de passe (SHA-256 + salt serveur) pour l'authentification
const passwordHash = await hashPassword(password, email);

// 8. Envoyer au backend
await fetch(`${API_URL}/auth/register`, {
  method: 'POST',
  credentials: 'include',
  body: JSON.stringify({
    email,
    password_hash: passwordHash,
    public_key: publicKeyPem,
    encrypted_private_key: encryptedPrivateKey,
    encrypted_record_key: encryptedRecordKey
  })
});

// 9. Stocker les clés dans IndexedDB (non-extractable)
await saveKeysToIndexedDB({ publicKey, privateKey, recordKey });
```

#### Workflow 2 : Upload Fichier (Chunked Upload avec E2EE)

```typescript
// Dans useFileActions.js - uploadFile()

// 1. Générer une clé AES-256 unique pour ce fichier
const fileKey = await generateAESKey();

// 2. Générer un IV (Initialization Vector) pour ce fichier
const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits pour GCM

// 3. Lire le fichier par chunks de 5MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

for (let i = 0; i < totalChunks; i++) {
  const start = i * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, file.size);
  const chunk = file.slice(start, end);

  // 4. Chiffrer le chunk avec AES-256-GCM
  const encryptedChunk = await encryptFileChunk(chunk, fileKey, iv, i);

  // 5. Upload du chunk chiffré vers le backend
  const formData = new FormData();
  formData.append('chunk', new Blob([encryptedChunk]));
  formData.append('chunk_index', i.toString());
  formData.append('total_chunks', totalChunks.toString());
  formData.append('upload_id', uploadId);

  await fetch(`${API_URL}/files/upload-chunk`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
}

// 6. Chiffrer les métadonnées (nom du fichier)
const recordKey = await getRecordKeyFromIndexedDB();
const encryptedFileName = await encrypt(file.name, recordKey);

// 7. Chiffrer la clé du fichier avec la record_key
const encryptedFileKey = await wrapKey(fileKey, recordKey);

// 8. Chiffrer l'IV avec la record_key
const encryptedIv = await encrypt(arrayBufferToBase64(iv), recordKey);

// 9. Finaliser l'upload
await fetch(`${API_URL}/files/finalize-upload`, {
  method: 'POST',
  credentials: 'include',
  body: JSON.stringify({
    upload_id: uploadId,
    encrypted_name: encryptedFileName,
    encrypted_file_key: encryptedFileKey,
    encrypted_iv: encryptedIv,
    file_size: file.size,
    mime_type: file.type,
    parent_folder_id: currentFolderId
  })
});
```

#### Workflow 3 : Partage E2EE

```typescript
// Dans ShareModal.vue - handleShare()

// 1. Récupérer la clé publique RSA du destinataire
const response = await fetch(`${API_URL}/users/${recipientEmail}/public-key`, {
  credentials: 'include'
});
const { public_key: recipientPublicKeyPem } = await response.json();

// 2. Importer la clé publique PEM
const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);

// 3. Récupérer la clé du fichier (déchiffrée depuis encrypted_file_key)
const recordKey = await getRecordKeyFromIndexedDB();
const fileKey = await unwrapKey(file.encrypted_file_key, recordKey);

// 4. Chiffrer la clé du fichier avec la clé publique RSA du destinataire
const wrappedFileKey = await wrapKeyWithRSA(fileKey, recipientPublicKey);

// 5. Envoyer au backend pour créer l'accès
await fetch(`${API_URL}/files/${file.id}/share`, {
  method: 'POST',
  credentials: 'include',
  body: JSON.stringify({
    recipient_email: recipientEmail,
    wrapped_file_key: wrappedFileKey, // Clé chiffrée avec RSA du destinataire
    permission: 'read' // ou 'write'
  })
});

// Le destinataire pourra déchiffrer la clé avec sa clé privée RSA
```

---

### 4. IndexedDB Storage Pattern

**Stockage sécurisé des clés crypto :**

```typescript
// Sauvegarde dans IndexedDB (non-extractable)
async function saveKeysToIndexedDB(keys) {
  const db = await openDB('gauzian-crypto', 1, {
    upgrade(db) {
      db.createObjectStore('keys');
    }
  });

  // ⚠️ CRITIQUE : Les CryptoKey sont non-extractable
  await db.put('keys', keys.privateKey, 'privateKey');
  await db.put('keys', keys.recordKey, 'recordKey');
  await db.put('keys', keys.publicKey, 'publicKey');
}

// Récupération depuis IndexedDB
async function getPrivateKeyFromIndexedDB() {
  const db = await openDB('gauzian-crypto', 1);
  return await db.get('keys', 'privateKey'); // Retourne un CryptoKey non-extractable
}

// Nettoyage au logout
async function clearIndexedDB() {
  const db = await openDB('gauzian-crypto', 1);
  await db.clear('keys');
}
```

**⚠️ Sécurité IndexedDB :**
- Les clés sont stockées comme `CryptoKey` **non-extractable** (impossible d'exporter en clair)
- Accessible uniquement par le code JavaScript du même domaine
- Pas de protection si l'attaquant a accès au code (XSS) → **Mitigation : CSP headers**
- Nettoyage obligatoire au logout

---

### 5. API Integration Pattern

**Toujours utiliser `credentials: 'include'` pour les cookies JWT :**

```typescript
// ✅ CORRECT
await fetch(`${API_URL}/files/list`, {
  method: 'GET',
  credentials: 'include', // Envoie le cookie auth_token
  headers: {
    'Content-Type': 'application/json'
  }
});

// ❌ INCORRECT (pas de cookie → 401 Unauthorized)
await fetch(`${API_URL}/files/list`, {
  method: 'GET'
});
```

**Gestion des erreurs réseau :**

```typescript
async function fetchWithErrorHandling(url, options) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expiré ou invalide → redirection login
        navigateTo('/login');
        throw new Error('Unauthorized');
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError') {
      // Erreur réseau (backend down, CORS, etc.)
      console.error('Network error:', error);
      throw new Error('Cannot connect to server');
    }
    throw error;
  }
}
```

---

## 🌍 Environment Variables

### Variables Nuxt

**Fichier : `.env` (ou variables d'environnement Clever Cloud / K8s)**

| Variable | Description | Valeur par défaut | Exemple |
|----------|-------------|-------------------|---------|
| `NUXT_PUBLIC_API_URL` | URL de l'API backend | - | `https://api.gauzian.com` |

**Utilisation dans le code :**

```typescript
const API_URL = import.meta.env.NUXT_PUBLIC_API_URL || 'http://localhost:8080';

await fetch(`${API_URL}/auth/login`, { ... });
```

**⚠️ Note :** Les variables `NUXT_PUBLIC_*` sont **publiques** et visibles côté client. Ne jamais y mettre de secrets (API keys privées, JWT secrets, etc.).

---

## 🧪 Testing

### Tester les Composables (Vitest)

**Fichier : `tests/composables/useAuth.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '~/composables/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
  });

  it('should login successfully', async () => {
    const mockResponse = {
      user_id: 123,
      encrypted_private_key: 'mock_encrypted_key',
      public_key: 'mock_public_key',
      encrypted_record_key: 'mock_record_key'
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const { login, isAuthenticated } = useAuth();
    await login('test@example.com', 'password123');

    expect(isAuthenticated.value).toBe(true);
  });

  it('should logout and clear IndexedDB', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });

    const { logout, isAuthenticated } = useAuth();
    await logout();

    expect(isAuthenticated.value).toBe(false);
    // Vérifier que clearIndexedDB() a été appelé
  });
});
```

### Tester crypto.ts (Unit Tests)

**Fichier : `tests/utils/crypto.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateKeyPair, encrypt, decrypt } from '~/utils/crypto';

describe('crypto.ts', () => {
  it('should generate RSA-4096 key pair', async () => {
    const { publicKey, privateKey } = await generateKeyPair();

    expect(publicKey.type).toBe('public');
    expect(privateKey.type).toBe('private');
    expect(publicKey.algorithm.modulusLength).toBe(4096);
  });

  it('should encrypt and decrypt text with AES-256-GCM', async () => {
    const recordKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const plaintext = 'Secret document.pdf';
    const encrypted = await encrypt(plaintext, recordKey);
    const decrypted = await decrypt(encrypted, recordKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should wrap and unwrap private key with password', async () => {
    const { privateKey } = await generateKeyPair();
    const passwordKey = await derivePasswordKey('password123', 'user@example.com');

    const wrapped = await wrapPrivateKey(privateKey, passwordKey);
    const unwrapped = await unwrapPrivateKey(wrapped, passwordKey);

    expect(unwrapped.type).toBe('private');
  });
});
```

### Tests E2E (Playwright)

**Fichier : `tests/e2e/login.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('should login and navigate to drive', async ({ page }) => {
  await page.goto('http://localhost:3000/login');

  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('http://localhost:3000/drive');
  await expect(page.locator('h1')).toContainText('My Drive');
});
```

---

## 🚀 Deployment

### VPS Kubernetes (Environnement Principal)

**1. Build et push de l'image Docker :**

```bash
# Depuis gauzian_front/
docker build -t angusvisual/gauzian-front:latest .
docker push angusvisual/gauzian-front:latest
```

**2. Déployer sur le cluster K8s :**

```bash
ssh vps 'bash ./gauzian_back/k8s/update-max.sh'
```

**3. Vérifier le déploiement :**

```bash
ssh vps 'kubectl get pods -n gauzian-v2 -l app=frontend'
ssh vps 'kubectl logs -n gauzian-v2 -l app=frontend --tail=50'
```

**URL de production :** `https://gauzian.com` (via Traefik IngressRoute)

---

### Clever Cloud (Environnement Alternatif)

**1. Push vers Clever Cloud :**

```bash
# Depuis la racine du projet
git push clever main
```

**2. Clever Cloud build automatiquement :**
- Détecte `package.json` → Node.js buildpack
- Exécute `npm install` + `npm run build`
- Lance `npm run start` (serveur Nuxt en mode production)

**3. Variables d'environnement Clever Cloud :**
```bash
clever env set NUXT_PUBLIC_API_URL "https://api.gauzian.com"
```

**URL de production :** `https://app-xyz.cleverapps.io` (ou domaine personnalisé)

---

## 🐛 Troubleshooting

### Erreur 1 : Network Error / Cannot Connect to Server

**Symptômes :**
```
TypeError: Failed to fetch
Network error: Cannot connect to server
```

**Causes possibles :**
1. Backend down ou non accessible
2. CORS headers manquants sur le backend
3. URL API incorrecte (`NUXT_PUBLIC_API_URL`)

**Solutions :**
```bash
# 1. Vérifier que le backend est up
ssh vps 'kubectl get pods -n gauzian-v2 -l app=backend'

# 2. Vérifier les logs backend pour CORS errors
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend --tail=100 | grep CORS'

# 3. Vérifier la configuration NUXT_PUBLIC_API_URL
echo $NUXT_PUBLIC_API_URL  # Doit pointer vers https://api.gauzian.com
```

**Fix CORS dans le backend (Rust) :**
```rust
// gauzian_back/src/main.rs
let cors = CorsLayer::new()
    .allow_origin("https://gauzian.com".parse::<HeaderValue>().unwrap())
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_credentials(true)  // ⚠️ CRITIQUE pour credentials: 'include'
    .allow_headers([AUTHORIZATION, CONTENT_TYPE]);
```

---

### Erreur 2 : 401 Unauthorized (Token Expiré)

**Symptômes :**
```
HTTP 401: Unauthorized
Redirection automatique vers /login
```

**Causes possibles :**
1. Cookie JWT expiré (durée de vie : 7 jours par défaut)
2. Token révoqué (logout sur un autre device)
3. Cookie bloqué (SameSite, HTTPS manquant)

**Solutions :**
```typescript
// 1. Vérifier la présence du cookie dans les DevTools
// Application → Cookies → auth_token (doit être présent)

// 2. Vérifier l'expiration du token
const token = getCookie('auth_token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token expires:', new Date(payload.exp * 1000));

// 3. Forcer un nouveau login
await logout();
await login(email, password); // Génère un nouveau token
```

**Fix backend (vérifier SameSite cookie) :**
```rust
// gauzian_back/src/handlers.rs
Cookie::build(("auth_token", token))
    .http_only(true)
    .secure(true)           // ⚠️ HTTPS uniquement
    .same_site(SameSite::None)  // Pour cross-origin requests
    .path("/")
    .max_age(time::Duration::days(7))
```

---

### Erreur 3 : Crypto Keys Lost (IndexedDB vide)

**Symptômes :**
```
Error: Private key not found in IndexedDB
Cannot decrypt file: key is null
```

**Causes possibles :**
1. IndexedDB cleared (par l'utilisateur ou le navigateur)
2. Logout sans backup des clés
3. Changement de domaine (IndexedDB is per-origin)

**Solutions :**
```typescript
// 1. Vérifier IndexedDB dans DevTools
// Application → IndexedDB → gauzian-crypto → keys
// Doit contenir : privateKey, publicKey, recordKey

// 2. Si vide → impossible de récupérer sans le mot de passe
// L'utilisateur doit se reconnecter (re-dériver les clés)
await logout();
await login(email, password); // Re-dérive passwordKey et unwrap les clés

// 3. TODO: Implémenter un "Recovery Key" (backup des clés)
// Générer une recovery key au register et la stocker chiffrée
```

**⚠️ Note :** **Zero-Knowledge signifie pas de récupération serveur** - Si l'utilisateur perd son mot de passe ET ses clés, les données sont **irrécupérables**.

---

### Erreur 4 : Upload Failure (Chunked Upload)

**Symptômes :**
```
Upload failed at chunk 42/100
Error: Chunk upload timeout
```

**Causes possibles :**
1. Timeout réseau (chunk trop gros ou connexion lente)
2. Backend crash pendant l'upload
3. S3/MinIO indisponible

**Solutions :**
```typescript
// 1. Réduire la taille des chunks (de 5MB à 2MB)
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB

// 2. Ajouter retry logic
async function uploadChunkWithRetry(chunk, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await uploadChunk(chunk);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Backoff
    }
  }
}

// 3. Vérifier les logs backend pour S3 errors
ssh vps 'kubectl logs -n gauzian-v2 -l app=backend | grep "S3 error"'
```

**Fix backend (augmenter timeout) :**
```rust
// gauzian_back/src/main.rs
let app = Router::new()
    .layer(TimeoutLayer::new(Duration::from_secs(300))) // 5 minutes timeout
    // ...
```

---

### Erreur 5 : Agenda Events Empty

**Symptômes :**
```
Agenda page shows "No events"
API returns [] but events exist in database
```

**Causes possibles :**
1. Filtrage incorrect par date (timezone issues)
2. Clés de déchiffrement manquantes
3. Événements soft-deleted (`is_deleted = true`)

**Solutions :**
```typescript
// 1. Vérifier le filtrage par date
const startDate = new Date('2025-01-01').toISOString();
const endDate = new Date('2025-12-31').toISOString();
const events = await fetchEvents(startDate, endDate);

// 2. Vérifier les clés de déchiffrement
const recordKey = await getRecordKeyFromIndexedDB();
if (!recordKey) {
  console.error('Record key missing - cannot decrypt events');
  await login(email, password); // Re-login pour récupérer les clés
}

// 3. Vérifier les événements soft-deleted
// Backend doit filtrer is_deleted = false
```

**Fix backend (filtrage soft delete) :**
```rust
// gauzian_back/src/handlers.rs
sqlx::query!(
    "SELECT * FROM agenda_events
     WHERE user_id = $1
     AND start_time >= $2
     AND end_time <= $3
     AND is_deleted = false",  // ⚠️ Filtrer les soft-deleted
    user_id, start_date, end_date
)
```

---

## ✅ Best Practices

### DO ✅

**Vue 3 / Nuxt 4 :**
- ✅ Utiliser la Composition API (`<script setup>`) pour tous les composants
- ✅ Utiliser `useState()` pour l'état global partagé (ex: `useAuth`)
- ✅ Utiliser `computed()` pour les valeurs dérivées (ex: `isAuthenticated`)
- ✅ Utiliser `watch()` pour les effets secondaires (ex: redirection après login)
- ✅ Utiliser `navigateTo()` pour la navigation programmatique (pas `router.push`)

**Crypto Operations :**
- ✅ Toujours générer un IV unique par opération de chiffrement
- ✅ Utiliser AES-256-GCM (pas CBC) pour l'authentification intégrée
- ✅ Stocker les clés dans IndexedDB comme `CryptoKey` non-extractable
- ✅ Nettoyer IndexedDB au logout (sécurité)
- ✅ PBKDF2 avec 310k iterations minimum (OWASP 2024)

**API Calls :**
- ✅ Toujours utiliser `credentials: 'include'` pour les cookies JWT
- ✅ Gérer les erreurs 401 (redirection `/login`)
- ✅ Gérer les erreurs réseau (backend down, timeout)
- ✅ Utiliser des retry logic pour les uploads chunked

**Security :**
- ✅ Valider et sanitiser toutes les entrées utilisateur (XSS prevention)
- ✅ Utiliser CSP headers pour limiter l'exécution de scripts
- ✅ Vérifier les CORS headers backend (`allow_credentials: true`)
- ✅ Utiliser HTTPS en production (cookies `Secure` flag)

---

### DON'T ❌

**Vue 3 / Nuxt 4 :**
- ❌ Ne pas utiliser Options API (`data()`, `methods`, `computed`) → Préférer Composition API
- ❌ Ne pas utiliser `localStorage` pour l'état global → Utiliser `useState()`
- ❌ Ne pas utiliser `window.location.href` → Utiliser `navigateTo()`
- ❌ Ne pas accéder directement aux cookies avec `document.cookie` → Backend gère les cookies JWT

**Crypto Operations :**
- ❌ Ne JAMAIS réutiliser le même IV pour deux chiffrements différents
- ❌ Ne JAMAIS stocker les clés en clair (localStorage, sessionStorage)
- ❌ Ne JAMAIS logger les clés ou données sensibles (`console.log(privateKey)`)
- ❌ Ne JAMAIS utiliser AES-CBC sans HMAC (pas d'authentification)
- ❌ Ne JAMAIS utiliser moins de 310k iterations pour PBKDF2

**API Calls :**
- ❌ Ne pas oublier `credentials: 'include'` → 401 Unauthorized
- ❌ Ne pas hardcoder l'URL API → Utiliser `NUXT_PUBLIC_API_URL`
- ❌ Ne pas ignorer les erreurs réseau silencieusement
- ❌ Ne pas faire de retry infini (max 3 tentatives)

**Security :**
- ❌ Ne JAMAIS injecter du HTML non sanitisé (`v-html` avec données user)
- ❌ Ne JAMAIS exposer des secrets dans les variables `NUXT_PUBLIC_*`
- ❌ Ne JAMAIS désactiver CORS en production
- ❌ Ne JAMAIS utiliser HTTP en production (cookies pas sécurisés)

---

## 📖 Documentation Complète

**Pour plus de détails, consulter :**

- ⭐ [`README.md`](./README.md) - **Architecture complète du frontend** (~1100 lignes)
  - Pages, composables, components, crypto.ts détaillés
  - 4 workflows E2EE (register, login, upload, share)
  - 4 scénarios de troubleshooting
  - Checklist de sécurité OWASP

- ⭐ [`docs/CRYPTO_ARCHITECTURE.md`](./docs/CRYPTO_ARCHITECTURE.md) - **Documentation technique E2EE** (~1000 lignes)
  - Justifications des choix crypto (RSA-4096, AES-GCM, PBKDF2 310k)
  - IndexedDB pattern avec clés non-extractable
  - Tous les 25+ fonctions crypto.ts documentées avec exemples
  - 4 unit tests examples
  - OWASP security checklist

- [`../CLAUDE.md`](../CLAUDE.md) - **Vue d'ensemble du projet** (root)
  - Stack technique complet
  - Architecture globale (backend + frontend)
  - Workflows de déploiement (VPS K8s + Clever Cloud)
  - Monitoring (Prometheus + Grafana)

- [`../gauzian_back/CLAUDE.md`](../gauzian_back/CLAUDE.md) - **Documentation backend**
  - Architecture backend détaillée (modules, patterns)
  - Database schema (9 tables)
  - Metrics Prometheus (17 métriques custom)

- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) - **Guide de déploiement complet**
  - Déploiement 1 : VPS Kubernetes (K3s)
  - Déploiement 2 : Clever Cloud (PaaS)
  - Scripts et commandes détaillées

---

**Dernière mise à jour :** 2026-02-11
