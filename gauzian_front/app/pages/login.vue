<template>
	<div class="page">
		<header>
			<h1>GZAUTH</h1>
			<div class="div_menu" style="display: none;">
				<a class="a_menu" href="a_propos.html">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 6C12.8284 6 13.5 5.32843 13.5 4.5C13.5 3.67157 12.8284 3 12 3C11.1716 3 10.5 3.67157 10.5 4.5C10.5 5.32843 11.1716 6 12 6ZM9 10H11V18H9V20H15V18H13V8H9V10Z"></path>
					</svg>
				</a>
				<a class="a_menu" href="parametres.html">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
						<path d="M3.33946 17.0002C2.90721 16.2515 2.58277 15.4702 2.36133 14.6741C3.3338 14.1779 3.99972 13.1668 3.99972 12.0002C3.99972 10.8345 3.3348 9.824 2.36353 9.32741C2.81025 7.71651 3.65857 6.21627 4.86474 4.99001C5.7807 5.58416 6.98935 5.65534 7.99972 5.072C9.01009 4.48866 9.55277 3.40635 9.4962 2.31604C11.1613 1.8846 12.8847 1.90004 14.5031 2.31862C14.4475 3.40806 14.9901 4.48912 15.9997 5.072C17.0101 5.65532 18.2187 5.58416 19.1346 4.99007C19.7133 5.57986 20.2277 6.25151 20.66 7.00021C21.0922 7.7489 21.4167 8.53025 21.6381 9.32628C20.6656 9.82247 19.9997 10.8336 19.9997 12.0002C19.9997 13.166 20.6646 14.1764 21.6359 14.673C21.1892 16.2839 20.3409 17.7841 19.1347 19.0104C18.2187 18.4163 17.0101 18.3451 15.9997 18.9284C14.9893 19.5117 14.4467 20.5941 14.5032 21.6844C12.8382 22.1158 11.1148 22.1004 9.49633 21.6818C9.55191 20.5923 9.00929 19.5113 7.99972 18.9284C6.98938 18.3451 5.78079 18.4162 4.86484 19.0103C4.28617 18.4205 3.77172 17.7489 3.33946 17.0002ZM8.99972 17.1964C10.0911 17.8265 10.8749 18.8227 11.2503 19.9659C11.7486 20.0133 12.2502 20.014 12.7486 19.9675C13.1238 18.8237 13.9078 17.8268 14.9997 17.1964C16.0916 16.5659 17.347 16.3855 18.5252 16.6324C18.8146 16.224 19.0648 15.7892 19.2729 15.334C18.4706 14.4373 17.9997 13.2604 17.9997 12.0002C17.9997 10.74 18.4706 9.5632 19.2729 8.6665C19.1688 8.4405 19.0538 8.21822 18.9279 8.00021C18.802 7.78219 18.667 7.57148 18.5233 7.36842C17.3457 7.61476 16.0911 7.43414 14.9997 6.80405C13.9083 6.17395 13.1246 5.17768 12.7491 4.03455C12.2509 3.98714 11.7492 3.98646 11.2509 4.03292C10.8756 5.17671 10.0916 6.17364 8.99972 6.80405C7.9078 7.43447 6.65245 7.61494 5.47428 7.36803C5.18485 7.77641 4.93463 8.21117 4.72656 8.66637C5.52881 9.56311 5.99972 10.74 5.99972 12.0002C5.99972 13.2604 5.52883 14.4372 4.72656 15.3339C4.83067 15.5599 4.94564 15.7822 5.07152 16.0002C5.19739 16.2182 5.3324 16.4289 5.47612 16.632C6.65377 16.3857 7.90838 16.5663 8.99972 17.1964ZM11.9997 15.0002C10.3429 15.0002 8.99972 13.6571 8.99972 12.0002C8.99972 10.3434 10.3429 9.00021 11.9997 9.00021C13.6566 9.00021 14.9997 10.3434 14.9997 12.0002C14.9997 13.6571 13.6566 15.0002 11.9997 15.0002ZM11.9997 13.0002C12.552 13.0002 12.9997 12.5525 12.9997 12.0002C12.9997 11.4479 12.552 11.0002 11.9997 11.0002C11.4474 11.0002 10.9997 11.4479 10.9997 12.0002C10.9997 12.5525 11.4474 13.0002 11.9997 13.0002Z"></path>
					</svg>
				</a>
				<a class="a_account" href="compte.html">
					<img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQx-dp4uGCohdJKwWhlWiiQvwaxGRTHaML-EA&s" alt="Icone compte utilisateur" />
				</a>
			</div>
		</header>

		<main>
			<section>
				<div class="div_input_all">
					<!-- J'ai groupé le H2 et le FORM dans le même bloc pour l'animation -->
					<Transition name="auth" mode="out-in">
						
						<!-- BLOC LOGIN -->
						<div v-if="etat === 'login'" class="auth-block" key="login">
							<h2>LOGIN</h2>
							<form @submit.prevent="handleLogin">
								<label for="login_email">Email :</label>
								<input v-model="loginForm.email" type="email" id="login_email" required />

								<label for="login_password">Mot de passe :</label>
								<div class="input-with-icon">
									<input 
										v-model="loginForm.password" 
										:type="showLoginPassword ? 'text' : 'password'" 
										id="login_password" 
										required 
									/>
									<button
										type="button"
										class="icon-btn"
										@click="showLoginPassword = !showLoginPassword"
										:aria-label="showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
									>
										<svg v-if="!showLoginPassword" class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
											<circle cx="12" cy="12" r="3" />
										</svg>
										<svg v-else class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
											<circle cx="12" cy="12" r="3" />
											<path d="M3 3l18 18" />
										</svg>
									</button>
								</div>

								<button type="submit" :disabled="loading">
									{{ loading ? "Connexion..." : "S'identifier" }}
								</button>
								<button type="button" @click="etat = 'register'">
									S'enregistrer
								</button>
							</form>
						</div>

						<!-- BLOC REGISTER -->
						<div v-else class="auth-block" key="register">
							<h2>S'ENREGISTRER</h2>
							<form @submit.prevent="handleRegister">
								<label for="register_username">Nom d'utilisateur :</label>
								<input v-model="registerForm.username" type="text" id="register_username" required />

								<label for="register_email">Email :</label>
								<input v-model="registerForm.email" type="email" id="register_email" required />

								<label for="register_password">Mot de passe :</label>
								<div class="input-with-icon">
									<input 
										v-model="registerForm.password" 
										:type="showRegisterPassword ? 'text' : 'password'" 
										id="register_password" 
										required 
									/>
									<button
										type="button"
										class="icon-btn"
										@click="showRegisterPassword = !showRegisterPassword"
										:aria-label="showRegisterPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
									>
										<svg v-if="!showRegisterPassword" class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
											<circle cx="12" cy="12" r="3" />
										</svg>
										<svg v-else class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
											<circle cx="12" cy="12" r="3" />
											<path d="M3 3l18 18" />
										</svg>
									</button>
								</div>

								<button type="submit" :disabled="loading">
									{{ loading ? "Création..." : "Créer un compte" }}
								</button>
								<button type="button" @click="etat = 'login'">
									Retour au login
								</button>
							</form>
						</div>

					</Transition>
				</div>
			</section>
		</main>
	</div>
</template>

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer

import {
	decryptPrivateKeyPemWithPassword,
	encryptPrivateKeyPemWithPassword,
	generateRsaKeyPairPem,
	saveUserKeysToIndexedDb,
} from "~/utils/crypto";

const API_URL = "https://gauzian.pupin.fr/api";

const etat = ref("login");
const loading = ref(false);
const loginForm = ref({ email: "", password: "" });
const registerForm = ref({ username: "", email: "", password: "" });
const showLoginPassword = ref(false);
const showRegisterPassword = ref(false);

const handleLogin = async () => {
  loading.value = true;
  try {
		const res = await fetch(`${API_URL}/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify(loginForm.value),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Login failed");

		if (data.encrypted_private_key && data.private_key_salt && data.iv && data.public_key) {
			const privateKeyPem = await decryptPrivateKeyPemWithPassword({
				encrypted_private_key: data.encrypted_private_key,
				private_key_salt: data.private_key_salt,
				iv: data.iv,
				password: loginForm.value.password,
			});
			await saveUserKeysToIndexedDb(privateKeyPem, data.public_key);
		}

		console.log("Login OK");
        window.location.href = "/";
  } finally {
    loading.value = false;
  }
};

const handleRegister = async () => {
  loading.value = true;
  try {
		const { publicKey, privateKey } = await generateRsaKeyPairPem();
		await saveUserKeysToIndexedDb(privateKey, publicKey);

		const cryptoPayload = await encryptPrivateKeyPemWithPassword(
			privateKey,
			registerForm.value.password
		);

		const res = await fetch(`${API_URL}/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({
				username: registerForm.value.username,
				email: registerForm.value.email,
				password: registerForm.value.password,
				public_key: publicKey,
				encrypted_private_key: cryptoPayload.encrypted_private_key,
				private_key_salt: cryptoPayload.private_key_salt,
				iv: cryptoPayload.iv,
			}),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Register failed");

        // redirect to /
        console.log("Register OK");
        window.location.href = "/";
  } finally {
    loading.value = false;
  }
};

useHead({
	title: "GZAuth | Login",
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