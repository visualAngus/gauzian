<template>
  <div
    class="item"
    :class="{
      pending: status === 'pending',
      uploading: status === 'uploading',
    }"
    :data-item-type="item.type"
    :data-item-id="item.file_id || item.folder_id"
    :data-folder-name="item.metadata?.folder_name || 'Dossier'"
    :data-item-metadata="JSON.stringify(item.metadata || {})"
    :data-item-size="
      item.size ||
      item.folder_size ||
      item.metadata?.file_size ||
      item.metadata?.folder_size ||
      0
    "
    @click="handleDoubleTap(item, $event)"
    @contextmenu.prevent="$emit('contextmenu', item, $event)"
    @mousedown="startDrag"
  >
    <span class="icon-wrapper">
      <svg
        v-if="item.type === 'folder'"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z"
        ></path>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z"
        ></path>
      </svg>

      <!-- Spinner pour les fichiers en upload -->
      <div v-if="status === 'uploading'" class="upload-spinner"></div>
    </span>

    <div class="file-info">
      <span
        class="filename"
        :class="{ short: currentFolderId === 'shared_with_me' }"
      >
        {{ displayName }}
      </span>

      <!-- Barre de progression pour les fichiers en upload -->
      <div
        v-if="status === 'uploading' && progress !== undefined"
        class="inline-progress"
      >
        <div
          class="inline-progress-bar"
          :style="{ width: progress + '%' }"
        ></div>
      </div>
    </div>

    <span class="status-indicator" v-if="status === 'pending'">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
        />
      </svg>
    </span>

    <span
      class="menu-dots"
      v-if="currentFolderId !== 'shared_with_me' && currentFolderId !== 'corbeille'"
      @click="$emit('dotclick', item, $event)"
    >
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    </span>
    <div class="accepted-rejected" v-if="currentFolderId === 'shared_with_me'">
      <button class="accepted-rejected__accepted"
        @click="$emit('accept', item)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z"></path>
        </svg>
      </button>
      <button class="accepted-rejected__rejected"
        @click="$emit('reject', item)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"
          ></path>
        </svg>
      </button>
    </div>
    <div class="trash-actions" v-if="currentFolderId === 'corbeille'">
      <button class="trash-actions__restore" @click.stop="$emit('restore', item)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.463 4.433A9.961 9.961 0 0 1 12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12h2a8 8 0 1 0 2.46-5.772L10 9H2V1l3.463 3.433z"/>
        </svg>
      </button>
      <button class="trash-actions__delete" @click.stop="$emit('delete-permanent', item)">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  status: {
    type: String,
    default: "uploaded", // 'uploaded', 'pending', 'uploading'
    validator: (value) => ["uploaded", "pending", "uploading"].includes(value),
  },
  progress: {
    type: Number,
    default: 0,
  },
  currentFolderId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits([
  "click",
  "select",
  "move-start",
  "moving",
  "move-end",
  "dotclick",
  "accept",
  "reject",
  "restore",
  "delete-permanent",
  "contextmenu",
]);

const DRAG_THRESHOLD = 5; // pixels avant d'activer le drag
let dragStartPos = null;
let isDragStarted = false;
let lastTap = 0; // Pour stocker le moment du dernier clic
let tapTimeout = null; // Pour gérer le délai du single tap

const handleDoubleTap = (item, event) => {
  event.preventDefault();

  const isTouchEvent = event.type.startsWith("touch");
  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTap;

  if (isTouchEvent) {
    // Sur tactile, un simple tap ouvre le dossier
    emit("click", item, event);
    lastTap = 0;
  } else if (tapLength < 300 && tapLength > 0) {
    // Sur souris, double-click pour ouvrir
    if (tapTimeout) {
      clearTimeout(tapTimeout);
      tapTimeout = null;
    }
    emit("click", item, event);
    lastTap = 0;
  } else {
    tapTimeout = setTimeout(() => {
      emit("select", { item, event });
      tapTimeout = null;
    }, 300);
  }

  lastTap = currentTime;
};

const startDrag = (mouseDownEvent) => {
  dragStartPos = { x: mouseDownEvent.clientX, y: mouseDownEvent.clientY };
  isDragStarted = false;

  const onMouseMove = (e) => {
    // Vérifier si on a bougé au-delà du seuil
    if (!isDragStarted && dragStartPos) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) +
          Math.pow(e.clientY - dragStartPos.y, 2),
      );

      // Si on a bougé assez, émettre move-start
      if (distance > DRAG_THRESHOLD) {
        isDragStarted = true;
        emit("move-start", {
          item: props.item,
          x: e.clientX,
          y: e.clientY,
          originalEvent: e,
        });
      }
    }

    // Si le drag est actif, émettre moving
    if (isDragStarted) {
      emit("moving", {
        item: props.item,
        x: e.clientX,
        y: e.clientY,
        originalEvent: e,
      });
    }
  };

  const onMouseUp = (e) => {
    // Émettre move-end seulement si le drag avait vraiment commencé
    if (isDragStarted) {
      emit("move-end", {
        item: props.item,
        x: e.clientX,
        y: e.clientY,
        originalEvent: e,
      });
    }
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    dragStartPos = null;
    isDragStarted = false;
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
};

const displayName = computed(() => {
  // console.log("Item metadata:", props.item);

  return (
    props.item.metadata?.folder_name ||
    props.item.metadata?.filename ||
    props.item.name ||
    props.item._name ||
    "Sans nom"
  );
});
</script>

<style scoped>
.item {
  position: relative;
  height: 48px;
  border-radius: 12px;
  background-color: #eff3f8;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
  overflow: hidden;
}

.item:hover {
  background-color: var(--color-surface-muted);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.item.pending {
  opacity: 0.7;
  background: linear-gradient(90deg, #eff3f8 0%, #e8edf3 50%, #eff3f8 100%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.item.uploading {
  background-color: var(--color-primary-soft);
  border: 1px solid var(--color-primary) 33;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.icon-wrapper svg {
  width: 20px;
  height: 20px;
  color: var(-color-text-muted);
}

.upload-spinner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-surface-muted);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.file-info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.filename {
  font-size: 14px;
  font-weight: 500;
  color: var(-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px;
}
.filename.short {
  max-width: 70%;
}
/* lorsque le nom est édité */
.filename[contenteditable="true"] {
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  background-color: var(--color-primary-soft);
  outline: none;
}

.inline-progress {
  width: 100%;
  height: 3px;
  background-color: var(--color-progress-track);
  border-radius: 2px;
  overflow: hidden;
}

.inline-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, #5ca3c7 100%);
  border-radius: 2px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 4px rgba(76, 142, 175, 0.4);
}

.status-indicator {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}

.status-indicator svg {
  width: 18px;
  height: 18px;
  color: var(--color-primary);
}

.menu-dots {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 8px;
  transition: background-color 0.2s ease;
}

.menu-dots svg {
  width: 18px;
  height: 18px;
  color: var(-color-text-muted);
  transform: rotate(90deg);
}

.menu-dots:hover {
  background-color: rgba(0, 0, 0, 0.08);
}

@keyframes border-beam {
  0%        { left: -50%; opacity: 0; }
  10%       { opacity: 1; }
  60%       { opacity: 1; }
  70%, 100% { left: 150%; opacity: 0; }
}

@keyframes notif-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(76, 142, 175, 0.55); }
  70%  { box-shadow: 0 0 0 5px rgba(76, 142, 175, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 142, 175, 0); }
}

/* Border beam pour les items en attente (pending) */
.item.pending::before {
  content: '';
  position: absolute;
  top: 0;
  left: -50%;
  width: 50%;
  height: 1.5px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-primary, #4c8eaf) 50%,
    transparent 100%
  );
  animation: border-beam 2.5s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}

/* Liseré + tint pour les items en attente d'action */
.item:has(.accepted-rejected) {
  background: linear-gradient(
    180deg,
    rgba(76, 142, 175, 0.06) 0%,
    transparent 50%
  ), #eff3f8;
  box-shadow: inset 0 1.5px 0 rgba(76, 142, 175, 0.35);
}

.accepted-rejected {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  margin-left: 8px;
}

.accepted-rejected__accepted,
.accepted-rejected__rejected {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid currentColor;
  cursor: pointer;
  background: transparent;
  transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.accepted-rejected__accepted svg,
.accepted-rejected__rejected svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.accepted-rejected__accepted {
  color: #22c55e;
}

.accepted-rejected__accepted:hover {
  background: #22c55e;
  color: white;
  border-color: #22c55e;
  transform: scale(1.12);
}

.accepted-rejected__rejected {
  color: #94a3b8;
  border-color: #94a3b8;
}

.accepted-rejected__rejected:hover {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  transform: scale(1.08);
}

.trash-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  margin-left: 8px;
}

.trash-actions__restore,
.trash-actions__delete {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid currentColor;
  cursor: pointer;
  background: transparent;
  transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.trash-actions__restore svg,
.trash-actions__delete svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.trash-actions__restore {
  color: var(--color-primary, #4c8eaf);
}

.trash-actions__restore:hover {
  background: var(--color-primary, #4c8eaf);
  color: white;
  border-color: var(--color-primary, #4c8eaf);
  transform: scale(1.12);
}

.trash-actions__delete {
  color: #94a3b8;
  border-color: #94a3b8;
}

.trash-actions__delete:hover {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  transform: scale(1.08);
}
</style>
