<template>
  <div class="page">
		
	</div>
    <main>
        <button @click="get_info">Récupérer mes infos</button>
        
        <div class="div_info_visu">
            <p>Vos informations apparaîtront ici.</p>
            <p>ID Utilisateur: {{ id_user }}</p>
            <p>Nom d'utilisateur: {{ username }}</p>
            <p>Clé publique: {{ public_key }}</p>
            <p>Clé privée chiffrée: {{ encrypted_private_key }}</p>
            <p>IV: {{ iv }}</p>
            <p>Sel de la clé privée: {{ private_key_salt }}</p>            
        </div>
    </main>
</template> 

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer
definePageMeta({
    headerTitle: 'GZINFO'
})

import {
    getKeyStatus,

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
	background-color: white;
}

* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
	user-select: none;
}

button {
    padding: 10px 15px;
	background-color: #333333;
	color: white;
	border: none;
	border-radius: 4px;
	font-size: 14px;
	font-family: "Montserrat", sans-serif;
	font-weight: 600;
	cursor: pointer;
	margin-top: 5px;
}

</style>
