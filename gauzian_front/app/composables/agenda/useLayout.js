export function useLayout(events) {
    const isMobile = ref(false)

    // Fonction pour détecter si deux événements se chevauchent
    function eventsOverlap(event1, event2) {
        return event1.startHour < event2.endHour && event2.startHour < event1.endHour;
    }

    // Computed property qui calcule le positionnement pour gérer l'overlapping
    const eventsWithLayout = computed(() => {
        // Grouper les événements par jour
        const eventsByDay = {};
        events.value.forEach(event => {
            if (!eventsByDay[event.dayId]) {
                eventsByDay[event.dayId] = [];
            }
            eventsByDay[event.dayId].push(event);
        });

        // Pour chaque jour, calculer le layout
        const layoutedEvents = [];

        Object.keys(eventsByDay).forEach(dayId => {
            const dayEvents = eventsByDay[dayId].sort((a, b) => a.startHour - b.startHour);

            // Assigner une colonne à chaque événement
            const columns = [];

            dayEvents.forEach(event => {
                // Trouver la première colonne disponible
                let column = 0;
                let placed = false;

                while (!placed) {
                    // Vérifier si cette colonne est libre
                    const columnFree = !columns[column] ||
                        columns[column].every(e => !eventsOverlap(e, event));

                    if (columnFree) {
                        if (!columns[column]) columns[column] = [];
                        columns[column].push(event);

                        layoutedEvents.push({
                            ...event,
                            column: column,
                            totalColumns: 0 // Sera mis à jour après
                        });
                        placed = true;
                    } else {
                        column++;
                    }
                }
            });

            // Mettre à jour totalColumns pour tous les événements de ce jour
            const totalCols = columns.length;
            layoutedEvents.forEach(e => {
                if (e.dayId === parseInt(dayId)) {
                    e.totalColumns = totalCols;
                }
            });
        });

        return layoutedEvents;
    });

    return {
        isMobile,
        eventsWithLayout
    };

}