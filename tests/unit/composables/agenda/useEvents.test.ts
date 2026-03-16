import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEvents } from '@/composables/agenda/useEvents'

vi.mock('@/utils/crypto', () => ({
  generateDataKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  encryptWithStoredPublicKey: vi.fn().mockResolvedValue('encrypted-data-key'),
  encryptSimpleDataWithDataKey: vi.fn().mockResolvedValue('encrypted-field'),
}))

vi.mock('@/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { events: [] } }),
    }),
  }),
}))

describe('useEvents', () => {
  let events: ReturnType<typeof useEvents>['events']
  let clearAllEvents: ReturnType<typeof useEvents>['clearAllEvents']
  let getEventById: ReturnType<typeof useEvents>['getEventById']
  let getEventsByDay: ReturnType<typeof useEvents>['getEventsByDay']
  let getEventsByCategory: ReturnType<typeof useEvents>['getEventsByCategory']
  let getEventsByDateRange: ReturnType<typeof useEvents>['getEventsByDateRange']
  let updateEvent: ReturnType<typeof useEvents>['updateEvent']
  let deleteEvent: ReturnType<typeof useEvents>['deleteEvent']
  let deleteEventsByCategory: ReturnType<typeof useEvents>['deleteEventsByCategory']
  let searchEvents: ReturnType<typeof useEvents>['searchEvents']
  let filterEvents: ReturnType<typeof useEvents>['filterEvents']
  let getEventCount: ReturnType<typeof useEvents>['getEventCount']
  let saveEvents: ReturnType<typeof useEvents>['saveEvents']
  let moveEvent: ReturnType<typeof useEvents>['moveEvent']
  let resizeEvent: ReturnType<typeof useEvents>['resizeEvent']
  let createEvent: ReturnType<typeof useEvents>['createEvent']
  let loadEvents: ReturnType<typeof useEvents>['loadEvents']

  beforeEach(() => {
    vi.clearAllMocks()
    ;({
      events,
      clearAllEvents,
      getEventById,
      getEventsByDay,
      getEventsByCategory,
      getEventsByDateRange,
      updateEvent,
      deleteEvent,
      deleteEventsByCategory,
      searchEvents,
      filterEvents,
      getEventCount,
      saveEvents,
      moveEvent,
      resizeEvent,
      createEvent,
      loadEvents,
    } = useEvents())

    // Vide le singleton avant chaque test
    clearAllEvents()
  })

  // ─── getEventById ──────────────────────────────────────────────────────

  describe('getEventById', () => {
    it("retourne l'événement correspondant à l'id fourni", () => {
      events.value.push({ id: 1, title: 'Réunion', dayId: 5, startHour: 9, endHour: 10, category: 'meeting' })

      const result = getEventById(1)

      expect(result).toBeDefined()
      expect(result?.title).toBe('Réunion')
    })

    it('retourne undefined si aucun événement ne correspond', () => {
      const result = getEventById(999)

      expect(result).toBeUndefined()
    })
  })

  // ─── getEventsByDay ────────────────────────────────────────────────────

  describe('getEventsByDay', () => {
    it('filtre les événements par dayId', () => {
      events.value.push(
        { id: 1, title: 'Matin', dayId: 10, startHour: 8, endHour: 9, category: 'meeting' },
        { id: 2, title: 'Soir', dayId: 11, startHour: 18, endHour: 19, category: 'personal' },
        { id: 3, title: 'Midi', dayId: 10, startHour: 12, endHour: 13, category: 'personal' }
      )

      const result = getEventsByDay(10)

      expect(result).toHaveLength(2)
      expect(result.every(e => e.dayId === 10)).toBe(true)
    })

    it('retourne un tableau vide si aucun événement pour ce jour', () => {
      events.value.push({ id: 1, title: 'Seul', dayId: 5, startHour: 9, endHour: 10, category: 'meeting' })

      expect(getEventsByDay(99)).toHaveLength(0)
    })
  })

  // ─── getEventsByCategory ───────────────────────────────────────────────

  describe('getEventsByCategory', () => {
    it('filtre les événements par catégorie', () => {
      events.value.push(
        { id: 1, title: 'A', dayId: 1, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 2, title: 'B', dayId: 2, startHour: 10, endHour: 11, category: 'deadline' },
        { id: 3, title: 'C', dayId: 3, startHour: 11, endHour: 12, category: 'meeting' }
      )

      const result = getEventsByCategory('meeting')

      expect(result).toHaveLength(2)
      expect(result.every(e => e.category === 'meeting')).toBe(true)
    })
  })

  // ─── getEventsByDateRange ──────────────────────────────────────────────

  describe('getEventsByDateRange', () => {
    it("retourne les événements dont le dayId est dans l'intervalle [start, end]", () => {
      events.value.push(
        { id: 1, title: 'Avant', dayId: 3, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 2, title: 'Début', dayId: 5, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 3, title: 'Milieu', dayId: 7, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 4, title: 'Fin', dayId: 10, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 5, title: 'Après', dayId: 12, startHour: 9, endHour: 10, category: 'meeting' }
      )

      const result = getEventsByDateRange(5, 10)

      expect(result).toHaveLength(3)
      expect(result.map(e => e.id)).toEqual([2, 3, 4])
    })
  })

  // ─── updateEvent ──────────────────────────────────────────────────────

  describe('updateEvent', () => {
    it("met à jour les champs de l'événement et ajoute updatedAt", () => {
      events.value.push({ id: 1, title: 'Ancien titre', dayId: 5, startHour: 9, endHour: 10, category: 'meeting' })

      const result = updateEvent(1, { title: 'Nouveau titre', startHour: 10 })

      expect(result?.title).toBe('Nouveau titre')
      expect(result?.startHour).toBe(10)
      expect(result?.updatedAt).toBeDefined()
    })

    it('retourne null si aucun événement ne correspond à cet id', () => {
      const result = updateEvent(999, { title: 'X' })

      expect(result).toBeNull()
    })
  })

  // ─── deleteEvent ──────────────────────────────────────────────────────

  describe('deleteEvent', () => {
    it("supprime l'événement et retourne true", () => {
      events.value.push({ id: 1, title: 'A supprimer', dayId: 1, startHour: 9, endHour: 10, category: 'meeting' })

      const result = deleteEvent(1)

      expect(result).toBe(true)
      expect(events.value).toHaveLength(0)
    })

    it("retourne false si l'événement n'existe pas", () => {
      const result = deleteEvent(999)

      expect(result).toBe(false)
    })
  })

  // ─── deleteEventsByCategory ────────────────────────────────────────────

  describe('deleteEventsByCategory', () => {
    it('supprime tous les événements de la catégorie et retourne le nombre supprimés', () => {
      events.value.push(
        { id: 1, title: 'A', dayId: 1, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 2, title: 'B', dayId: 2, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 3, title: 'C', dayId: 3, startHour: 9, endHour: 10, category: 'deadline' }
      )

      const count = deleteEventsByCategory('meeting')

      expect(count).toBe(2)
      expect(events.value).toHaveLength(1)
      expect(events.value[0].category).toBe('deadline')
    })

    it('retourne 0 si aucun événement de cette catégorie', () => {
      events.value.push({ id: 1, title: 'A', dayId: 1, startHour: 9, endHour: 10, category: 'deadline' })

      expect(deleteEventsByCategory('meeting')).toBe(0)
    })
  })

  // ─── searchEvents ──────────────────────────────────────────────────────

  describe('searchEvents', () => {
    it('recherche dans le titre (insensible à la casse)', () => {
      events.value.push(
        { id: 1, title: 'Réunion client', dayId: 1, startHour: 9, endHour: 10, category: 'meeting', description: '' },
        { id: 2, title: 'Code review', dayId: 2, startHour: 10, endHour: 11, category: 'project', description: '' }
      )

      const result = searchEvents('réunion')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })

    it('recherche dans la description (insensible à la casse)', () => {
      events.value.push(
        { id: 1, title: 'Sprint', dayId: 1, startHour: 9, endHour: 10, category: 'meeting', description: 'Discuss Q1 Goals' },
        { id: 2, title: 'Autre', dayId: 2, startHour: 10, endHour: 11, category: 'project', description: 'Rien de special' }
      )

      const result = searchEvents('q1 goals')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })

    it('retourne plusieurs résultats si la requête correspond à plusieurs événements', () => {
      events.value.push(
        { id: 1, title: 'Dev meeting', dayId: 1, startHour: 9, endHour: 10, category: 'meeting', description: '' },
        { id: 2, title: 'Dev workshop', dayId: 2, startHour: 10, endHour: 11, category: 'learning', description: '' }
      )

      expect(searchEvents('dev')).toHaveLength(2)
    })
  })

  // ─── filterEvents ──────────────────────────────────────────────────────

  describe('filterEvents', () => {
    beforeEach(() => {
      events.value.push(
        { id: 1, title: 'A', dayId: 5, startHour: 8, endHour: 10, category: 'meeting' },
        { id: 2, title: 'B', dayId: 5, startHour: 14, endHour: 17, category: 'deadline' },
        { id: 3, title: 'C', dayId: 6, startHour: 9, endHour: 11, category: 'meeting' }
      )
    })

    it('filtre par category', () => {
      const result = filterEvents({ category: 'meeting' })
      expect(result).toHaveLength(2)
    })

    it('filtre par dayId', () => {
      const result = filterEvents({ dayId: 5 })
      expect(result).toHaveLength(2)
    })

    it('filtre par startHour minimum', () => {
      // Exclut les événements dont startHour < 9
      const result = filterEvents({ startHour: 9 })
      expect(result.every(e => e.startHour >= 9)).toBe(true)
    })

    it('filtre par endHour maximum', () => {
      // Exclut les événements dont endHour > 11
      const result = filterEvents({ endHour: 11 })
      expect(result.every(e => e.endHour <= 11)).toBe(true)
    })

    it('combine plusieurs filtres', () => {
      const result = filterEvents({ category: 'meeting', dayId: 5 })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(1)
    })
  })

  // ─── getEventCount ─────────────────────────────────────────────────────

  describe('getEventCount', () => {
    it('retourne le nombre exact d\'événements (computed)', () => {
      expect(getEventCount.value).toBe(0)

      events.value.push(
        { id: 1, title: 'A', dayId: 1, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 2, title: 'B', dayId: 2, startHour: 10, endHour: 11, category: 'deadline' }
      )

      expect(getEventCount.value).toBe(2)
    })
  })

  // ─── clearAllEvents ────────────────────────────────────────────────────

  describe('clearAllEvents', () => {
    it('vide le tableau events et remet nextId à 1', () => {
      events.value.push(
        { id: 10, title: 'X', dayId: 1, startHour: 9, endHour: 10, category: 'meeting' },
        { id: 11, title: 'Y', dayId: 2, startHour: 10, endHour: 11, category: 'deadline' }
      )

      clearAllEvents()

      expect(events.value).toHaveLength(0)
    })
  })

  // ─── saveEvents ────────────────────────────────────────────────────────

  describe('saveEvents', () => {
    it('appelle localStorage.setItem avec la clé gauzian_agenda_events', () => {
      const spy = vi.spyOn(localStorage, 'setItem')
      events.value.push({ id: 1, title: 'Test', dayId: 1, startHour: 9, endHour: 10, category: 'meeting' })

      saveEvents()

      expect(spy).toHaveBeenCalledWith('gauzian_agenda_events', expect.any(String))
      const serialized = JSON.parse(spy.mock.calls[spy.mock.calls.length - 1][1])
      expect(serialized.events).toHaveLength(1)
    })
  })

  // ─── moveEvent ─────────────────────────────────────────────────────────

  describe('moveEvent', () => {
    it('met à jour dayId, startHour et endHour en conservant la durée', () => {
      // Durée initiale : endHour - startHour = 11 - 9 = 2h
      events.value.push({ id: 1, title: 'Déplaçable', dayId: 5, startHour: 9, endHour: 11, category: 'meeting' })

      const result = moveEvent(1, 7, 14)

      expect(result?.dayId).toBe(7)
      expect(result?.startHour).toBe(14)
      expect(result?.endHour).toBe(16) // 14 + 2 = 16
    })

    it("retourne null si l'événement n'existe pas", () => {
      expect(moveEvent(999, 1, 9)).toBeNull()
    })
  })

  // ─── resizeEvent ───────────────────────────────────────────────────────

  describe('resizeEvent', () => {
    it('met à jour endHour', () => {
      events.value.push({ id: 1, title: 'Extensible', dayId: 5, startHour: 9, endHour: 11, category: 'meeting' })

      const result = resizeEvent(1, 15)

      expect(result?.endHour).toBe(15)
    })

    it('ne dépasse pas 24 si newEndHour > 24', () => {
      events.value.push({ id: 1, title: 'Extensible', dayId: 5, startHour: 9, endHour: 11, category: 'meeting' })

      const result = resizeEvent(1, 26)

      expect(result?.endHour).toBe(24)
    })

    it('ne fait rien si newEndHour <= startHour', () => {
      events.value.push({ id: 1, title: 'Stable', dayId: 5, startHour: 9, endHour: 11, category: 'meeting' })

      const result = resizeEvent(1, 9)

      expect(result).toBeNull()
      expect(events.value[0].endHour).toBe(11)
    })
  })

  // ─── createEvent (async, avec mocks) ──────────────────────────────────

  describe('createEvent', () => {
    it('appelle les fonctions crypto et fetchWithAuth puis ajoute le résultat dans events', async () => {
      const { generateDataKey, encryptWithStoredPublicKey, encryptSimpleDataWithDataKey } =
        await import('@/utils/crypto')
      const { useFetchWithAuth } = await import('@/composables/useFetchWithAuth')

      const newEvent = { id: 42, title: 'encrypted-field', dayId: 3, startHour: 10, endHour: 11 }
      const mockFetchWithAuth = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(newEvent),
      })
      vi.mocked(useFetchWithAuth).mockReturnValue({ fetchWithAuth: mockFetchWithAuth })

      const eventData = {
        title: 'Planification sprint',
        description: 'Détails du sprint',
        dayId: 3,
        startHour: 10,
        endHour: 11,
        category: 'meeting',
        color: 'blue',
      }

      await createEvent(eventData)

      expect(generateDataKey).toHaveBeenCalled()
      expect(encryptWithStoredPublicKey).toHaveBeenCalled()
      expect(encryptSimpleDataWithDataKey).toHaveBeenCalled()
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/agenda/events', expect.objectContaining({ method: 'POST' }))
      expect(events.value).toContainEqual(newEvent)
    })
  })

  // ─── loadEvents (async, avec mocks) ───────────────────────────────────

  describe('loadEvents', () => {
    it('appelle fetchWithAuth avec les bons query params startDayId et endDayId', async () => {
      const { useFetchWithAuth } = await import('@/composables/useFetchWithAuth')

      const returnedEvents = [
        { id: 1, title: 'Evt', dayId: 5, startHour: 9, endHour: 10, category: 'meeting' },
      ]
      const mockFetchWithAuth = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { events: returnedEvents } }),
      })
      vi.mocked(useFetchWithAuth).mockReturnValue({ fetchWithAuth: mockFetchWithAuth })

      await loadEvents(5, 10)

      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/api/agenda/events?startDayId=5&endDayId=10',
        { method: 'GET' }
      )
      expect(events.value).toEqual(returnedEvents)
    })

    it("ne fait pas d'appel réseau si startDayId ou endDayId est null", async () => {
      const { useFetchWithAuth } = await import('@/composables/useFetchWithAuth')
      const mockFetchWithAuth = vi.fn()
      vi.mocked(useFetchWithAuth).mockReturnValue({ fetchWithAuth: mockFetchWithAuth })

      await loadEvents(null, null)

      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })
  })
})
