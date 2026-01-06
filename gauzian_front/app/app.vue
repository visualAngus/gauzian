<template>
  <div class="container">
    <h1>Gauzian Secure Client (Cookie Auth)</h1>

    <!-- SECTION 1 : REGISTER -->
    <div class="section">
      <h2>1. Inscription (Génération de clés)</h2>
      <form @submit.prevent="register">
        <input
          v-model="registerForm.username"
          placeholder="Username"
          required
        />
        <input
          v-model="registerForm.email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          v-model="registerForm.password"
          type="password"
          placeholder="Password"
          required
        />
        <button type="submit" :disabled="loading">
          {{ loading ? "Traitement..." : "S'inscrire & Générer Clés" }}
        </button>
      </form>
    </div>

    <!-- SECTION 2 : LOGIN -->
    <div class="section">
      <h2>2. Connexion (Récupération de clés)</h2>
      <form @submit.prevent="login">
        <input
          v-model="loginForm.email"
          type="email"
          placeholder="Email"
          required
        />
        <input
          v-model="loginForm.password"
          type="password"
          placeholder="Password"
          required
        />
        <button type="submit" :disabled="loading">
          {{ loading ? "Déchiffrement..." : "Se connecter" }}
        </button>
      </form>
    </div>

    <!-- SECTION 3 : ÉTAT -->
    <div class="section status-box">
      <h3>État du client</h3>
      <!-- On ne peut plus afficher l'état du token, on affiche l'état de la clé locale -->
      <p><strong>Clé Privée (IndexedDB) :</strong> {{ keyStatus }}</p>

      <div class="button-group">
        <button @click="testProtected">Test API Protégée (via Cookie)</button>
        <button @click="checkLocalKey">Vérifier Clé Locale</button>
        <button @click="logout" class="danger">Se Déconnecter (Logout)</button>
      </div>
    </div>

    <!-- SECTION 4 : LOGS -->
    <div v-if="response" class="section">
      <h3>Logs / Réponse Serveur</h3>
      <pre>{{ response }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

// CONFIGURATION
const API_URL = "https://gauzian.pupin.fr/api";
const DB_NAME = "GauzianSecureDB";
const DB_VERSION = 2;
const DB_STORE = "keys";

// STATE
const registerForm = ref({ username: "", email: "", password: "" });
const loginForm = ref({ email: "", password: "" });
const response = ref("");
const loading = ref(false);
const keyStatus = ref("❓ Inconnu");

// =============================================================================
// 1. UTILITAIRES & INDEXEDDB (Inchangés mais nécessaires)
// =============================================================================

const buff_to_b64 = (buff) =>
  window.btoa(String.fromCharCode(...new Uint8Array(buff)));
const str_to_buff = (str) => new TextEncoder().encode(str);
const b64_to_buff = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

function toPem(buffer, type) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  const b64 = window.btoa(binary);
  const formatted = b64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${type} KEY-----\n${formatted}\n-----END ${type} KEY-----`;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN.*?-----/g, "")
    .replace(/-----END.*?-----/g, "")
    .replace(/\s/g, "");
  return b64_to_buff(b64).buffer;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE))
        db.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject("Erreur ouverture DB");
  });
}

async function saveKeyToBrowser(pemKey, publicKey) {
  try {
    const binaryKey = pemToArrayBuffer(pemKey);
    const binaryPubKey = pemToArrayBuffer(publicKey);

    const keyObject = await window.crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );

    const pubKeyObject = await window.crypto.subtle.importKey(
      "spki",
      binaryPubKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put({
      id: "user_private_key",
      key: keyObject,
      expires: Date.now() + 10 * 24 * 60 * 60 * 1000, // 10 jours
    });
    tx.objectStore(DB_STORE).put({
      id: "user_public_key",
      key: pubKeyObject,
    });
    keyStatus.value = "✅ Stockée en local (IndexedDB)";
  } catch (e) {
    console.error(e);
    response.value = "Erreur IndexedDB: " + e.message;
  }
}

async function checkLocalKey() {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get("user_private_key");
    request.onsuccess = () => {
      const res = request.result;
      if (res && res.key) {
        keyStatus.value = Date.now() > res.expires ? "⚠️ Expirée" : "✅ Prête";
      } else {
        keyStatus.value = "❌ Aucune clé";
      }
    };
  } catch (e) {
    keyStatus.value = "❌ Erreur DB";
  }

  console.log("=== TEST CRYPTOGRAPHIE ===");
  let test = await encryptWithPublicKey("Test Message");
  console.log("Encrypted Test:", test);
  let decrypted = await decryptWithPrivateKey(test);
  console.log("Decrypted Test:", decrypted);
  
}

async function getPublicKeyFromDB() {
  const db = await openDB();
  const tx = db.transaction(DB_STORE, "readonly");
  const request = tx.objectStore(DB_STORE).get("user_public_key");
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const res = request.result;
      if (res && res.key) {
        resolve(res.key);
      } else {
        reject("No public key found");
      }
    };
    request.onerror = () => reject("Error retrieving public key");
  });
}


async function encryptWithPublicKey(data){
  const publicKey =  await getPublicKeyFromDB();
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP"
    },
    publicKey,
    encodedData
  );
  return buff_to_b64(encryptedData);
}

async function decryptWithPrivateKey(data){
  const b64Data = data;
  const db = await openDB();
  const tx = db.transaction(DB_STORE, "readonly");
  const request = tx.objectStore(DB_STORE).get("user_private_key");
  return new Promise((resolve, reject) => {
    request.onsuccess = async () => {
      const res = request.result;
      if (res && res.key) {
        const encryptedData = b64_to_buff(b64Data);
        try {
          const decryptedData = await window.crypto.subtle.decrypt(
            {
              name: "RSA-OAEP"
            },
            res.key,
            encryptedData
          );
          const decoder = new TextDecoder();
          resolve(decoder.decode(decryptedData));
        } catch (e) {
          reject("Decryption failed: " + e.message);
        }
      } else {
        reject("No private key found");
      }
    };
    request.onerror = () => reject("Error retrieving private key");
  });
}

// =============================================================================
// 2. CRYPTO & API
// =============================================================================

async function generateBestKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  const pubBuf = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  const privBuf = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );
  return {
    publicKey: toPem(pubBuf, "PUBLIC"),
    privateKey: toPem(privBuf, "PRIVATE"),
  };
}

const register = async () => {
  loading.value = true;
  response.value = "Génération des clés RSA 4096...";

  try {
    const password = registerForm.value.password;
    const cryptoSubtle = window.crypto.subtle;

    // A. Générer & Sauvegarder Localement
    const { publicKey, privateKey } = await generateBestKeyPair();
    await saveKeyToBrowser(privateKey, publicKey);

    // B. Chiffrer pour le serveur
    const private_key_salt = window.crypto.getRandomValues(new Uint8Array(16));
    const auth_salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const passwordKey = await cryptoSubtle.importKey(
      "raw",
      str_to_buff(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const aesKey = await cryptoSubtle.deriveKey(
      {
        name: "PBKDF2",
        salt: private_key_salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    const encryptedBuffer = await cryptoSubtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      str_to_buff(privateKey)
    );

    // C. Envoi (Le cookie sera set automatiquement par le serveur en réponse)
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: registerForm.value.username,
        email: registerForm.value.email,
        password: password,
        public_key: publicKey,
        encrypted_private_key: buff_to_b64(encryptedBuffer),
        private_key_salt: buff_to_b64(private_key_salt),
        iv: buff_to_b64(iv),
      }),
    });

    const data = await res.json();
    response.value = JSON.stringify(data, null, 2);
  } catch (error) {
    response.value = `Erreur Register: ${error.message}`;
  } finally {
    loading.value = false;
    checkLocalKey();
  }
};

const login = async () => {
  loading.value = true;
  response.value = "Connexion...";

  try {
    // A. Login API (Le navigateur stocke le cookie HttpOnly automatiquement si 200 OK)
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm.value),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Login failed");

    // B. Gestion Crypto (Si présente)
    if (data.encrypted_private_key) {
      response.value = "Cookie reçu. Déchiffrement clé privée...";
      const password = loginForm.value.password;
      const cryptoSubtle = window.crypto.subtle;

      const saltBuf = b64_to_buff(data.private_key_salt);
      const ivBuf = b64_to_buff(data.iv);
      const encryptedBuf = b64_to_buff(data.encrypted_private_key);

      const passwordKey = await cryptoSubtle.importKey(
        "raw",
        str_to_buff(password),
        "PBKDF2",
        false,
        ["deriveKey"]
      );
      const aesKey = await cryptoSubtle.deriveKey(
        { name: "PBKDF2", salt: saltBuf, iterations: 100000, hash: "SHA-256" },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const decryptedBuf = await cryptoSubtle.decrypt(
        { name: "AES-GCM", iv: ivBuf },
        aesKey,
        encryptedBuf
      );
      await saveKeyToBrowser(new TextDecoder().decode(decryptedBuf), data.public_key);
      response.value = "Login complet : Cookie OK + Clé OK.";
    } else {
      response.value = "Login OK (Pas de crypto).";
    }
  } catch (error) {
    response.value = `Erreur Login: ${error.message}`;
  } finally {
    loading.value = false;
    checkLocalKey();
  }
};

const testProtected = async () => {
  try {
    // Pas de header Authorization ici ! Le cookie part tout seul.
    const res = await fetch(`${API_URL}/protected`);
    if (res.status === 401) {
      response.value = "Erreur 401: Non autorisé (Cookie manquant ou invalide)";
      return;
    }
    const data = await res.json();
    response.value = "Protected: " + JSON.stringify(data, null, 2);
  } catch (error) {
    response.value = `Erreur API: ${error.message}`;
  }
};

const logout = async () => {
  try {
    // 1. Appel au backend pour qu'il supprime le cookie HttpOnly
    await fetch(`${API_URL}/logout`, { method: "POST" });

    // 2. Nettoyage local (IndexedDB)
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => {
      keyStatus.value = "❌ Supprimée";
      response.value = "Déconnecté (Cookie effacé + DB locale nettoyée).";
    };
  } catch (e) {
    response.value = "Erreur logout: " + e.message;
  }
};

onMounted(() => checkLocalKey());
</script>

<style scoped>
/* Même CSS qu'avant */
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: "Segoe UI", sans-serif;
}
.section {
  background: #f8f9fa;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}
.status-box {
  background: #e8f4fd;
  border-color: #b6e0fe;
}
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
input {
  padding: 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}
button {
  padding: 12px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover:not(:disabled) {
  background: #0056b3;
}
button:disabled {
  background: #6c757d;
}
button.danger {
  background: #dc3545;
}
button.danger:hover {
  background: #a71d2a;
}
.button-group {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
pre {
  background: #343a40;
  color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
}
</style>
