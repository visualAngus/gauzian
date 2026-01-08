<template>
  <div class="page">
		
	</div>
    <main>
      <button @click="autologin">Auto-login</button>
	  <button @click="navigate('/drive')">Go to Drive</button>
    </main>
</template> 

<script setup>
import { ref, onMounted } from "vue";
const navigate = navigateTo;
definePageMeta({
	headerTitle: 'GZHOME'
})
useHead({
	title: "GZDRIVE | Drive",
	link: [
		{ rel: "preconnect", href: "https://fonts.googleapis.com" },
		{ rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
		{
			rel: "stylesheet",
			href:
				"https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
		},
	],
});
</script>

<style scoped>
body {
	background-color: white;
}

* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
	user-select: none;
}

</style>
