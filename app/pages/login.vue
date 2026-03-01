<template>
  <div class="page" :class="{ dark: isDark }">
    <div class="login-card">
      <!-- En-tête -->
      <div class="card-header">
        <span class="brand">GAUZIAN</span>
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
      </div>

      <!-- Formulaire -->
      <div class="card-body">
        <div class="step-label">Bon retour !</div>
        <h2 class="step-title">Connectez-vous à votre espace</h2>

        <form @submit.prevent="handleLogin" autocomplete="on">
          <div class="field-group">
            <label class="field-label" for="login_email">Adresse email</label>
            <input
              ref="emailInputRef"
              v-model="loginForm.email"
              type="email"
              id="login_email"
              name="username"
              autocomplete="username"
              placeholder="votre@email.com"
              @input="validateEmail(loginForm.email)"
              @keydown.enter.prevent
              class="field-input"
              required
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="login_password">Mot de passe</label>
            <div class="input-with-icon">
              <input
                v-model="loginForm.password"
                :type="showLoginPassword ? 'text' : 'password'"
                id="login_password"
                name="password"
                autocomplete="current-password"
                placeholder="Mot de passe"
                class="field-input"
                required
              />
              <button
                type="button"
                class="icon-btn"
                @click="showLoginPassword = !showLoginPassword"
                :aria-label="showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
              >
                <svg v-if="!showLoginPassword" class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          </div>
          <p v-if="connnError" class="field-error">{{ connnError }}</p>

          <button type="submit" class="btn btn--primary" :disabled="loading">
            {{ loading ? "Connexion…" : "Se connecter" }}
          </button>
        </form>
      </div>

      <!-- Lien inscription -->
      <div class="card-register-link">
        Pas encore de compte ?
        <button class="link-btn" @click="navigateTo('/register')">Créer un compte</button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: "blank",
});
import { ref } from "vue";
import { useHead } from "#imports";
import { useAuth } from "~/composables/useAuth";

const { login } = useAuth();
const { isDark, toggleTheme } = useTheme();

// ─── Formulaire ───────────────────────────────────────────────────────────────
const loading = ref(false);
const loginForm = ref({ email: "", password: "" });
const showLoginPassword = ref(false);
const emailInputRef = ref(null);
const connnError = ref(null);

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

const handleLogin = async () => {
  if (!validateEmail(loginForm.value.email)) {
    alert("Email invalide");
    return;
  }

  loading.value = true;
  try {
    await login(loginForm.value.email, loginForm.value.password);
    if (import.meta.dev) {
      console.log("Login OK");
    }
    await navigateTo("/drive");
  } catch (error) {
    if (error.message === "Invalid credentials") {
      connnError.value = "Email ou mot de passe incorrect";
    } else if (error.message === "Network Error") {
      connnError.value = "Impossible de se connecter au serveur";
    } else {
      connnError.value = error.message || "Échec de la connexion";
    }
    // alert(error.message || "Login failed");
  } finally {
    loading.value = false;
  }
};

useHead({
  title: "Gauzian | Connexion",
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
.login-card {
  width: 100%;
  max-width: 400px;
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

/* ─── Theme toggle ───────────────────────────────────────────────────────────── */
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
}

.theme-toggle svg {
  width: 16px;
  height: 16px;
}

.theme-toggle:hover {
  border-color: var(--color-neutral-900);
  color: var(--color-neutral-900);
}

/* ─── Card Body ──────────────────────────────────────────────────────────────── */
.card-body {
  padding: 20px 0 12px;
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

/* ─── Form ───────────────────────────────────────────────────────────────────── */
form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  color: var(--color-neutral-900);
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

.field-error {
  font-size: 12px;
  color: var(--color-pastel-danger);
  font-weight: 500;
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

/* ─── Buttons ────────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 15px;
  border-radius: 4px;
  font-family: "Montserrat", sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s ease;
  width: 100%;
  margin-top: 5px;
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

/* ─── Register link ──────────────────────────────────────────────────────────── */
.card-register-link {
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

.page.dark .step-label {
  color: #aaaaaa;
}

.page.dark .step-title {
  color: #f0f0f0;
}

.page.dark .field-label {
  color: #cccccc;
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

.page.dark .btn--primary {
  background-color: #dddddd;
  color: #111111;
}

.page.dark .btn--primary:not(:disabled):hover {
  background-color: #ffffff;
}

.page.dark .card-register-link {
  color: #888888;
}

.page.dark .link-btn {
  color: #cccccc;
}

.page.dark .link-btn:hover {
  color: #ffffff;
}

/* ─── Responsive mobile ──────────────────────────────────────────────────────── */
@media (max-width: 520px) {
  .step-title {
    font-size: 19px;
  }
}
</style>
