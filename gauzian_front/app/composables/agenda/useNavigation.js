// useNavigation.js - Navigation temporelle pour l'agenda

import { ref, computed } from 'vue';

// État global de navigation (singleton)
const currentDate = ref(new Date());
const selectedDate = ref(new Date());

export const useNavigation = () => {
    // ***** DATE UTILITIES *****

    const getDayOfWeek = (date) => {
        // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
        return date.getDay();
    };

    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        // Lundi = 0, donc on ajuste
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const getEndOfWeek = (date) => {
        const start = getStartOfWeek(date);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
    };

    const getStartOfMonth = (date) => {
        const d = new Date(date);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const getEndOfMonth = (date) => {
        const d = new Date(date);
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        d.setHours(23, 59, 59, 999);
        return d;
    };

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    // ***** NAVIGATION PRINCIPALE *****

    const goToToday = () => {
        currentDate.value = new Date();
        selectedDate.value = new Date();
    };

    const goToDate = (date) => {
        if (date instanceof Date && !isNaN(date)) {
            currentDate.value = new Date(date);
            selectedDate.value = new Date(date);
        } else {
            console.warn('Date invalide:', date);
        }
    };

    const nextDay = () => {
        const d = new Date(currentDate.value);
        d.setDate(d.getDate() + 1);
        currentDate.value = d;
    };

    const previousDay = () => {
        const d = new Date(currentDate.value);
        d.setDate(d.getDate() - 1);
        currentDate.value = d;
    };

    const nextWeek = () => {
        const d = new Date(currentDate.value);
        d.setDate(d.getDate() + 7);
        currentDate.value = d;
    };

    const previousWeek = () => {
        const d = new Date(currentDate.value);
        d.setDate(d.getDate() - 7);
        currentDate.value = d;
    };

    const nextMonth = () => {
        const d = new Date(currentDate.value);
        d.setMonth(d.getMonth() + 1);
        currentDate.value = d;
    };

    const previousMonth = () => {
        const d = new Date(currentDate.value);
        d.setMonth(d.getMonth() - 1);
        currentDate.value = d;
    };

    const nextYear = () => {
        const d = new Date(currentDate.value);
        d.setFullYear(d.getFullYear() + 1);
        currentDate.value = d;
    };

    const previousYear = () => {
        const d = new Date(currentDate.value);
        d.setFullYear(d.getFullYear() - 1);
        currentDate.value = d;
    };

    // ***** COMPUTED PROPERTIES *****

    const currentWeekStart = computed(() => {
        return getStartOfWeek(currentDate.value);
    });

    const currentWeekEnd = computed(() => {
        return getEndOfWeek(currentDate.value);
    });

    const currentMonthStart = computed(() => {
        return getStartOfMonth(currentDate.value);
    });

    const currentMonthEnd = computed(() => {
        return getEndOfMonth(currentDate.value);
    });

    const currentYear = computed(() => {
        return currentDate.value.getFullYear();
    });

    const currentMonth = computed(() => {
        return currentDate.value.getMonth();
    });

    const currentMonthName = computed(() => {
        const monthNames = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        return monthNames[currentMonth.value];
    });

    const currentWeekNumber = computed(() => {
        const d = new Date(currentDate.value);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    });

    const isToday = computed(() => {
        const today = new Date();
        return (
            currentDate.value.getDate() === today.getDate() &&
            currentDate.value.getMonth() === today.getMonth() &&
            currentDate.value.getFullYear() === today.getFullYear()
        );
    });

    const formattedCurrentDate = computed(() => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return currentDate.value.toLocaleDateString('fr-FR', options);
    });

    const formattedCurrentWeek = computed(() => {
        const start = currentWeekStart.value;
        const end = currentWeekEnd.value;

        if (start.getMonth() === end.getMonth()) {
            return `${start.getDate()} - ${end.getDate()} ${currentMonthName.value} ${currentYear.value}`;
        } else {
            const startMonthNames = [
                'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
                'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
            ];
            return `${start.getDate()} ${startMonthNames[start.getMonth()]} - ${end.getDate()} ${startMonthNames[end.getMonth()]} ${currentYear.value}`;
        }
    });

    // ***** GÉNÉRATION DE JOURS *****

    const getWeekDays = (startDate = currentWeekStart.value) => {
        const days = [];
        const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        const dayNamesShort = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            const isToday =
                date.getDate() === new Date().getDate() &&
                date.getMonth() === new Date().getMonth() &&
                date.getFullYear() === new Date().getFullYear();

            days.push({
                id: i,
                date: date,
                dayOfWeek: i,
                dayName: dayNames[i],
                dayNameShort: dayNamesShort[i],
                dayNumber: date.getDate(),
                month: date.getMonth(),
                year: date.getFullYear(),
                isToday: isToday,
                isWeekend: i === 5 || i === 6,
                isCurrentMonth: date.getMonth() === currentDate.value.getMonth()
            });
        }

        return days;
    };

    const getMonthDays = (date = currentDate.value) => {
        const days = [];
        const firstDay = getStartOfMonth(date);
        const lastDay = getEndOfMonth(date);
        const daysInMonth = getDaysInMonth(date);

        // Jours avant le début du mois (pour compléter la première semaine)
        const startDayOfWeek = getDayOfWeek(firstDay);
        const daysToAdd = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Lundi = 0

        for (let i = daysToAdd; i > 0; i--) {
            const d = new Date(firstDay);
            d.setDate(d.getDate() - i);
            days.push({
                date: d,
                dayNumber: d.getDate(),
                isCurrentMonth: false,
                isToday: false
            });
        }

        // Jours du mois
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(date);
            d.setDate(i);

            const isToday =
                d.getDate() === new Date().getDate() &&
                d.getMonth() === new Date().getMonth() &&
                d.getFullYear() === new Date().getFullYear();

            days.push({
                date: d,
                dayNumber: i,
                isCurrentMonth: true,
                isToday: isToday,
                isWeekend: getDayOfWeek(d) === 0 || getDayOfWeek(d) === 6
            });
        }

        // Jours après la fin du mois (pour compléter la dernière semaine)
        const endDayOfWeek = getDayOfWeek(lastDay);
        const daysToAddAtEnd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;

        for (let i = 1; i <= daysToAddAtEnd; i++) {
            const d = new Date(lastDay);
            d.setDate(d.getDate() + i);
            days.push({
                date: d,
                dayNumber: d.getDate(),
                isCurrentMonth: false,
                isToday: false
            });
        }

        return days;
    };

    // ***** CONVERSION DATE <-> DAYID *****

    // Référence epoch pour les dayId (1er janvier 2020)
    const EPOCH = new Date(2020, 0, 1);

    const dateToDayId = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const epochTime = EPOCH.getTime();
        const dateTime = d.getTime();
        const diffTime = dateTime - epochTime;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const dayIdToDate = (dayId) => {
        const d = new Date(EPOCH);
        d.setDate(d.getDate() + dayId);
        return d;
    };

    const getCurrentDayId = () => {
        return dateToDayId(currentDate.value);
    };

    const getWeekDayIds = (startDate = currentWeekStart.value) => {
        const days = getWeekDays(startDate);
        return days.map(day => ({
            ...day,
            dayId: dateToDayId(day.date)
        }));
    };

    const getMonthDayIds = (date = currentDate.value) => {
        const days = getMonthDays(date);
        return days.map(day => ({
            ...day,
            dayId: dateToDayId(day.date),
            dayName: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][day.date.getDay()],
            month: day.date.getMonth(),
            year: day.date.getFullYear()
        }));
    };

    // ***** RACCOURCIS CLAVIER *****

    const handleKeyboardNavigation = (event) => {
        // Ignorer si on est dans un input, textarea ou autre élément éditable
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        if (event.key === 'ArrowLeft') {
            if (event.ctrlKey || event.metaKey) {
                previousWeek();
            } else {
                previousDay();
            }
            event.preventDefault();
        } else if (event.key === 'ArrowRight') {
            if (event.ctrlKey || event.metaKey) {
                nextWeek();
            } else {
                nextDay();
            }
            event.preventDefault();
        } else if (event.key === 'ArrowUp') {
            if (event.ctrlKey || event.metaKey) {
                previousMonth();
            } else {
                previousWeek();
            }
            event.preventDefault();
        } else if (event.key === 'ArrowDown') {
            if (event.ctrlKey || event.metaKey) {
                nextMonth();
            } else {
                nextWeek();
            }
            event.preventDefault();
        } else if (event.key === 't' || event.key === 'T') {
            if (!event.ctrlKey && !event.metaKey) {
                goToToday();
                event.preventDefault();
            }
        }
    };

    const enableKeyboardNavigation = () => {
        window.addEventListener('keydown', handleKeyboardNavigation);
    };

    const disableKeyboardNavigation = () => {
        window.removeEventListener('keydown', handleKeyboardNavigation);
    };

    return {
        // État
        currentDate,
        selectedDate,

        // Navigation
        goToToday,
        goToDate,
        nextDay,
        previousDay,
        nextWeek,
        previousWeek,
        nextMonth,
        previousMonth,
        nextYear,
        previousYear,

        // Computed
        currentWeekStart,
        currentWeekEnd,
        currentMonthStart,
        currentMonthEnd,
        currentYear,
        currentMonth,
        currentMonthName,
        currentWeekNumber,
        isToday,
        formattedCurrentDate,
        formattedCurrentWeek,

        // Génération de jours
        getWeekDays,
        getMonthDays,
        getWeekDayIds,
        getMonthDayIds,

        // Conversion
        dateToDayId,
        dayIdToDate,
        getCurrentDayId,

        // Utilities
        getDayOfWeek,
        getStartOfWeek,
        getEndOfWeek,
        getStartOfMonth,
        getEndOfMonth,
        getDaysInMonth,

        // Clavier
        enableKeyboardNavigation,
        disableKeyboardNavigation,
        handleKeyboardNavigation
    };
};
