<template>
    <div class="notification">
        <div class="notification-title">
            <slot name="title"></slot>
        </div>
        <div class="notification-content">
            <slot name="default"></slot>
        </div>
        <div class="notification--close">
            <button @click="$emit('close')">x</button>
        </div>
    </div>

</template>
<script setup>

</script>
<style scoped>
.notification { 
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #323232;
  color: white;
  padding: 16px;
  min-width: 50px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  overflow: hidden;
}
.notification-title {
  font-weight: bold;
  margin-bottom: 8px;
}
.notification-content {
  font-size: 14px;
}
.notification--close {
  position: absolute;
  top: 0px;
  right: 8px;
}
.notification--close button {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
}
.notification--close button:hover {
  color: var(--color-surface-muted);
  transform: scale(1.2);
}
.notification--close button:active {
  transform: scale(0.9);
}

:global(.notif-pop-enter-active),
:global(.notif-pop-leave-active) {
  transition: opacity 0.25s ease, transform 0.25s ease, filter 0.25s ease;
}

:global(.notif-pop-enter-from),
:global(.notif-pop-leave-to) {
  opacity: 0;
  transform: translateX(12px) scale(0.98);
  filter: blur(2px);
}
</style>