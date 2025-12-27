<script setup>
import { onMounted, ref, watch, computed } from 'vue'
import { useRouter, useHead } from '#imports'
import Gauzial from '../components/gauzial.vue'
import * as pdfjsLib from 'pdfjs-dist'

useHead({
  title: 'Mot de passe oublié – Gauzian',
})

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

const router = useRouter()

const email = ref('')
const recoveryKey = ref('')
const recoveryFile = ref(null)
const message = ref(null)
const loading = ref(false)
const isEmailValid = ref(false)
const phase = ref('verify')
const recoveryAuthProof = ref('')
const decryptedPrivateKeyB64 = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isPasswordValid = ref(false)
const isPasswordMatch = ref(true)

const validateEmail = (value) => {
  if (value === '') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

const validatePassword = (value) => /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value)

watch(email, (v) => { isEmailValid.value = validateEmail(v) })
watch(newPassword, (v) => {
  isPasswordValid.value = validatePassword(v)
  if (confirmPassword.value) isPasswordMatch.value = v === confirmPassword.value
})
watch(confirmPassword, (v) => { isPasswordMatch.value = v === newPassword.value })

const bufToB64 = (buf) => {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

const decodeRecoveryKeyBytes = (sodium, recoveryKeyRaw) => {
  const normalize = (val) => String(val || '').replace(/\s+/g, '')
  const normalized = normalize(recoveryKeyRaw).replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  try {
    return sodium.from_base64(normalized, sodium.base64_variants.ORIGINAL_NO_PADDING)
  } catch (e1) {
    try {
      return sodium.from_base64(padded, sodium.base64_variants.ORIGINAL)
    } catch (e2) {
      return sodium.from_base64(normalized, sodium.base64_variants.URLSAFE_NO_PADDING)
    }
  }
}

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsText(file)
})

const parsePdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((s) => s.str).join(' ')
    fullText += pageText + '\n'
  }
  return fullText
}

const deriveRecoveryProof = (sodium, recoveryKeyRaw, saltB64) => {
  const saltNormalized = (saltB64 || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const saltPad = saltNormalized.length % 4
  const saltPadded = saltPad ? saltNormalized + '='.repeat(4 - saltPad) : saltNormalized
  const saltBytes = sodium.from_base64(saltPadded, sodium.base64_variants.ORIGINAL)
  const keyBytes = decodeRecoveryKeyBytes(sodium, recoveryKeyRaw)
  const proof = sodium.crypto_generichash(32, new Uint8Array([...keyBytes, ...saltBytes]))
  return sodium.to_base64(proof, sodium.base64_variants.ORIGINAL).replace(/=+$/, '')
}

const decryptPrivateKeyWithRecoveryKey = async (encryptedKeyB64, recoveryKeyRaw, sourceLabel = 'unknown') => {
  const sodiumLib = await import('libsodium-wrappers-sumo')
  const sodium = sodiumLib.default || sodiumLib
  await sodium.ready

  const normalize = (val) => String(val || '').replace(/\s+/g, '')
  const decodeCipher = () => {
    const normalized = normalize(encryptedKeyB64).replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    try {
      return sodium.from_base64(padded, sodium.base64_variants.ORIGINAL)
    } catch (e1) {
      try {
        return sodium.from_base64(normalized, sodium.base64_variants.ORIGINAL_NO_PADDING)
      } catch (e2) {
        return sodium.from_base64(normalized, sodium.base64_variants.URLSAFE_NO_PADDING)
      }
    }
  }

  const encryptedBytes = decodeCipher()
  const nonceLength = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  if (!encryptedBytes || encryptedBytes.length <= nonceLength) {
    throw new Error('Clé chiffrée invalide renvoyée par le serveur.')
  }

  const nonce = encryptedBytes.slice(0, nonceLength)
  const ciphertext = encryptedBytes.slice(nonceLength)

  const recoveryKeyBytes = decodeRecoveryKeyBytes(sodium, recoveryKeyRaw)
  if (recoveryKeyBytes.length !== 32) {
    throw new Error('Clé de récupération invalide.')
  }

  try {
    const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      recoveryKeyBytes
    )
    return bufToB64(decrypted)
  } catch (e) {
    const info = `source=${sourceLabel}, cipherLen=${encryptedBytes.length}, keyLen=${recoveryKeyBytes.length}`
    throw new Error(`Impossible de déchiffrer la clé (${info}).`)
  }
}

const fetchRecoverySalt = async (emailVal) => {
  const res = await fetch('/api/auth/recovery/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailVal }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || 'Impossible de récupérer le challenge.')
  if (!data?.recovery_salt) throw new Error('Challenge de récupération incomplet.')
  return data.recovery_salt
}

const requestRecoveryCipher = async (emailVal, recoveryAuthVal) => {
  const res = await fetch('/api/auth/recovery/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailVal, recovery_auth: recoveryAuthVal }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || 'Preuve de récupération invalide.')
  const encryptedKey = data?.private_key_encrypted_recuperation
  if (!encryptedKey) throw new Error('Aucune clé chiffrée retournée par le serveur.')
  return encryptedKey
}

const handleFileChange = (e) => {
  const file = e.target.files?.[0]
  recoveryFile.value = file || null
  if (file) recoveryKey.value = ''
}

const handleKeyChange = (value) => {
  recoveryKey.value = value
  if (value) recoveryFile.value = null
}

const handleVerifySubmit = async () => {
  message.value = null
  if (!isEmailValid.value || (!recoveryKey.value && !recoveryFile.value)) {
    message.value = { type: 'error', text: 'Renseignez un email valide et votre clé ou fichier.' }
    return
  }

  loading.value = true
  try {
    let payloadKey = recoveryKey.value.replace(/\s/g, '').trim()
    if (payloadKey && payloadKey.length < 40) throw new Error('Clé de récupération trop courte ou invalide.')

    if (recoveryFile.value && !payloadKey) {
      if (recoveryFile.value.type === 'application/pdf') {
        const pdfText = await parsePdf(recoveryFile.value)
        payloadKey = pdfText.trim()
        const keyMatch = pdfText.match(/(Cl[eé] de r[eé]cup[eé]ration)\s([A-Za-z0-9/=_-]{32,})/i)
        if (keyMatch && (keyMatch[2] || keyMatch[1])) {
          payloadKey = (keyMatch[2] || keyMatch[1]).replace(/\s/g, '').trim()
        } else {
          throw new Error('Clé de récupération non trouvée dans le PDF.')
        }
      } else {
        const fileContent = await readFileAsText(recoveryFile.value)
        payloadKey = fileContent?.toString().replace(/\s/g, '').trim()
      }
    }

    if (!payloadKey) throw new Error('Impossible de lire la clé depuis le fichier.')

    const sodiumLib = await import('libsodium-wrappers-sumo')
    const sodium = sodiumLib.default || sodiumLib
    await sodium.ready

    const challengeSalt = await fetchRecoverySalt(email.value)
    const proof = deriveRecoveryProof(sodium, payloadKey, challengeSalt)
    const encryptedKeyFromServer = await requestRecoveryCipher(email.value, proof)

    const decrypted = await decryptPrivateKeyWithRecoveryKey(
      encryptedKeyFromServer,
      payloadKey,
      'private_key_encrypted_recuperation'
    )

    recoveryAuthProof.value = proof
    decryptedPrivateKeyB64.value = decrypted
    phase.value = 'reset'
    message.value = { type: 'success', text: 'Clé validée. Choisissez un nouveau mot de passe.' }
  } catch (err) {
    message.value = { type: 'error', text: err.message || 'Erreur lors de la préparation de la demande.' }
  } finally {
    loading.value = false
  }
}

const handleResetSubmit = async () => {
  message.value = null
  if (!decryptedPrivateKeyB64.value || !recoveryAuthProof.value) {
    message.value = { type: 'error', text: 'Validez d’abord votre clé de récupération.' }
    return
  }
  if (!validatePassword(newPassword.value) || !isPasswordMatch.value) {
    message.value = { type: 'error', text: 'Mot de passe invalide ou non confirmé.' }
    return
  }

  loading.value = true
  try {
    const sodiumLib = await import('libsodium-wrappers-sumo')
    const sodium = sodiumLib.default || sodiumLib
    await sodium.ready

    const enc = new TextEncoder()
    const saltAuth = sodium.randombytes_buf(16)
    const saltE2e = sodium.randombytes_buf(16)
    const passwordBytes = enc.encode(newPassword.value)

    const encryptedPassword = sodium.crypto_pwhash(
      32,
      passwordBytes,
      saltAuth,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    )

    const derivedKey = sodium.crypto_pwhash(
      32,
      encryptedPassword,
      saltE2e,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_MODERATE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    )

    const userMasterKey = sodium.crypto_generichash(32, derivedKey)

    const privateKeyBytes = Uint8Array.from(atob(decryptedPrivateKeyB64.value), (c) => c.charCodeAt(0))
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
    const encryptedPrivateKeyBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      privateKeyBytes,
      null,
      null,
      nonce,
      userMasterKey
    )
    const finalEncryptedPrivateKey = new Uint8Array([...nonce, ...encryptedPrivateKeyBlob])

    const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL)
    const b64NoPadding = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL).replace(/=$/, '')

    const newRecoveryKeyBytes = sodium.randombytes_buf(32)
    const newRecoveryKey = b64NoPadding(newRecoveryKeyBytes)

    const newRecoverySalt = sodium.randombytes_buf(16)
    const newRecoverySaltB64 = b64NoPadding(newRecoverySalt)
    const newRecoveryProof = deriveRecoveryProof(sodium, newRecoveryKey, newRecoverySaltB64)

    const newRecoveryNonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
    const encryptedForRecovery = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      privateKeyBytes,
      null,
      null,
      newRecoveryNonce,
      newRecoveryKeyBytes
    )
    const finalRecoveryCipher = new Uint8Array([...newRecoveryNonce, ...encryptedForRecovery])

    const payload = {
      email: email.value,
      recovery_auth: recoveryAuthProof.value,
      new_password: newPassword.value,
      salt_auth: b64NoPadding(saltAuth),
      salt_e2e: b64NoPadding(saltE2e),
      private_key_encrypted: b64(finalEncryptedPrivateKey),
      private_key_encrypted_recuperation: b64(finalRecoveryCipher),
      new_recovery_salt: newRecoverySaltB64,
      new_recovery_auth: newRecoveryProof,
    }

    const res = await fetch('/api/auth/recovery/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data?.message || 'Erreur lors de la mise à jour du mot de passe.')

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('gauzian_recovery_key', newRecoveryKey)
    }

    message.value = { type: 'success', text: 'Mot de passe mis à jour. Sauvegardez votre nouvelle clé.' }
    phase.value = 'done'
    router.push('/recovery-key')
  } catch (err) {
    message.value = { type: 'error', text: err.message || 'Erreur lors de la mise à jour du mot de passe.' }
  } finally {
    loading.value = false
  }
}

const canSubmit = computed(() => phase.value === 'verify' && isEmailValid.value && (recoveryKey.value.trim().length > 0 || recoveryFile.value))
const canReset = computed(() => phase.value !== 'verify' && isPasswordValid.value && isPasswordMatch.value && newPassword.value.length > 0)
const statusClass = computed(() => message.value?.type === 'error' ? 'err' : message.value?.type === 'success' ? 'ok' : 'warn')

onMounted(() => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash
    if (hash.startsWith('#k=')) {
      const keyFromUrl = decodeURIComponent(hash.slice(3))
      recoveryKey.value = keyFromUrl
    }
  }
})
</script>

<template>
  <main class="page">
    <div class="left-panel">
      <Gauzial :isUnhappy="message?.type === 'error'" :lookAway="false" :isRequestGood="message?.type !== 'error'" :isLoadingPage="false" />
      <div class="branding">
        <h2>Gauzian</h2>
        <p>Votre espace sécurisé</p>
      </div>
    </div>

    <div class="right-panel">
      <div class="card">
        <div class="header">
          <h1>Mot de passe oublié</h1>
          <p class="subtitle">Saisissez votre email et votre clé de récupération (.key ou PDF).</p>
        </div>

        <div v-if="message?.text" :class="['alert', statusClass]">{{ message.text }}</div>

        <form class="form" @submit.prevent="handleVerifySubmit">
          <div class="input-group">
            <label>Email</label>
            <input
              type="email"
              v-model="email"
              placeholder="vous@email.com"
              :class="{ 'input-error': !isEmailValid && email.length > 0 }"
              required
              :disabled="phase !== 'verify'"
            />
            <span v-if="!isEmailValid && email.length > 0" class="error-text">Email invalide</span>
          </div>

          <template v-if="phase === 'verify'">
            <div class="input-group">
              <label>Entrer la clé de récupération</label>
              <textarea
                v-model="recoveryKey"
                placeholder="Collez votre clé ici"
                rows="3"
                :disabled="!!recoveryFile || phase !== 'verify'"
              />
              <span class="helper-text">Vous pouvez soit coller la clé, soit envoyer le fichier .key ou le PDF.</span>
            </div>

            <div class="input-group">
              <label>Ou importer le fichier (.key ou .pdf)</label>
              <div class="file-row">
                <input type="file" accept=".key,.pdf" @change="handleFileChange" :disabled="recoveryKey.trim().length > 0 || phase !== 'verify'" />
                <span v-if="recoveryFile" class="file-name">{{ recoveryFile.name }}</span>
              </div>
            </div>

            <button type="submit" class="submit-btn" :disabled="!canSubmit || loading || phase !== 'verify'">
              {{ loading ? 'Préparation...' : 'Valider la récupération' }}
            </button>
          </template>
        </form>

        <form v-if="phase !== 'verify'" class="form secondary-form" @submit.prevent="handleResetSubmit">
          <div class="input-group">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              v-model="newPassword"
              placeholder="Mot de passe fort"
              :class="{ 'input-error': !isPasswordValid && newPassword.length > 0 }"
              required
              :disabled="phase === 'done'"
            />
            <span v-if="!isPasswordValid && newPassword.length > 0" class="error-text">8 caractères, 1 majuscule, 1 chiffre, 1 spécial.</span>
          </div>

          <div class="input-group">
            <label>Confirmer le mot de passe</label>
            <input
              type="password"
              v-model="confirmPassword"
              placeholder="Confirmez"
              :class="{ 'input-error': !isPasswordMatch && confirmPassword.length > 0 }"
              required
              :disabled="phase === 'done'"
            />
            <span v-if="!isPasswordMatch && confirmPassword.length > 0" class="error-text">Les mots de passe ne correspondent pas.</span>
          </div>

          <button type="submit" class="submit-btn" :disabled="!canReset || loading || phase === 'done'">
            {{ loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe' }}
          </button>
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
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
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

.branding h2 { font-size: 3rem; font-weight: 700; margin-bottom: 0.5rem; text-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.branding p { font-size: 1.2rem; opacity: 0.9; }

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

.header { margin-bottom: 2rem; }
.header h1 { margin: 0 0 0.5rem; color: #0B1120; font-size: 2.2rem; font-weight: 700; }
.subtitle { color: #334155; margin: 0; font-size: 1rem; }

.alert {
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}
.alert.warn { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
.alert.err { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
.alert.ok { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }

.form { display: flex; flex-direction: column; gap: 1.5rem; }
.input-group { display: flex; flex-direction: column; gap: 0.5rem; }
.input-group label { font-size: 0.95rem; font-weight: 600; color: #0B1120; }

input, textarea {
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  border: 2px solid #E2E8F0;
  background: white;
  font-size: 1rem;
  transition: all 0.3s ease;
  font-family: inherit;
}
textarea { resize: vertical; min-height: 100px; }

input:focus, textarea:focus {
  outline: none;
  border-color: #F97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

input.input-error { border-color: #EF4444; background-color: #FEF2F2; }
.helper-text { font-size: 0.85rem; color: #64748B; }
.error-text { color: #EF4444; font-size: 0.875rem; }

.file-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.file-name { font-size: 0.9rem; color: #334155; }

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

.submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 968px) {
  .page { flex-direction: column; }
  .left-panel { min-height: 40vh; padding: 2rem; }
  .branding h2 { font-size: 2rem; }
  .branding p { font-size: 1rem; }
  .card { padding: 2rem; max-width: 100%; }
  .header h1 { font-size: 1.8rem; }
}
</style>
