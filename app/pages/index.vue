<template>
  <div class="loading">
    <p>Chargement...</p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';

definePageMeta({
	headerTitle: 'GAUZIAN'
});

// Vérifier session et rediriger
onMounted(async () => {
  const { isAuthenticated, validateSession } = useAuth();

  // Si déjà authentifié (état existant), aller directement sur /drive
  if (isAuthenticated.value) {
    return navigateTo('/drive');
  }

  // Sinon, tenter de restaurer la session depuis localStorage
  const restored = await validateSession();

  if (restored) {
    // Session restaurée avec succès → /drive
    navigateTo('/drive');
  } else {
    // Pas de session valide → /login
    navigateTo('/login');
  }
});

useHead({
	title: "GAUZIAN | Chargement..."
});
</script>

<style scoped>
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: 'Montserrat', sans-serif;
  font-size: 18px;
  color: #666;
}
</style>
