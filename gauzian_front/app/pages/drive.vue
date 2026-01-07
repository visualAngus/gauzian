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
                return;
            }
            // redirect to /
            window.location.href = "/";
        }
    } catch (error) {
        console.error("Auto-login failed:", error);
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

header {
	padding: 25px 35px;
	height: 88px;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

h1 {
	color: #333333;
	font-family: "Montserrat", sans-serif;
	font-optical-sizing: auto;
	font-weight: 800;
	font-style: normal;
}

.div_menu {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 5px;
}

.div_menu svg {
	width: 24px;
	height: 24px;
	fill: #333333;
	cursor: pointer;
}

.div_menu a {
	text-decoration: none;
	width: 50px;
	height: 50px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.div_menu a:hover {
	background-color: #eeeeee;
}

.a_account {
	width: 50px;
	height: 50px;
	border-radius: 50%;
	background-color: #cccccc;
	display: flex;
	align-items: center;
	justify-content: center;
	text-decoration: none;
	overflow: hidden;
	margin-left: 15px;
}

.a_account img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

@media (max-width: 600px) {
	header {
		padding: 15px 20px;
		height: 70px;
	}

	h1 {
		font-size: 25px;
	}

	.a_menu {
		display: none !important;
	}

	.a_account {
		width: 40px;
		height: 40px;
		margin-left: 10px;
	}
}

main {
	width: 100vw;
	min-height: 200px;
	height: calc(100vh - 88px);
	display: flex;
	flex-direction: row;
}

section {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 30px 20px;
}

/* Conteneur principal */
.div_input_all {
	width: 100%;
	max-width: 400px;
	transform: translateY(-15%);
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	padding: 25px 20px;
}

/* Bloc contenant Titre + Form pour l'animation groupée */
.auth-block {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
}

section h2 {
	font-family: "Montserrat", sans-serif;
	font-weight: 700;
	font-size: 22px;
	color: #333333;
	padding: 15px 20px;
	text-align: center;
}

section form {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 15px;
}

/* Style de l'input avec icône intégrée */
.input-with-icon {
	position: relative;
	width: 100%;
}

.input-with-icon input {
	width: 100%;
	padding-right: 40px; /* Espace pour ne pas écrire sous l'icône */
}

.icon-btn {
	position: absolute;
	right: 10px;
	top: 50%;
	transform: translateY(-50%);
	background: none;
	border: none;
	cursor: pointer;
	padding: 5px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #666;
}

.icon-btn:hover {
	color: #333;
}

.icon-btn .icon {
	width: 20px;
	height: 20px;
}

/* Transition douce */
.auth-enter-active,
.auth-leave-active {
	transition: opacity 250ms ease, transform 250ms ease;
}

.auth-enter-from,
.auth-leave-to {
	opacity: 0;
	transform: translateY(10px);
}

section form label {
	font-family: "Montserrat", sans-serif;
	font-size: 14px;
	color: #333333;
	margin-bottom: 5px;
}

section form input {
	padding: 10px 15px;
	border: 1px solid #cccccc;
	border-radius: 4px;
	font-size: 14px;
	font-family: "Montserrat", sans-serif;
}

section form input:focus {
	outline: none;
	border-color: #333333;
}

section form button[type="submit"], 
section form button[type="button"] {
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

section form button[type="button"] {
    background-color: transparent;
    color: #333;
    text-decoration: underline;
    font-weight: 500;
    margin-top: 0;
}

section form button[type="submit"]:hover {
	background-color: #555555;
}

section form button[type="button"]:hover {
    color: #000;
}

button:disabled {
	background-color: #aaaaaa;
	cursor: not-allowed;
}
</style>