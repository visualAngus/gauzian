<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useHead } from '#imports'
import Gauzial from '../components/gauzial.vue'

useHead({
	title: 'Inscription – Gauzian',
})

const router = useRouter()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const isLoadingPage = ref(false)
const message = ref(null)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isEmailValid = ref(false)
const isPasswordValid = ref(false)
const isPasswordMatch = ref(true)
const isRequestGood = ref(true)
const isAllComplete = ref(false)
const acceptedCGU = ref(false)

const validateEmail = (value) => {
	if (value === '') return true
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(value)
}

const validatePassword = (value) => /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value)

const handleEmailChange = () => {
	isRequestGood.value = true
	isEmailValid.value = validateEmail(email.value)
}

const handlePasswordChange = () => {
	isRequestGood.value = true
	isPasswordValid.value = validatePassword(password.value)
	if (confirmPassword.value) {
		isPasswordMatch.value = password.value === confirmPassword.value
	}
}

const handleConfirmPasswordChange = () => {
	isRequestGood.value = true
	isPasswordMatch.value = password.value === confirmPassword.value
}

const b64 = (u8, sodium) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL)
const b64NoPadding = (u8, sodium) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL).replace(/=+$/, '')

const generateKeyPair = async () => {
	const keyPair = await window.crypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256',
		},
		true,
		['encrypt', 'decrypt']
	)

	const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
	const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)))

	const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
	const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)))

	return { publicKey: publicKeyBase64, privateKey: privateKeyBase64 }
}

const b64ToBuf = (sodium, b64Val) => {
	if (!b64Val) return new Uint8Array()
	const normalized = b64Val.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
	const pad = normalized.length % 4
	const padded = pad ? normalized + '='.repeat(4 - pad) : normalized
	const bin = window.atob(padded)
	const arr = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
	return arr
}

const handleSubmit = async () => {
	loading.value = true
	message.value = null

	if (!firstName.value || !lastName.value || !email.value || !password.value || !confirmPassword.value || !validateEmail(email.value) || !validatePassword(password.value) || password.value !== confirmPassword.value) {
		isRequestGood.value = false
		loading.value = false
		return
	}

	isLoadingPage.value = true

	try {
		const sodiumLib = await import('libsodium-wrappers-sumo')
		const sodium = sodiumLib.default || sodiumLib
		await sodium.ready

		const enc = new TextEncoder()
		const salt_e2e = sodium.randombytes_buf(16)
		const salt_auth = sodium.randombytes_buf(16)

		const passwordBytes = enc.encode(password.value)

		const encryptedPassword = sodium.crypto_pwhash(
			32,
			passwordBytes,
			salt_auth,
			sodium.crypto_pwhash_OPSLIMIT_MODERATE,
			sodium.crypto_pwhash_MEMLIMIT_MODERATE,
			sodium.crypto_pwhash_ALG_ARGON2ID13
		)

		const derivedKey = sodium.crypto_pwhash(
			32,
			encryptedPassword,
			salt_e2e,
			sodium.crypto_pwhash_OPSLIMIT_MODERATE,
			sodium.crypto_pwhash_MEMLIMIT_MODERATE,
			sodium.crypto_pwhash_ALG_ARGON2ID13
		)

		const keyPair = await generateKeyPair()
		const userMasterKey = sodium.crypto_generichash(32, derivedKey)
		const rootFolderKey = sodium.randombytes_buf(32)

		const raw = b64ToBuf(sodium, keyPair.publicKey)
		const publicKey = await crypto.subtle.importKey(
			'spki',
			raw.buffer,
			{ name: 'RSA-OAEP', hash: 'SHA-256' },
			false,
			['encrypt']
		)

		const encryptedRootKeyBytes = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rootFolderKey)
		const finalRootFolderKey = new Uint8Array(encryptedRootKeyBytes)

		const folderMetadata = JSON.stringify({ name: 'Mon Drive', created_at: new Date().toISOString() })
		const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
		const encryptedMetadataBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
			sodium.from_string(folderMetadata),
			null,
			null,
			nonceMeta,
			rootFolderKey
		)
		const finalRootMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadataBlob])

		const privateKeyBytes = Uint8Array.from(atob(keyPair.privateKey), (c) => c.charCodeAt(0))
		const noncePrivKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
		const encryptedPrivateKeyBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
			privateKeyBytes,
			null,
			null,
			noncePrivKey,
			userMasterKey
		)
		const finalEncryptedPrivateKey = new Uint8Array([...noncePrivKey, ...encryptedPrivateKeyBlob])

		const userRestoreKey = b64NoPadding(sodium.randombytes_buf(32), sodium)
		const userRestoreKeyBytes = sodium.from_base64(userRestoreKey, sodium.base64_variants.ORIGINAL_NO_PADDING)

		const privateKeyBytesForRecovery = Uint8Array.from(atob(keyPair.privateKey), (c) => c.charCodeAt(0))
		const noncePrivKeyRecovery = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
		const encryptedPrivateKeyBlobRecovery = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
			privateKeyBytesForRecovery,
			null,
			null,
			noncePrivKeyRecovery,
			userRestoreKeyBytes
		)
		const finalEncryptedPrivateKeyForRecovery = new Uint8Array([...noncePrivKeyRecovery, ...encryptedPrivateKeyBlobRecovery])

		const recoverySaltBytes = sodium.randombytes_buf(16)
		const recoverySalt = b64NoPadding(recoverySaltBytes, sodium)
		const recoveryProof = sodium.crypto_generichash(32, new Uint8Array([...userRestoreKeyBytes, ...recoverySaltBytes]))
		const recoveryAuth = b64NoPadding(recoveryProof, sodium)

		const payload = {
			first_name: firstName.value,
			last_name: lastName.value,
			email: email.value,
			password: password.value,
			salt_e2e: b64NoPadding(salt_e2e, sodium),
			salt_auth: b64NoPadding(salt_auth, sodium),
			private_key_encrypted_recuperation: b64(finalEncryptedPrivateKeyForRecovery, sodium),
			recovery_auth: recoveryAuth,
			recovery_salt: recoverySalt,
			folder_key_encrypted: b64(finalRootFolderKey, sodium),
			folder_metadata_encrypted: b64(finalRootMetadata, sodium),
			public_key: keyPair.publicKey,
			private_key_encrypted: b64(finalEncryptedPrivateKey, sodium),
		}

		const res = await fetch('/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		const data = await res.json()
		if (!res.ok) throw new Error(data.message || "Erreur lors de l'inscription")

		message.value = { type: 'success', text: 'Inscription réussie ! Sauvegardez votre clé.' }
		if (typeof window !== 'undefined') {
			sessionStorage.setItem('gauzian_recovery_key', userRestoreKey)
		}

		isLoadingPage.value = false
		router.push('/recovery-key')
	} catch (err) {
		console.error(err)
		isRequestGood.value = false
		isLoadingPage.value = false
		message.value = { type: 'error', text: err.message }
	} finally {
		loading.value = false
	}
}

watch([acceptedCGU, isEmailValid, isPasswordValid, isPasswordMatch], () => {
	isAllComplete.value = acceptedCGU.value && isEmailValid.value && isPasswordValid.value && isPasswordMatch.value
})

const disableForm = computed(() => loading.value || isLoadingPage.value || !isRequestGood.value || !isAllComplete.value)

onMounted(() => {
	isAllComplete.value = acceptedCGU.value && isEmailValid.value && isPasswordValid.value && isPasswordMatch.value
})
</script>

<template>
	<main class="page">
		<div class="left-panel">
			<Gauzial
				:lookAway="showPassword || showConfirmPassword"
				:isUnhappy="(!isEmailValid && email.length > 0) || (!isPasswordValid && password.length > 0) || (!isPasswordMatch && confirmPassword.length > 0) || !isRequestGood"
				:isRequestGood="isRequestGood"
				:isLoadingPage="isLoadingPage"
			/>
			<div class="branding">
				<h2>Gauzian</h2>
				<p>Votre espace sécurisé</p>
			</div>
		</div>

		<div class="right-panel">
			<div class="card">
				<div class="header">
					<h1>Rejoignez-nous</h1>
					<p class="subtitle">Créez votre compte sécurisé</p>
				</div>

				<div v-if="message" :class="['alert', message.type === 'error' ? 'err' : 'ok']">{{ message.text }}</div>

				<form class="form" :style="{ opacity: isLoadingPage ? 0.5 : 1, pointerEvents: isLoadingPage ? 'none' : 'auto' }" @submit.prevent="handleSubmit">
					<div class="form-row">
						<div class="input-group">
							<label>Prénom</label>
							<input
								type="text"
								v-model="firstName"
								:disabled="loading || isLoadingPage"
								placeholder="Jean"
								required
							/>
						</div>
						<div class="input-group">
							<label>Nom</label>
							<input
								type="text"
								v-model="lastName"
								:disabled="loading || isLoadingPage"
								placeholder="Dupont"
								required
							/>
						</div>
					</div>

					<div class="input-group">
						<label>Email</label>
						<input
							type="email"
							v-model="email"
							@input="handleEmailChange"
							:disabled="loading || isLoadingPage"
							placeholder="votre@email.com"
							:class="{ 'input-error': !validateEmail(email) && email.length > 0 }"
							required
						/>
						<span v-if="!validateEmail(email) && email.length > 0" class="error-text">❌ Email invalide</span>
					</div>

					<div class="input-group">
						<label>Mot de passe</label>
						<div class="password-wrapper">
							<input
								:type="showPassword ? 'text' : 'password'"
								v-model="password"
								@input="handlePasswordChange"
								:disabled="loading || isLoadingPage"
								placeholder="••••••••"
								:class="{ 'input-error': !validatePassword(password) && password.length > 0 }"
								required
								minlength="6"
							/>
							<button
								type="button"
								class="toggle-password"
								:disabled="loading || isLoadingPage"
								@click="showPassword = !showPassword"
								:aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
							>
								<svg v-if="showPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
									<line x1="1" y1="1" x2="23" y2="23" />
								</svg>
								<svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							</button>
						</div>
						<span class="helper-text">Minimum 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial</span>
						<span v-if="!validatePassword(password) && password.length > 0" class="error-text">❌ Mot de passe non valide</span>
					</div>

					<div class="input-group">
						<label>Confirmer le mot de passe</label>
						<div class="password-wrapper">
							<input
								:type="showConfirmPassword ? 'text' : 'password'"
								v-model="confirmPassword"
								@input="handleConfirmPasswordChange"
								:disabled="loading || isLoadingPage"
								placeholder="••••••••"
								:class="{ 'input-error': !isPasswordMatch && confirmPassword.length > 0 }"
								required
								minlength="6"
							/>
							<button
								type="button"
								class="toggle-password"
								:disabled="loading || isLoadingPage"
								@click="showConfirmPassword = !showConfirmPassword"
								:aria-label="showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
							>
								<svg v-if="showConfirmPassword" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
									<line x1="1" y1="1" x2="23" y2="23" />
								</svg>
								<svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
									<circle cx="12" cy="12" r="3" />
								</svg>
							</button>
						</div>
						<span v-if="!isPasswordMatch && confirmPassword.length > 0" class="error-text">❌ Les mots de passe ne correspondent pas</span>
					</div>

					<div class="input-group cgu">
						<label class="cgu-label">
							<input
								type="checkbox"
								v-model="acceptedCGU"
								:disabled="loading || isLoadingPage"
								required
							/>
							J'accepte les <NuxtLink to="/cgu" target="_blank">conditions générales d'utilisation</NuxtLink>
						</label>
					</div>

					<button type="submit" class="submit-btn" :disabled="disableForm">
						{{ loading ? 'Inscription en cours…' : "S'inscrire" }}
					</button>

					<div class="links login-btn">
						<button type="button" class="link" @click="router.push('/login')">Retour à la connexion</button>
					</div>
				</form>
			</div>
		</div>
	</main>
</template>

<style scoped>
.page {
	min-height: 100vh;
	display: flex;
	background-color: #F8FAFC;
}

.left-panel {
	flex: 1;
	background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 3rem;
	position: relative;
	overflow: hidden;
}

.left-panel::before {
	content: '';
	position: absolute;
	top: -50%;
	left: -50%;
	width: 200%;
	height: 200%;
	background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
	animation: pulse 15s ease-in-out infinite;
}

@keyframes pulse {
	0%, 100% { transform: scale(1); opacity: 0.5; }
	50% { transform: scale(1.1); opacity: 0.8; }
}

.branding {
	margin-top: 3rem;
	text-align: center;
	color: white;
	z-index: 1;
}

.branding h2 {
	font-size: 3rem;
	font-weight: 700;
	margin-bottom: 0.5rem;
	text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.branding p {
	font-size: 1.2rem;
	opacity: 0.9;
}

.right-panel {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2rem;
}

.card {
	width: 100%;
	max-width: 540px;
	background: white;
	padding: 3rem;
	border-radius: 20px;
	box-shadow: 0 10px 40px rgba(11, 17, 32, 0.08);
}

.header {
	margin-bottom: 2rem;
}

h1 {
	margin: 0 0 0.5rem;
	color: #0B1120;
	font-size: 2.2rem;
	font-weight: 700;
}

.subtitle {
	color: #334155;
	margin: 0;
	font-size: 1rem;
}

.form {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.form-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 1rem;
}

.input-group {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.input-group label {
	font-size: 0.95rem;
	font-weight: 600;
	color: #0B1120;
}

input {
	width: 100%;
	padding: 0.875rem 1rem;
	border-radius: 12px;
	border: 2px solid #E2E8F0;
	background: white;
	font-size: 1rem;
	transition: all 0.3s ease;
	font-family: inherit;
}

.password-wrapper {
	position: relative;
	width: 100%;
}

.password-wrapper input {
	padding-right: 3rem;
}

.toggle-password {
	position: absolute;
	right: 0.75rem;
	top: 50%;
	transform: translateY(-50%);
	background: none;
	border: none;
	color: #334155;
	cursor: pointer;
	padding: 0.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: color 0.2s ease;
	border-radius: 6px;
}

.toggle-password:hover:not(:disabled) {
	color: #F97316;
	background: rgba(249, 115, 22, 0.05);
}

.toggle-password:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.toggle-password svg {
	width: 20px;
	height: 20px;
}

input:focus {
	outline: none;
	border-color: #F97316;
	box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

input:disabled {
	background-color: #F8FAFC;
	cursor: not-allowed;
}

input.input-error {
	border-color: #EF4444;
	background-color: #FEF2F2;
}

input.input-error:focus {
	border-color: #EF4444;
	box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.helper-text {
	font-size: 0.8rem;
	color: #334155;
	margin-top: -0.3rem;
}

.submit-btn {
	background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
	color: white;
	padding: 1rem;
	border-radius: 12px;
	border: none;
	font-size: 1.05rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.3s ease;
	margin-top: 0.5rem;
	box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

.submit-btn:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
}

.submit-btn:active:not(:disabled) {
	transform: translateY(0);
}

.submit-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.links {
	text-align: center;
	margin-top: 1rem;
}

.link {
	color: #F97316;
	text-decoration: none;
	font-weight: 500;
	transition: color 0.2s ease;
	background: none;
	border: none;
	cursor: pointer;
	font-size: 1rem;
	font-family: inherit;
}

.link:hover {
	color: #FDBA74;
	text-decoration: underline;
}

.login-btn {
	margin-top: 2rem;
	padding-top: 2rem;
	border-top: 1px solid #E2E8F0;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
}

.login-btn .link {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	max-width: 300px;
	padding: 1rem 2rem;
	background: transparent;
	border: 2px solid #E2E8F0;
	border-radius: 12px;
	color: #A0AEC0;
	text-decoration: none;
	font-weight: 600;
	font-size: 1rem;
	transition: all 0.3s ease;
	cursor: pointer;
}

.login-btn .link:hover {
	background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%);
	color: white;
	text-decoration: none;
	transform: translateY(-2px);
	box-shadow: 0 6px 16px rgba(249, 115, 22, 0.3);
	border-color: #F97316;
}

.login-btn .link:active {
	transform: translateY(0);
}

.alert {
	padding: 1rem;
	border-radius: 12px;
	margin-bottom: 1.5rem;
	font-size: 0.95rem;
}

.alert.err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
.alert.ok { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }

.error-text {
	color: #EF4444;
	font-size: 0.875rem;
	margin-top: 0.25rem;
	display: block;
}

.cgu-label {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-weight: 500;
}

.cgu-label input {
	width: auto;
	margin: 0;
}

@media (max-width: 968px) {
	.page { flex-direction: column; }
	.left-panel { min-height: 40vh; padding: 2rem; }
	.branding h2 { font-size: 2rem; }
	.branding p { font-size: 1rem; }
	.card { padding: 2rem; }
	h1 { font-size: 1.8rem; }
	.form-row { grid-template-columns: 1fr; }
}
</style>
