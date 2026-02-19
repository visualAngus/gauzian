// useLayout.js - Calcul du layout des événements (gestion des chevauchements)

import { computed } from 'vue';

export const useLayout = (events) => {
    // Vérifier si deux événements se chevauchent
    const eventsOverlap = (event1, event2) => {
        return event1.dayId === event2.dayId &&
               event1.startHour < event2.endHour &&
               event2.startHour < event1.endHour;
    };

    // Calculer le layout avec colonnes pour gérer les chevauchements
    const eventsWithLayout = computed(() => {
        if (!events || !events.value || events.value.length === 0) {
            return [];
        }

        // Grouper les événements par jour
        const eventsByDay = {};
        events.value.forEach(event => {
            if (!eventsByDay[event.dayId]) {
                eventsByDay[event.dayId] = [];
            }
            eventsByDay[event.dayId].push(event);
        });

        const layoutedEvents = [];

        // Pour chaque jour
        Object.keys(eventsByDay).forEach(dayId => {
            const dayEvents = eventsByDay[dayId];

            // Trier par heure de début, puis par durée (plus long en premier)
            const sortedEvents = [...dayEvents].sort((a, b) => {
                if (a.startHour !== b.startHour) {
                    return a.startHour - b.startHour;
                }
                return (b.endHour - b.startHour) - (a.endHour - a.startHour);
            });

            // Colonnes: array de arrays d'événements
            const columns = [];

            // Placer chaque événement dans une colonne
            sortedEvents.forEach(event => {
                let placed = false;
                let columnIndex = 0;

                // Chercher la première colonne disponible
                while (!placed) {
                    if (!columns[columnIndex]) {
                        columns[columnIndex] = [];
                    }

                    // Vérifier si l'événement peut être placé dans cette colonne
                    const canPlace = columns[columnIndex].every(e => !eventsOverlap(e, event));

                    if (canPlace) {
                        columns[columnIndex].push(event);
                        placed = true;
                    } else {
                        columnIndex++;
                    }
                }
            });

            // Calculer le nombre total de colonnes pour ce jour
            const totalColumns = columns.length;

            // Assigner les informations de layout à chaque événement
            columns.forEach((column, columnIndex) => {
                column.forEach(event => {
                    layoutedEvents.push({
                        ...event,
                        column: columnIndex,
                        totalColumns: totalColumns
                    });
                });
            });
        });

        return layoutedEvents;
    });

    // Calculer la largeur et position d'un événement
    const getEventStyle = (event, columnWidth = 100) => {
        if (!event.totalColumns || event.totalColumns === 1) {
            return {
                width: `calc(${columnWidth}% - 6px)`,
                marginLeft: '2px'
            };
        }

        const width = (columnWidth / event.totalColumns);
        const marginLeft = (event.column * width);

        return {
            width: `calc(${width}% - 6px)`,
            marginLeft: `calc(${marginLeft}% + 2px)`
        };
    };

    // Détecter les groupes d'événements qui se chevauchent
    const getOverlapGroups = (dayEvents) => {
        if (!dayEvents || dayEvents.length === 0) return [];

        const sortedEvents = [...dayEvents].sort((a, b) => a.startHour - b.startHour);
        const groups = [];
        let currentGroup = [sortedEvents[0]];

        for (let i = 1; i < sortedEvents.length; i++) {
            const event = sortedEvents[i];
            const overlapsWithGroup = currentGroup.some(e => eventsOverlap(e, event));

            if (overlapsWithGroup) {
                currentGroup.push(event);
            } else {
                groups.push(currentGroup);
                currentGroup = [event];
            }
        }

        groups.push(currentGroup);
        return groups;
    };

    // Calculer la densité d'événements pour un jour donné
    const getDayDensity = (dayId, events) => {
        const dayEvents = events.filter(e => e.dayId === dayId);
        if (dayEvents.length === 0) return 0;

        // Compter le nombre d'heures occupées
        const occupiedHours = new Set();
        dayEvents.forEach(event => {
            for (let h = event.startHour; h < event.endHour; h++) {
                occupiedHours.add(h);
            }
        });

        return (occupiedHours.size / 24) * 100; // Pourcentage
    };

    // Trouver l'heure la plus chargée d'un jour
    const getBusiestHour = (dayId, events) => {
        const dayEvents = events.filter(e => e.dayId === dayId);
        if (dayEvents.length === 0) return null;

        const hourCounts = {};
        for (let h = 0; h < 24; h++) {
            hourCounts[h] = 0;
        }

        dayEvents.forEach(event => {
            for (let h = event.startHour; h < event.endHour; h++) {
                hourCounts[h]++;
            }
        });

        let maxCount = 0;
        let busiestHour = 0;
        Object.entries(hourCounts).forEach(([hour, count]) => {
            if (count > maxCount) {
                maxCount = count;
                busiestHour = parseInt(hour);
            }
        });

        return { hour: busiestHour, count: maxCount };
    };

    // Vérifier si une plage horaire est libre
    const isTimeSlotFree = (dayId, startHour, endHour, events, excludeEventId = null) => {
        return !events.some(event => {
            if (event.id === excludeEventId) return false;
            if (event.dayId !== dayId) return false;
            return event.startHour < endHour && startHour < event.endHour;
        });
    };

    // Trouver le prochain créneau libre
    const findNextFreeSlot = (dayId, fromHour, duration, events) => {
        for (let hour = fromHour; hour <= 24 - duration; hour++) {
            if (isTimeSlotFree(dayId, hour, hour + duration, events)) {
                return { startHour: hour, endHour: hour + duration };
            }
        }
        return null; // Aucun créneau libre trouvé
    };

    return {
        eventsWithLayout,
        eventsOverlap,
        getEventStyle,
        getOverlapGroups,
        getDayDensity,
        getBusiestHour,
        isTimeSlotFree,
        findNextFreeSlot
    };
};
