<template>
    <div
        v-for="event in eventsWithLayout"
        :key="event.id"
        class="agenda-event"
        :class="`event-${event.color || 'blue'}`"
        :style="{
            gridColumn: 2 + displayDays.findIndex(d => d.dayId === event.dayId),
            gridRow: `${(hasAllDayEvents ? 3 : 2) + event.startHour} / ${(hasAllDayEvents ? 3 : 2) + event.endHour}`,
            width: `calc(${100 / event.totalColumns}% - 6px)`,
            marginLeft: `calc(${(event.column * 100) / event.totalColumns}% + 2px)`
        }"
        @mousedown="(e) => dragEvent(event, e.currentTarget, e)"
        @click.stop="handleEventClick(event)"
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
    },
    hasAllDayEvents: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['event-click']);

// Référence à l'événement en cours de drag
let draggedEvent = null;
let originalDayId = null;
let originalStartHour = null;
let originalEndHour = null;
let gridContainer = null;
let hasMoved = false;
let startX = 0;
let startY = 0;

const dragEvent = (event, elem, mouseEvent) => {
    // TODO(human): Empêcher le drag des segments d'événements multi-jours
    // Si event.isSegment est true, faire un return pour bloquer le drag

    draggedEvent = event;
    originalDayId = event.dayId;
    originalStartHour = event.startHour;
    originalEndHour = event.endHour;
    hasMoved = false;
    startX = mouseEvent.clientX;
    startY = mouseEvent.clientY;

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

        // Petit délai pour laisser le click se propager ou non
        setTimeout(() => {
            hasMoved = false;
        }, 50);

        draggedEvent = null;
        gridContainer = null;
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler, { once: true });
};

const onMouseMove = (e, elem) => {
    if (!draggedEvent || !gridContainer) return;

    // Détecter si la souris a bougé de plus de 5px (pour éviter les micro-mouvements)
    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);
    if (deltaX > 5 || deltaY > 5) {
        hasMoved = true;
    }

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
    // Utilisation de getBoundingClientRect() pour des valeurs précises (float) au lieu de offsetHeight (arrondi)
    const headerElement = gridContainer.querySelector('.agenda-page--center-center__header');
    const cellElement = gridContainer.querySelector('.agenda-page--center-center__body-cell');
    const allDayElement = gridContainer.querySelector('.all-day-row-spacer');

    const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : 80; // Fallback 80px
    const rowHeight = cellElement ? cellElement.getBoundingClientRect().height : 50; // Fallback 50px
    const allDayRowHeight = (props.hasAllDayEvents && allDayElement) ? allDayElement.getBoundingClientRect().height : 0;

    // Calculer la largeur disponible pour les jours
    const availableWidth = gridRect.width - hourColumnWidth;
    const columnWidth = availableWidth / numberOfDays;

    // Calculer l'index du jour et de l'heure
    // Si hasAllDayEvents, soustraire aussi la hauteur de la ligne all-day
    const dayIndex = Math.floor((mouseX - hourColumnWidth) / columnWidth);
    const hourIndex = Math.floor((mouseY - headerHeight - allDayRowHeight) / rowHeight);

    // Vérifier les limites
    if (dayIndex >= 0 && dayIndex < numberOfDays && hourIndex >= 0 && hourIndex < numberOfHours) {
        const duration = originalEndHour - originalStartHour;
        const newDayId = props.displayDays[dayIndex].dayId;
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

const handleEventClick = (event) => {
    // Ne pas ouvrir le modal si l'événement vient d'être déplacé
    if (hasMoved) {
        return;
    }
    emit('event-click', event);
};

</script>

<style scoped>
.agenda-event.dragging {
    opacity: 0.7;
    cursor: grabbing !important;
    z-index: 1000;
}
</style>