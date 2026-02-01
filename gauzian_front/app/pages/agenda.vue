<template>
    <div class="agenda-page">
        <div class="agenda-page--left">

        </div>
        <div class="agenda-page--center">
            <div class="agenda-page--center--top">

            </div>
            <div
                class="agenda-page--center--center"
                :style="{ '--grid-columns': displayDays.length }"
            >
                <!-- Espace vide dans le coin supérieur gauche -->
                <div class="agenda-page--center-center__header-corner"></div>

                <!-- Header des jours -->
                <div class="agenda-page--center-center__header">
                    <div
                        v-for="day in displayDays"
                        :key="day.id"
                        class="agenda-page--center-center__header--day"
                    >
                        <span class="day-label">{{ day.label }}</span>
                        <span class="date-label">{{ day.date }}</span>
                    </div>
                </div>

                <!-- Labels d'heures (placés individuellement sur la grille) -->
                <div
                    v-for="(hour, index) in hours"
                    :key="`hour-label-${hour}`"
                    class="agenda-page--center-center__hour-label"
                    :style="{ gridRow: 2 + index }"
                >
                    {{ hour }}h
                </div>

                <!-- Cellules des jours (placées individuellement sur la grille) -->
                <template v-for="(day, dayIndex) in displayDays" :key="`column-${day.id}`">
                    <div
                        v-for="hourIndex in 24"
                        :key="`cell-${day.id}-${hourIndex}`"
                        class="agenda-page--center-center__body-cell"
                        :style="{
                            gridColumn: 2 + dayIndex,
                            gridRow: 1 + hourIndex
                        }"
                    >
                    </div>
                </template>
                <!-- Composant des événements -->
                <event-graph
                    :events="events"
                    :displayDays="displayDays"
                    :eventsWithLayout="eventsWithLayout"
                ></event-graph>
                

            </div>

        </div>
    </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue';

// composable
import { useLayout } from '~/composables/agenda/useLayout.js';

// composant 
import eventGraph from '~/components/EventAgenda.vue';

useHead({
	title: "GZINFO | Agenda",
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

const displayDays = ref([
	{ id: 1, label: 'Mon', date: 2 },
	{ id: 2, label: 'Tue', date: 3 },
	{ id: 3, label: 'Wed', date: 4 },
	{ id: 4, label: 'Thu', date: 5 },
	{ id: 5, label: 'Fri', date: 6 },
	{ id: 6, label: 'Sat', date: 7 },
	{ id: 7, label: 'Sun', date: 8 },
]);

const hours = Array.from({ length: 24 }, (_, i) => i);

const events = ref([
    {
        id: 1,
        title: "Meeting with Team",
        dayId: 2,
        startHour: 10,
        endHour: 11,
    },
    {
        id: 2,
        title: "Project Deadline",
        dayId: 2,
        startHour: 10,
        endHour: 15,
    },
    {
        id: 3,
        title: "Lunch with Client",
        dayId: 2,
        startHour: 12,
        endHour: 18,
    },
    {
        id: 4,
        title: "Webinar on Vue.js",
        dayId: 2,
        startHour: 15,
        endHour: 17,
    },
    {
        id: 5,
        title: "Code Review Session",
        dayId: 2,
        startHour: 9,
        endHour: 11,
    },
    {
        id: 6,
        title: "Design Meeting",
        dayId: 3,
        startHour: 10,
        endHour: 12,
    }
]);


const { isMobile, eventsWithLayout } = useLayout(events);

// regarder si l'utilisateur scrolle avec le shift pour zommer verticalement
onMounted(() => {
    window.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
            e.preventDefault();
            // changer la hauteur de toutes les cellules à la même taille
            const cells = document.querySelectorAll('.agenda-page--center-center__body-cell');
            const currentHeight = cells[0].offsetHeight; // prendre la hauteur de la première cellule
            const newHeight = currentHeight - e.deltaY * 0.05; // ajuster le facteur de zoom ici
            if (newHeight >= 20 && newHeight <= 150) { // limites de hauteur
                cells.forEach(cell => {
                    cell.style.height = `${newHeight}px`;
                });
            }
        }
    }, { passive: false });
});

</script>

<style src="~/assets/css/agenda.css"></style>
<style scoped>
/* Styles spécifiques au composant agenda peuvent être ajoutés ici si nécessaire */
</style>