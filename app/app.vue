<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup>
const { initTheme } = useTheme();
onMounted(() => initTheme());
</script>
