<template>
	<div class="page">
		
	</div>
    <main>

    </main>
</template>

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer

import {
    getKeyStatus,

} from "~/utils/crypto";

const API_URL = "https://gauzian.pupin.fr/api";

const etat = ref("login");
const loading = ref(false);


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

autologin();

useHead({
	title: "GZDRIVE | Drive",
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

</style>