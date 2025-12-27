<script setup>
import { onMounted, ref } from 'vue'
import { useHead } from '#imports'
import Gauzial from '../components/gauzial.vue'
import QRCode from 'qrcode'

useHead({
  title: 'Clé de récupération – Gauzian',
})

const recoveryKey = ref('')
const qrDataUrl = ref('')

const generateQr = async (text) => {
  try {
    qrDataUrl.value = await QRCode.toDataURL(text, { errorCorrectionLevel: 'H', margin: 1 })
  } catch (e) {
    qrDataUrl.value = ''
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('gauzian_recovery_key')
    if (stored) {
      recoveryKey.value = stored
      generateQr(stored)
    }
  }
})
</script>

<template>
  <main class="page">
    <div class="left-panel">
      <Gauzial :isUnhappy="false" :lookAway="false" :isRequestGood="true" :isLoadingPage="false" />
      <div class="branding">
        <h2>Clé générée</h2>
        <p>Sauvegardez-la en lieu sûr.</p>
      </div>
    </div>

    <div class="right-panel">
      <div class="card">
        <div class="header">
          <h1>Votre clé de récupération</h1>
          <p class="subtitle">Copiez-la, exportez-la, puis stockez-la hors ligne.</p>
        </div>

        <div v-if="recoveryKey" class="key-block">
          <div class="key-text">{{ recoveryKey }}</div>
          <button class="copy-btn" @click="() => navigator.clipboard?.writeText(recoveryKey)">Copier</button>
        </div>

        <div v-if="qrDataUrl" class="qr-block">
          <img :src="qrDataUrl" alt="QR code" />
          <p class="qr-caption">Scannez pour récupérer rapidement la clé.</p>
        </div>

        <div class="tips">
          <h3>Conseils</h3>
          <ul>
            <li>Stockez-la dans un gestionnaire de mots de passe.</li>
            <li>Imprimez le QR code et conservez-le séparément.</li>
            <li>Ne partagez jamais cette clé.</li>
          </ul>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; display: flex; background: #F8FAFC; }
.left-panel { flex: 1; background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; position: relative; overflow: hidden; }
.left-panel::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); animation: pulse 15s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 0.8; } }
.branding { margin-top: 3rem; text-align: center; color: white; z-index: 1; }
.branding h2 { font-size: 3rem; font-weight: 700; margin-bottom: 0.5rem; text-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.branding p { font-size: 1.2rem; opacity: 0.9; }
.right-panel { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
.card { width: 100%; max-width: 520px; background: white; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 40px rgba(11, 17, 32, 0.08); }
.header { margin-bottom: 2rem; }
.header h1 { margin: 0 0 0.5rem; color: #0B1120; font-size: 2.1rem; font-weight: 700; }
.subtitle { color: #334155; margin: 0; font-size: 1rem; }
.key-block { background: #0B1120; color: #F8FAFC; padding: 1.25rem; border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
.key-text { word-break: break-all; font-family: "SFMono-Regular", Consolas, 'Liberation Mono', Menlo, monospace; font-size: 0.95rem; }
.copy-btn { background: #F97316; border: none; color: white; padding: 0.75rem 1rem; border-radius: 10px; font-weight: 600; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 8px 24px rgba(249, 115, 22, 0.2); }
.copy-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(249, 115, 22, 0.3); }
.qr-block { text-align: center; margin-bottom: 1.5rem; }
.qr-block img { width: 240px; height: 240px; object-fit: contain; border-radius: 12px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); background: white; padding: 0.75rem; }
.qr-caption { color: #475569; margin-top: 0.75rem; }
.tips { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 1.25rem; }
.tips h3 { margin: 0 0 0.75rem; color: #0B1120; }
.tips ul { margin: 0; padding-left: 1.1rem; color: #334155; display: grid; gap: 0.4rem; }
@media (max-width: 968px) { .page { flex-direction: column; } .left-panel { min-height: 40vh; padding: 2rem; } .branding h2 { font-size: 2rem; } .branding p { font-size: 1rem; } .card { padding: 2rem; max-width: 100%; } .header h1 { font-size: 1.8rem; } }
</style>
