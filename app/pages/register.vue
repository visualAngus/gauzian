<template>
  <div class="page" :class="{ dark: isDark }">
    <div class="register-card" :class="{ 'register-card--recovery': currentStep === 'recovery' }">
      <!-- En-tête carte -->
      <div class="card-header">
        <span class="brand">GAUZIAN</span>
        <div class="header-right">
        <button class="theme-toggle" @click="toggleTheme" :aria-label="isDark ? 'Mode clair' : 'Mode sombre'">
          <!-- Soleil -->
          <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <!-- Lune -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
        <div class="step-dots">
          <span
            v-for="(s, i) in visibleSteps"
            :key="s"
            class="dot"
            :class="{
              active: currentStep === s,
              completed: stepIndex > i,
            }"
          ></span>
        </div>
        </div>
      </div>

      <!-- Contenu par étape avec transition -->
      <div class="card-body">
        <Transition :name="direction === 'forward' ? 'slide-left' : 'slide-right'" mode="out-in">

          <!-- Étape 1 : username -->
          <div v-if="currentStep === 'username'" key="username" class="step">
            <div class="step-label">Bienvenue !</div>
            <h2 class="step-title">Comment souhaitez-vous<br>vous appeler ?</h2>
            <div class="field-group">
              <input
                id="reg-username"
                v-model="registerForm.username"
                type="text"
                placeholder="Nom d'utilisateur"
                autocomplete="nickname"
                @keydown.enter="goNext"
                autofocus
                class="field-input"
                :class="{ 'field-input--error': usernameError }"
              />
              <p v-if="usernameError" class="field-error">{{ usernameError }}</p>
            </div>
          </div>

          <!-- Étape 2 : email -->
          <div v-else-if="currentStep === 'email'" key="email" class="step">
            <div class="step-label">Parfait !</div>
            <h2 class="step-title">Quelle est votre<br>adresse email ?</h2>
            <div class="field-group">
              <input
                id="reg-email"
                ref="emailInputRef"
                v-model="registerForm.email"
                type="email"
                placeholder="votre@email.com"
                autocomplete="username"
                @input="validateEmail(registerForm.email)"
                @keydown.enter="goNext"
                class="field-input"
                :class="{ 'field-input--error': emailError }"
              />
              <p v-if="emailError" class="field-error">{{ emailError }}</p>
            </div>
          </div>

            <!-- Étape 2.5 : otp -->
          <div v-else-if="currentStep === 'otp'" key="otp" class="step">
            <div class="step-label">Un dernier effort !</div>
            <h2 class="step-title">Entrez le code de vérification<br>envoyé à votre email</h2>
            <div class="field-group">
              <!-- 6 gros input number -->
              <div class="otp-inputs">
                <input
                  v-for="(_, i) in 6"
                  :key="i"
                  type="text"
                  inputmode="numeric"
                  maxlength="1"
                  class="otp-input"
                  :class="{ 'field-input--error': otpError }"
                  :ref="(el) => setOtpInputRef(el, i)"
                  @input="(e) => handleOtpInput(e, i)"
                  @keydown.backspace="(e) => handleOtpBackspace(e, i)"
                />
              </div>

              <p v-if="otpError" class="field-error">{{ otpError }}</p>
            </div>
          </div>

          <!-- Étape 3 : password -->
          <div v-else-if="currentStep === 'password'" key="password" class="step">
            <div class="step-label">Presque !</div>
            <h2 class="step-title">Créez un mot de<br>passe sécurisé</h2>
            <div class="field-group">
              <div class="input-with-icon">
                <input
                  id="reg-password"
                  v-model="registerForm.password"
                  :type="showRegisterPassword ? 'text' : 'password'"
                  placeholder="Mot de passe"
                  autocomplete="new-password"
                  @input="changement"
                  @keydown.enter="goNext"
                  class="field-input"
                  :class="{ 'field-input--error': passwordError }"
                />
                <button
                  type="button"
                  class="icon-btn"
                  @click="showRegisterPassword = !showRegisterPassword"
                  :aria-label="showRegisterPassword ? 'Masquer' : 'Afficher'"
                >
                  <svg v-if="!showRegisterPassword" class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg v-else class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M3 3l18 18"/>
                  </svg>
                </button>
              </div>
              <!-- Indicateur de force -->
              <div v-if="registerForm.password.length > 0" class="strength-bar">
                <span
                  v-for="n in 4"
                  :key="n"
                  class="strength-segment"
                  :class="strengthClass(n)"
                ></span>
              </div>
              <p v-if="passwordMsg" class="field-hint" :style="{ color: passwordMsgColor === 'green' ? 'var(--color-success)' : '#e05c4b' }">
                {{ passwordMsg }}
              </p>
              <p v-if="passwordError" class="field-error">{{ passwordError }}</p>
            </div>
            <div class="field-group" style="margin-top: 12px;">
              <div class="input-with-icon">
                <input
                  v-model="confirmPassword"
                  :type="showRegisterPassword ? 'text' : 'password'"
                  placeholder="Confirmer le mot de passe"
                  autocomplete="new-password"
                  @keydown.enter="goNext"
                  class="field-input"
                  :class="{ 'field-input--error': confirmPasswordError }"
                />
              </div>
              <p v-if="confirmPasswordError" class="field-error">{{ confirmPasswordError }}</p>
            </div>
          </div>

          <!-- Étape 4 : generating -->
          <div v-else-if="currentStep === 'generating'" key="generating" class="step step--centered">
            <div class="spinner-wrap">
              <svg class="spinner" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                <circle class="spinner-track" cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
                <circle class="spinner-arc" cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
              </svg>
            </div>
            <h2 class="step-title step-title--center">Génération de votre<br>espace sécurisé…</h2>
            <p class="step-subtitle">Clés RSA-4096 en cours de génération</p>
            <p v-if="generateError" class="field-error" style="margin-top:12px; text-align:center;">{{ generateError }}</p>
          </div>

          <!-- Étape 5 : recovery -->
          <div v-else-if="currentStep === 'recovery'" key="recovery" class="step step--recovery">
            <div class="recovery-header">
              <div class="recovery-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <div>
                <div class="step-label">Votre espace est prêt !</div>
                <h2 class="step-title step-title--recovery">Sauvegardez votre clé de récupération</h2>
              </div>
            </div>

            <p class="recovery-warning">
              Cette clé est <strong>la seule façon</strong> de retrouver l'accès à votre compte si vous oubliez votre mot de passe. <strong>Il n'en existe qu'un seul exemplaire.</strong>
            </p>

            <div class="recovery-key-preview">
              <div class="recovery-key-header">
                <div class="recovery-key-label">Votre clé</div>
                <button class="btn-copy" @click="copyRecoveryKey" :class="{ copied: copyStatus === 'copied' }">
                  <svg v-if="copyStatus !== 'copied'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {{ copyStatus === 'copied' ? 'Copié !' : 'Copier' }}
                </button>
              </div>
              <div class="recovery-key-value">{{ recoveryKeyValue }}</div>
            </div>

            <p class="recovery-last-chance">
              Cette page est la <strong>seule occasion</strong> de récupérer cette clé — elle ne sera plus jamais affichée.
            </p>

            <div class="recovery-actions">
              <button class="btn btn--primary btn--recovery-dl" @click="downloadRecoveryKey" :disabled="downloadStatus === 'downloading'">
                <svg v-if="downloadStatus !== 'done'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon" :class="{ 'btn-icon--spinning': downloadStatus === 'downloading' }">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ downloadStatus === 'downloading' ? 'Préparation…' : downloadStatus === 'done' ? 'Téléchargé !' : 'Télécharger la clé' }}
              </button>
              <p v-if="downloadStatus === 'done'" class="download-hint">
                Dans la fenêtre qui s'est ouverte, choisissez "Enregistrer en PDF".
              </p>
            </div>
          </div>

        </Transition>
      </div>

      <!-- Actions navigation -->
      <div class="card-footer" v-if="currentStep !== 'generating'">
        <button
          v-if="currentStep !== 'username'"
          class="btn btn--ghost"
          @click="goBack"
          :disabled="currentStep === 'recovery'"
        >
          ← Retour
        </button>
        <div v-else></div>

        <button
          v-if="currentStep !== 'recovery'"
          class="btn btn--primary"
          @click="goNext"
          :disabled="!canGoNext"
        >
          Suivant →
        </button>
        <button
          v-else
          class="btn btn--primary"
          @click="navigateTo('/drive')"
        >
          Accéder à mon drive →
        </button>
      </div>

      <!-- Lien login -->
      <div class="card-login-link" v-if="currentStep !== 'generating' && currentStep !== 'recovery'">
        Déjà un compte ?
        <button class="link-btn" @click="navigateTo('/login')">Se connecter</button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: "blank",
});
import { ref, computed, watch, nextTick } from "vue";
import { useHead } from "#imports";
import { useAuth } from "~/composables/useAuth";

const { requestOtp, validateOtp, finalizeRegistration } = useAuth();
const { isDark, toggleTheme } = useTheme();

// ─── État du formulaire ───────────────────────────────────────────────────────
const loading = ref(false);
const registerForm = ref({ username: "", email: "", password: "" });
const showRegisterPassword = ref(false);
const passwordMsg = ref("");
const passwordMsgColor = ref("");
const emailInputRef = ref(null);
const recoveryKeyValue = ref("");
const generateError = ref("");
const downloadStatus = ref("idle"); // 'idle' | 'downloading' | 'done'
const copyStatus = ref("idle"); // 'idle' | 'copied'
const otpCode = ref("");
const tempToken = ref("");
const otpInputRefs = ref([]);

const setOtpInputRef = (el, index) => {
  if (el) otpInputRefs.value[index] = el;
};

const handleOtpInput = (event, index) => {
  const target = event.target;
  const sanitizedValue = (target.value || "")
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, "")
  .slice(0, 1);
  target.value = sanitizedValue;

  otpCode.value = otpInputRefs.value
    .map((input) => input?.value || "")
    .join("");

  if (sanitizedValue && index < 5) {
    otpInputRefs.value[index + 1]?.focus();
  }

  if (otpCode.value.length === 6) {
    goNext();
  }
};

const handleOtpBackspace = (event, index) => {
  const target = event.target;
  if ((target.value || "").length === 0 && index > 0) {
    otpInputRefs.value[index - 1]?.focus();
  }
};
// ─── Navigation par étapes ────────────────────────────────────────────────────
const currentStep = ref("username"); // 'username'|'email'|'otp'|'password'|'generating'|'recovery'
const direction = ref("forward");
const steps = ["username", "email","otp","password", "generating", "recovery"];
const visibleSteps = ["username", "email", "otp", "password", "recovery"]; // dots de progression (4 visibles)

const stepIndex = computed(() => steps.indexOf(currentStep.value));

// ─── Erreurs inline ───────────────────────────────────────────────────────────
const usernameError = ref("");
const emailError = ref("");
const passwordError = ref("");
const otpError = ref("");
const confirmPassword = ref("");
const confirmPasswordError = ref("");

// ─── Validation ──────────────────────────────────────────────────────────────
const validateEmail = (email) => {
  const re =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  const hasDotInDomain =
    email.includes("@") && email.split("@")[1].includes(".");
  const final =
    re.test(email) &&
    email.length <= 254 &&
    !email.startsWith(".") &&
    !email.endsWith(".") &&
    hasDotInDomain;

  if (emailInputRef.value) {
    emailInputRef.value.style.color = final
      ? "var(--color-success)"
      : "var(--color-pastel-danger)";
  }

  return final;
};

const passwordRules = computed(() => {
  const p = registerForm.value.password;
  return {
    hasMinLength: p.length >= 10,
    hasUpperCase: /[A-Z]/.test(p),
    hasNumber: /[0-9]/.test(p),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
  };
});

const passwordStrength = computed(() => {
  const r = passwordRules.value;
  return [r.hasMinLength, r.hasUpperCase, r.hasNumber, r.hasSpecialChar].filter(Boolean).length;
});

const isPasswordValid = computed(() => passwordStrength.value === 4);

const strengthClass = (n) => {
  if (n > passwordStrength.value) return "";
  if (passwordStrength.value === 1) return "strength--weak";
  if (passwordStrength.value === 2) return "strength--fair";
  if (passwordStrength.value === 3) return "strength--good";
  return "strength--strong";
};

const changement = () => {
  const password = registerForm.value.password;
  passwordError.value = "";

  if (password.length === 0) {
    passwordMsg.value = "";
    passwordMsgColor.value = "";
    return;
  }

  const r = passwordRules.value;
  const errors = [];
  if (!r.hasMinLength) errors.push("10 caractères minimum");
  if (!r.hasUpperCase) errors.push("1 majuscule");
  if (!r.hasNumber) errors.push("1 chiffre");
  if (!r.hasSpecialChar) errors.push("1 caractère spécial");

  if (errors.length > 0) {
    passwordMsgColor.value = "red";
    passwordMsg.value = `Manquant : ${errors.join(", ")}`;
  } else {
    passwordMsgColor.value = "green";
    passwordMsg.value = "✓ Mot de passe valide";
  }
};

// ─── Peut-on avancer ? ────────────────────────────────────────────────────────
const canGoNext = computed(() => {
  switch (currentStep.value) {
    case "username":
      return registerForm.value.username.trim().length >= 2;
    case "email":
      return validateEmail(registerForm.value.email);
    case "otp":
      return otpCode.value.trim().length === 6;
    case "password":
      return isPasswordValid.value;
    default:
      return false;
  }
});

// ─── Navigation ───────────────────────────────────────────────────────────────
const goNext = async () => {
  if (!canGoNext.value) return;

  usernameError.value = "";
  emailError.value = "";
  passwordError.value = "";
  otpError.value = "";
  confirmPasswordError.value = "";

  direction.value = "forward";

  if (currentStep.value === "email") {
    try {
      await requestOtp(registerForm.value.email);
      currentStep.value = "otp";
    } catch (error) {
      emailError.value = error.message || "Erreur lors de l'envoi du code OTP";
    }
    return;
  }

  if (currentStep.value === "otp") {
    try {
      tempToken.value = await validateOtp(registerForm.value.email, otpCode.value.trim().toUpperCase());
      currentStep.value = "password";
    } catch (error) {
      otpError.value = error.message || "Code OTP invalide";
    }
    return;
  }

  if (currentStep.value === "password") {
    if (registerForm.value.password !== confirmPassword.value) {
      confirmPasswordError.value = "Les mots de passe ne correspondent pas.";
      return;
    }
    confirmPasswordError.value = "";
    currentStep.value = "generating";
    return;
  }

  const idx = steps.indexOf(currentStep.value);
  if (idx < steps.length - 1) {
    currentStep.value = steps[idx + 1];
  }
};

const goBack = () => {
  if (currentStep.value === "recovery") return;
  direction.value = "backward";
  const idx = steps.indexOf(currentStep.value);
  if (idx > 0) {
    currentStep.value = steps[idx - 1];
  }
};

// ─── Déclenche handleRegister quand on arrive sur 'generating' ────────────────
watch(currentStep, async (step) => {
  if (step === "generating") {
    generateError.value = "";
    await nextTick();
    await handleRegister();
  }
});

// ─── Register ─────────────────────────────────────────────────────────────────
const handleRegister = async () => {
  loading.value = true;
  try {
    const recoveryKey = await finalizeRegistration(
      registerForm.value.username,
      registerForm.value.password,
      registerForm.value.email,
      tempToken.value,
    );

    recoveryKeyValue.value = recoveryKey;
    direction.value = "forward";
    currentStep.value = "recovery";
  } catch (error) {
    generateError.value = error.message || "Erreur lors de l'inscription";
    // Revenir à l'étape password après un court délai
    setTimeout(() => {
      direction.value = "backward";
      currentStep.value = "password";
      generateError.value = "";
    }, 2000);
  } finally {
    loading.value = false;
  }
};

// ─── Générer QR code SVG inline (sans appel réseau) ───────────────────────────
const generateQRSvg = async (text) => {
  const { renderSVG } = await import('uqr');
  return renderSVG(text, { ecc: 'M' });
};

const copyRecoveryKey = async () => {
  await navigator.clipboard.writeText(recoveryKeyValue.value);
  copyStatus.value = "copied";
  setTimeout(() => { copyStatus.value = "idle"; }, 2000);
};

// ─── Télécharger la clé de récupération (PDF imprimable) ──────────────────────
const downloadRecoveryKey = async () => {
  downloadStatus.value = "downloading";
  const key = recoveryKeyValue.value;
  const recoveryUrl = `${window.location.origin}/recovery#recoveryKey=${encodeURIComponent(key)}`;
  const qrSvg = await generateQRSvg(recoveryUrl);
  const date = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Gauzian — Clé de secours</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Montserrat', sans-serif;
      background: #fff;
      color: #1a1a1a;
      padding: 48px;
      max-width: 680px;
      margin: 0 auto;
      font-size: 14px;
      line-height: 1.6;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: 2px; }
    .date { font-size: 12px; color: #888; }
    hr { border: none; border-top: 1px solid #ccc; margin: 10px 0 28px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    .intro { margin-bottom: 20px; color: #333; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #888;
      margin-bottom: 10px;
    }
    .points { margin-bottom: 24px; }
    .point { display: flex; gap: 10px; margin-bottom: 10px; color: #333; }
    .point-icon { flex-shrink: 0; color: #1a1a1a; font-size: 13px; padding-top: 1px; }
    .key-box {
      background: #f7f7f7;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 14px 16px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      word-break: break-all;
      line-height: 1.9;
      color: #1a1a1a;
      margin-bottom: 24px;
    }
    .bottom-section {
      display: flex;
      align-items: flex-start;
      gap: 28px;
      margin-bottom: 28px;
    }
    .qr-wrap {
      flex-shrink: 0;
      width: 140px;
    }
    .qr-wrap svg {
      width: 140px;
      height: 140px;
      display: block;
    }
    .instructions { flex: 1; }
    .instructions .section-title { margin-bottom: 8px; }
    .step { display: flex; gap: 8px; margin-bottom: 7px; font-size: 13px; color: #333; }
    .step-num {
      flex-shrink: 0;
      width: 20px; height: 20px;
      background: #1a1a1a; color: #fff;
      border-radius: 50%;
      font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      margin-top: 1px;
    }
    .qr-note { margin-top: 10px; font-size: 12px; color: #555; line-height: 1.5; }
    .footer {
      border-top: 1px solid #e0e0e0;
      padding-top: 12px;
      font-size: 11px;
      color: #aaa;
      text-align: center;
    }
    @media print {
      body { padding: 28px; }
      @page { margin: 1.2cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">GAUZIAN</div>
    <div class="date">${date}</div>
  </div>
  <hr>

  <h1>Votre clé de secours</h1>
  <p class="intro">
    Bonjour&nbsp;! Vous venez de créer votre compte Gauzian.<br>
    Ce document contient votre clé de secours.
  </p>

  <div class="section-title">Qu'est-ce que c'est&nbsp;?</div>
  <p class="intro">
    Imaginez cette clé comme un double de vos clés de maison. Si un jour vous oubliez
    votre mot de passe, cette clé vous permettra de retrouver l'accès à votre compte
    et à tous vos fichiers.
  </p>

  <div class="section-title">À savoir</div>
  <div class="points">
    <div class="point">
      <span class="point-icon">✦</span>
      <span>Cette clé a été créée uniquement pour vous. Il n'en existe qu'un seul exemplaire — celui-ci.</span>
    </div>
    <div class="point">
      <span class="point-icon">✦</span>
      <span>Nous ne pouvons pas vous en envoyer une autre, donc gardez ce document précieusement.</span>
    </div>
    <div class="point">
      <span class="point-icon">✦</span>
      <span>Comme un double de clés, ne le laissez pas traîner n'importe où — un tiroir ou un classeur personnel, c'est parfait.</span>
    </div>
  </div>

  <hr>
  <div class="section-title">Votre clé personnelle</div>
  <div class="key-box">${key}</div>

  <hr>
  <div class="bottom-section">
    <div class="qr-wrap">${qrSvg}</div>
    <div class="instructions">
      <div class="section-title">Comment l'utiliser si besoin</div>
      <div class="step"><div class="step-num">1</div><span>Aller sur <strong>gauzian.pupin.fr</strong></span></div>
      <div class="step"><div class="step-num">2</div><span>Cliquer « Mot de passe oublié »</span></div>
      <div class="step"><div class="step-num">3</div><span>Entrer votre email + cette clé</span></div>
      <div class="step"><div class="step-num">4</div><span>Choisir un nouveau mot de passe</span></div>
      <p class="qr-note">Sur téléphone&nbsp;: scannez le QR code, il vous amène directement au bon endroit.</p>
    </div>
  </div>

  <hr>
  <div class="footer">Gauzian — stockage privé &bull; gauzian.pupin.fr</div>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) setTimeout(() => URL.revokeObjectURL(url), 15000);
  downloadStatus.value = "done";
};

useHead({
  title: "Gauzian | Créer un compte",
  lang: "fr",
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossorigin: "anonymous",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
    },
  ],
});
</script>

<style scoped>
/* ─── Reset ──────────────────────────────────────────────────────────────────── */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
.page {
  min-height: 100vh;
  width: 100%;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: "Montserrat", sans-serif;
}

/* ─── Card ───────────────────────────────────────────────────────────────────── */
.register-card {
  width: 100%;
  max-width: 460px;
}

/* ─── Card Header ────────────────────────────────────────────────────────────── */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 8px;
}

.brand {
  font-family: "Montserrat", sans-serif;
  font-weight: 800;
  font-size: 20px;
  color: var(--color-neutral-900);
}

.step-dots {
  display: flex;
  gap: 6px;
  align-items: center;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cccccc;
  transition: all 0.3s ease;
}

.dot.active {
  background: var(--color-neutral-900);
  width: 22px;
  border-radius: 4px;
}

.dot.completed {
  background: var(--color-neutral-700);
  opacity: 0.4;
}

/* ─── Card Body ──────────────────────────────────────────────────────────────── */
.card-body {
  padding: 20px 0 12px;
  min-height: 200px;
  overflow: hidden;
  position: relative;
}

/* ─── Step ───────────────────────────────────────────────────────────────────── */
.step {
  width: 100%;
}

.step--centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 0;
}

.step-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-neutral-700);
  margin-bottom: 6px;
}

.step-title {
  font-family: "Montserrat", sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-neutral-900);
  line-height: 1.3;
  margin-bottom: 22px;
}

.step-title--center {
  text-align: center;
  margin-top: 16px;
}

.step-subtitle {
  font-size: 13px;
  color: #666;
  margin-top: 6px;
}

/* ─── Field ──────────────────────────────────────────────────────────────────── */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #cccccc;
  border-radius: 4px;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  color: var(--color-neutral-900);
  background: white;
  transition: border-color 0.15s ease;
  outline: none;
}

.field-input:focus {
  border-color: var(--color-neutral-900);
}

.field-input--error {
  border-color: var(--color-pastel-danger);
}

.field-error {
  font-size: 12px;
  color: var(--color-pastel-danger);
  font-weight: 500;
}

.field-hint {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.otp-inputs {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 3px;
  width: 100%;
}
.otp-input{
  width: 100%;
  padding: 10px;
  border: 1px solid #cccccc;
  border-radius: 4px;
  font-family: "Montserrat", sans-serif;
  font-size: 18px;
  text-align: center;
  color: var(--color-neutral-900);
  background: white;
  transition: border-color 0.15s ease;
}

/* ─── Input with icon ────────────────────────────────────────────────────────── */
.input-with-icon {
  position: relative;
  width: 100%;
}

.input-with-icon .field-input {
  padding-right: 40px;
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
  transition: color 0.15s ease;
}

.icon-btn:hover {
  color: #333;
}

.icon {
  width: 20px;
  height: 20px;
}

/* ─── Strength bar ───────────────────────────────────────────────────────────── */
.strength-bar {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.strength-segment {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: #dddddd;
  transition: background-color 0.3s ease;
}

.strength--weak   { background: var(--color-danger) !important; }
.strength--fair   { background: #f59d3d !important; }
.strength--good   { background: #e8c23a !important; }
.strength--strong { background: var(--color-success) !important; }

/* ─── Spinner ────────────────────────────────────────────────────────────────── */
.spinner-wrap {
  width: 48px;
  height: 48px;
  margin-bottom: 10px;
}

.spinner {
  width: 48px;
  height: 48px;
  animation: rotate 1.4s linear infinite;
}

.spinner-track {
  stroke: #dddddd;
}

.spinner-arc {
  stroke: var(--color-neutral-900);
  stroke-linecap: round;
  stroke-dasharray: 80 200;
  stroke-dashoffset: 0;
  animation: dash 1.4s ease-in-out infinite;
}

@keyframes rotate {
  100% { transform: rotate(360deg); }
}

@keyframes dash {
  0%   { stroke-dasharray: 1 200; stroke-dashoffset: 0; }
  50%  { stroke-dasharray: 89 200; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 89 200; stroke-dashoffset: -124; }
}

/* ─── Recovery ───────────────────────────────────────────────────────────────── */
.register-card--recovery {
  max-width: 540px;
}

.step--recovery {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recovery-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.recovery-icon {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0faf0;
  border-radius: 14px;
  color: #2a7a3a;
}

.recovery-icon svg {
  width: 28px;
  height: 28px;
}

.step-title--recovery {
  font-size: 18px;
  line-height: 1.3;
  margin-bottom: 0;
}

.recovery-warning {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  padding: 14px 16px;
  background: #fffbee;
  border-left: 4px solid #d4a017;
  border-radius: 0 6px 6px 0;
  margin: 0;
}

.recovery-warning strong {
  color: #1a1a1a;
}

.recovery-key-preview {
  background: #f7f7f7;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 14px 16px;
}

.recovery-key-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.recovery-key-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #999;
}

.recovery-key-value {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
  line-height: 1.8;
  color: #1a1a1a;
  user-select: all;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  background: none;
  border: 1px solid #d0d0d0;
  border-radius: 5px;
  padding: 3px 9px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  font-family: inherit;
}

.btn-copy:hover {
  color: #1a1a1a;
  border-color: #aaa;
}

.btn-copy.copied {
  color: #2a7a3a;
  border-color: #a0d4a8;
  background: #f0faf0;
}

.recovery-last-chance {
  font-size: 13px;
  color: #555;
  line-height: 1.55;
  padding: 11px 14px;
  background: #f5f5f5;
  border-radius: 6px;
  border-left: 3px solid #aaa;
}

.recovery-last-chance strong {
  color: #1a1a1a;
}

.btn--recovery-dl {
  width: 100%;
  padding: 14px;
  font-size: 15px;
}

.download-hint {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  text-align: center;
  margin-top: 2px;
}

.btn-icon--spinning {
  animation: btn-spin 1s linear infinite;
}

@keyframes btn-spin {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}

.recovery-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ─── Buttons ────────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 15px;
  border-radius: 4px;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s ease;
  white-space: nowrap;
}

.btn:disabled {
  background-color: #aaaaaa;
  cursor: not-allowed;
}

.btn--primary {
  background-color: var(--color-neutral-900);
  color: #ffffff;
}

.btn--primary:not(:disabled):hover {
  background-color: var(--color-neutral-700);
}

.btn--ghost {
  background: transparent;
  color: #333;
  text-decoration: underline;
  font-weight: 500;
}

.btn--ghost:not(:disabled):hover {
  color: #000;
}

.btn--ghost:disabled {
  background: transparent;
  color: #aaaaaa;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* ─── Card Footer ────────────────────────────────────────────────────────────── */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 8px;
  gap: 10px;
}

/* ─── Login link ─────────────────────────────────────────────────────────────── */
.card-login-link {
  text-align: center;
  padding-top: 12px;
  font-size: 13px;
  font-family: "Montserrat", sans-serif;
  color: #444;
}

.link-btn {
  background: none;
  border: none;
  font-family: "Montserrat", sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-neutral-900);
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
  text-decoration: underline;
  transition: color 0.15s ease;
}

.link-btn:hover {
  color: var(--color-neutral-700);
}

/* ─── Transitions slide ──────────────────────────────────────────────────────── */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.slide-left-enter-from  { opacity: 0; transform: translateX(28px); }
.slide-left-leave-to    { opacity: 0; transform: translateX(-28px); }
.slide-right-enter-from { opacity: 0; transform: translateX(-28px); }
.slide-right-leave-to   { opacity: 0; transform: translateX(28px); }

/* ─── Theme toggle button ────────────────────────────────────────────────────── */
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-toggle {
  background: none;
  border: 1px solid #cccccc;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  padding: 0;
  transition: border-color 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.theme-toggle svg {
  width: 16px;
  height: 16px;
}

.theme-toggle:hover {
  border-color: var(--color-neutral-900);
  color: var(--color-neutral-900);
}

/* ─── Dark mode ──────────────────────────────────────────────────────────────── */
.page.dark {
  background: #1a1a1a;
}

.page.dark .brand {
  color: #f0f0f0;
}

.page.dark .theme-toggle {
  border-color: #444444;
  color: #aaaaaa;
}

.page.dark .theme-toggle:hover {
  border-color: #cccccc;
  color: #f0f0f0;
}

.page.dark .dot {
  background: #444444;
}

.page.dark .dot.active {
  background: #e0e0e0;
}

.page.dark .dot.completed {
  background: #e0e0e0;
  opacity: 0.35;
}

.page.dark .step-label {
  color: #aaaaaa;
}

.page.dark .step-title {
  color: #f0f0f0;
}

.page.dark .step-subtitle {
  color: #888888;
}

.page.dark .field-input {
  background: #252525;
  border-color: #444444;
  color: #f0f0f0;
}

.page.dark .field-input:focus {
  border-color: #cccccc;
}

.page.dark .field-input::placeholder {
  color: #555555;
}

.page.dark .icon-btn {
  color: #777777;
}

.page.dark .icon-btn:hover {
  color: #dddddd;
}

.page.dark .strength-segment {
  background: #444444;
}

.page.dark .spinner-track {
  stroke: #333333;
}

.page.dark .spinner-arc {
  stroke: #dddddd;
}

.page.dark .recovery-icon {
  background: #0d2b14;
  color: #5dc67a;
}

.page.dark .recovery-warning {
  background: #1e1a0a;
  border-color: #5a4a10;
  color: #c8b870;
}

.page.dark .recovery-warning strong {
  color: #f0d060;
}

.page.dark .recovery-key-preview {
  background: #1a1a1a;
  border-color: #333;
}

.page.dark .recovery-key-value {
  color: #e0e0e0;
}

.page.dark .btn-copy {
  color: #888;
  border-color: #444;
}

.page.dark .btn-copy:hover {
  color: #ddd;
  border-color: #666;
}

.page.dark .btn-copy.copied {
  color: #5dc67a;
  border-color: #2a5a34;
  background: #0d2b14;
}

.page.dark .recovery-last-chance {
  background: #1e1e1e;
  border-color: #555;
  color: #aaa;
}

.page.dark .recovery-last-chance strong {
  color: #e0e0e0;
}

.page.dark .download-hint {
  color: #aaa;
}

.page.dark .btn--primary {
  background-color: #dddddd;
  color: #111111;
}

.page.dark .btn--primary:not(:disabled):hover {
  background-color: #ffffff;
}

.page.dark .btn--ghost {
  color: #aaaaaa;
}

.page.dark .btn--ghost:not(:disabled):hover {
  color: #eeeeee;
}

.page.dark .card-login-link {
  color: #888888;
}

.page.dark .link-btn {
  color: #cccccc;
}

.page.dark .link-btn:hover {
  color: #ffffff;
}

.page.dark .field-error {
  color: #f07060;
}

/* ─── Responsive mobile ──────────────────────────────────────────────────────── */
@media (max-width: 520px) {
  .step-title {
    font-size: 19px;
  }
}
</style>
