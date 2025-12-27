<template>
  <Header :userName="userName" :TITLE="'GZPROFILE'" />

  <main class="content-wrapper">
    <aside>
      <div class="profile-card">
        <div class="avatar">{{ userUserName }}</div>
        <h2>{{ userName }}</h2>
        <p class="email">{{ userMail }}</p>
      </div>
      <nav class="sidebar-nav">
        <button
          class="sidebar-btn"
          :class="{ active: activeTab === 'vue d\'ensemble' }"
          @click="activeTab = 'vue d\'ensemble'"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          Vue d'ensemble
        </button>
        <button
          class="sidebar-btn"
          :class="{ active: activeTab === 'paramètres' }"
          @click="activeTab = 'paramètres'"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Paramètres
        </button>
        <button
          class="sidebar-btn"
          :class="{ active: activeTab === 'sécurité' }"
          @click="activeTab = 'sécurité'"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Sécurité
        </button>
        <button
          class="sidebar-btn"
          :class="{ active: activeTab === 'notifications' }"
          @click="activeTab = 'notifications'"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Notifications
        </button>
        <button
          class="sidebar-btn"
          :class="{ active: activeTab === 'stockage' }"
          @click="activeTab = 'stockage'"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          Stockage
        </button>
      </nav>
    </aside>

    <section class="main-content">
      <div v-if="activeTab === 'vue d\'ensemble'" class="content">
        <h1>Vue d'ensemble</h1>
        <div class="owerview_drive">
          <div class="stat-card" @click="activeTab = 'stockage'">
            <div class="stat-icon files">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
                />
                <polyline points="13 2 13 9 20 9" />
              </svg>
            </div>
            <div class="stat-info">
              <h3>{{ stats.filesCount }}</h3>
              <p>Fichiers</p>
            </div>
          </div>
          <div class="stat-card" @click="activeTab = 'stockage'">
            <div class="stat-icon folders">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                />
              </svg>
            </div>
            <div class="stat-info">
              <h3>{{ stats.foldersCount }}</h3>
              <p>Dossiers</p>
            </div>
          </div>
          <div class="stat-card" @click="activeTab = 'stockage'">
            <div class="stat-icon storage">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                />
              </svg>
            </div>
            <div class="stat-info">
              <h3>{{ convert_byte_to_perfect(stats.storageUsed) }}</h3>
              <p>Stockage utilisé</p>
            </div>
          </div>
        </div>
        <div class="div_usage">
          <h2>Utilisation du stockage</h2>
          <div class="storage-bar">
            <div
              class="storage-fill"
              :style="{
                width:
                  (stats.storageUsed /
                    (stats.storageLimit * 1024 * 1024 * 1024)) *
                    100 +
                  '%',
              }"
            ></div>
          </div>
          <p class="storage-text">
            {{ convert_byte_to_perfect(stats.storageUsed) }} sur
            {{ stats.storageLimit }} GB utilisés ({{
              (
                (stats.storageUsed /
                  (stats.storageLimit * 1024 * 1024 * 1024)) *
                100
              ).toFixed(2) + "%"
            }})
          </p>
        </div>
        <div class="fast_access">
          <h2>Accès rapide aux outils</h2>
          <div class="div_outils">
              <button
                class="tool-card"
                @click="router.push('/drive')"
                title="Accéder au Drive"
              >
                <div class="tool-icon drive">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
                    />
                    <polyline points="13 2 13 9 20 9" />
                  </svg>
                </div>
                <h4>Drive</h4>
                <p>Gérez vos fichiers et dossiers</p>
              </button>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'paramètres'" class="tab-content">
        <h1>Paramètres</h1>
        <p>Contenu des paramètres du profil utilisateur.</p>
      </div>

      <div v-else-if="activeTab === 'sécurité'" class="tab-content">
        <h1>Sécurité</h1>
        <p>Contenu des options de sécurité du profil utilisateur.</p>
      </div>

      <div v-else-if="activeTab === 'notifications'" class="tab-content">
        <h1>Notifications</h1>
        <p>Contenu des paramètres de notification du profil utilisateur.</p>
      </div>

      <div v-else-if="activeTab === 'stockage'" class="tab-content">
        <h1>Stockage</h1>
        <p>Contenu des informations de stockage du profil utilisateur.</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { useHead } from "#imports";

useHead({
  title: "Gauzian - Profil utilisateur",
  meta: [
    { name: "description", content: "Page de profil utilisateur de Gauzian." },
  ],
});
import Header from "../components/Header.vue";

const userName = ref("John Doe");
const userMail = ref("test@eamil.fr");
const userUserName = ref("JO");
const stats = ref({
  filesCount: 42,
  storageUsed: 923552234, // in bytes
  lastLogin: "2024-06-15 10:30 AM",
  foldersCount: 8,
  storageLimit: 3,
});

const activeTab = ref("vue d'ensemble");

function convert_byte_to_perfect(bytes) {
  if (bytes === 0) return "0 Octets";
  const k = 1024;
  const sizes = ["Octets", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
</script>

<style scoped>
.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 2rem;
  align-items: start;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.sidebar-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: none;
  background: white;
  color: #64748b;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-family: inherit;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.sidebar-btn:hover {
  background: #f1f5f9;
  color: #334155;
  transform: translateX(4px);
}

.sidebar-btn.active {
  background: linear-gradient(135deg, #f97316 0%, #fdba74 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}

.profile-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-bottom: 1rem;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f97316 0%, #fdba74 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 auto 1rem;
}

.profile-card h2 {
  font-size: 1.25rem;
  color: #0b1120;
  margin: 0 0 0.5rem;
}

.profile-card .email {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0;
}
.main-content {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  min-height: 600px;
  height: auto;
}
.tab-content {
  animation: fadeIn 0.3s ease;
}
.content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.owerview_drive {
  display: flex;
  gap: 1.5rem;
  justify-content: space-between;
  margin-top: 1.5rem;
  flex-wrap: wrap;
  width: 100%;
}

.stat-card {
  background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform 0.2s ease;
  cursor: pointer;
  width: 30%;
}

.stat-card:hover {
  transform: translateY(-4px);
}
.stat-info h3 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0b1120;
  margin: 0;
}

.stat-info p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.files {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
}

.stat-icon.folders {
  background: linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%);
}

.stat-icon.storage {
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
}
.stat-icon svg {
  width: 24px;
  height: 24px;
  stroke-width: 2;
  color: white;
}
.div_usage {
  margin-top: 2rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.div_usage h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #0b1120;
}
.storage-bar {
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.storage-fill {
  height: 100%;
  background: linear-gradient(90deg, #f97316 0%, #fdba74 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.storage-text {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}
.fast_access {
  padding: 1.5rem;
}
.fast_access h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: #0b1120;
}
.div_outils {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.5rem;
  padding-top: 1rem;
}

.tool-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.75rem 1.5rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.tool-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(249, 115, 22, 0) 0%,
    rgba(249, 115, 22, 0.05) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.tool-card:hover {
  border-color: #f97316;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(249, 115, 22, 0.15);
}

.tool-card:hover::before {
  opacity: 1;
}

.tool-icon {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 2rem;
  transition: all 0.3s ease;
  z-index: 1;
}

.tool-card:hover .tool-icon {
  transform: scale(1.1);
}

.tool-icon.drive {
  background: linear-gradient(135deg, #f97316 0%, #fdba74 100%);
}

.tool-card h4 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0b1120;
  margin: 0;
  z-index: 1;
  position: relative;
}

.tool-card p {
  font-size: 0.825rem;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
  z-index: 1;
  position: relative;
}
</style>
