<template>
<div class="info-container">
    <h1 class="info-title">Mes informations</h1>
    <button class="info-btn" @click="get_info">Récupérer mes infos</button>
    <transition name="fade-slide">
        <div class="info-card" v-if="id_user || username || public_key || encrypted_private_key || iv || private_key_salt">
            <div class="info-row">
                <span class="info-label"><i class="fa-solid fa-id-badge"></i> ID Utilisateur :</span>
                <span class="info-value">{{ id_user }}</span>
            </div>
            <div class="info-row">
                <span class="info-label"><i class="fa-solid fa-user"></i> Nom d'utilisateur :</span>
                <span class="info-value">{{ username }}</span>
            </div>
            <div class="info-row">
                <span class="info-label"><i class="fa-solid fa-key"></i> Clé publique :</span>
                <span class="info-value info-mono scrollable">{{ public_key }}</span>
            </div>
            <div class="info-row">
                <span class="info-label"><i class="fa-solid fa-lock"></i> Clé privée chiffrée :</span>
                <span class="info-value info-mono scrollable">{{ encrypted_private_key }}</span>
            </div>
            <div class="info-row">
                <span class="info-label"><i class="fa-solid fa-fingerprint"></i> IV :</span>
                <span class="info-value info-mono">{{ iv }}</span>
            </div>
            <div class="info-row">
                <span class="info-label"><i class="fa-solid fa-salt-shaker"></i> Sel de la clé privée :</span>
                <span class="info-value info-mono">{{ private_key_salt }}</span>
            </div>
        </div>
        <div v-else class="info-placeholder">
            <i class="fa-regular fa-circle-question"></i>
            <span>Vos informations apparaîtront ici.</span>
        </div>
    </transition>
</div>
<div class="info-container">
    <h1 class="info-title">Sécuriser une information</h1>
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
<div>
    <h1 class="info-title">Gestion de la clé de récupération</h1>
    <button class="info-btn" @click="generaterecoverykey">Générer une clé de récupération</button>
    
    <div v-if="encrypted_private_key_reco && recovery_key" class="info-card">
        <div class="info-row">
            <span class="info-label"><i class="fa-solid fa-lock"></i> Clé privée chiffrée :</span>
            <span class="info-value info-mono scrollable">{{ encrypted_private_key_reco }}</span>
        </div>
        <div class="info-row">
            <span class="info-label"><i class="fa-solid fa-key"></i> Clé de récupération (à conserver) :</span>
            <span class="info-value info-mono scrollable">{{ recovery_key }}</span>
        </div>
    </div>

    <button class="info-btn" @click="decryptrecoverykey(encrypted_private_key_reco, recovery_key)">Déchiffrer la clé de récupération</button>
</div>

</template> 

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer
import { useFetchWithAuth } from '~/composables/useFetchWithAuth';
import { useAuth } from '~/composables/useAuth';

definePageMeta({
    headerTitle: 'GZINFO'
})

import {
    getKeyStatus,
    encryptWithStoredPublicKey,
    decryptWithStoredPrivateKey,
    generateRecordKey,
    decryptRecordKey,
    generateRsaKeyPairPem,

} from "~/utils/crypto";

// Configuration dynamique de l'API URL (Clever Cloud, K8s, local)
const API_URL = useApiUrl();
const { fetchWithAuth } = useFetchWithAuth();
const { validateSession } = useAuth();

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

const encrypted_private_key_reco = ref("");
const recovery_key = ref("");


// Session vérifiée par middleware auth.global.js (plus besoin de checkSession)

const encryptSecret = async () => {
    if (!secretInput.value) {
        alert("Veuillez entrer une information secrète à chiffrer.");
        return;
    }
    try {
        encryptedSecret.value = await encryptWithStoredPublicKey(secretInput.value);
        // SECURITY: Ne pas logger les données chiffrées/déchiffrées
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
        // SECURITY: Ne pas logger les données chiffrées/déchiffrées
    } catch (error) {
        console.error("Erreur lors du déchiffrement de l'information :", error);
    }
};

const get_info = async () => {
    console.log("Fetching info...");
    try {
        const res = await fetchWithAuth('/info', {
            method: "GET",
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

const generaterecoverykey = async () => {
    const { publicKey, privateKey } = await generateRsaKeyPairPem();
    if (!privateKey) {
        console.error("Failed to generate private key PEM.");
        return;
    }
    // SECURITY: Ne jamais logger les clés privées
    const result = await generateRecordKey(privateKey);

    // Store the values in refs for later use
    encrypted_private_key_reco.value = result.encrypted_private_key_reco;
    recovery_key.value = result.recovery_key;
};

const decryptrecoverykey = async (encrypted_private_key_reco, recovery_key) => {
    try {
        const decrypted_private_key = await decryptRecordKey(encrypted_private_key_reco, recovery_key);
        // SECURITY: Ne jamais logger les clés privées déchiffrées
    } catch (error) {
        console.error("Error decrypting recovery key:", error);
    }
};
    


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
    background: linear-gradient(120deg, #f7f8fa 60%, #e0e7ef 100%);
}

input[type="text"] {
    width: 90%;
    padding: 12px 16px;
    margin-bottom: 16px;
    border: 2px solid #cbd5e1;
    border-radius: 8px;
    font-size: 1rem;
    font-family: "Montserrat", sans-serif;
    transition: border-color 0.2s;
}
input[type="text"]:focus {
    border-color: #3b82f6;
    outline: none;
}

.info-container {
    max-width: 700px;
    margin: 40px auto 0 auto;
    padding: 32px 24px;
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 4px 24px 0 rgba(0,0,0,0.10);
    font-family: "Montserrat", sans-serif;
    animation: fadeIn 0.7s cubic-bezier(.4,0,.2,1);
}

.info-title {
    text-align: center;
    font-size: 2.2rem;
    font-weight: 800;
    margin-bottom: 24px;
    color: #1e293b;
    letter-spacing: 1px;
    text-shadow: 0 2px 8px rgba(59,130,246,0.07);
}

.info-btn {
    display: block;
    margin: 0 auto 28px auto;
    padding: 13px 32px;
    background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 1.08rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 12px 0 rgba(59,130,246,0.10);
    transition: background 0.2s, transform 0.15s;
    letter-spacing: 0.5px;
}
.info-btn:hover {
    background: linear-gradient(90deg, #2563eb 0%, #0891b2 100%);
    transform: translateY(-2px) scale(1.03);
}

.info-card {
    background: #f1f5f9;
    border-radius: 16px;
    padding: 28px 22px;
    box-shadow: 0 4px 18px 0 rgba(59,130,246,0.07);
    transition: box-shadow 0.2s, transform 0.2s;
    margin-top: 10px;
    animation: fadeInUp 0.7s cubic-bezier(.4,0,.2,1);
}
.info-card:hover {
    box-shadow: 0 8px 32px 0 rgba(59,130,246,0.13);
    transform: translateY(-2px) scale(1.01);
}

.info-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    margin-bottom: 20px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 10px;
    gap: 8px;
}
.info-row:last-child {
    border-bottom: none;
}
.info-label {
    min-width: 200px;
    font-weight: 700;
    color: #2563eb;
    font-size: 1.08rem;
    margin-right: 10px;
    display: flex;
    align-items: center;
    gap: 7px;
}
.info-value {
    color: #222;
    font-size: 1.08rem;
    word-break: break-all;
    flex: 1;
    background: none;
    padding: 0;
}
.info-mono {
    font-family: "Fira Mono", "Consolas", "Menlo", monospace;
    font-size: 0.99rem;
    background: #e0e7ef;
    border-radius: 4px;
    padding: 2px 8px;
    margin-top: 2px;
    line-height: 1.5;
}
.scrollable {
    max-height: 90px;
    overflow-y: auto;
    display: block;
    white-space: pre-line;
}

.info-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 1.1rem;
    background: #f1f5f9;
    border-radius: 14px;
    padding: 40px 0 30px 0;
    margin-top: 18px;
    gap: 10px;
}
.info-placeholder i {
    font-size: 2.2rem;
    color: #3b82f6;
    margin-bottom: 6px;
}

/* Animations */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: none; }
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: none; }
}
.fade-slide-enter-active, .fade-slide-leave-active {
    transition: opacity 0.5s, transform 0.5s;
}
.fade-slide-enter-from, .fade-slide-leave-to {
    opacity: 0;
    transform: translateY(30px);
}
.fade-slide-enter-to, .fade-slide-leave-from {
    opacity: 1;
    transform: none;
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

/* FontAwesome CDN (à ajouter dans le head si pas déjà présent) */

</style>
