<template>
  <div class="page">
		
	</div>
    <main>
      <button @click="autologin">Auto-login</button>
	  <button @click="navigate('/drive')">Go to Drive</button>
	  <button @click="navigate('/info')">Go to Info</button>

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

<style>
body {
	background-color: white;
}

* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
	user-select: none;
}

button {
    padding: 10px 15px;
	background-color: #333333;
	color: white;
	border: none;
	border-radius: 4px;
	font-size: 14px;
	font-family: "Montserrat", sans-serif;
	font-weight: 600;
	cursor: pointer;
	margin-top: 5px;
}

</style>
