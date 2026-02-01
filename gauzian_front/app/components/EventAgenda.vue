<template>
    <div
        v-for="event in eventsWithLayout"
        :key="event.id"
        class="agenda-event"
        :style="{
            gridColumn: 2 + displayDays.findIndex(d => d.id === event.dayId),
            gridRow: `${2 + event.startHour} / ${2 + event.endHour}`,
            width: `calc(${100 / event.totalColumns}% - 6px)`,
            marginLeft: `calc(${(event.column * 100) / event.totalColumns}% + 2px)`
        }"
        @mousedown="dragEvent(event, $event.currentTarget)"
    >
        <div class="agenda-event__content">
            <div class="agenda-event__title">{{ event.title }}</div>
            <div class="agenda-event__time">
                {{ event.startHour }}h - {{ event.endHour }}h
            </div>
        </div>
    </div>
</template>
<script setup>

import { ref } from 'vue';

const props = defineProps({
    events: {
        type: Array,
        required: true
    },
    displayDays: {
        type: Array,
        required: true
    },
    eventsWithLayout: {
        type: Array,
        required: true
    }
});

// Référence à l'événement en cours de drag
let draggedEvent = null;
let originalDayId = null;
let originalStartHour = null;
let originalEndHour = null;
let gridContainer = null;

const dragEvent = (event, elem) => {
    draggedEvent = event;
    originalDayId = event.dayId;
    originalStartHour = event.startHour;
    originalEndHour = event.endHour;

    // Récupérer le conteneur de la grille
    gridContainer = elem.closest('.agenda-page--center--center');
    if (!gridContainer) {
        console.error('Grille parente non trouvée');
        return;
    }

    // Ajouter une classe pendant le drag pour feedback visuel
    elem.classList.add('dragging');

    const moveHandler = (e) => onMouseMove(e, elem);
    const upHandler = () => {
        elem.classList.remove('dragging');
        window.removeEventListener('mousemove', moveHandler);
        draggedEvent = null;
        gridContainer = null;
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler, { once: true });
};

const onMouseMove = (e, elem) => {
    if (!draggedEvent || !gridContainer) return;

    const gridRect = gridContainer.getBoundingClientRect();

    // Position de la souris dans le conteneur (en tenant compte du scroll)
    const mouseX = e.clientX - gridRect.left + gridContainer.scrollLeft;
    const mouseY = e.clientY - gridRect.top + gridContainer.scrollTop;

    // Dimensions de la grille
    const numberOfDays = props.displayDays.length;
    const numberOfHours = 24;

    // Largeur de la colonne des heures (première colonne)
    const hourColumnWidth = 60; // min-width défini dans le CSS

    // Hauteur des éléments (calculée dynamiquement depuis le DOM)
    const headerElement = gridContainer.querySelector('.agenda-page--center-center__header');
    const cellElement = gridContainer.querySelector('.agenda-page--center-center__body-cell');

    const headerHeight = headerElement ? headerElement.offsetHeight : 80; // Fallback 80px
    const rowHeight = cellElement ? cellElement.offsetHeight : 50; // Fallback 50px

    // Calculer la largeur disponible pour les jours
    const availableWidth = gridRect.width - hourColumnWidth;
    const columnWidth = availableWidth / numberOfDays;

    // Calculer l'index du jour et de l'heure
    const dayIndex = Math.floor((mouseX - hourColumnWidth) / columnWidth);
    const hourIndex = Math.floor((mouseY - headerHeight) / rowHeight);

    // Vérifier les limites
    if (dayIndex >= 0 && dayIndex < numberOfDays && hourIndex >= 0 && hourIndex < numberOfHours) {
        const duration = originalEndHour - originalStartHour;
        const newDayId = props.displayDays[dayIndex].id;
        const newStartHour = hourIndex;
        const newEndHour = Math.min(hourIndex + duration, numberOfHours);

        // IMPORTANT : Modifier l'événement dans le tableau source (props.events)
        // pas dans eventsWithLayout qui est une computed property
        const sourceEvent = props.events.find(e => e.id === draggedEvent.id);
        if (sourceEvent) {
            sourceEvent.dayId = newDayId;
            sourceEvent.startHour = newStartHour;
            sourceEvent.endHour = newEndHour;
        }
    }
};

</script>

<style scoped>
.agenda-event.dragging {
    opacity: 0.7;
    cursor: grabbing !important;
    z-index: 1000;
}
</style>