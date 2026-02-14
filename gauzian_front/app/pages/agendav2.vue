<template>
  <main>
    <div class="div_group--left">
        <section id="top-section">
          <div id="top-section--left">
            <BtnAddEvent />
          </div>
        </section>
        <section id="left-section">
          <MiniMapagenda />
        </section>
    </div>

    <section id="center-right-section">
      <Agenda />
    </section>
  </main>
</template>
<script setup>
import { useRouter } from "vue-router";
const router = useRouter();
definePageMeta({ headerTitle: "GZAgenda" });
useHead({
  title: "GZAgenda | AGENDA",
  lang: "fr",
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
    },
  ],
});

import BtnAddEvent from "@/components/agendaV2/BtnAddEvent.vue";
import MiniMapagenda from "~/components/agendaV2/MiniMapAgenda.vue";
import Agenda from "~/components/agendaV2/Agenda.vue";
</script>
<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
}

#top-section {
  height: 6vh;
  width: 100%;
}
main {
  height: calc(100vh - 88px);
  width: 100%;
  display: flex;
  flex-direction: row;
}
.div_group--left {
  display: flex;
  flex-direction: column;
  width: 15%;
  height: 100%;
}

#left-section {
  height: 100%;
  width: 100%;
  max-width: 250px;
  min-width: 200px;
  float: left;
  padding: 10px;

}
#center-right-section {
  height: 100%;
  width: 85%;
  float: left;
}

@media (max-width: 768px) {
    main {
        flex-direction: column;
    }
    .div_group--left {
        flex-direction: column;
        width: 100%;
        height: 6vh;
    }
    #top-section {
        width: 100%;
        height: 100%;
    }
    #left-section {
        width: 100%;
        height: 40vh;
        max-width: none;
        min-width: none;
    }
    #center-right-section {
        width: 100%;
        height: 60vh;
    }
}

#top-section--left {
  height: 100%;
  width: 100%;
  /* background-color: black; */
  padding: 4px 10px;
}

</style>
