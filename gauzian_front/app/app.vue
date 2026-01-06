<template>
  <div class="container">
    <h1>Gauzian Secure Client (Zero Knowledge)</h1>

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
      <p>
        <strong>Token JWT :</strong> {{ token ? "✅ Présent" : "❌ Absent" }}
      </p>
      <p><strong>Clé Privée (IndexedDB) :</strong> {{ keyStatus }}</p>

      <div class="button-group">
        <button @click="testProtected" :disabled="!token">
          Test API Protégée
        </button>
        <button @click="checkLocalKey">Vérifier Clé Locale</button>
        <button @click="clearLocalData" class="danger">
          Tout effacer (Logout)
        </button>
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
const DB_VERSION = 2; // Incrémenter si on change la structure
const DB_STORE = "keys";

// STATE
const registerForm = ref({ username: "", email: "", password: "" });
const loginForm = ref({ email: "", password: "" });
const token = ref("");
const response = ref("");
const loading = ref(false);
const keyStatus = ref("❓ Inconnu");

// =============================================================================
// 1. UTILITAIRES (CONVERSION)
// =============================================================================

const buff_to_b64 = (buff) =>
  window.btoa(String.fromCharCode(...new Uint8Array(buff)));
const str_to_buff = (str) => new TextEncoder().encode(str);
const b64_to_buff = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

// Convertit un ArrayBuffer (clé brute) en String PEM
function toPem(buffer, type) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  const b64 = window.btoa(binary);
  const formatted = b64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${type} KEY-----\n${formatted}\n-----END ${type} KEY-----`;
}

// Convertit une String PEM en ArrayBuffer (en retirant les headers)
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN.*?-----/g, "")
    .replace(/-----END.*?-----/g, "")
    .replace(/\s/g, "");
  return b64_to_buff(b64).buffer;
}

// =============================================================================
// 2. GESTION INDEXEDDB (STOCKAGE SÉCURISÉ)
// =============================================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        console.log(`Création du store '${DB_STORE}'`);
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject("Erreur ouverture DB");
  });
}

/**
 * Importe une clé PEM privée, la transforme en CryptoKey non-extractable
 * et la sauvegarde dans IndexedDB.
 */
async function saveKeyToBrowser(pemKey) {
  try {
    const binaryKey = pemToArrayBuffer(pemKey);

    // Import en format "interne" au navigateur (non lisible en JS ensuite)
    const keyObject = await window.crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false, // <--- FALSE = SÉCURITÉ MAXIMALE (Non exportable)
      ["decrypt"]
    );

    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);

    store.put({
      id: "user_private_key",
      key: keyObject,
      expires: Date.now() + 2 * 24 * 60 * 60 * 1000, // Valide 2 jours
    });

    console.log("💾 Clé privée sauvegardée dans IndexedDB.");
    keyStatus.value = "✅ Stockée en local (IndexedDB)";
  } catch (e) {
    console.error("Erreur sauvegarde clé:", e);
    response.value = "Erreur sauvegarde IndexedDB: " + e.message;
  }
}

/**
 * Vérifie si la clé est présente et valide.
 */
async function checkLocalKey() {
  try {
    const db = await openDB();
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const request = store.get("user_private_key");

    request.onsuccess = () => {
      const result = request.result;
      if (result && result.key) {
        if (Date.now() > result.expires) {
          keyStatus.value = "⚠️ Expirée";
        } else {
          keyStatus.value = "✅ Prête à l'emploi";
        }
      } else {
        keyStatus.value = "❌ Aucune clé trouvée";
      }
    };
  } catch (e) {
    keyStatus.value = "❌ Erreur DB";
  }
}

function clearLocalData() {
  token.value = "";
  response.value = "Déconnecté.";

  // Supprimer la DB pour nettoyer proprement
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = () => {
    console.log("DB supprimée");
    keyStatus.value = "❌ Supprimée";
  };
}

// =============================================================================
// 3. CRYPTOGRAPHIE (ACTIONS)
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

// =============================================================================
// 4. API ACTIONS
// =============================================================================

const register = async () => {
  loading.value = true;
  response.value =
    "Génération des clés RSA 4096... (peut prendre qques secondes)";

  try {
    const password = registerForm.value.password;
    const cryptoSubtle = window.crypto.subtle;

    // A. Générer paire RSA
    const { publicKey, privateKey } = await generateBestKeyPair();
    console.log("🔑 Paires de clés générées");

    // B. Sauvegarder la clé privée tout de suite dans le navigateur (pour être connecté)
    await saveKeyToBrowser(privateKey);

    // C. Préparer le chiffrement pour l'envoi au serveur
    const private_key_salt = window.crypto.getRandomValues(new Uint8Array(16));
    const auth_salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // D. Dériver clé AES (Password -> Key)
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

    // E. Chiffrer la clé privée PEM
    const encryptedBuffer = await cryptoSubtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      str_to_buff(privateKey)
    );

    // F. Construire Payload
    const body = {
      username: registerForm.value.username,
      email: registerForm.value.email,
      password: password, // ou hashé si ton back le demande
      public_key: publicKey,
      encrypted_private_key: buff_to_b64(encryptedBuffer),
      private_key_salt: buff_to_b64(private_key_salt),
      iv: buff_to_b64(iv),
    };

    // G. Envoi
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    response.value = JSON.stringify(data, null, 2);
    if (data.token) token.value = data.token;
  } catch (error) {
    console.error(error);
    response.value = `Erreur Register: ${error.message}`;
  } finally {
    loading.value = false;
    checkLocalKey(); // Mettre à jour l'UI
  }
};

const login = async () => {
  loading.value = true;
  response.value = "Connexion...";

  try {
    // A. Login API
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm.value),
    });
    const data = await res.json();

    if (!data.token) throw new Error("Login failed (no token)");
    token.value = data.token;

    // Si le serveur renvoie les infos crypto, on déchiffre
    if (data.encrypted_private_key) {
      response.value = "Token reçu. Déchiffrement de la clé privée...";

      const password = loginForm.value.password;
      const cryptoSubtle = window.crypto.subtle;

      // B. Préparer les buffers depuis la réponse Base64
      const saltBuf = b64_to_buff(data.private_key_salt);
      const ivBuf = b64_to_buff(data.iv);
      const encryptedBuf = b64_to_buff(data.encrypted_private_key);

      // C. Re-dériver la clé AES
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

      // D. Déchiffrer
      const decryptedBuf = await cryptoSubtle.decrypt(
        { name: "AES-GCM", iv: ivBuf },
        aesKey,
        encryptedBuf
      );

      // E. Convertir en String PEM
      const decryptedPem = new TextDecoder().decode(decryptedBuf);

      // F. Sauvegarder dans le navigateur
      await saveKeyToBrowser(decryptedPem);

      response.value = "Login complet : Clé déchiffrée et stockée.";
    } else {
      response.value = "Login OK (Pas de données crypto reçues).";
    }
  } catch (error) {
    console.error(error);
    response.value = `Erreur Login: ${error.message}`;
  } finally {
    loading.value = false;
    checkLocalKey();
  }
};

const testProtected = async () => {
  try {
    const res = await fetch(`${API_URL}/protected`, {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    const data = await res.json();
    response.value = "Protected: " + JSON.stringify(data, null, 2);
  } catch (error) {
    response.value = `Erreur API: ${error.message}`;
  }
};

// Vérifier l'état au chargement
onMounted(() => {
  checkLocalKey();
});
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: "Segoe UI", sans-serif;
}
h1 {
  color: #2c3e50;
  text-align: center;
}
h2 {
  margin-top: 0;
  font-size: 1.2rem;
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
  font-weight: bold;
  transition: background 0.2s;
}
button:hover:not(:disabled) {
  background: #0056b3;
}
button:disabled {
  background: #6c757d;
  cursor: not-allowed;
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
  font-size: 0.85rem;
}
</style>
