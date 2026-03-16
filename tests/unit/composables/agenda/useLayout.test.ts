import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useLayout } from '@/composables/agenda/useLayout'

// Helpers pour créer des événements de test
const makeEvent = (id: number, dayId: number, startHour: number, endHour: number) => ({
    id,
    dayId,
    startHour,
    endHour,
    title: `Événement ${id}`
})

describe('useLayout', () => {

    // ─── eventsOverlap ────────────────────────────────────────────────────────

    describe('eventsOverlap', () => {
        it('retourne true si deux événements sont le même jour et leurs heures se chevauchent', () => {
            const events = ref([])
            const { eventsOverlap } = useLayout(events)

            const e1 = makeEvent(1, 10, 9, 11)
            const e2 = makeEvent(2, 10, 10, 12)
            expect(eventsOverlap(e1, e2)).toBe(true)
        })

        it('retourne true si un événement est contenu dans un autre', () => {
            const events = ref([])
            const { eventsOverlap } = useLayout(events)

            const e1 = makeEvent(1, 5, 8, 18)
            const e2 = makeEvent(2, 5, 10, 12)
            expect(eventsOverlap(e1, e2)).toBe(true)
        })

        it('retourne false si les événements sont sur des jours différents', () => {
            const events = ref([])
            const { eventsOverlap } = useLayout(events)

            const e1 = makeEvent(1, 10, 9, 11)
            const e2 = makeEvent(2, 11, 9, 11)
            expect(eventsOverlap(e1, e2)).toBe(false)
        })

        it('retourne false si les heures sont adjacentes (end === start suivant)', () => {
            const events = ref([])
            const { eventsOverlap } = useLayout(events)

            const e1 = makeEvent(1, 10, 9, 11)
            const e2 = makeEvent(2, 10, 11, 13)
            expect(eventsOverlap(e1, e2)).toBe(false)
        })

        it('retourne false si l\'événement 2 se termine avant que l\'événement 1 commence', () => {
            const events = ref([])
            const { eventsOverlap } = useLayout(events)

            const e1 = makeEvent(1, 10, 14, 16)
            const e2 = makeEvent(2, 10, 9, 11)
            expect(eventsOverlap(e1, e2)).toBe(false)
        })
    })

    // ─── eventsWithLayout ─────────────────────────────────────────────────────

    describe('eventsWithLayout', () => {
        it('retourne un tableau vide si aucun événement', () => {
            const events = ref([])
            const { eventsWithLayout } = useLayout(events)
            expect(eventsWithLayout.value).toHaveLength(0)
        })

        it('retourne un tableau vide si events est undefined', () => {
            const events = ref(undefined as any)
            const { eventsWithLayout } = useLayout(events)
            expect(eventsWithLayout.value).toHaveLength(0)
        })

        it('un événement seul a column: 0 et totalColumns: 1', () => {
            const events = ref([makeEvent(1, 10, 9, 11)])
            const { eventsWithLayout } = useLayout(events)
            const result = eventsWithLayout.value
            expect(result).toHaveLength(1)
            expect(result[0].column).toBe(0)
            expect(result[0].totalColumns).toBe(1)
        })

        it('deux événements qui se chevauchent ont totalColumns: 2 et des colonnes différentes', () => {
            const events = ref([
                makeEvent(1, 10, 9, 11),
                makeEvent(2, 10, 10, 12)
            ])
            const { eventsWithLayout } = useLayout(events)
            const result = eventsWithLayout.value
            expect(result).toHaveLength(2)
            expect(result[0].totalColumns).toBe(2)
            expect(result[1].totalColumns).toBe(2)
            const columns = result.map(e => e.column)
            expect(columns).toContain(0)
            expect(columns).toContain(1)
        })

        it('deux événements qui ne se chevauchent pas ont totalColumns: 1', () => {
            const events = ref([
                makeEvent(1, 10, 8, 10),
                makeEvent(2, 10, 12, 14)
            ])
            const { eventsWithLayout } = useLayout(events)
            const result = eventsWithLayout.value
            expect(result).toHaveLength(2)
            expect(result[0].totalColumns).toBe(1)
            expect(result[1].totalColumns).toBe(1)
        })
    })

    // ─── getEventStyle ────────────────────────────────────────────────────────

    describe('getEventStyle', () => {
        it('1 colonne → width: calc(100% - 6px), marginLeft: "2px"', () => {
            const events = ref([])
            const { getEventStyle } = useLayout(events)
            const style = getEventStyle({ column: 0, totalColumns: 1 })
            expect(style.width).toBe('calc(100% - 6px)')
            expect(style.marginLeft).toBe('2px')
        })

        it('2 colonnes colonne 0 → width: calc(50% - 6px)', () => {
            const events = ref([])
            const { getEventStyle } = useLayout(events)
            const style = getEventStyle({ column: 0, totalColumns: 2 })
            expect(style.width).toBe('calc(50% - 6px)')
        })

        it('2 colonnes colonne 1 → marginLeft contient "50%"', () => {
            const events = ref([])
            const { getEventStyle } = useLayout(events)
            const style = getEventStyle({ column: 1, totalColumns: 2 })
            expect(style.marginLeft).toContain('50%')
        })

        it('totalColumns absent → retourne le style pour 1 colonne', () => {
            const events = ref([])
            const { getEventStyle } = useLayout(events)
            const style = getEventStyle({ column: 0 })
            expect(style.marginLeft).toBe('2px')
        })
    })

    // ─── getOverlapGroups ─────────────────────────────────────────────────────

    describe('getOverlapGroups', () => {
        it('retourne un tableau vide pour un tableau vide', () => {
            const events = ref([])
            const { getOverlapGroups } = useLayout(events)
            expect(getOverlapGroups([])).toHaveLength(0)
        })

        it('retourne un tableau vide pour une valeur falsy', () => {
            const events = ref([])
            const { getOverlapGroups } = useLayout(events)
            expect(getOverlapGroups(null as any)).toHaveLength(0)
        })

        it('2 événements qui se chevauchent → 1 groupe de 2', () => {
            const events = ref([])
            const { getOverlapGroups } = useLayout(events)
            const dayEvents = [
                makeEvent(1, 10, 9, 11),
                makeEvent(2, 10, 10, 12)
            ]
            const groups = getOverlapGroups(dayEvents)
            expect(groups).toHaveLength(1)
            expect(groups[0]).toHaveLength(2)
        })

        it('2 événements qui ne se chevauchent pas → 2 groupes de 1', () => {
            const events = ref([])
            const { getOverlapGroups } = useLayout(events)
            const dayEvents = [
                makeEvent(1, 10, 8, 10),
                makeEvent(2, 10, 12, 14)
            ]
            const groups = getOverlapGroups(dayEvents)
            expect(groups).toHaveLength(2)
            expect(groups[0]).toHaveLength(1)
            expect(groups[1]).toHaveLength(1)
        })

        it('un seul événement → 1 groupe de 1', () => {
            const events = ref([])
            const { getOverlapGroups } = useLayout(events)
            const dayEvents = [makeEvent(1, 10, 9, 11)]
            const groups = getOverlapGroups(dayEvents)
            expect(groups).toHaveLength(1)
            expect(groups[0]).toHaveLength(1)
        })
    })

    // ─── getDayDensity ────────────────────────────────────────────────────────

    describe('getDayDensity', () => {
        it('retourne 0 pour un jour sans événements', () => {
            const events = ref([])
            const { getDayDensity } = useLayout(events)
            expect(getDayDensity(42, [])).toBe(0)
        })

        it('retourne une valeur > 0 pour un jour avec des événements', () => {
            const events = ref([])
            const { getDayDensity } = useLayout(events)
            const dayEvents = [makeEvent(1, 42, 9, 11)]
            const density = getDayDensity(42, dayEvents)
            expect(density).toBeGreaterThan(0)
        })

        it('calcule le pourcentage d\'heures occupées sur 24', () => {
            const events = ref([])
            const { getDayDensity } = useLayout(events)
            // 1 événement de 8h à 10h = 2 heures sur 24 = ~8.33%
            const dayEvents = [makeEvent(1, 5, 8, 10)]
            const density = getDayDensity(5, dayEvents)
            expect(density).toBeCloseTo((2 / 24) * 100, 1)
        })
    })

    // ─── getBusiestHour ───────────────────────────────────────────────────────

    describe('getBusiestHour', () => {
        it('retourne null pour un jour sans événements', () => {
            const events = ref([])
            const { getBusiestHour } = useLayout(events)
            expect(getBusiestHour(42, [])).toBeNull()
        })

        it('retourne l\'heure avec le plus d\'événements', () => {
            const events = ref([])
            const { getBusiestHour } = useLayout(events)
            const dayEvents = [
                makeEvent(1, 10, 9, 12),   // couvre 9, 10, 11
                makeEvent(2, 10, 10, 13),  // couvre 10, 11, 12
                makeEvent(3, 10, 11, 14),  // couvre 11, 12, 13
            ]
            // Heure 11 : couverte par les 3 événements
            const result = getBusiestHour(10, dayEvents)
            expect(result).toBeDefined()
            expect(result?.hour).toBe(11)
            expect(result?.count).toBe(3)
        })
    })

    // ─── isTimeSlotFree ───────────────────────────────────────────────────────

    describe('isTimeSlotFree', () => {
        it('retourne true si le créneau est libre', () => {
            const events = ref([])
            const { isTimeSlotFree } = useLayout(events)
            const dayEvents = [makeEvent(1, 10, 9, 11)]
            expect(isTimeSlotFree(10, 12, 14, dayEvents)).toBe(true)
        })

        it('retourne false si le créneau est occupé', () => {
            const events = ref([])
            const { isTimeSlotFree } = useLayout(events)
            const dayEvents = [makeEvent(1, 10, 9, 11)]
            expect(isTimeSlotFree(10, 10, 12, dayEvents)).toBe(false)
        })

        it('retourne true pour un créneau adjacent (non chevauchant)', () => {
            const events = ref([])
            const { isTimeSlotFree } = useLayout(events)
            const dayEvents = [makeEvent(1, 10, 9, 11)]
            expect(isTimeSlotFree(10, 11, 13, dayEvents)).toBe(true)
        })

        it('exclut l\'événement désigné par excludeEventId', () => {
            const events = ref([])
            const { isTimeSlotFree } = useLayout(events)
            const dayEvents = [makeEvent(1, 10, 9, 11)]
            // Sans exclusion → occupé
            expect(isTimeSlotFree(10, 10, 12, dayEvents)).toBe(false)
            // Avec exclusion de l'id 1 → libre
            expect(isTimeSlotFree(10, 10, 12, dayEvents, 1)).toBe(true)
        })
    })

    // ─── findNextFreeSlot ─────────────────────────────────────────────────────

    describe('findNextFreeSlot', () => {
        it('retourne le premier créneau libre dès l\'heure de départ si libre', () => {
            const events = ref([])
            const { findNextFreeSlot } = useLayout(events)
            const result = findNextFreeSlot(10, 8, 2, [])
            expect(result).toEqual({ startHour: 8, endHour: 10 })
        })

        it('retourne le premier créneau libre après les événements existants', () => {
            const events = ref([])
            const { findNextFreeSlot } = useLayout(events)
            const dayEvents = [makeEvent(1, 10, 8, 12)]
            const result = findNextFreeSlot(10, 8, 2, dayEvents)
            expect(result).toBeDefined()
            expect(result?.startHour).toBeGreaterThanOrEqual(12)
        })

        it('retourne null si aucun créneau libre n\'est disponible', () => {
            const events = ref([])
            const { findNextFreeSlot } = useLayout(events)
            // Événement qui bloque toute la journée
            const dayEvents = [makeEvent(1, 10, 0, 24)]
            const result = findNextFreeSlot(10, 0, 2, dayEvents)
            expect(result).toBeNull()
        })
    })
})
