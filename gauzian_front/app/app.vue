<template>
  <div class="container">
    <h1>Test API Gauzian (Client-Side Crypto)</h1>

    <div class="section">
      <h2>Register</h2>
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
          {{ loading ? "Génération des clés..." : "Register" }}
        </button>
      </form>
    </div>

    <div class="section">
      <h2>Login</h2>
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
        <button type="submit" :disabled="loading">Login</button>
      </form>
    </div>

    <div v-if="token" class="section">
      <h2>Token</h2>
      <p class="token-display">{{ token }}</p>
      <button @click="testProtected">Test Protected Route</button>
    </div>

    <div v-if="response" class="section">
      <h2>Response</h2>
      <pre>{{ response }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const API_URL = "https://gauzian.pupin.fr/api";

const registerForm = ref({ username: "", email: "", password: "" });
const loginForm = ref({ email: "", password: "" });
const token = ref("");
const response = ref("");
const loading = ref(false);

// --- UTILITAIRES CRYPTO ---

const buff_to_b64 = (buff) =>
  window.btoa(String.fromCharCode(...new Uint8Array(buff)));
const str_to_buff = (str) => new TextEncoder().encode(str);

function toPem(buffer, type) {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  const b64 = window.btoa(binary);
  const formatted = b64.match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${type} KEY-----\n${formatted}\n-----END ${type} KEY-----`;
}

// --- GÉNÉRATION RSA ---

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

  const publicKeyBuffer = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  const privateKeyBuffer = await window.crypto.subtle.exportKey(
    "pkcs8",
    keyPair.privateKey
  );

  return {
    publicKey: toPem(publicKeyBuffer, "PUBLIC"),
    privateKey: toPem(privateKeyBuffer, "PRIVATE"),
  };
}

// --- ACTIONS ---

const register = async () => {
  loading.value = true;
  response.value =
    "Génération des clés RSA 4096 bits et chiffrement AES... Patientez...";

  try {
    const password = registerForm.value.password;

    // 1. Générer la paire RSA
    const { publicKey, privateKey } = await generateBestKeyPair();
    console.log("Clés générées.");

    // 2. Préparer les ingrédients aléatoires (Salts et IV)
    const cryptoSubtle = window.crypto.subtle;
    const private_key_salt = window.crypto.getRandomValues(new Uint8Array(16)); // Pour chiffrer la clé privée
    const auth_salt = window.crypto.getRandomValues(new Uint8Array(16)); // Pour hacher le mdp auth (si requis par ton back)
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Pour AES-GCM

    // 3. Dériver la clé AES à partir du mot de passe (PBKDF2)
    // Import du mot de passe en tant que clé brute
    const passwordKey = await cryptoSubtle.importKey(
      "raw",
      str_to_buff(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    // Dérivation
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

    // 4. Chiffrer la Clé Privée (PEM)
    const encryptedBuffer = await cryptoSubtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      str_to_buff(privateKey)
    );
    

    // 6. Envoi au serveur
    let body = {
      username: registerForm.value.username,
      email: registerForm.value.email,

      // Auth data
      password: registerForm.value.password, // Le MDP en clair


      // Crypto data
      public_key: publicKey,
      encrypted_private_key: buff_to_b64(encryptedBuffer),
      private_key_salt: buff_to_b64(private_key_salt), // Nécessaire pour déchiffrer plus tard
      iv: buff_to_b64(iv), // Nécessaire pour déchiffrer plus tard
    };

    console.log("Envoi du payload:", body);

    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    response.value = JSON.stringify(data, null, 2);

    if (data.token) {
      token.value = data.token;
    }
  } catch (error) {
    console.error(error);
    response.value = `Error: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

const login = async () => {
  loading.value = true;
  try {
    // Note: Pour le login, tu devras probablement refaire le hash
    // avec le auth_salt stocké en base si tu utilises le hachage client-side.
    // Ici c'est un login simple.
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm.value),
    });
    const data = await res.json();
    response.value = JSON.stringify(data, null, 2);
    if (data.token) {
      token.value = data.token;
    }
  } catch (error) {
    response.value = `Error: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

const testProtected = async () => {
  try {
    const res = await fetch(`${API_URL}/protected`, {
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
    });
    const data = await res.json();
    response.value = JSON.stringify(data, null, 2);
  } catch (error) {
    response.value = `Error: ${error.message}`;
  }
};
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}
h1 {
  color: #2c3e50;
  margin-bottom: 30px;
}
.section {
  background: #f5f5f5;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
button {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}
button:hover:not(:disabled) {
  background: #2980b9;
}
pre {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
}
.token-display {
  word-break: break-all;
  font-family: monospace;
  background: #fff;
  padding: 10px;
  border: 1px solid #ddd;
}
</style>
