<script setup>
import { useHead } from '#imports'

useHead({
  title: 'Bienvenue - Gauzian',
  meta: [
    { name: 'description', content: "Projet Nuxt minimal — page d'accueil." },
  ],
})
</script>

<template>
  <main class="home">
    <h1>Bienvenue dans gauzian_front3</h1>
    <p>Portage Nuxt des pages de front2 (hors Drive).</p>
    <p>
      Test API: <NuxtLink to="/api/hello">/api/hello</NuxtLink><br />
      Inscription: <NuxtLink to="/register">/register</NuxtLink><br />
      Connexion: <NuxtLink to="/login">/login</NuxtLink><br />
      Profil utilisateur: <NuxtLink to="/profile">/profile</NuxtLink>
    </p>
  </main>
</template>

<style scoped>
.home {
  font-family: system-ui, sans-serif;
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
  line-height: 1.6;
}

h1 {
  margin-bottom: 12px;
}

a {
  color: #F97316;
}
</style>
