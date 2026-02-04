<template>
    <div class="agenda-page">
        <!-- Sidebar gauche -->
        <div class="agenda-page--left">
            <EventSearch
                @select-event="handleSelectEvent"
            />

            <div class="sidebar-divider"></div>

            <CategoryFilter
                @filter-change="handleFilterChange"
                @manage-categories="openCategoryManager"
            />
        </div>

        <!-- Section centrale -->
        <div class="agenda-page--center">
            <!-- Toolbar -->
            <div class="agenda-page--center--top">
                <AgendaToolbar
                    :current-view="currentView"
                    :current-period="formattedCurrentPeriod"
                    @today="goToToday"
                    @previous="handlePrevious"
                    @next="handleNext"
                    @view-change="handleViewChange"
                    @new-event="openNewEventModal"
                    @search="handleSearch"
                    @filter="handleFilter"
                    @settings="handleSettings"
                />
            </div>

            <!-- Vue Mois -->
            <div v-if="currentView === VIEW_TYPES.MONTH" class="agenda-month-view">
                <!-- Headers jours de la semaine -->
                <div class="month-header">
                    <div v-for="dayName in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']"
                         :key="dayName"
                         class="month-header-day">
                        {{ dayName }}
                    </div>
                </div>

                <!-- Grille calendrier -->
                <div class="month-grid">
                    <div
                        v-for="day in displayDays"
                        :key="day.dayId"
                        class="month-cell"
                        :class="{
                            'not-current-month': !day.isCurrentMonth,
                            'today': day.isToday,
                            'weekend': day.isWeekend
                        }"
                        @click="handleCellClick(day.dayId, 9)"
                    >
                        <div class="month-cell-header">
                            <span class="month-day-number">{{ day.dayNumber }}</span>
                        </div>
                        <div class="month-cell-events">
                            <div
                                v-for="event in getEventsForDay(day.dayId)"
                                :key="event.id"
                                class="month-event"
                                :class="`event-${event.color || 'blue'}`"
                                @click.stop="handleEventClick(event)"
                            >
                                <span class="month-event-time" v-if="!event.isAllDay">
                                    {{ event.startHour }}h
                                </span>
                                <span class="month-event-title">{{ event.title }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Vue Semaine/Jour -->
            <div
                v-else
                class="agenda-page--center--center"
                :style="{ '--grid-columns': displayDays.length }"
            >
                <!-- Espace vide dans le coin supérieur gauche -->
                <div class="agenda-page--center-center__header-corner"></div>

                <!-- Header des jours -->
                <div class="agenda-page--center-center__header">
                    <div
                        v-for="day in displayDays"
                        :key="day.dayId"
                        class="agenda-page--center-center__header--day"
                        :class="{ 'today': day.isToday }"
                    >
                        <span class="day-label">{{ day.dayNameShort }}</span>
                        <span class="date-label">{{ day.dayNumber }}</span>
                    </div>
                </div>

                <!-- Événements toute la journée (dans la grille, entre header et 0h) -->
                <div
                    v-if="hasAllDayEvents"
                    class="all-day-row-spacer"
                    :style="{ gridRow: 2 }"
                ></div>
                <div
                    v-for="event in allDayEventsList"
                    :key="`allday-${event.id}`"
                    class="agenda-event-allday"
                    :class="`event-${event.color || 'blue'}`"
                    :style="getAllDayEventStyle(event)"
                    @click="handleEventClick(event)"
                >
                    <span class="allday-title">{{ event.title }}</span>
                </div>

                <!-- Labels d'heures -->
                <div
                    v-for="(hour, index) in visibleHours"
                    :key="`hour-label-${hour}`"
                    class="agenda-page--center-center__hour-label"
                    :style="{ gridRow: (hasAllDayEvents ? 3 : 2) + index }"
                >
                    {{ hour }}h
                </div>

                <!-- Cellules du calendrier -->
                <template v-for="(day, dayIndex) in displayDays" :key="`column-${day.dayId}`">
                    <div
                        v-for="(hour, hourIndex) in visibleHours"
                        :key="`cell-${day.dayId}-${hour}`"
                        class="agenda-page--center-center__body-cell"
                        :class="{ 'today': day.isToday }"
                        :style="{
                            gridColumn: 2 + dayIndex,
                            gridRow: (hasAllDayEvents ? 3 : 2) + hourIndex
                        }"
                        @click="handleCellClick(day.dayId, hour)"
                    >
                    </div>
                </template>

                <!-- Événements normaux (incluant segments d'événements multi-jours) -->
                <EventAgenda
                    :events="normalEvents"
                    :displayDays="displayDays"
                    :eventsWithLayout="eventsWithLayout"
                    :hasAllDayEvents="hasAllDayEvents"
                    @event-click="handleEventClick"
                />
            </div>
        </div>

        <!-- Modal d'événement -->
        <EventModal
            :is-open="isEventModalOpen"
            :event="selectedEvent"
            :default-day-id="defaultEventDayId"
            :default-start-hour="defaultEventStartHour"
            :available-days="displayDays"
            @close="closeEventModal"
            @save="handleEventSave"
            @delete="handleEventDelete"
        />

        <!-- Modal de gestion des catégories -->
        <CategoryManager
            :is-open="isCategoryManagerOpen"
            @close="closeCategoryManager"
        />
    </div>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue';

// Composables
import { useEvents } from '~/composables/agenda/useEvents';
import { useCategories } from '~/composables/agenda/useCategories';
import { useView } from '~/composables/agenda/useView';
import { useNavigation } from '~/composables/agenda/useNavigation';
import { useLayout } from '~/composables/agenda/useLayout';

// Composants
import EventAgenda from '~/components/EventAgenda.vue';
import EventModal from '~/components/agenda/EventModal.vue';
import AgendaToolbar from '~/components/agenda/AgendaToolbar.vue';
import CategoryFilter from '~/components/agenda/CategoryFilter.vue';
import EventSearch from '~/components/agenda/EventSearch.vue';
import CategoryManager from '~/components/agenda/CategoryManager.vue';

useHead({
    title: "GAUZIAN | Agenda",
    link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
        },
    ],
});

// ***** COMPOSABLES *****
const {
    events,
    createEvent,
    updateEvent,
    deleteEvent,
    loadEvents,
    saveEvents
} = useEvents();

const {
    filterEventsByCategories,
    activeFilters
} = useCategories();

const {
    currentView,
    VIEW_TYPES,
    setView,
    visibleHours,
    loadPreferences,
    savePreferences
} = useView();

const {
    currentDate,
    getWeekDayIds,
    getMonthDayIds,
    goToToday,
    nextWeek,
    previousWeek,
    nextDay,
    previousDay,
    nextMonth,
    previousMonth,
    formattedCurrentWeek,
    formattedCurrentDate,
    currentMonthName,
    currentYear,
    enableKeyboardNavigation,
    disableKeyboardNavigation
} = useNavigation();

// ***** ÉTAT LOCAL *****
const isEventModalOpen = ref(false);
const selectedEvent = ref(null);
const defaultEventDayId = ref(null);
const defaultEventStartHour = ref(null);
const isCategoryManagerOpen = ref(false);

// ***** COMPUTED *****

// Jours affichés selon la vue actuelle
const displayDays = computed(() => {
    if (currentView.value === VIEW_TYPES.WEEK) {
        return getWeekDayIds();
    } else if (currentView.value === VIEW_TYPES.DAY) {
        const currentDayId = getWeekDayIds()[0];
        return [currentDayId];
    } else if (currentView.value === VIEW_TYPES.MONTH) {
        return getMonthDayIds();
    }
    return getWeekDayIds(); // Défaut : semaine
});

// Événements filtrés par catégorie ET par période visible
const filteredEvents = computed(() => {
    // IDs des jours visibles
    const visibleDayIds = displayDays.value.map(day => day.dayId);

    // Filtrer par période d'abord
    let periodFilteredEvents = events.value.filter(event =>
        visibleDayIds.includes(event.dayId)
    );

    // Puis filtrer par catégorie si des filtres sont actifs
    if (activeFilters.value.length === 0) {
        return periodFilteredEvents;
    }
    return filterEventsByCategories(periodFilteredEvents);
});

// Fonction pour découper les événements multi-jours en segments par jour
const splitMultiDayEvent = (event) => {
    if (!event.isMultiDay) {
        return [event];
    }

    const segments = [];
    const visibleDayIds = displayDays.value.map(d => d.dayId);

    // Trouver tous les jours entre startDayId et endDayId
    const startIndex = displayDays.value.findIndex(d => d.dayId === event.startDayId);
    const endIndex = displayDays.value.findIndex(d => d.dayId === event.endDayId);

    // Si l'événement n'est pas dans la période visible, retourner vide
    if (startIndex === -1 && endIndex === -1) {
        return [];
    }

    // Calculer les bornes visibles
    const visibleStart = Math.max(0, startIndex);
    const visibleEnd = Math.min(displayDays.value.length - 1, endIndex);

    for (let i = visibleStart; i <= visibleEnd; i++) {
        const day = displayDays.value[i];
        const isFirstDay = (i === startIndex);
        const isLastDay = (i === endIndex);

        let segmentStartHour, segmentEndHour;

        if (isFirstDay && isLastDay) {
            // Cas spécial : début et fin le même jour (ne devrait pas arriver avec isMultiDay)
            segmentStartHour = event.startHour;
            segmentEndHour = event.endHour;
        } else if (isFirstDay) {
            // Premier jour : de startHour à 24h
            segmentStartHour = event.startHour;
            segmentEndHour = 24;
        } else if (isLastDay) {
            // Dernier jour : de 0h à endHour
            segmentStartHour = 0;
            segmentEndHour = event.endHour;
        } else {
            // Jour intermédiaire : journée complète (0h-24h)
            segmentStartHour = 0;
            segmentEndHour = 24;
        }

        // Si le segment couvre 0h-24h, le marquer comme all-day
        const isSegmentAllDay = (segmentStartHour === 0 && segmentEndHour === 24);

        segments.push({
            ...event,
            dayId: day.dayId,
            startHour: segmentStartHour,
            endHour: segmentEndHour,
            isAllDay: event.isAllDay || isSegmentAllDay,
            isMultiDay: false, // Les segments ne sont plus multi-jours
            originalEventId: event.id, // Garder référence à l'événement parent
            isSegment: true // Marquer comme segment pour identification
        });
    }

    return segments;
};

// Découper tous les événements en segments
const eventSegments = computed(() => {
    const segments = [];
    filteredEvents.value.forEach(event => {
        segments.push(...splitMultiDayEvent(event));
    });
    return segments;
});

// Séparer les segments en all-day et normaux
const allDayEventsList = computed(() => {
    return eventSegments.value.filter(event => event.isAllDay);
});

const hasAllDayEvents = computed(() => {
    return allDayEventsList.value.length > 0;
});

const normalEvents = computed(() => {
    return eventSegments.value.filter(event => !event.isAllDay);
});

// Layout des événements normaux avec colonnes
const { eventsWithLayout } = useLayout(normalEvents);

// Période affichée (texte)
const formattedCurrentPeriod = computed(() => {
    if (currentView.value === VIEW_TYPES.WEEK) {
        return formattedCurrentWeek.value;
    } else if (currentView.value === VIEW_TYPES.DAY) {
        return formattedCurrentDate.value;
    } else if (currentView.value === VIEW_TYPES.MONTH) {
        return `${currentMonthName.value} ${currentYear.value}`;
    }
    return formattedCurrentWeek.value;
});

// ***** MÉTHODES *****

// Obtenir les événements d'un jour spécifique (pour vue mois)
const getEventsForDay = (dayId) => {
    return eventSegments.value.filter(event => event.dayId === dayId).slice(0, 3); // Limiter à 3 événements affichés
};

// Style des événements all-day (maintenant tous les segments sont sur un seul jour)
const getAllDayEventStyle = (event) => {
    // Tous les segments ont maintenant un dayId unique
    const dayIndex = displayDays.value.findIndex(d => d.dayId === event.dayId);
    return {
        gridColumn: 2 + dayIndex,
        gridRow: 2
    };
};

// Navigation
const handlePrevious = () => {
    if (currentView.value === VIEW_TYPES.WEEK) {
        previousWeek();
    } else if (currentView.value === VIEW_TYPES.DAY) {
        previousDay();
    } else if (currentView.value === VIEW_TYPES.MONTH) {
        previousMonth();
    }
};

const handleNext = () => {
    if (currentView.value === VIEW_TYPES.WEEK) {
        nextWeek();
    } else if (currentView.value === VIEW_TYPES.DAY) {
        nextDay();
    } else if (currentView.value === VIEW_TYPES.MONTH) {
        nextMonth();
    }
};

const handleViewChange = (view) => {
    setView(view);
    savePreferences();
};

// Modal d'événement
const openNewEventModal = (dayId = null, startHour = null) => {
    selectedEvent.value = null;
    defaultEventDayId.value = dayId;
    defaultEventStartHour.value = startHour;
    isEventModalOpen.value = true;
};

const closeEventModal = () => {
    isEventModalOpen.value = false;
    selectedEvent.value = null;
    defaultEventDayId.value = null;
    defaultEventStartHour.value = null;
};

const handleEventSave = (eventData) => {
    if (eventData.id) {
        // Mise à jour
        updateEvent(eventData.id, eventData.updates);
    } else {
        // Création
        createEvent(eventData);
    }
    saveEvents();
};

const handleEventDelete = (eventId) => {
    deleteEvent(eventId);
    saveEvents();
};

// Clic sur une cellule : ouvrir modal de création
const handleCellClick = (dayId, hour) => {
    openNewEventModal(dayId, hour);
};

// Clic sur un événement : ouvrir modal d'édition
const handleEventClick = (event) => {
    // Si c'est un segment d'événement multi-jours, retrouver l'événement parent
    if (event.isSegment && event.originalEventId) {
        const parentEvent = events.value.find(e => e.id === event.originalEventId);
        selectedEvent.value = parentEvent || event;
    } else {
        selectedEvent.value = event;
    }
    isEventModalOpen.value = true;
};

// Sélection depuis la recherche
const handleSelectEvent = (event) => {
    selectedEvent.value = event;
    isEventModalOpen.value = true;
};

// Gestion des filtres
const handleFilterChange = (filters) => {
    // Les filtres sont déjà mis à jour dans le composable useCategories
    // Rien à faire ici
};

// Actions toolbar
const handleSearch = () => {
    // La recherche est gérée dans EventSearch
};

const handleFilter = () => {
    // Filtres gérés dans CategoryFilter
};

const handleSettings = () => {
    // TODO: Implémenter un modal de paramètres
    console.log('Paramètres');
};

// Gestion des catégories
const openCategoryManager = () => {
    isCategoryManagerOpen.value = true;
};

const closeCategoryManager = () => {
    isCategoryManagerOpen.value = false;
};

// Zoom vertical avec Shift + Scroll
const handleZoom = (e) => {
    if (e.shiftKey) {
        e.preventDefault();
        const cells = document.querySelectorAll('.agenda-page--center-center__body-cell');
        const hourLabels = document.querySelectorAll('.agenda-page--center-center__hour-label');

        if (cells.length === 0) return;

        const currentHeight = cells[0].offsetHeight;
        const newHeight = currentHeight - e.deltaY * 0.05;

        if (newHeight >= 20 && newHeight <= 150) {
            // Modifier les cellules
            cells.forEach(cell => {
                cell.style.height = `${newHeight}px`;
            });

            // Modifier aussi les labels d'heures pour garder l'alignement
            hourLabels.forEach(label => {
                label.style.height = `${newHeight}px`;
            });
        }
    }
};

// ***** MÉTHODE DE CHARGEMENT DES ÉVÉNEMENTS AVEC INTERVALLE *****
const reloadEventsForCurrentView = async () => {
    const dayIds = displayDays.value.map(day => day.dayId);
    if (dayIds.length > 0) {
        const startDayId = Math.min(...dayIds);
        const endDayId = Math.max(...dayIds);
        await loadEvents(startDayId, endDayId);
    }
};

// ***** LIFECYCLE *****
onMounted(() => {
    // Charger les préférences d'abord (pour avoir la bonne vue)
    loadPreferences();

    // Charger les données avec l'intervalle actuel
    reloadEventsForCurrentView();

    // Activer la navigation clavier
    enableKeyboardNavigation();

    // Zoom avec Shift + Scroll
    window.addEventListener('wheel', handleZoom, { passive: false });
});

// Sauvegarder les préférences quand la vue change
watch(currentView, () => {
    savePreferences();
});

// Recharger les événements quand la période affichée change
watch(displayDays, () => {
    reloadEventsForCurrentView();
}, { deep: true });
</script>

<style src="~/assets/css/agenda.css"></style>
<style scoped>
.sidebar-divider {
    height: 1px;
    background-color: #e5e7eb;
    margin: 20px 0;
}

.agenda-page--center-center__header--day.today {
    background-color: #eff6ff;
}

.agenda-page--center-center__header--day.today .date-label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    background-color: #3b82f6;
    color: #ffffff;
    border-radius: 16px;
    font-weight: 600;
}

.agenda-page--center-center__body-cell.today {
    background-color: #fafafa;
}

/* All-day events */
.all-day-row-spacer {
    grid-column: 1;
    min-height: 36px;
    background-color: #fafafa;
    border-right: 1px solid #e0e0e0;
    border-bottom: 1px solid #e0e0e0;
}

.agenda-event-allday {
    padding: 6px 10px;
    margin: 4px;
    background-color: #5B7FE8;
    border-radius: 4px;
    border-left: 3px solid #3D5FC4;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    min-height: 28px;
}

.agenda-event-allday:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    filter: brightness(1.05);
}

.allday-title {
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Event Colors for all-day */
.agenda-event-allday.event-blue { background: #4A90E2; border-left-color: #2E5C8A; }
.agenda-event-allday.event-green { background: #10B981; border-left-color: #047857; }
.agenda-event-allday.event-red { background: #EF4444; border-left-color: #991B1B; }
.agenda-event-allday.event-orange { background: #F59E0B; border-left-color: #B45309; }
.agenda-event-allday.event-purple { background: #8B5CF6; border-left-color: #5B21B6; }
.agenda-event-allday.event-teal { background: #14B8A6; border-left-color: #0F766E; }
.agenda-event-allday.event-pink { background: #EC4899; border-left-color: #9F1239; }
.agenda-event-allday.event-gray { background: #6B7280; border-left-color: #374151; }

/* Multi-day normal events */
.agenda-event-multiday {
    z-index: 15;
    opacity: 0.95;
}

/* Vue Mois */
.agenda-month-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.month-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background-color: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
}

.month-header-day {
    padding: 16px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
}

.month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: minmax(120px, 1fr);
    flex: 1;
}

.month-cell {
    border-right: 1px solid #e5e7eb;
    border-bottom: 1px solid #e5e7eb;
    padding: 8px;
    background-color: #ffffff;
    cursor: pointer;
    transition: background-color 0.2s;
    overflow: hidden;
}

.month-cell:hover {
    background-color: #f9fafb;
}

.month-cell.not-current-month {
    background-color: #f9fafb;
    opacity: 0.5;
}

.month-cell.today {
    background-color: #eff6ff;
}

.month-cell.weekend {
    background-color: #fafafa;
}

.month-cell-header {
    margin-bottom: 8px;
}

.month-day-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    border-radius: 50%;
}

.month-cell.today .month-day-number {
    background-color: #3b82f6;
    color: #ffffff;
}

.month-cell-events {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.month-event {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.2s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 4px;
}

.month-event:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.month-event-time {
    font-weight: 700;
    opacity: 0.9;
}

.month-event-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Couleurs événements pour vue mois */
.month-event.event-blue { background-color: #4A90E2; }
.month-event.event-green { background-color: #10B981; }
.month-event.event-red { background-color: #EF4444; }
.month-event.event-orange { background-color: #F59E0B; }
.month-event.event-purple { background-color: #8B5CF6; }
.month-event.event-teal { background-color: #14B8A6; }
.month-event.event-pink { background-color: #EC4899; }
.month-event.event-gray { background-color: #6B7280; }
</style>