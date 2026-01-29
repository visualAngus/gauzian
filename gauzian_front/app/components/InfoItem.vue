<template>
  <div class="info-item" :id="itemId">
    <div class="header_info">
      <h3>Informations</h3>
      <div class="notification--close">
        <button @click="emit('close')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path></svg>
        </button>
      </div>
    </div>

    <div class="info-list">
      <div class="info-row">
        <span class="info-label">Nom</span>
        <span class="info-value"><slot name="name"></slot></span>
      </div>

      <div class="info-row">
        <span class="info-label">Type</span>
        <span class="info-value"><slot name="type"></slot></span>
      </div>

      <div class="info-row">
        <span class="info-label">Taille</span>
        <span class="info-value"><slot name="size"></slot></span>
      </div>

      <div class="info-row">
        <span class="info-label">Créé le</span>
        <span class="info-value"><slot name="created"></slot></span>
      </div>

      <div class="info-row">
        <span class="info-label">Modifié le</span>
        <span class="info-value"><slot name="modified"></slot></span>
      </div>

      <div class="info-row">
        <span class="info-label">Propriétaire</span>
        <span class="info-value"><slot name="owner"></slot></span>
      </div>
    </div>
    <div class="share-section" v-if="shared_persons && shared_persons.length > 0">
      <h3>Partagé avec</h3>
      <div class="share-list">
        <div
          v-for="shared in shared_persons"
          class="share-item"
        >
          <div class="share-user">
            <div class="user-avatar">{{ (shared.username || "?").slice(0, 1) }}</div>
            <div class="user-info">
              <span class="user-name">{{ shared.username }}</span>
              <span class="user-permission">{{ shared.permission }}</span>
            </div>
          </div>
          <button
            class="revoke-btn"
            title="Révoquer l'accès"
            @click="emit('revoke', shared)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
      </div>
    </div>
    <div class="action-buttons">
      <button class="btn-primary" @click="$emit('download', itemId)">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Télécharger
      </button>
      <button class="btn-primary" @click="$emit('share', itemId)">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
        Partager
      </button>
      <button class="btn-secondary"
        @click="$emit('rename', itemId)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
          ></path>
          <path
            d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
          ></path>
        </svg>
        Renommer
      </button>
      <button class="btn-danger" @click="$emit('delete', itemId)">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path
            d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
          ></path>
        </svg>
        Supprimer
      </button>
    </div>
  </div>
</template>
<script setup>
const emit = defineEmits(["close", "revoke", "rename", "download", "share", "delete"]);

defineProps({
  itemId: {
    type: String,
    required: true,
  },
  shared_persons: {
    type: Array,
    required: true,
  },
});
</script>
<style scoped>
.info-item {
  position: fixed;
  top: 200px;
  right: 20px;
  background-color: var(--color-surface-soft);
  color: var(--color-text);
  padding: 20px;
  width: 340px;
  min-height: 50vh;
  max-height: 70vh;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 1000;
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid var(--color-surface-muted);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@media  screen and (max-width: 768px) {
  .info-item {
    width: calc(100% - 40px);
    max-width: 400px;
    left: 20px;
    bottom: 0px;
    max-height: 60vh;
    top: auto;
  }
    
}

.info-item h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-surface-muted);
  padding-bottom: 8px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  gap: 12px;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 500;
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.info-value {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
  text-align: right;
  word-break: break-word;
  flex: 1;
}

/* Share Section */
.share-section {
  margin-top: auto;
}

.share-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.share-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
}

.share-user {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-surface-muted);
  color: var(--color-text);
  border: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
}

.user-permission {
  font-size: 12px;
  color: var(--color-text-muted);
}

.revoke-btn {
  padding: 4px;
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 0px;
}

.revoke-btn:hover {
  background-color: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.revoke-btn:active {
  background-color: rgba(239, 68, 68, 0.15);
}

/* Action Buttons */
.action-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 2px solid rgba(0, 0, 0, 0.08);
}

.action-buttons button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--color-surface-muted);
  white-space: nowrap;
}

.btn-primary {
  background-color: var(--color-text);
  color: var(--color-white);
  border-color: var(--color-text);
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-surface-muted);
}

.btn-secondary:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.btn-danger {
  background-color: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-surface-muted);
}

.btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.action-buttons button:active {
  transform: scale(0.98);
}

.action-buttons button svg {
  flex-shrink: 0;
}

/* Scrollbar styling */
.info-item::-webkit-scrollbar {
  width: 6px;
}

.info-item::-webkit-scrollbar-track {
  background: transparent;
}

.info-item::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.info-item::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.header_info{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.notification--close {
  position: absolute;
  top: 0px;
  right: 8px;
}
.notification--close button {
  background: none;
  border: none;
  color: var(--color-black);
  font-size: 16px;
  cursor: pointer;
}
.notification--close button:hover {
  color: var(--color-neutral-900);
  transform: scale(1.2);
}
.notification--close button:active {
  transform: scale(0.9);
}
.notification--close button svg {
  width: 20px;
  height: 20px;
}

:global(.info-pop-enter-active),
:global(.info-pop-leave-active) {
  transition: opacity 0.25s ease, transform 0.25s ease, filter 0.25s ease;
}

:global(.info-pop-enter-from),
:global(.info-pop-leave-to) {
  opacity: 0;
  transform: translateX(12px) scale(0.98);
  filter: blur(2px);
}
</style>
