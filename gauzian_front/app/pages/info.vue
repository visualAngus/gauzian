<template>
<div class="info-container">
    <h1 class="info-title">Mes informations</h1>
    <button class="info-btn" @click="get_info">Récupérer mes infos</button>
    <div class="info-card">
        <div class="info-row">
            <span class="info-label">ID Utilisateur :</span>
            <span class="info-value">{{ id_user }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Nom d'utilisateur :</span>
            <span class="info-value">{{ username }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Clé publique :</span>
            <span class="info-value info-mono">{{ public_key }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Clé privée chiffrée :</span>
            <span class="info-value info-mono">{{ encrypted_private_key }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">IV :</span>
            <span class="info-value info-mono">{{ iv }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Sel de la clé privée :</span>
            <span class="info-value info-mono">{{ private_key_salt }}</span>
        </div>
    </div>
</div>
<div class="info-container">
    <h1 class="info-title">Sécurisé une information</h1>
    <input v-model="secretInput" type="text" placeholder="Entrez une information secrète" />
    <button class="info-btn" @click="encryptSecret">Chiffrer</button>
    <div v-if="encryptedSecret" class="info-card">
        <div class="info-row">
            <span class="info-label">Information chiffrée :</span>
            <span class="info-value info-mono">{{ encryptedSecret }}</span> 
        </div>
    </div>

    <button class="info-btn" @click="decryptSecret">Déchiffrer</button>
    <div v-if="decryptedSecret" class="info-card">
        <div class="info-row">
            <span class="info-label">Information déchiffrée :</span>
            <span class="info-value info-mono">{{ decryptedSecret }}</span>
        </div>
    </div>

</div>
</template> 

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer
definePageMeta({
    headerTitle: 'GZINFO'
})

import {
    getKeyStatus,
    encryptWithStoredPublicKey,
    decryptWithStoredPrivateKey,

} from "~/utils/crypto";

const API_URL = "https://gauzian.pupin.fr/api";

const etat = ref("login");
const loading = ref(false);


const id_user = ref(null);
const username = ref(null);
const public_key = ref(null);
const encrypted_private_key = ref(null);
const iv = ref(null);
const private_key_salt = ref(null);
const secretInput = ref("");
const encryptedSecret = ref("");
const decryptedSecret = ref("");


const autologin = async () => {
    console.log("Attempting auto-login...");
    try {
        const res = await fetch(`${API_URL}/autologin`, {
            method: "GET",
            credentials: "include",
        });
        if (res.ok) {

            let is_ok = await getKeyStatus();
            if (!is_ok) {
                console.warn("Keys not found or invalid in IndexedDB during auto-login.");
                window.location.href = "/login";
            }
            // redirect to /
        }else {
            console.log("No valid session found for auto-login.");
            window.location.href = "/login";
        }
    } catch (error) {
        console.error("Auto-login failed:", error);
        // window.location.href = "/login";
    }
};

const encryptSecret = async () => {
    if (!secretInput.value) {
        alert("Veuillez entrer une information secrète à chiffrer.");
        return;
    }
    try {
        encryptedSecret.value = await encryptWithStoredPublicKey(secretInput.value);
        console.log("Information chiffrée :", encryptedSecret.value);
    } catch (error) {
        console.error("Erreur lors du chiffrement de l'information :", error);
    }
};

const decryptSecret = async () => {
    if (!encryptedSecret.value) {
        alert("Veuillez chiffrer une information avant de la déchiffrer.");
        return;
    }
    try {
        decryptedSecret.value = await decryptWithStoredPrivateKey(encryptedSecret.value);
        console.log("Information déchiffrée :", decryptedSecret.value);
    } catch (error) {
        console.error("Erreur lors du déchiffrement de l'information :", error);
    }
};

const get_info = async () => {
    console.log("Fetching info...");
    try {
        const res = await fetch(`${API_URL}/info`, {
            method: "GET",
            credentials: "include",
        });
        if (res.ok) {
            const data = await res.json();
            id_user.value = data.id;
            username.value = data.username;
            public_key.value = data.public_key;
            encrypted_private_key.value = data.encrypted_private_key;
            iv.value = data.iv;
            private_key_salt.value = data.private_key_salt;
            console.log("Info fetched successfully:", data);
        } else {
            console.log("Failed to fetch info.");
        }
    } catch (error) {
        console.error("Fetching info failed:", error);
    }
};


autologin();

useHead({
	title: "GZINFO | Info",
	link: [
		{ rel: "preconnect", href: "https://fonts.googleapis.com" },
		{ rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
		{
			rel: "stylesheet",
			href:
				"https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
		},
	],
});
</script>


<style>

body {
    background: #f7f8fa;
}

.info-container {
    max-width: 700px;
    margin: 40px auto 0 auto;
    padding: 32px 24px;
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 4px 24px 0 rgba(0,0,0,0.08);
    font-family: "Montserrat", sans-serif;
}

.info-title {
    text-align: center;
    font-size: 2.2rem;
    font-weight: 700;
    margin-bottom: 24px;
    color: #222;
    letter-spacing: 1px;
}

.info-btn {
    display: block;
    margin: 0 auto 28px auto;
    padding: 12px 28px;
    background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px 0 rgba(59,130,246,0.08);
    transition: background 0.2s;
}
.info-btn:hover {
    background: linear-gradient(90deg, #2563eb 0%, #0891b2 100%);
}

.info-card {
    background: #f1f5f9;
    border-radius: 12px;
    padding: 24px 18px;
    box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
}

.info-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    margin-bottom: 18px;
}
.info-label {
    min-width: 180px;
    font-weight: 600;
    color: #374151;
    font-size: 1.05rem;
    margin-right: 10px;
}
.info-value {
    color: #222;
    font-size: 1.05rem;
    word-break: break-all;
    flex: 1;
}
.info-mono {
    font-family: "Fira Mono", "Consolas", "Menlo", monospace;
    font-size: 0.98rem;
    background: #e0e7ef;
    border-radius: 4px;
    padding: 2px 6px;
    margin-top: 2px;
}

@media (max-width: 600px) {
    .info-container {
        padding: 12px 2vw;
    }
    .info-label {
        min-width: 120px;
        font-size: 0.98rem;
    }
    .info-title {
        font-size: 1.3rem;
    }
    .info-card {
        padding: 10px 4px;
    }
}

</style>
