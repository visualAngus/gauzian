<template>
  <div
    class="item"
    :class="{
      pending: status === 'pending',
      uploading: status === 'uploading',
    }"

    :data-item-type="item.type"
    :data-item-id="item.id"

    @click="$emit('click', item)"
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
      <span class="filename">
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

    <span class="menu-dots" v-else>
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    </span>
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
});

defineEmits(["click"]);

const displayName = computed(() => {
  console.log("Item metadata:", props.item);

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
  background-color: #e2e7ed;
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
  background-color: #e8f4f8;
  border: 1px solid #4c8eaf33;
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
  color: #444746;
}

.upload-spinner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 2px solid #e2e7ed;
  border-top: 2px solid #4c8eaf;
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
  color: #1f1f1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inline-progress {
  width: 100%;
  height: 3px;
  background-color: #d1dce5;
  border-radius: 2px;
  overflow: hidden;
}

.inline-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4c8eaf 0%, #5ca3c7 100%);
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
  color: #4c8eaf;
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
  color: #444746;
  transform: rotate(90deg);
}

.menu-dots:hover {
  background-color: rgba(0, 0, 0, 0.08);
}
</style>
