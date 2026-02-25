<template>
  <div class="page" :class="{ dark: isDark }">
    <div class="recovery-card">
      <div class="card-header">
        <span class="brand">GAUZIAN</span>
        <div class="header-right">
          <button
            class="theme-toggle"
            @click="toggleTheme"
            :aria-label="isDark ? 'Mode clair' : 'Mode sombre'"
          >
            <svg
              v-if="isDark"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          <div class="step-dots">
            <span class="dot" :class="{ active: step === 1, completed: step > 1 }"></span>
            <span class="dot" :class="{ active: step === 2, completed: step > 2 }"></span>
            <span class="dot" :class="{ active: step === 3 }"></span>
          </div>
        </div>
      </div>

      <div class="card-body">
        <Transition :name="direction === 'forward' ? 'slide-left' : 'slide-right'" mode="out-in">
          <div v-if="step === 1" key="email-step" class="step">
            <div class="step-label">Récupération</div>
            <h2 class="step-title">Entrez votre adresse email</h2>

            <div class="field-group">
              <input
                ref="emailInputRef"
                v-model="form.email"
                type="email"
                autocomplete="username"
                placeholder="votre@email.com"
                class="field-input"
                :class="{ 'field-input--error': emailError }"
                @input="validateEmail(form.email)"
                @keydown.enter="goToStep2"
              />
              <p v-if="emailError" class="field-error">{{ emailError }}</p>
            </div>
          </div>

          <div v-else-if="step === 2" key="key-step" class="step">
            <div class="step-label">Étape finale</div>
            <h2 class="step-title">Saisissez votre clé de récupération</h2>

            <div class="field-group">
              <textarea
                v-model="form.recoveryKey"
                class="field-input field-textarea"
                :class="{ 'field-input--error': recoveryKeyError }"
                placeholder="Collez votre clé de récupération ici"
                @input="recoveryKeyError = ''"
              ></textarea>
              <p v-if="recoveryKeyError" class="field-error">{{ recoveryKeyError }}</p>
            </div>

            <div class="or-divider">ou</div>

            <div class="upload-block">
              <input
                ref="fileInputRef"
                type="file"
                class="hidden-input"
                accept=".pdf,.html,.txt"
                @change="handleRecoveryFile"
              />
              <button class="btn btn--ghost" @click="openFilePicker">
                Importer un fichier de récupération
              </button>
              <p v-if="selectedFileName" class="upload-name">Fichier sélectionné : {{ selectedFileName }}</p>
              <p class="upload-hint">
                PDF, HTML ou TXT accepté. Si le fichier contient la clé, elle sera préremplie.
              </p>
            </div>

            <p v-if="globalError" class="field-error">{{ globalError }}</p>
          </div>

          <div v-else key="password-step" class="step">
            <div class="step-label">Compte vérifié</div>
            <h2 class="step-title">Choisissez un nouveau mot de passe</h2>

            <div class="field-group">
              <input
                v-model="form.newPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Nouveau mot de passe"
                class="field-input"
                :class="{ 'field-input--error': passwordError }"
                @input="passwordError = ''"
              />

              <input
                v-model="form.confirmPassword"
                type="password"
                autocomplete="new-password"
                placeholder="Confirmer le mot de passe"
                class="field-input"
                :class="{ 'field-input--error': passwordError }"
                @input="passwordError = ''"
              />

              <p class="field-hint">Utilisez au moins 10 caractères.</p>
              <p v-if="passwordError" class="field-error">{{ passwordError }}</p>
              <p v-if="globalError" class="field-error">{{ globalError }}</p>
            </div>
          </div>
        </Transition>
      </div>

      <div class="card-footer">
        <button v-if="step > 1" class="btn btn--ghost" @click="goBack">Retour</button>
        <div v-else></div>

        <button
          v-if="step === 1"
          class="btn btn--primary"
          :disabled="!isEmailValid"
          @click="goToStep2"
        >
          Continuer
        </button>

        <button v-else-if="step === 2" class="btn btn--primary" :disabled="submitting" @click="submitRecovery">
          {{ submitting ? "Vérification..." : "Valider la récupération" }}
        </button>

        <button v-else class="btn btn--primary" :disabled="submitting" @click="submitNewPassword">
          {{ submitting ? "Mise à jour..." : "Changer le mot de passe" }}
        </button>
      </div>

      <div class="card-login-link">
        Retour à la connexion
        <button class="link-btn" @click="navigateTo('/login')">Se connecter</button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: "blank",
});

import { ref, computed } from "vue";
import { useHead } from "#imports";

const { isDark, toggleTheme } = useTheme();

const step = ref(1);
const direction = ref("forward");
const submitting = ref(false);

const form = ref({
  email: "",
  recoveryKey: "",
  newPassword: "",
  confirmPassword: "",
});

const emailError = ref("");
const recoveryKeyError = ref("");
const passwordError = ref("");
const globalError = ref("");
const selectedFileName = ref("");

const emailInputRef = ref(null);
const fileInputRef = ref(null);

const validateEmail = (email) => {
  const re =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  const hasDotInDomain = email.includes("@") && email.split("@")[1]?.includes(".");
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

const isEmailValid = computed(() => validateEmail(form.value.email));

const goToStep2 = async () => {
  emailError.value = "";
  globalError.value = "";

  if (!isEmailValid.value) {
    emailError.value = "Adresse email invalide.";
    return;
  }

  // TODO: appeler la fonction/API qui vérifie l'email pour recovery
  // Exemple: await verifyRecoveryEmail(form.value.email)

  direction.value = "forward";
  step.value = 2;
};

const goBack = () => {
  direction.value = "backward";
  if (step.value > 1) {
    step.value -= 1;
  }
};

const openFilePicker = () => {
  fileInputRef.value?.click();
};

const extractRecoveryKeyFromText = (content) => {
  const hashMatch = content.match(/recoveryKey=([^\s"'<>]+)/i);
  if (hashMatch?.[1]) {
    return decodeURIComponent(hashMatch[1]).trim();
  }

  const keyBoxMatch = content.match(/<div class="key-box">([\s\S]*?)<\/div>/i);
  if (keyBoxMatch?.[1]) {
    return keyBoxMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  const base64Like = content.match(/[A-Za-z0-9+/=]{80,}/);
  if (base64Like?.[0]) {
    return base64Like[0].trim();
  }

  return "";
};

const handleRecoveryFile = async (event) => {
  const file = event.target?.files?.[0];
  if (!file) return;

  selectedFileName.value = file.name;
  globalError.value = "";

  try {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".pdf")) {
      // TODO: appeler une fonction d'extraction de clé depuis PDF
      // Option 1: parser PDF côté front (pdf.js)
      // Option 2: upload temporaire au backend et extraction serveur
      globalError.value = "Extraction PDF non branchée pour l'instant. Collez la clé manuellement.";
      return;
    }

    const content = await file.text();
    const extracted = extractRecoveryKeyFromText(content);

    if (!extracted) {
      globalError.value = "Impossible d'extraire la clé depuis ce fichier.";
      return;
    }

    form.value.recoveryKey = extracted;
    console.log("Clé de récupération extraite :", extracted);
    recoveryKeyError.value = "";
  } catch {
    globalError.value = "Lecture du fichier impossible.";
  }
};

const validateRecoveryKey = (key) => {
  if (key.trim() && key.trim().length < 80) {
    recoveryKeyError.value = "La clé de récupération semble trop courte.";
  } else {
    recoveryKeyError.value = "";
  }
};



const submitRecovery = async () => {
  recoveryKeyError.value = "";
  passwordError.value = "";
  globalError.value = "";

  if (!form.value.recoveryKey.trim()) {
    recoveryKeyError.value = "La clé de récupération est requise.";
    return;
  }

  submitting.value = true;

  try {
    validateRecoveryKey(form.value.recoveryKey);


    // TODO: appeler la fonction/API qui valide email + recovery key
    // Exemple: await validateRecoveryKey(form.value.email, form.value.recoveryKey)

    direction.value = "forward";
    step.value = 3;
  } catch (error) {
    globalError.value = error?.message || "Erreur pendant la récupération.";
  } finally {
    submitting.value = false;
  }
};

const submitNewPassword = async () => {
  passwordError.value = "";
  globalError.value = "";

  if (form.value.newPassword.length < 10) {
    passwordError.value = "Le nouveau mot de passe doit contenir au moins 10 caractères.";
    return;
  }

  if (form.value.newPassword !== form.value.confirmPassword) {
    passwordError.value = "Les deux mots de passe ne correspondent pas.";
    return;
  }

  submitting.value = true;

  try {
    // TODO: appeler la fonction/API qui applique le nouveau mot de passe
    // Exemple:
    // await resetPasswordWithRecovery({
    //   email: form.value.email,
    //   recoveryKey: form.value.recoveryKey,
    //   newPassword: form.value.newPassword,
    // });

    await navigateTo("/login");
  } catch (error) {
    globalError.value = error?.message || "Erreur pendant le changement de mot de passe.";
  } finally {
    submitting.value = false;
  }
};

useHead({
  title: "Gauzian | Récupération",
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
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
}

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

.recovery-card {
  width: 100%;
  max-width: 460px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 8px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand {
  font-weight: 800;
  font-size: 20px;
  color: var(--color-neutral-900);
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
}

.theme-toggle svg {
  width: 16px;
  height: 16px;
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
  transition: all 0.2s ease;
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

.card-body {
  padding: 20px 0 12px;
  /* min-height: 260px; */
  overflow: hidden;
}

.step-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-neutral-700);
  margin-bottom: 6px;
}

.step-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-neutral-900);
  line-height: 1.3;
  margin-bottom: 18px;
}

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
  outline: none;
}

.field-input:focus {
  border-color: var(--color-neutral-900);
}

.field-textarea {
  min-height: 100px;
  resize: vertical;
}

.field-input--error {
  border-color: var(--color-pastel-danger);
}

.field-error {
  font-size: 12px;
  color: var(--color-pastel-danger);
  font-weight: 500;
  margin-top: 6px;
}

.field-hint {
  font-size: 12px;
  color: #666;
}

.or-divider {
  text-align: center;
  font-size: 13px;
  color: #777;
  margin: 12px 0;
}

.upload-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hidden-input {
  display: none;
}

.upload-name,
.upload-hint {
  font-size: 12px;
  color: #666;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 8px;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  padding: 0 15px;
  border-radius: 4px;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
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

.btn--ghost {
  background: transparent;
  color: #333;
  text-decoration: underline;
  font-weight: 500;
}

.card-login-link {
  text-align: center;
  padding-top: 12px;
  font-size: 13px;
  color: #444;
}

.link-btn {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-neutral-900);
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
  text-decoration: underline;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.page.dark {
  background: #1a1a1a;
}

.page.dark .brand,
.page.dark .step-title {
  color: #f0f0f0;
}

.page.dark .step-label {
  color: #aaaaaa;
}

.page.dark .dot {
  background: #444;
}

.page.dark .dot.active {
  background: #e0e0e0;
}

.page.dark .field-input {
  background: #252525;
  border-color: #444;
  color: #f0f0f0;
}

.page.dark .field-input::placeholder {
  color: #666;
}

.page.dark .btn--primary {
  background: #dddddd;
  color: #111;
}

.page.dark .btn--ghost,
.page.dark .card-login-link,
.page.dark .upload-name,
.page.dark .upload-hint {
  color: #aaaaaa;
}

.page.dark .link-btn {
  color: #ddd;
}

@media (max-width: 520px) {
  .step-title {
    font-size: 19px;
  }
}
</style>
