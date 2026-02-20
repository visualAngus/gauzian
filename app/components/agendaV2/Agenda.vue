<template>
    <main>
        <div class="agenda-container">
            <div class="agenda-hours">
                <div></div>
                <div>00:00</div>
                <div></div>
                <div>01:00</div>
                <div>02:00</div>
                <div>03:00</div>
                <div>04:00</div>
                <div>05:00</div>
                <div>06:00</div>
                <div>07:00</div>
                <div>08:00</div>
                <div>09:00</div>
                <div>10:00</div>
                <div>11:00</div>
                <div>12:00</div>
                <div>13:00</div>
                <div>14:00</div>
                <div>15:00</div>
                <div>16:00</div>
                <div>17:00</div>
                <div>18:00</div>
                <div>19:00</div>
                <div>20:00</div>
                <div>21:00</div>
                <div>22:00</div>
                <div>23:00</div>
            </div>
            <div class="agenda-content">
                <div class="agenda-content--header">
                    <div class="head-day" v-for="(day, index) in daysWithDate" :key="index">
                        <span>{{ day.day }}</span>
                        <span :class="{ 'today': day.isToday }">{{ day.date }}</span>
                    </div>
                </div>
                <div class="agenda-content--events">
                    <div class="day_full" v-for="(day, index) in daysWithDate" :key="index">
                        <template v-for="event in normalizedWeekEvents" :key="event.id">
                            <div
                                v-if="event && event.start && event.end && event.start.getDate() === day.date && event.start.getMonth() === day.fullDate.getMonth() && event.start.getFullYear() === day.fullDate.getFullYear()"
                                class="event"
                                @mousedown="onEventMouseDown(event, $event)"
                                :style="{
                                    top: `${(event.start.getHours() + (event.start.getMinutes() / 60)) * (100 / 24)}%`,
                                    height: `${((event.end.getHours() - event.start.getHours()) + ((event.end.getMinutes() - event.start.getMinutes()) / 60)) * (100 / 24)}%`,
                                    width: eventLayouts[event.id] ? `calc(${100 / eventLayouts[event.id].totalColumns}% - 6px)` : 'calc(100% - 6px)',
                                    left: eventLayouts[event.id] ? `${((eventLayouts[event.id].column - 1) * 100) / eventLayouts[event.id].totalColumns}%` : '0',
                                }"
                            >
                                <span class="event-title">{{ event.title }}</span>
                                <span 
                                v-if ="((event.end.getHours() - event.start.getHours()) + ((event.end.getMinutes() - event.start.getMinutes()) / 60)) >= 2.5"
                                class="event-description">{{ event.description }}</span>
                                <span 
                                v-if ="((event.end.getHours() - event.start.getHours()) + ((event.end.getMinutes() - event.start.getMinutes()) / 60)) >= 0.5"
                                class="event-time" 
                                
                                >De {{ event.start.getHours() }}h{{ event.start.getMinutes().toString().padStart(2, '0') }} à {{ event.end.getHours() }}h{{ event.end.getMinutes().toString().padStart(2, '0') }}</span>
                            </div>
                        </template>
                    </div>

                </div>
                <div class="agenda-content--events__overlay">
                    <div v-for="hour in 24*7" :key="hour" class="event-slot"></div>
                </div>

            </div>
        </div>
    </main>
</template>
<script setup>
import { computed, ref } from 'vue';

const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const monthsOfYear = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const daysWithDate = ref([]);

// Sauvegarder le layout précédent pour stabilité
let previousLayout = {};

// Détection de conflits et assignation de colonnes pour les événements
const calculateEventLayout = (events) => {
    const layout = {};

    // Grouper les événements par jour
    const eventsByDay = {};
    events.forEach(event => {
        const key = `${event.start.getFullYear()}-${event.start.getMonth()}-${event.start.getDate()}`;
        if (!eventsByDay[key]) {
            eventsByDay[key] = [];
        }
        eventsByDay[key].push(event);
    });

    // Pour chaque jour, calculer le layout optimal
    Object.values(eventsByDay).forEach(dayEvents => {
        // Trier par heure de début, puis par durée (les plus longs d'abord)
        dayEvents.sort((a, b) => {
            if (a.start.getTime() !== b.start.getTime()) {
                return a.start.getTime() - b.start.getTime();
            }
            return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
        });

        // Colonnes : chaque colonne contient la liste des événements qu'elle héberge
        const columns = [];

        // Helper : vérifier si deux événements se chevauchent OU sont proches (< 15 min d'écart)
        const hasSignificantOverlap = (event1, event2) => {
            const MARGIN_MS = 15 * 60 * 1000; // 15 minutes en millisecondes

            // Cas 1 : Chevauchement réel (événements qui se superposent)
            if (event1.start < event2.end && event1.end > event2.start) {
                return true;
            };

            // Cas 2 : Événements proches mais ne se chevauchant pas
            // Calculer l'écart entre la fin d'un event et le début de l'autre
            const gap1 = event2.start.getTime() - event1.end.getTime(); // Event2 après Event1
            const gap2 = event1.start.getTime() - event2.end.getTime(); // Event1 après Event2

            // Si l'écart est positif (pas de chevauchement) mais < 15 min
            // on les considère quand même comme "se chevauchant" (marge de proximité)
            return (gap1 >= 0 && gap1 < MARGIN_MS) || (gap2 >= 0 && gap2 < MARGIN_MS);
        };

        dayEvents.forEach(event => {
            // Essayer d'utiliser la colonne précédente si elle existe et est disponible
            const previousColumn = previousLayout[event.id]?.column;
            let columnIndex = null;

            if (previousColumn !== undefined) {
                const targetIndex = previousColumn - 1; // Convertir de 1-based à 0-based

                // Vérifier si cette colonne existe et est disponible
                if (targetIndex < columns.length) {
                    const hasOverlap = columns[targetIndex].some(e =>
                        hasSignificantOverlap(event, e)
                    );
                    if (!hasOverlap) {
                        columnIndex = targetIndex; // Réutiliser la même colonne
                    }
                }
            }

            // Si pas de colonne précédente ou non disponible, chercher la première disponible
            if (columnIndex === null) {
                columnIndex = 0;
                while (columnIndex < columns.length) {
                    const hasOverlap = columns[columnIndex].some(e =>
                        hasSignificantOverlap(event, e)
                    );

                    if (!hasOverlap) {
                        break;
                    }
                    columnIndex++;
                }
            }

            // Si aucune colonne disponible, créer une nouvelle colonne
            if (columnIndex === columns.length) {
                columns.push([]);
            }

            columns[columnIndex].push(event);
            layout[event.id] = { column: columnIndex + 1, totalColumns: 1 }; // Sera recalculé
        });

        // Calculer totalColumns individuellement pour chaque événement
        // = nombre max de colonnes utilisées pendant sa période active
        dayEvents.forEach(event => {
            // Trouver tous les événements qui se chevauchent significativement avec celui-ci
            const overlapping = dayEvents.filter(e =>
                hasSignificantOverlap(event, e)
            );

            // Récupérer toutes les colonnes utilisées par les événements qui se chevauchent
            const columnsUsed = overlapping.map(e => layout[e.id].column);

            // totalColumns = la colonne la plus élevée parmi les chevauchements
            layout[event.id].totalColumns = Math.max(...columnsUsed);
        });
    });

    // Sauvegarder le layout pour la prochaine fois (stabilité des colonnes)
    previousLayout = { ...layout };

    return layout;
};

const allWeekEvents = ref([
    {
        title: 'Réwxcde projet',
        description: 'Discussion sur les étapes du projet',
        start: new Date(2026, 1, 14, 10, 0), // 5 février 2026 à 10h00
        end: new Date(2026, 1, 14, 13, 0),   // 5 février 2026 à 11h00
        id: 'custom-id-789' // ID personnalisé pour test
    },
    {
        title: 'xwcwxc de projet',
        description: 'Discussion sur les étapes du projet',
        start: new Date(2026, 1, 14, 10, 0), // 5 février 2026 à 10h00
        end: new Date(2026, 1, 14, 13, 0),   // 5 février 2026 à 11h00
        id: 'custom-id-101' // ID personnalisé pour test
    },
    {
        title: 'Déjeuner avec l\'équipe',
        description: 'Déjeuner informel pour renforcer la cohésion d\'équipe',
        start: new Date(2026, 1, 14, 12, 30), // 6 février 2026 à 12h30
        end: new Date(2026, 1, 14, 13, 30),   // 6 février 2026 à 13h30
        id: 'custom-id-123' // ID personnalisé pour test
    },
    {
        title: 'PPPPPPPPPPP',
        description: 'Déjeuner informel pour renforcer la cohésion d\'équipe',
        start: new Date(2026, 1, 14, 8, 30), // 6 février 2026 à 12h30
        end: new Date(2026, 1, 14, 9, 30),   // 6 février 2026 à 13h30
        id: 'custom-id-456' // ID personnalisé pour test
    },
]);

const normalizedWeekEvents = computed(() => {
    return allWeekEvents.value.map(event => ({
        ...event,
        start: event.start ? new Date(event.start) : null,
        end: event.end ? new Date(event.end) : null,
    }));
});

// Calculer les layouts pour tous les événements
const eventLayouts = computed(() => {
    return calculateEventLayout(normalizedWeekEvents.value);
});


const getCurrentDay = () => {
    const today = new Date();
    return today.getDate();
}

// fonction pour générer les jours de la semaine qui contiennent la date en input
const generateDaysOfWeek = (date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    // Décaler pour que lundi = 0 (au lieu de dimanche)
    const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(diff);
    
    daysWithDate.value = [];
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(startOfWeek.getDate() + i);
        daysWithDate.value.push({
            day: daysOfWeek[i],
            date: currentDate.getDate(),
            fullDate: currentDate,
            isToday: currentDate.getDate() === getCurrentDay() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear()
        });
    }
    return daysWithDate.value;
};

// Initialiser avec la semaine courante
generateDaysOfWeek(new Date());


// mooving events with mouse (drag and drop)

const draggedEventIndex = ref(null);
const dragStartY = ref(0);
const dragStartX = ref(0);
const originalStart = ref(null);
const originalEnd = ref(null);
const preferredColumn = ref(null); // Colonne préférée pour le drop

const onEventMouseDown = (event, evt) => {
    evt.preventDefault(); // Empêcher la sélection de texte
    
    // cursor: grabbing

    // Trouver l'index de l'événement dans allWeekEvents
    const index = allWeekEvents.value.findIndex(e =>
        e.start?.getTime() === event.start?.getTime() &&
        e.end?.getTime() === event.end?.getTime() &&
        e.title === event.title
    );

    if (index === -1) return;

    draggedEventIndex.value = index;
    dragStartY.value = evt.clientY;
    dragStartX.value = evt.clientX;
    originalStart.value = new Date(event.start);
    originalEnd.value = new Date(event.end);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

const onMouseMove = (evt) => {
    if (draggedEventIndex.value === null) return;

    evt.preventDefault();


    // === DÉPLACEMENT VERTICAL (Changement d'heure) ===
    const deltaY = evt.clientY - dragStartY.value;

    // Obtenir la hauteur de l'agenda pour calculer le déplacement en heures
    const agendaElement = document.querySelector('.agenda-content--events');
    if (!agendaElement) return;

    const agendaHeight = agendaElement.clientHeight;
    const pixelsPerHour = agendaHeight / 24;
    const hoursChange = deltaY / pixelsPerHour;

    // Snap sur 15 minutes
    const minutesChange = hoursChange * 60;
    const snappedMinutes = Math.round(minutesChange / 15) * 15;

    // === DÉPLACEMENT HORIZONTAL (Changement de jour) ===
    const deltaX = evt.clientX - dragStartX.value;

    // Calculer la largeur d'une colonne jour
    const dayColumn = document.querySelector('.day_full');
    let daysChange = 0;
    if (dayColumn) {
        const dayWidth = dayColumn.clientWidth;
        daysChange = Math.round(deltaX / dayWidth);
    }

    // === APPLIQUER LES CHANGEMENTS ===
    const newStart = new Date(originalStart.value);
    newStart.setMinutes(originalStart.value.getMinutes() + snappedMinutes);
    newStart.setDate(originalStart.value.getDate() + daysChange);

    const newEnd = new Date(originalEnd.value);
    newEnd.setMinutes(originalEnd.value.getMinutes() + snappedMinutes);
    newEnd.setDate(originalEnd.value.getDate() + daysChange);

    // Mettre à jour l'événement source dans allWeekEvents (réactif)
    allWeekEvents.value[draggedEventIndex.value].start = newStart;
    allWeekEvents.value[draggedEventIndex.value].end = newEnd;
};

const onMouseUp = () => {
    if (draggedEventIndex.value !== null) {
        const event = allWeekEvents.value[draggedEventIndex.value];
        console.log('Event dropped at:', {
            title: event.title,
            start: event.start,
            end: event.end
        });

        // TODO: Sauvegarder les changements via API

        draggedEventIndex.value = null;
    }

    // Nettoyer les event listeners
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
};

</script>
<style scoped>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    user-select: none;
	font-family: "Montserrat", sans-serif;

}
main{
    overflow: auto;
}
.agenda-container {
    width: 100%;
    height: 120%;
    display: grid;  
    grid-template-columns: 8% 92%;

}
.agenda-hours {
    width: 100%;
    height: 100%; 
    display: grid;
    grid-template-rows: 50px 15px repeat(24, 1fr);
}
.agenda-hours > div {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    font-size: 0.8rem;
    color: var(--color-text);
    border-top: 1px solid var(--color-surface-muted);
}

/* first child */
.agenda-hours > div:first-child {
    border-top: none;
}
/* seconde child */
.agenda-hours > div:nth-child(2) {
    border-top: none;
    border-right: 1px solid var(--color-surface-muted);    
}


.agenda-content {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: 50px 15px repeat(24, 1fr);
    position: relative;
}

.agenda-content--header {
    grid-column: 1 / -1;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
}

.head-day{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    color: var(--color-text);
    border-right: 1px solid var(--color-surface-muted);
}
.head-day > span:first-child {
    font-size: 0.7rem;
    color: var(--color-text-muted);
}
.today {
    background-color: var(--color-primary-soft);
    color: var(--color-primary);
    border-radius: 50%;
    padding: 0.2rem 0.5rem;
    font-weight: 600 !important;
}
.head-day > span:last-child {
    font-weight: 500;
    font-size: 1.2rem;
    text-align: center;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}


.head-day:last-child {
    border-right: none;
}



.agenda-content--events {
    grid-column: 1 / -1;
    grid-row: 3 / -1;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(24, 1fr);
}

.agenda-content--events__overlay {
    grid-column: 1 / -1;
    grid-row: 3 / -1;
    height: 100%;

    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(24, 1fr);

}
.event-slot {
    border-top: 1px solid var(--color-surface-muted);
    border-left: 1px solid var(--color-surface-muted);
    z-index: -1;
}
.day_full{
    grid-row: 1 / -1;
    width: 100%;
    height: 100%;
    position: relative; /* Permet le positionnement absolu des enfants */
    display: grid;
    grid-template-rows: repeat(24, 1fr);
}
.event {
    position: absolute; /* Positionnement calculé dynamiquement */
    height: auto;
    background-color: var(--color-primary);
    border-radius: 10px;
    padding: 0.5rem;
    overflow: hidden;
    box-sizing: border-box;
    color: white;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
}

.event:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
}
.event:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    z-index: 10;
    cursor: grabbing;
}

.event-title {
    font-weight: 600;
    margin-bottom: 0.2rem;
}
.event-description {
    font-size: 0.75rem;
    opacity: 0.9;
    margin-bottom: 0.2rem;
    /* max caractère 50 */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.event-time {
    font-size: 0.75rem;
    opacity: 0.9;
    margin-top: auto;
}
</style>