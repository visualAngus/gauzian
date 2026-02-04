// useEvents.js - Gestion CRUD des événements avec persistance LocalStorage

import { ref, computed, watch } from 'vue';
// import de utils pour l'encryption 
import {
    decryptWithStoredPrivateKey,
    encryptWithPublicKey,
    generateDataKey,
    encryptWithStoredPublicKey,
    encryptSimpleDataWithDataKey
} from '~/utils/crypto';

const STORAGE_KEY = 'gauzian_agenda_events';

// État global des événements (singleton)
const events = ref([]);
const nextId = ref(1);

// Charger les événements depuis le LocalStorage au démarrage
const loadEvents = async (startDayId = null, endDayId = null) => {
    // #ICIBACK - Appel API GET /api/agenda/events?startDayId=XXX&endDayId=YYY
    if (startDayId !== null && endDayId !== null) {
        const response = await fetch(`/api/agenda/events?startDayId=${startDayId}&endDayId=${endDayId}`, {
            credentials: 'include'
        })
        events.value = await response.json().then(data => data.data.events)
        return
    }
    // try {
    //     const stored = localStorage.getItem(STORAGE_KEY);
    //     if (stored) {
    //         const data = JSON.parse(stored);
    //         events.value = data.events || [];
    //         nextId.value = data.nextId || 1;

    //         // Filtrer localement si interval fourni (pour simulation)
    //         if (startDayId !== null && endDayId !== null) {
    //             events.value = events.value.filter(event => {
    //                 const eventStart = event.startDayId || event.dayId;
    //                 const eventEnd = event.endDayId || event.dayId;
    //                 // Inclure si l'événement chevauche l'intervalle
    //                 return eventStart <= endDayId && eventEnd >= startDayId;
    //             });
    //         }
    //     } else {
    //         // Événements de démonstration par défaut
    //         events.value = [
    //             {
    //                 id: 1,
    //                 title: "Meeting with Team",
    //                 description: "Discuss Q1 goals and roadmap",
    //                 dayId: 2,
    //                 startHour: 10,
    //                 endHour: 11,
    //                 category: 'meeting',
    //                 color: 'blue'
    //             },
    //             {
    //                 id: 2,
    //                 title: "Project Deadline",
    //                 description: "Submit final deliverables",
    //                 dayId: 2,
    //                 startHour: 10,
    //                 endHour: 15,
    //                 category: 'deadline',
    //                 color: 'orange'
    //             },
    //             {
    //                 id: 3,
    //                 title: "Lunch with Client",
    //                 description: "Business lunch at downtown restaurant",
    //                 dayId: 2,
    //                 startHour: 12,
    //                 endHour: 18,
    //                 category: 'personal',
    //                 color: 'purple'
    //             },
    //             {
    //                 id: 4,
    //                 title: "Webinar on Vue.js",
    //                 description: "Advanced Vue 3 Composition API techniques",
    //                 dayId: 2,
    //                 startHour: 15,
    //                 endHour: 17,
    //                 category: 'learning',
    //                 color: 'teal'
    //             },
    //             {
    //                 id: 5,
    //                 title: "Code Review Session",
    //                 description: "Review PRs from the team",
    //                 dayId: 2,
    //                 startHour: 9,
    //                 endHour: 11,
    //                 category: 'project',
    //                 color: 'green'
    //             },
    //             {
    //                 id: 6,
    //                 title: "Design Meeting",
    //                 description: "Review new UI mockups",
    //                 dayId: 3,
    //                 startHour: 10,
    //                 endHour: 12,
    //                 category: 'meeting',
    //                 color: 'blue'
    //             }
    //         ];
    //         nextId.value = 7;
    //     }
    // } catch (error) {
    //     console.error('Erreur chargement événements:', error);
    //     events.value = [];
    //     nextId.value = 1;
    // }
};

// Sauvegarder les événements dans le LocalStorage
const saveEvents = () => {
    // #ICIBACK - Cette fonction sera supprimée
    // Les sauvegardes se feront directement dans createEvent/updateEvent/deleteEvent
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            events: events.value,
            nextId: nextId.value
        }));
    } catch (error) {
        console.error('Erreur sauvegarde événements:', error);
    }
};

// Watcher pour sauvegarder automatiquement à chaque modification
watch(events, () => {
    saveEvents();
}, { deep: true });

// Charger au démarrage
if (events.value.length === 0) {
    loadEvents();
}

export const useEvents = () => {
    // ***** CREATE *****
    const createEvent = async (eventData) => {

        // ici il faut encrypter les données sensibles avant envoi

        // générer une clé de données pour l'événement
        const dataKey = await generateDataKey();
        // encrypter les champs sensibles avec la clé de données
        const encryptedTitle = await encryptSimpleDataWithDataKey(eventData.title, dataKey);
        const encryptedDescription = eventData.description ? await encryptSimpleDataWithDataKey(eventData.description, dataKey) : null;
        const encryptedCategory = eventData.category ? await encryptSimpleDataWithDataKey(eventData.category, dataKey) : null;
        const encryptedColor = eventData.color ? await encryptSimpleDataWithDataKey(eventData.color, dataKey) : null;
        const encryptedEndDayId = eventData.endDayId ? await encryptSimpleDataWithDataKey(eventData.endDayId.toString(), dataKey) : null;
        const encryptedStartDayId = eventData.startDayId ? await encryptSimpleDataWithDataKey(eventData.startDayId.toString(), dataKey) : null;
        const encryptedStartHour = await encryptSimpleDataWithDataKey(eventData.startHour.toString(), dataKey);
        const encryptedEndHour = await encryptSimpleDataWithDataKey(eventData.endHour.toString(), dataKey);
        // encrypter la clé de données avec la clé publique de l'utilisateur
        const encryptedDataKey = await encryptWithStoredPublicKey(dataKey);

        // préparer les données à envoyer à l'API
        const payload = {
            ...eventData,
            title: encryptedTitle,
            description: encryptedDescription,
            encryptedDataKey: encryptedDataKey,
            category: encryptedCategory,
            color: encryptedColor,
            startDayId: encryptedStartDayId,
            endDayId: encryptedEndDayId,
            startHour: encryptedStartHour,
            endHour: encryptedEndHour
        };
       const response = await fetch('/api/agenda/events', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        const newEvent = await response.json()
        events.value.push(newEvent)
        return newEvent
    };

    // ***** READ *****
    const getEventById = (id) => {
        return events.value.find(event => event.id === id);
    };

    const getEventsByDay = (dayId) => {
        return events.value.filter(event => event.dayId === dayId);
    };

    const getEventsByCategory = (category) => {
        return events.value.filter(event => event.category === category);
    };

    const getEventsByDateRange = (startDayId, endDayId) => {
        return events.value.filter(event =>
            event.dayId >= startDayId && event.dayId <= endDayId
        );
    };

    // ***** UPDATE *****
    const updateEvent = (id, updates) => {
        // #ICIBACK - Appel API PUT /api/events/:id
        // const response = await fetch(`/api/events/${id}`, {
        //     method: 'PUT',
        //     credentials: 'include',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(updates)
        // })
        // const updatedEvent = await response.json()
        // const index = events.value.findIndex(e => e.id === id)
        // if (index !== -1) events.value[index] = updatedEvent
        // return updatedEvent

        const event = events.value.find(e => e.id === id);
        if (event) {
            Object.assign(event, {
                ...updates,
                updatedAt: new Date().toISOString()
            });
            return event;
        }
        return null;
    };

    // ***** DELETE *****
    const deleteEvent = (id) => {
        // #ICIBACK - Appel API DELETE /api/events/:id
        // await fetch(`/api/events/${id}`, {
        //     method: 'DELETE',
        //     credentials: 'include'
        // })
        // const index = events.value.findIndex(e => e.id === id)
        // if (index !== -1) events.value.splice(index, 1)
        // return true

        const index = events.value.findIndex(e => e.id === id);
        if (index !== -1) {
            events.value.splice(index, 1);
            return true;
        }
        return false;
    };

    const deleteEventsByCategory = (category) => {
        const initialLength = events.value.length;
        events.value = events.value.filter(e => e.category !== category);
        return initialLength - events.value.length; // Nombre supprimés
    };

    // ***** BULK OPERATIONS *****
    const bulkCreateEvents = (eventsData) => {
        const created = eventsData.map(data => createEvent(data));
        return created;
    };

    const clearAllEvents = () => {
        events.value = [];
        nextId.value = 1;
        saveEvents();
    };

    // ***** SEARCH & FILTER *****
    const searchEvents = (query) => {
        const lowerQuery = query.toLowerCase();
        return events.value.filter(event =>
            event.title.toLowerCase().includes(lowerQuery) ||
            (event.description && event.description.toLowerCase().includes(lowerQuery))
        );
    };

    const filterEvents = (filters) => {
        return events.value.filter(event => {
            if (filters.category && event.category !== filters.category) return false;
            if (filters.dayId && event.dayId !== filters.dayId) return false;
            if (filters.startHour !== undefined && event.startHour < filters.startHour) return false;
            if (filters.endHour !== undefined && event.endHour > filters.endHour) return false;
            return true;
        });
    };

    // ***** STATISTICS *****
    const getEventCount = computed(() => events.value.length);

    const getEventsByHour = computed(() => {
        const byHour = {};
        for (let i = 0; i < 24; i++) {
            byHour[i] = 0;
        }
        events.value.forEach(event => {
            for (let h = event.startHour; h < event.endHour; h++) {
                byHour[h]++;
            }
        });
        return byHour;
    });

    const getBusiestDay = computed(() => {
        const dayCount = {};
        events.value.forEach(event => {
            dayCount[event.dayId] = (dayCount[event.dayId] || 0) + 1;
        });

        let maxCount = 0;
        let busiestDay = null;
        Object.entries(dayCount).forEach(([dayId, count]) => {
            if (count > maxCount) {
                maxCount = count;
                busiestDay = parseInt(dayId);
            }
        });

        return { dayId: busiestDay, count: maxCount };
    });

    // ***** UTILITIES *****
    const duplicateEvent = (id, newDayId = null) => {
        const event = getEventById(id);
        if (event) {
            return createEvent({
                ...event,
                id: undefined, // Sera généré automatiquement
                dayId: newDayId || event.dayId,
                title: `${event.title} (copie)`
            });
        }
        return null;
    };

    const moveEvent = (id, newDayId, newStartHour) => {
        const event = getEventById(id);
        if (event) {
            const duration = event.endHour - event.startHour;
            return updateEvent(id, {
                dayId: newDayId,
                startHour: newStartHour,
                endHour: newStartHour + duration
            });
        }
        return null;
    };

    const resizeEvent = (id, newEndHour) => {
        const event = getEventById(id);
        if (event && newEndHour > event.startHour) {
            return updateEvent(id, {
                endHour: Math.min(newEndHour, 24)
            });
        }
        return null;
    };

    return {
        // État
        events,

        // CRUD
        createEvent,
        getEventById,
        getEventsByDay,
        getEventsByCategory,
        getEventsByDateRange,
        updateEvent,
        deleteEvent,
        deleteEventsByCategory,

        // Bulk
        bulkCreateEvents,
        clearAllEvents,

        // Search & Filter
        searchEvents,
        filterEvents,

        // Statistics
        getEventCount,
        getEventsByHour,
        getBusiestDay,

        // Utilities
        duplicateEvent,
        moveEvent,
        resizeEvent,

        // Storage
        loadEvents,
        saveEvents
    };
};
