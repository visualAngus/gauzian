<template>
  <Transition name="loading-fade">
    <div v-if="isLoading" class="loading-overlay">

      <div class="loading-center">
        <p class="app-name">GAUZIAN</p>
        <div class="bars">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <!-- <p class="loading-message">{{ message || 'Chargement…' }}</p> -->
      </div>

      <div class="progress-bar"></div>

    </div>
  </Transition>
</template>

<script setup>
defineProps({
  message:   { type: String,  default: '' },
  isLoading: { type: Boolean, default: false },
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* ── Barres égaliseur ── */
.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 24px;
}

.bars span {
  width: 3px;
  border-radius: 2px;
  background: var(--color-primary);
  animation: bar-grow 1s ease-in-out infinite;
}

.bars span:nth-child(1) { animation-delay: 0s;    }
.bars span:nth-child(2) { animation-delay: 0.15s; }
.bars span:nth-child(3) { animation-delay: 0.3s;  }
.bars span:nth-child(4) { animation-delay: 0.45s; }
.bars span:nth-child(5) { animation-delay: 0.6s;  }

@keyframes bar-grow {
  0%, 100% { height: 4px;  opacity: 0.35; }
  50%       { height: 22px; opacity: 1;    }
}

.app-name {
  font-family: "Roboto", sans-serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.25em;
  color: var(--color-black);
  text-transform: uppercase;
  margin: 0;
}

.loading-message {
  font-family: "Roboto", sans-serif;
  font-size: 14px;
  color: var(--color-text-muted);
  margin: -8px 0 0;
}

/* ── Barre indéterminée façon Material/Google ── */
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(76, 142, 175, 0.12);
  overflow: hidden;
}

.progress-bar::before,
.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--color-primary);
}

.progress-bar::before {
  animation: bar-1 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
}

.progress-bar::after {
  animation: bar-2 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite;
}

@keyframes bar-1 {
  0%   { left: -35%;  right: 100%; }
  60%  { left: 100%;  right: -90%; }
  100% { left: 100%;  right: -90%; }
}

@keyframes bar-2 {
  0%   { left: -200%; right: 100%; }
  60%  { left: 107%;  right: -8%;  }
  100% { left: 107%;  right: -8%;  }
}

/* ── Transition sortie ── */
.loading-fade-leave-active {
  transition: opacity 0.35s ease;
}
.loading-fade-leave-to {
  opacity: 0;
}
</style>
