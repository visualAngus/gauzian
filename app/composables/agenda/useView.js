// useView.js - Gestion des vues de l'agenda (semaine, jour, mois, année)

import { ref, computed } from 'vue';

// Types de vues disponibles
export const VIEW_TYPES = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year'
};

// Configuration des vues
const viewConfigs = {
    [VIEW_TYPES.DAY]: {
        name: 'Jour',
        icon: '📅',
        numberOfDays: 1,
        hourRange: { start: 0, end: 24 }
    },
    [VIEW_TYPES.WEEK]: {
        name: 'Semaine',
        icon: '📆',
        numberOfDays: 7,
        hourRange: { start: 0, end: 24 }
    },
    [VIEW_TYPES.MONTH]: {
        name: 'Mois',
        icon: '🗓️',
        numberOfDays: null, // Variable selon le mois
        hourRange: null // Pas d'heures en vue mois
    },
    [VIEW_TYPES.YEAR]: {
        name: 'Année',
        icon: '📊',
        numberOfDays: 365, // Approximatif
        hourRange: null
    }
};

// État global de la vue (singleton)
const currentView = ref(VIEW_TYPES.WEEK);
const showWeekends = ref(true);
const workingHoursOnly = ref(false);
const workingHoursRange = ref({ start: 8, end: 18 });
const compactMode = ref(false);

export const useView = () => {
    // ***** GESTION DES VUES *****

    const setView = (viewType) => {
        if (Object.values(VIEW_TYPES).includes(viewType)) {
            currentView.value = viewType;
        } else {
            console.warn(`Type de vue invalide: ${viewType}`);
        }
    };

    const getViewConfig = (viewType = currentView.value) => {
        return viewConfigs[viewType];
    };

    const isCurrentView = (viewType) => {
        return currentView.value === viewType;
    };

    // ***** JOURS AFFICHÉS *****

    const toggleWeekends = () => {
        showWeekends.value = !showWeekends.value;
    };

    const toggleWorkingHours = () => {
        workingHoursOnly.value = !workingHoursOnly.value;
    };

    const setWorkingHours = (start, end) => {
        if (start >= 0 && start < 24 && end > start && end <= 24) {
            workingHoursRange.value = { start, end };
        } else {
            console.warn('Heures de travail invalides');
        }
    };

    // ***** HEURES VISIBLES *****

    const visibleHours = computed(() => {
        if (workingHoursOnly.value && currentView.value !== VIEW_TYPES.MONTH) {
            const hours = [];
            for (let i = workingHoursRange.value.start; i < workingHoursRange.value.end; i++) {
                hours.push(i);
            }
            return hours;
        }
        // Toutes les heures (0-23)
        return Array.from({ length: 24 }, (_, i) => i);
    });

    // ***** JOURS VISIBLES (pour vue semaine) *****

    const getVisibleDaysForWeek = (startDayId) => {
        const daysInWeek = 7;
        const days = [];

        for (let i = 0; i < daysInWeek; i++) {
            const dayId = startDayId + i;
            const dayOfWeek = dayId % 7; // 0 = Lundi, 6 = Dimanche

            // Skip weekends si désactivés (5 = Samedi, 6 = Dimanche)
            if (!showWeekends.value && (dayOfWeek === 5 || dayOfWeek === 6)) {
                continue;
            }

            days.push({
                id: dayId,
                dayOfWeek: dayOfWeek,
                isWeekend: dayOfWeek === 5 || dayOfWeek === 6
            });
        }

        return days;
    };

    // ***** MODE COMPACT *****

    const toggleCompactMode = () => {
        compactMode.value = !compactMode.value;
    };

    // ***** COMPUTED PROPERTIES *****

    const currentViewConfig = computed(() => {
        return getViewConfig(currentView.value);
    });

    const numberOfVisibleDays = computed(() => {
        if (currentView.value === VIEW_TYPES.WEEK) {
            return showWeekends.value ? 7 : 5;
        }
        if (currentView.value === VIEW_TYPES.DAY) {
            return 1;
        }
        return currentViewConfig.value.numberOfDays;
    });

    const hourGridSize = computed(() => {
        return visibleHours.value.length;
    });

    // ***** PRÉFÉRENCES VISUELLES *****

    const showEventTime = ref(true);
    const showEventDescription = ref(true);
    const showEventCategory = ref(true);
    const eventMinHeight = ref(30); // En pixels

    const toggleEventTime = () => {
        showEventTime.value = !showEventTime.value;
    };

    const toggleEventDescription = () => {
        showEventDescription.value = !showEventDescription.value;
    };

    const toggleEventCategory = () => {
        showEventCategory.value = !showEventCategory.value;
    };

    const setEventMinHeight = (height) => {
        if (height >= 20 && height <= 100) {
            eventMinHeight.value = height;
        }
    };

    // ***** DENSITÉ D'AFFICHAGE *****

    const density = ref('normal'); // 'compact', 'normal', 'comfortable'

    const setDensity = (newDensity) => {
        if (['compact', 'normal', 'comfortable'].includes(newDensity)) {
            density.value = newDensity;
        }
    };

    const densityConfig = computed(() => {
        const configs = {
            compact: {
                cellHeight: 40,
                eventPadding: 4,
                fontSize: 11,
                headerHeight: 50
            },
            normal: {
                cellHeight: 50,
                eventPadding: 8,
                fontSize: 13,
                headerHeight: 80
            },
            comfortable: {
                cellHeight: 60,
                eventPadding: 12,
                fontSize: 14,
                headerHeight: 100
            }
        };
        return configs[density.value];
    });

    // ***** ZOOM *****

    const zoomLevel = ref(100); // Pourcentage

    const zoomIn = () => {
        zoomLevel.value = Math.min(zoomLevel.value + 10, 200);
    };

    const zoomOut = () => {
        zoomLevel.value = Math.max(zoomLevel.value - 10, 50);
    };

    const resetZoom = () => {
        zoomLevel.value = 100;
    };

    // ***** GRILLE CONFIGURATION *****

    const showGridLines = ref(true);
    const showCurrentTimeLine = ref(true);
    const snap15Minutes = ref(false); // Snapping tous les 15 minutes

    const toggleGridLines = () => {
        showGridLines.value = !showGridLines.value;
    };

    const toggleCurrentTimeLine = () => {
        showCurrentTimeLine.value = !showCurrentTimeLine.value;
    };

    const toggleSnap15Minutes = () => {
        snap15Minutes.value = !snap15Minutes.value;
    };

    // ***** PERSISTENCE *****

    const STORAGE_KEY = 'gauzian_agenda_view_preferences';

    const savePreferences = () => {
        try {
            const prefs = {
                currentView: currentView.value,
                showWeekends: showWeekends.value,
                workingHoursOnly: workingHoursOnly.value,
                workingHoursRange: workingHoursRange.value,
                compactMode: compactMode.value,
                showEventTime: showEventTime.value,
                showEventDescription: showEventDescription.value,
                showEventCategory: showEventCategory.value,
                eventMinHeight: eventMinHeight.value,
                density: density.value,
                zoomLevel: zoomLevel.value,
                showGridLines: showGridLines.value,
                showCurrentTimeLine: showCurrentTimeLine.value,
                snap15Minutes: snap15Minutes.value
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch (error) {
            console.error('Erreur sauvegarde préférences vue:', error);
        }
    };

    const loadPreferences = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const prefs = JSON.parse(stored);
                currentView.value = prefs.currentView || VIEW_TYPES.WEEK;
                showWeekends.value = prefs.showWeekends ?? true;
                workingHoursOnly.value = prefs.workingHoursOnly ?? false;
                workingHoursRange.value = prefs.workingHoursRange || { start: 8, end: 18 };
                compactMode.value = prefs.compactMode ?? false;
                showEventTime.value = prefs.showEventTime ?? true;
                showEventDescription.value = prefs.showEventDescription ?? true;
                showEventCategory.value = prefs.showEventCategory ?? true;
                eventMinHeight.value = prefs.eventMinHeight || 30;
                density.value = prefs.density || 'normal';
                zoomLevel.value = prefs.zoomLevel || 100;
                showGridLines.value = prefs.showGridLines ?? true;
                showCurrentTimeLine.value = prefs.showCurrentTimeLine ?? true;
                snap15Minutes.value = prefs.snap15Minutes ?? false;
            }
        } catch (error) {
            console.error('Erreur chargement préférences vue:', error);
        }
    };

    return {
        // État
        currentView,
        VIEW_TYPES,

        // Gestion des vues
        setView,
        getViewConfig,
        isCurrentView,
        currentViewConfig,

        // Jours visibles
        showWeekends,
        toggleWeekends,
        getVisibleDaysForWeek,
        numberOfVisibleDays,

        // Heures
        workingHoursOnly,
        toggleWorkingHours,
        setWorkingHours,
        workingHoursRange,
        visibleHours,
        hourGridSize,

        // Mode compact
        compactMode,
        toggleCompactMode,

        // Préférences visuelles
        showEventTime,
        showEventDescription,
        showEventCategory,
        eventMinHeight,
        toggleEventTime,
        toggleEventDescription,
        toggleEventCategory,
        setEventMinHeight,

        // Densité
        density,
        setDensity,
        densityConfig,

        // Zoom
        zoomLevel,
        zoomIn,
        zoomOut,
        resetZoom,

        // Grille
        showGridLines,
        showCurrentTimeLine,
        snap15Minutes,
        toggleGridLines,
        toggleCurrentTimeLine,
        toggleSnap15Minutes,

        // Persistence
        savePreferences,
        loadPreferences
    };
};
