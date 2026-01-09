<template>
  <div>
    <AppHeader :header-title="route.meta.headerTitle" />
    <slot />
  </div>
</template>

<script setup>
import AppHeader from '../components/AppHeader.vue'
const route = useRoute()
</script>
