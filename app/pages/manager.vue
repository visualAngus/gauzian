<template>
<LeftPanel />

</template>
<script setup>
import { defineComponent } from 'vue';

import { useHead } from "#imports";
definePageMeta({ headerTitle: "GZMANAGER" });

useHead({
  title: "Gauzian | Manager",
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossorigin: "anonymous",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
    }
  ],
});

import LeftPanel from '~/components/manager/LeftPanel.vue';

</script>
<style src="~/assets/css/manager.css"></style>

