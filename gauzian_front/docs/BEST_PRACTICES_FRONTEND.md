# Best Practices - Frontend (Vue 3 / Nuxt 4)

Guide des bonnes pratiques pour le développement du frontend GAUZIAN (Nuxt 4 / Vue 3 / Composition API / E2EE).

**Dernière mise à jour** : 2026-02-11

---

## Table des Matières

1. [Vue 3 & Composition API](#vue-3--composition-api)
2. [Nuxt 4 Patterns](#nuxt-4-patterns)
3. [Crypto & E2EE](#crypto--e2ee)
4. [State Management](#state-management)
5. [API Calls](#api-calls)
6. [Performance](#performance)
7. [Security](#security)
8. [Testing](#testing)
9. [Code Style](#code-style)
10. [Common Pitfalls](#common-pitfalls)

---

## Vue 3 & Composition API

### Toujours Utiliser `<script setup>`

✅ **DO** : Utiliser la Composition API avec `<script setup>` (syntaxe concise).

```vue
<!-- ✅ GOOD - Composition API avec <script setup> -->
<script setup>
import { ref, computed } from 'vue';

const count = ref(0);
const doubleCount = computed(() => count.value * 2);

function increment() {
  count.value++;
}
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Double: {{ doubleCount }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>

<!-- ❌ BAD - Options API (deprecated) -->
<script>
export default {
  data() {
    return {
      count: 0
    };
  },
  computed: {
    doubleCount() {
      return this.count * 2;
    }
  },
  methods: {
    increment() {
      this.count++;
    }
  }
};
</script>
```

**Avantages de `<script setup>` :**
- ✅ Syntaxe plus concise (moins de boilerplate)
- ✅ Meilleure performance (compile en `setup()` optimisé)
- ✅ Meilleur TypeScript support
- ✅ Auto-import des composants

---

### Reactivity avec `ref` et `reactive`

✅ **DO** : Utiliser `ref` pour les primitives, `reactive` pour les objets (avec prudence).

```javascript
import { ref, reactive, computed } from 'vue';

// ✅ GOOD - ref pour primitives
const count = ref(0);
const username = ref('john');
const isLoading = ref(false);

// Accès avec .value
count.value++;
console.log(username.value);

// ✅ GOOD - reactive pour objets (avec prudence)
const state = reactive({
  files: [],
  currentFolderId: null,
  breadcrumb: []
});

// Accès direct (pas de .value)
state.files.push(newFile);

// ❌ BAD - reactive pour primitives
const count = reactive(0);  // ⚠️ Perd la réactivité !

// ❌ BAD - Destructurer reactive (perd la réactivité)
const { files } = reactive({ files: [] });  // ⚠️ files n'est plus réactif !
files.push(newFile);  // Pas de mise à jour !
```

**Règle** : Préférer `ref` par défaut (fonctionne pour tout), utiliser `reactive` seulement pour des objets complexes **non-destructurés**.

---

### Computed Properties

✅ **DO** : Utiliser `computed` pour les valeurs dérivées.

```javascript
import { ref, computed } from 'vue';

// ✅ GOOD - computed pour valeurs dérivées
const files = ref([
  { name: 'file1.pdf', size: 1024 },
  { name: 'file2.png', size: 2048 }
]);

const totalSize = computed(() => {
  return files.value.reduce((sum, file) => sum + file.size, 0);
});

// Réactif : totalSize se met à jour quand files change
console.log(totalSize.value);  // 3072

// ❌ BAD - Recalculer manuellement (pas réactif)
let totalSize = 0;
files.value.forEach(file => {
  totalSize += file.size;  // ⚠️ Pas réactif, doit être recalculé manuellement
});
```

**Avantages de `computed` :**
- ✅ Cached (recalculé seulement si dépendances changent)
- ✅ Réactif (mise à jour automatique dans template)
- ✅ Read-only (ne peut pas être modifié)

---

### Watchers

✅ **DO** : Utiliser `watch` pour les effets secondaires (API calls, navigation, etc.).

```javascript
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

// ✅ GOOD - watch pour effets secondaires
const searchQuery = ref('');
const router = useRouter();

watch(searchQuery, async (newQuery) => {
  if (newQuery.length > 0) {
    // Effet secondaire : appel API
    await fetchSearchResults(newQuery);
  }
});

// ✅ GOOD - watch pour navigation
const isAuthenticated = ref(false);

watch(isAuthenticated, (newValue) => {
  if (!newValue) {
    // Effet secondaire : redirection
    router.push('/login');
  }
});

// ❌ BAD - Modifier une ref dans computed (side effect)
const doubleCount = computed(() => {
  count.value++;  // ⚠️ Side effect interdit dans computed !
  return count.value * 2;
});
```

**Règle** : `computed` = calculs purs (read-only), `watch` = side effects (API calls, navigation).

---

### Lifecycle Hooks

✅ **DO** : Utiliser `onMounted`, `onUnmounted` pour setup/cleanup.

```javascript
import { ref, onMounted, onUnmounted } from 'vue';

// ✅ GOOD - Lifecycle hooks
const eventSource = ref(null);

onMounted(() => {
  // Setup : récupérer les données au montage
  fetchUserData();

  // Setup : EventSource pour notifications
  eventSource.value = new EventSource('/api/notifications');
  eventSource.value.onmessage = handleNotification;
});

onUnmounted(() => {
  // Cleanup : fermer la connexion EventSource
  if (eventSource.value) {
    eventSource.value.close();
  }
});

// ❌ BAD - Setup sans cleanup (memory leak)
onMounted(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);

  // ⚠️ Pas de cleanup → memory leak !
});

// ✅ GOOD - Setup + cleanup
onMounted(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);

  onUnmounted(() => {
    clearInterval(interval);  // ← Cleanup
  });
});
```

---

## Nuxt 4 Patterns

### useState pour État Global

✅ **DO** : Utiliser `useState` pour partager l'état entre composants.

```javascript
// composables/useAuth.js
export const useAuth = () => {
  // ✅ GOOD - useState pour état global partagé
  const user = useState('auth-user', () => null);
  const isAuthenticated = computed(() => !!user.value);

  const login = async (email, password) => {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) throw new Error('Login failed');

    const data = await response.json();
    user.value = { email, userId: data.user_id };  // ← Shared state
  };

  const logout = async () => {
    await fetch(`${API_URL}/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    user.value = null;  // ← Réinitialiser l'état global
    await clearIndexedDB();
  };

  return { user, isAuthenticated, login, logout };
};

// Usage dans un composant
<script setup>
import { useAuth } from '~/composables/useAuth';

const { user, isAuthenticated, login, logout } = useAuth();
// user est partagé entre tous les composants qui utilisent useAuth()
</script>

// ❌ BAD - ref local (pas partagé)
export const useAuth = () => {
  const user = ref(null);  // ⚠️ Nouvel état créé pour chaque composant !
  // ...
};
```

**Avantages de `useState` :**
- ✅ Shared state (même instance pour tous les composants)
- ✅ SSR-safe (state séparé par requête)
- ✅ Auto-serialized (hydration automatique)

---

### navigateTo pour Navigation

✅ **DO** : Utiliser `navigateTo` (pas `router.push` ou `window.location`).

```javascript
import { navigateTo } from '#app';

// ✅ GOOD - navigateTo (Nuxt-aware)
async function handleLogin() {
  await login(email.value, password.value);
  await navigateTo('/drive');  // ← Navigation Nuxt
}

// ❌ BAD - window.location (full page reload)
async function handleLogin() {
  await login(email.value, password.value);
  window.location.href = '/drive';  // ⚠️ Recharge toute la page !
}

// ❌ BAD - router.push (moins sûr)
import { useRouter } from 'vue-router';
const router = useRouter();

async function handleLogin() {
  await login(email.value, password.value);
  router.push('/drive');  // ⚠️ Fonctionne mais navigateTo est préféré
}
```

**Avantages de `navigateTo` :**
- ✅ SSR-safe (fonctionne server-side)
- ✅ Middleware-aware (exécute les middlewares)
- ✅ Type-safe (TypeScript autocomplete)

---

### Composables Pattern

✅ **DO** : Extraire la logique réutilisable dans des composables.

```javascript
// composables/useFileActions.js
export const useFileActions = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const uploadFile = async (file, folderId) => {
    try {
      // 1. Initialize upload
      const { file_id } = await fetch(`${API_URL}/drive/initialize_file`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          size: file.size,
          encrypted_metadata: await encryptMetadata(file.name),
          mime_type: file.type,
          folder_id: folderId,
          encrypted_file_key: await generateFileKey()
        })
      }).then(r => r.json());

      // 2. Upload chunks
      await uploadChunks(file, file_id);

      // 3. Finalize
      await fetch(`${API_URL}/drive/finalize_upload/${file_id}/success`, {
        method: 'POST',
        credentials: 'include'
      });

      showNotification('File uploaded successfully', 'success');
    } catch (error) {
      showNotification(`Upload failed: ${error.message}`, 'error');
    }
  };

  const deleteFile = async (fileId) => {
    // ...
  };

  return { uploadFile, deleteFile };
};

// Usage dans un composant
<script setup>
import { useFileActions } from '~/composables/useFileActions';

const { uploadFile, deleteFile } = useFileActions();

async function handleUpload(file) {
  await uploadFile(file, currentFolderId.value);
}
</script>

// ❌ BAD - Logique dupliquée dans chaque composant
<script setup>
// Dupliquer uploadFile dans chaque composant → DRY violation
async function uploadFile(file) {
  // ... logique dupliquée
}
</script>
```

---

### Auto-Import

✅ **DO** : Profiter de l'auto-import Nuxt (pas besoin d'import explicite).

```javascript
// ✅ GOOD - Auto-import (Nuxt 3+)
<script setup>
// Pas besoin d'import !
const user = useState('user', () => null);
const route = useRoute();
const { uploadFile } = useFileActions();

onMounted(() => {
  console.log('Mounted!');
});
</script>

// ❌ BAD - Imports explicites (inutile avec Nuxt)
<script setup>
import { useState } from '#app';  // ⚠️ Inutile avec auto-import
import { useRoute } from 'vue-router';  // ⚠️ Inutile
import { onMounted } from 'vue';  // ⚠️ Inutile

const user = useState('user', () => null);
// ...
</script>
```

**Auto-importés par défaut** :
- Vue APIs : `ref`, `computed`, `watch`, `onMounted`, etc.
- Nuxt APIs : `useState`, `navigateTo`, `useRoute`, `useFetch`, etc.
- Composables : `~/composables/*.js`
- Components : `~/components/**/*.vue`

---

## Crypto & E2EE

### Générer des IV Uniques

✅ **DO** : **TOUJOURS** générer un IV unique pour chaque chiffrement.

```javascript
// ✅ GOOD - IV unique par chiffrement
async function encrypt(plaintext, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));  // ← NOUVEAU IV à chaque fois

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Stocker IV avec ciphertext
  return `${arrayBufferToBase64(iv)}:${arrayBufferToBase64(ciphertext)}`;
}

// ❌ BAD - Réutiliser le même IV (VULNÉRABLE !)
const GLOBAL_IV = new Uint8Array(12);  // ⚠️ DANGER !

async function encrypt_bad(plaintext, key) {
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: GLOBAL_IV },  // ⚠️ Même IV réutilisé → attaque possible !
    key,
    new TextEncoder().encode(plaintext)
  );

  return arrayBufferToBase64(ciphertext);
}
```

**⚠️ CRITIQUE** : Réutiliser le même IV avec AES-GCM expose le XOR des plaintexts → **attaque catastrophique**.

---

### Stocker les Clés dans IndexedDB

✅ **DO** : Stocker les CryptoKey dans IndexedDB (non-extractable).

```javascript
import { openDB } from 'idb';

// ✅ GOOD - CryptoKey non-extractable dans IndexedDB
async function saveKeysToIndexedDB(keys) {
  const db = await openDB('gauzian-crypto', 1, {
    upgrade(db) {
      db.createObjectStore('keys');
    }
  });

  // ⚠️ CryptoKey avec extractable: false (secure)
  await db.put('keys', keys.privateKey, 'privateKey');
  await db.put('keys', keys.recordKey, 'recordKey');
}

async function getPrivateKeyFromIndexedDB() {
  const db = await openDB('gauzian-crypto', 1);
  return await db.get('keys', 'privateKey');  // Retourne CryptoKey
}

// ❌ BAD - Clés en clair dans localStorage (VULNÉRABLE !)
async function saveKeys_bad(keys) {
  const exportedPrivateKey = await crypto.subtle.exportKey('pkcs8', keys.privateKey);
  localStorage.setItem('privateKey', arrayBufferToBase64(exportedPrivateKey));  // ⚠️ DANGER !
}
```

**Sécurité IndexedDB :**
- ✅ CryptoKey non-extractable (impossible d'exporter en clair)
- ❌ Accessible par code JavaScript du même domaine (vulnérable aux XSS)
- **Mitigation XSS** : CSP headers, input sanitization

---

### PBKDF2 Iterations

✅ **DO** : Utiliser **310,000 iterations minimum** (OWASP 2024).

```javascript
// ✅ GOOD - PBKDF2 avec 310k iterations (OWASP 2024)
async function derivePasswordKey(password, salt) {
  const passwordBuffer = new TextEncoder().encode(password);
  const saltBuffer = new TextEncoder().encode(salt);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 310000,  // ← OWASP 2024 recommendation
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,  // non-extractable
    ['wrapKey', 'unwrapKey']
  );
}

// ❌ BAD - Trop peu d'iterations (VULNÉRABLE !)
async function derivePasswordKey_bad(password, salt) {
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 1000,  // ⚠️ Vulnérable aux attaques brute-force !
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}
```

**Évolution des recommandations OWASP** :
- 2020 : 100,000 iterations
- 2023 : 210,000 iterations
- 2024 : **310,000 iterations**

---

### Nettoyer IndexedDB au Logout

✅ **DO** : **TOUJOURS** nettoyer IndexedDB au logout (sécurité).

```javascript
// ✅ GOOD - Cleanup au logout
async function logout() {
  await fetch(`${API_URL}/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  // Nettoyer TOUTES les clés crypto
  await clearIndexedDB();

  // Rediriger vers login
  await navigateTo('/login');
}

async function clearIndexedDB() {
  const db = await openDB('gauzian-crypto', 1);
  await db.clear('keys');  // ← Supprimer toutes les clés
}

// ❌ BAD - Pas de cleanup (clés restent en mémoire)
async function logout_bad() {
  await fetch(`${API_URL}/logout`, {
    method: 'POST',
    credentials: 'include'
  });

  // ⚠️ Pas de clearIndexedDB() → clés accessibles après logout !
  await navigateTo('/login');
}
```

**⚠️ Sécurité** : Si les clés restent dans IndexedDB après logout, un autre utilisateur sur le même device peut y accéder.

---

### Ne Jamais Logger les Clés

❌ **DON'T** : **JAMAIS** logger les clés crypto ou données sensibles.

```javascript
// ❌ BAD - Logger des données sensibles
async function login(email, password) {
  console.log('Password:', password);  // ⚠️ DANGER ! Password en clair dans console
  const passwordKey = await derivePasswordKey(password, email);
  console.log('Password Key:', passwordKey);  // ⚠️ DANGER !

  const privateKey = await unwrapPrivateKey(encryptedPrivateKey, passwordKey);
  console.log('Private Key:', privateKey);  // ⚠️ DANGER !
}

// ✅ GOOD - Logger seulement des métadonnées
async function login(email, password) {
  console.log('Login attempt for:', email);  // ✅ OK (email pas ultra sensible)

  const passwordKey = await derivePasswordKey(password, email);
  // Pas de log du passwordKey

  const privateKey = await unwrapPrivateKey(encryptedPrivateKey, passwordKey);
  console.log('Private key loaded successfully');  // ✅ OK (confirmation sans données)
}
```

**Liste de données à JAMAIS logger** :
- ❌ Passwords (plaintext)
- ❌ CryptoKey objects
- ❌ JWT tokens
- ❌ Clés AES/RSA exportées
- ❌ IVs (sauf si combinés avec ciphertext)

---

## State Management

### Composables > Pinia pour État Simple

✅ **DO** : Utiliser des composables pour l'état simple (pas besoin de Pinia).

```javascript
// ✅ GOOD - Composable pour état simple
// composables/useAuth.js
export const useAuth = () => {
  const user = useState('auth-user', () => null);
  const isAuthenticated = computed(() => !!user.value);

  const login = async (email, password) => { /* ... */ };
  const logout = async () => { /* ... */ };

  return { user, isAuthenticated, login, logout };
};

// Usage
<script setup>
const { user, isAuthenticated, login, logout } = useAuth();
</script>

// ❌ BAD - Pinia pour état simple (over-engineering)
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null
  }),
  getters: {
    isAuthenticated: (state) => !!state.user
  },
  actions: {
    async login(email, password) { /* ... */ },
    async logout() { /* ... */ }
  }
});
```

**Quand utiliser Pinia ?**
- État très complexe (>5 composables interdépendants)
- Besoin de devtools (time-travel debugging)
- Besoin de plugins (persistence, etc.)

**Sinon** : Composables suffisent (plus simple, moins de boilerplate).

---

### Éviter les Mutations Directes

✅ **DO** : Modifier l'état via des fonctions (encapsulation).

```javascript
// ✅ GOOD - Mutations via fonctions
export const useDriveData = () => {
  const files = useState('drive-files', () => []);

  const addFile = (file) => {
    files.value.push(file);
  };

  const removeFile = (fileId) => {
    files.value = files.value.filter(f => f.id !== fileId);
  };

  return { files: readonly(files), addFile, removeFile };  // ← readonly
};

// Usage
<script setup>
const { files, addFile, removeFile } = useDriveData();
addFile(newFile);  // ✅ Via fonction
</script>

// ❌ BAD - Mutations directes
export const useDriveData = () => {
  const files = useState('drive-files', () => []);
  return { files };  // ← Pas readonly, pas de fonctions
};

// Usage
<script setup>
const { files } = useDriveData();
files.value.push(newFile);  // ⚠️ Mutation directe (pas encapsulé)
</script>
```

**Avantages de l'encapsulation** :
- ✅ Validations centralisées
- ✅ Side effects (notifications, logging) dans un seul endroit
- ✅ Easier to debug (un seul point d'entrée)

---

## API Calls

### Toujours Utiliser `credentials: 'include'`

✅ **DO** : Ajouter `credentials: 'include'` pour envoyer les cookies JWT.

```javascript
// ✅ GOOD - credentials: 'include'
async function fetchFiles() {
  const response = await fetch(`${API_URL}/drive/files`, {
    method: 'GET',
    credentials: 'include',  // ← Envoie le cookie auth_token
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

// ❌ BAD - Pas de credentials (pas de cookie)
async function fetchFiles_bad() {
  const response = await fetch(`${API_URL}/drive/files`, {
    method: 'GET'
    // ⚠️ Pas de credentials: 'include' → 401 Unauthorized !
  });

  return await response.json();
}
```

**⚠️ IMPORTANT** : Sans `credentials: 'include'`, le cookie `auth_token` n'est **jamais** envoyé → 401 Unauthorized.

---

### Gestion des Erreurs Réseau

✅ **DO** : Toujours gérer les erreurs réseau et HTTP.

```javascript
// ✅ GOOD - Gestion des erreurs complète
async function fetchWithErrorHandling(url, options) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expiré → redirection login
        await navigateTo('/login');
        throw new Error('Unauthorized');
      }

      if (response.status === 403) {
        throw new Error('Forbidden: You don\'t have permission');
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

// ❌ BAD - Pas de gestion d'erreur
async function fetchWithoutErrorHandling(url) {
  const response = await fetch(url);  // ⚠️ Pas de try/catch, pas de vérification status
  return await response.json();
}
```

---

### Éviter les Requêtes N+1

✅ **DO** : Charger toutes les données en une seule requête (ou en parallèle).

```javascript
// ✅ GOOD - Une seule requête pour tout charger
async function loadDashboard() {
  const data = await fetch(`${API_URL}/drive/get_all_drive_info/${folderId}`, {
    credentials: 'include'
  }).then(r => r.json());

  // data contient : user, files, folders, quota
  files.value = data.files;
  folders.value = data.folders;
  quota.value = data.quota;
}

// ❌ BAD - Requêtes séquentielles (N+1 problem)
async function loadDashboard_bad() {
  const user = await fetch(`${API_URL}/auth/info`).then(r => r.json());
  const files = await fetch(`${API_URL}/drive/files`).then(r => r.json());
  const folders = await fetch(`${API_URL}/drive/folders`).then(r => r.json());
  const quota = await fetch(`${API_URL}/drive/quota`).then(r => r.json());
  // ⚠️ 4 requêtes séquentielles → 4x plus lent !
}

// ✅ GOOD - Requêtes parallèles (si endpoint groupé pas disponible)
async function loadDashboard_parallel() {
  const [user, files, folders, quota] = await Promise.all([
    fetch(`${API_URL}/auth/info`).then(r => r.json()),
    fetch(`${API_URL}/drive/files`).then(r => r.json()),
    fetch(`${API_URL}/drive/folders`).then(r => r.json()),
    fetch(`${API_URL}/drive/quota`).then(r => r.json())
  ]);
}
```

---

## Performance

### Lazy Loading Components

✅ **DO** : Lazy-load les composants lourds (pas dans le bundle initial).

```javascript
// ✅ GOOD - Lazy loading pour composant lourd
<script setup>
import { defineAsyncComponent } from 'vue';

const UploadModal = defineAsyncComponent(() =>
  import('~/components/UploadModal.vue')
);

const showUploadModal = ref(false);
</script>

<template>
  <button @click="showUploadModal = true">Upload</button>
  <UploadModal v-if="showUploadModal" />  <!-- Chargé seulement si affiché -->
</template>

// ❌ BAD - Import synchrone (toujours dans bundle)
<script setup>
import UploadModal from '~/components/UploadModal.vue';  // ⚠️ Toujours dans bundle

const showUploadModal = ref(false);
</script>
```

---

### Debounce pour Recherches

✅ **DO** : Debouncer les inputs de recherche (éviter trop d'API calls).

```javascript
import { ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';

// ✅ GOOD - Debounce 300ms
const searchQuery = ref('');
const searchResults = ref([]);

const debouncedSearch = useDebounceFn(async (query) => {
  if (query.length > 0) {
    searchResults.value = await fetchSearchResults(query);
  }
}, 300);  // ← Attendre 300ms après dernière saisie

watch(searchQuery, (newQuery) => {
  debouncedSearch(newQuery);
});

// ❌ BAD - Pas de debounce (API call à chaque touche)
watch(searchQuery, async (newQuery) => {
  searchResults.value = await fetchSearchResults(newQuery);
  // ⚠️ Si user tape "hello" → 5 API calls (h, he, hel, hell, hello)
});
```

---

### Virtual Scrolling pour Listes Longues

✅ **DO** : Utiliser virtual scrolling pour afficher >100 items.

```vue
<!-- ✅ GOOD - Virtual scrolling pour 10,000+ fichiers -->
<script setup>
import { useVirtualList } from '@vueuse/core';

const files = ref(Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  name: `File ${i}.pdf`
})));

const { list, containerProps, wrapperProps } = useVirtualList(
  files,
  { itemHeight: 50 }
);
</script>

<template>
  <div v-bind="containerProps" style="height: 600px; overflow: auto;">
    <div v-bind="wrapperProps">
      <div v-for="{ data } in list" :key="data.id" style="height: 50px;">
        {{ data.name }}
      </div>
    </div>
  </div>
</template>

<!-- ❌ BAD - Render TOUS les items (10,000 DOM nodes) -->
<template>
  <div style="height: 600px; overflow: auto;">
    <div v-for="file in files" :key="file.id">
      {{ file.name }}  <!-- ⚠️ 10,000 DOM nodes → lag ! -->
    </div>
  </div>
</template>
```

---

### Computed Properties Caching

✅ **DO** : Exploiter le caching de `computed` pour éviter recalculs.

```javascript
import { ref, computed } from 'vue';

// ✅ GOOD - computed (cached)
const files = ref([/* 1000 files */]);

const sortedFiles = computed(() => {
  console.log('Sorting files...');  // Appelé seulement si files change
  return files.value.slice().sort((a, b) => a.name.localeCompare(b.name));
});

// Usage multiple (pas de recalcul)
console.log(sortedFiles.value);  // "Sorting files..."
console.log(sortedFiles.value);  // (pas de log, cached)
console.log(sortedFiles.value);  // (pas de log, cached)

// ❌ BAD - fonction normale (recalculé à chaque fois)
function getSortedFiles() {
  console.log('Sorting files...');  // Appelé à CHAQUE accès
  return files.value.slice().sort((a, b) => a.name.localeCompare(b.name));
}

console.log(getSortedFiles());  // "Sorting files..."
console.log(getSortedFiles());  // "Sorting files..." (recalculé !)
console.log(getSortedFiles());  // "Sorting files..." (recalculé !)
```

---

## Security

### XSS Prevention

✅ **DO** : Toujours sanitize les entrées utilisateur avant `v-html`.

```vue
<!-- ✅ GOOD - Sanitization avec DOMPurify -->
<script setup>
import DOMPurify from 'dompurify';

const userContent = ref('<script>alert("XSS")</script><p>Hello</p>');
const sanitizedContent = computed(() => DOMPurify.sanitize(userContent.value));
</script>

<template>
  <div v-html="sanitizedContent"></div>  <!-- Safe -->
</template>

<!-- ❌ BAD - v-html sans sanitization (XSS vulnérable !) -->
<template>
  <div v-html="userContent"></div>  <!-- ⚠️ XSS attack possible ! -->
</template>

<!-- ✅ BETTER - Éviter v-html (utiliser {{ }} par défaut) -->
<template>
  <div>{{ userContent }}</div>  <!-- ✅ Auto-escaped par Vue -->
</template>
```

**Règle** : Préférer `{{ }}` (auto-escaped), utiliser `v-html` **seulement** si absolument nécessaire (et toujours avec sanitization).

---

### CSP Headers

✅ **DO** : Configurer CSP headers pour limiter les scripts (protection XSS).

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",  // ⚠️ 'unsafe-inline' à éviter si possible
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self' https://api.gauzian.com",
            "font-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
          ].join('; ')
        }
      }
    }
  }
});

// ❌ BAD - Pas de CSP (vulnérable aux XSS injectées)
```

---

### Éviter eval() et new Function()

❌ **DON'T** : **JAMAIS** utiliser `eval()` ou `new Function()`.

```javascript
// ❌ BAD - eval() (XSS vulnérable !)
const userInput = '2 + 2';
const result = eval(userInput);  // ⚠️ Si userInput = "alert('XSS')" → XSS !

// ❌ BAD - new Function() (même problème)
const fn = new Function('return ' + userInput);
const result = fn();  // ⚠️ XSS vulnérable

// ✅ GOOD - Parser sécurisé
import { parse } from 'mathjs';
const result = parse(userInput).evaluate();  // ✅ Safe
```

---

## Testing

### Unit Tests avec Vitest

✅ **DO** : Tester les composables et fonctions pures.

```javascript
// tests/composables/useAuth.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '~/composables/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
  });

  it('should login successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user_id: '123', token: 'abc' })
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
  });
});
```

---

### Component Tests

✅ **DO** : Tester les composants avec `@vue/test-utils`.

```javascript
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import FileItem from '~/components/FileItem.vue';

describe('FileItem', () => {
  it('should render file name', () => {
    const wrapper = mount(FileItem, {
      props: {
        file: {
          id: '123',
          encrypted_metadata: 'test.pdf',
          size: 1024
        }
      }
    });

    expect(wrapper.text()).toContain('test.pdf');
  });

  it('should emit delete event on click', async () => {
    const wrapper = mount(FileItem, {
      props: { file: { id: '123', encrypted_metadata: 'test.pdf', size: 1024 } }
    });

    await wrapper.find('.delete-button').trigger('click');

    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')[0]).toEqual(['123']);
  });
});
```

---

## Code Style

### Naming Conventions

✅ **DO** : Suivre les conventions Vue 3.

```javascript
// ✅ GOOD
<script setup>
// Variables: camelCase
const userName = ref('John');
const isLoading = ref(false);

// Fonctions: camelCase
function handleClick() { /* ... */ }
async function fetchData() { /* ... */ }

// Composants: PascalCase
import UserProfile from '~/components/UserProfile.vue';
import FileItem from '~/components/FileItem.vue';

// Constantes: SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE = 1024 * 1024 * 100;
const API_URL = 'https://api.gauzian.com';
</script>

// ❌ BAD
<script setup>
const UserName = ref('John');  // ⚠️ Devrait être camelCase
function HandleClick() { /* ... */ }  // ⚠️ Devrait être camelCase
import userProfile from '~/components/UserProfile.vue';  // ⚠️ Devrait être PascalCase
const maxFileSize = 100;  // ⚠️ Constante devrait être SCREAMING_SNAKE_CASE
</script>
```

---

### Component File Naming

✅ **DO** : Utiliser PascalCase pour les noms de fichiers de composants.

```
components/
├── UserProfile.vue        ✅ GOOD
├── FileItem.vue           ✅ GOOD
├── UploadModal.vue        ✅ GOOD
├── user-profile.vue       ❌ BAD (kebab-case)
├── fileitem.vue           ❌ BAD (lowercase)
└── upload_modal.vue       ❌ BAD (snake_case)
```

---

## Common Pitfalls

### Pitfall #1 : Oublier `.value` avec ref

```javascript
// ❌ BAD - Oublier .value
const count = ref(0);
console.log(count);  // ⚠️ Affiche { value: 0 }, pas 0

count++;  // ⚠️ Erreur : count est un objet, pas un nombre

// ✅ GOOD - Utiliser .value
const count = ref(0);
console.log(count.value);  // ✅ Affiche 0

count.value++;  // ✅ Fonctionne
```

---

### Pitfall #2 : Destructurer reactive

```javascript
// ❌ BAD - Destructurer reactive (perd la réactivité)
const state = reactive({ count: 0 });
const { count } = state;  // ⚠️ count n'est plus réactif !

count++;  // Pas de mise à jour dans le template

// ✅ GOOD - Utiliser toRefs
import { toRefs } from 'vue';

const state = reactive({ count: 0 });
const { count } = toRefs(state);  // ✅ count est un ref réactif

count.value++;  // ✅ Fonctionne
```

---

### Pitfall #3 : Mutate Props

```vue
<!-- ❌ BAD - Modifier une prop (anti-pattern) -->
<script setup>
const props = defineProps({
  file: Object
});

function renameFile() {
  props.file.name = 'new-name.pdf';  // ⚠️ Mutation de prop (interdit !)
}
</script>

<!-- ✅ GOOD - Emit event pour notifier parent -->
<script setup>
const props = defineProps({
  file: Object
});

const emit = defineEmits(['rename']);

function renameFile() {
  emit('rename', props.file.id, 'new-name.pdf');  // ✅ Parent gère la mutation
}
</script>
```

---

### Pitfall #4 : Memory Leaks (Event Listeners)

```javascript
// ❌ BAD - Pas de cleanup (memory leak)
onMounted(() => {
  window.addEventListener('resize', handleResize);
  // ⚠️ Event listener jamais supprimé !
});

// ✅ GOOD - Cleanup dans onUnmounted
onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);  // ← Cleanup
});
```

---

### Pitfall #5 : Async dans Computed

```javascript
// ❌ BAD - Async dans computed (ne fonctionne pas)
const user = computed(async () => {
  return await fetchUser();  // ⚠️ Retourne Promise, pas User
});

console.log(user.value);  // Promise { <pending> }

// ✅ GOOD - watch + ref pour async
const user = ref(null);

watch(userId, async (newId) => {
  user.value = await fetchUser(newId);
}, { immediate: true });
```

---

## Résumé des Règles d'Or

1. ✅ **Vue 3** : `<script setup>`, `ref`/`reactive`, `computed`, `watch`
2. ✅ **Nuxt 4** : `useState` pour état global, `navigateTo` pour navigation, composables
3. ✅ **Crypto** : IV unique, IndexedDB non-extractable, PBKDF2 310k, cleanup au logout
4. ✅ **State** : Composables > Pinia, encapsulation des mutations
5. ✅ **API** : `credentials: 'include'`, error handling, éviter N+1
6. ✅ **Performance** : Lazy loading, debounce, virtual scrolling, computed caching
7. ✅ **Security** : XSS prevention (sanitize), CSP headers, pas d'eval()
8. ✅ **Testing** : Unit tests (Vitest) + component tests (@vue/test-utils)
9. ✅ **Style** : camelCase variables, PascalCase components, SCREAMING_SNAKE_CASE constants
10. ❌ **Never** : Oublier `.value`, destructurer reactive, mutate props, memory leaks, async computed

---

**Ressources** :
- [Vue 3 Docs](https://vuejs.org/)
- [Nuxt 4 Docs](https://nuxt.com/)
- [VueUse](https://vueuse.org/) - Collection de composables utiles
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/)

**Dernière mise à jour** : 2026-02-11
