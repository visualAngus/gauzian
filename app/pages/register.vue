<template>
  <div class="page" :class="{ dark: isDark }">
    <div class="register-card">
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
          <div v-else-if="currentStep === 'recovery'" key="recovery" class="step">
            <div class="recovery-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <div class="step-label">Votre espace est prêt !</div>
            <h2 class="step-title">Sauvegardez<br>votre clé de récupération</h2>
            <p class="recovery-warning">
              Cette clé est <strong>indispensable</strong> pour récupérer votre compte si vous perdez votre mot de passe. Conservez-la en lieu sûr.
            </p>
            <div class="recovery-actions">
              <button class="btn btn--primary" @click="downloadRecoveryKey">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Télécharger la clé
              </button>
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

// ─── Télécharger la clé de récupération ──────────────────────────────────────
const downloadRecoveryKey = () => {
  const element = document.createElement("a");
  const file = new Blob([recoveryKeyValue.value], { type: "text/plain" });
  element.href = URL.createObjectURL(file);
  element.download = "gauzian_recovery_key.txt";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
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
.recovery-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  color: var(--color-neutral-900);
}

.recovery-icon svg {
  width: 28px;
  height: 28px;
}

.recovery-warning {
  font-size: 13px;
  color: #444;
  line-height: 1.55;
  padding: 12px 14px;
  background: #fffbf0;
  border: 1px solid #e8d48a;
  border-radius: 4px;
  margin-bottom: 18px;
}

.recovery-warning strong {
  color: var(--color-neutral-900);
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
  color: #cccccc;
}

.page.dark .recovery-warning {
  background: #1e1a0a;
  border-color: #5a4a10;
  color: #c8b870;
}

.page.dark .recovery-warning strong {
  color: #f0d060;
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
