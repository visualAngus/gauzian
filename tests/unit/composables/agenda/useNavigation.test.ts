import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNavigation } from '@/composables/agenda/useNavigation'

// useNavigation utilise des refs SINGLETON au niveau module.
// On remet currentDate et selectedDate sur une date fixe avant chaque test.
const RESET_DATE = new Date(2024, 0, 15) // Lundi 15 janvier 2024

describe('useNavigation', () => {
    beforeEach(() => {
        const { goToDate } = useNavigation()
        goToDate(new Date(2024, 0, 15))
    })

    // ─── goToToday ───────────────────────────────────────────────────────────

    describe('goToToday', () => {
        it('met currentDate et selectedDate à la date du jour', () => {
            const { goToToday, currentDate, selectedDate } = useNavigation()
            const before = new Date()
            goToToday()
            const after = new Date()

            expect(currentDate.value.getDate()).toBe(before.getDate())
            expect(currentDate.value.getMonth()).toBe(before.getMonth())
            expect(currentDate.value.getFullYear()).toBe(before.getFullYear())

            expect(selectedDate.value.getDate()).toBe(after.getDate())
            expect(selectedDate.value.getMonth()).toBe(after.getMonth())
            expect(selectedDate.value.getFullYear()).toBe(after.getFullYear())
        })
    })

    // ─── goToDate ────────────────────────────────────────────────────────────

    describe('goToDate', () => {
        it('met à jour currentDate et selectedDate avec une Date valide', () => {
            const { goToDate, currentDate, selectedDate } = useNavigation()
            const target = new Date(2023, 5, 10)
            goToDate(target)

            expect(currentDate.value.getFullYear()).toBe(2023)
            expect(currentDate.value.getMonth()).toBe(5)
            expect(currentDate.value.getDate()).toBe(10)

            expect(selectedDate.value.getFullYear()).toBe(2023)
            expect(selectedDate.value.getMonth()).toBe(5)
            expect(selectedDate.value.getDate()).toBe(10)
        })

        it('ne change pas currentDate si la valeur est invalide', () => {
            const { goToDate, currentDate } = useNavigation()
            const before = currentDate.value.getTime()
            goToDate('not-a-date' as unknown as Date)
            expect(currentDate.value.getTime()).toBe(before)
        })

        it('ne change pas currentDate si la valeur est null', () => {
            const { goToDate, currentDate } = useNavigation()
            const before = currentDate.value.getTime()
            goToDate(null as unknown as Date)
            expect(currentDate.value.getTime()).toBe(before)
        })
    })

    // ─── nextDay / previousDay ───────────────────────────────────────────────

    describe('nextDay', () => {
        it('avance currentDate d\'un jour', () => {
            const { nextDay, currentDate } = useNavigation()
            const before = currentDate.value.getDate()
            nextDay()
            expect(currentDate.value.getDate()).toBe(before + 1)
        })
    })

    describe('previousDay', () => {
        it('recule currentDate d\'un jour', () => {
            const { previousDay, currentDate } = useNavigation()
            const before = currentDate.value.getDate()
            previousDay()
            expect(currentDate.value.getDate()).toBe(before - 1)
        })
    })

    // ─── nextWeek / previousWeek ─────────────────────────────────────────────

    describe('nextWeek', () => {
        it('avance currentDate de 7 jours', () => {
            const { nextWeek, currentDate } = useNavigation()
            const before = currentDate.value.getDate()
            nextWeek()
            expect(currentDate.value.getDate()).toBe(before + 7)
        })
    })

    describe('previousWeek', () => {
        it('recule currentDate de 7 jours', () => {
            const { previousWeek, currentDate } = useNavigation()
            const before = currentDate.value.getDate()
            previousWeek()
            expect(currentDate.value.getDate()).toBe(before - 7)
        })
    })

    // ─── nextMonth / previousMonth ───────────────────────────────────────────

    describe('nextMonth', () => {
        it('avance currentDate d\'un mois', () => {
            const { nextMonth, currentDate } = useNavigation()
            const beforeMonth = currentDate.value.getMonth()
            nextMonth()
            expect(currentDate.value.getMonth()).toBe(beforeMonth + 1)
        })
    })

    describe('previousMonth', () => {
        it('recule currentDate d\'un mois', () => {
            // Réinitialiser à février pour que previousMonth → janvier (pas de wrap 0→-1)
            const { goToDate, previousMonth, currentDate } = useNavigation()
            goToDate(new Date(2024, 1, 15)) // 15 février 2024
            previousMonth()
            expect(currentDate.value.getMonth()).toBe(0) // janvier
        })
    })

    // ─── nextYear / previousYear ─────────────────────────────────────────────

    describe('nextYear', () => {
        it('avance currentDate d\'un an', () => {
            const { nextYear, currentDate } = useNavigation()
            const beforeYear = currentDate.value.getFullYear()
            nextYear()
            expect(currentDate.value.getFullYear()).toBe(beforeYear + 1)
        })
    })

    describe('previousYear', () => {
        it('recule currentDate d\'un an', () => {
            const { previousYear, currentDate } = useNavigation()
            const beforeYear = currentDate.value.getFullYear()
            previousYear()
            expect(currentDate.value.getFullYear()).toBe(beforeYear - 1)
        })
    })

    // ─── getStartOfWeek ──────────────────────────────────────────────────────

    describe('getStartOfWeek', () => {
        it('retourne le lundi pour un mardi', () => {
            const { getStartOfWeek } = useNavigation()
            // 2024-01-16 est un mardi
            const tuesday = new Date(2024, 0, 16)
            const start = getStartOfWeek(tuesday)
            expect(start.getDay()).toBe(1) // 1 = Lundi
            expect(start.getDate()).toBe(15)
            expect(start.getHours()).toBe(0)
            expect(start.getMinutes()).toBe(0)
            expect(start.getSeconds()).toBe(0)
        })

        it('retourne le lundi précédent pour un dimanche', () => {
            const { getStartOfWeek } = useNavigation()
            // 2024-01-21 est un dimanche
            const sunday = new Date(2024, 0, 21)
            const start = getStartOfWeek(sunday)
            expect(start.getDay()).toBe(1) // 1 = Lundi
            expect(start.getDate()).toBe(15)
        })
    })

    // ─── getEndOfWeek ────────────────────────────────────────────────────────

    describe('getEndOfWeek', () => {
        it('retourne le dimanche à 23:59:59', () => {
            const { getEndOfWeek } = useNavigation()
            const monday = new Date(2024, 0, 15)
            const end = getEndOfWeek(monday)
            expect(end.getDay()).toBe(0) // 0 = Dimanche
            expect(end.getDate()).toBe(21)
            expect(end.getHours()).toBe(23)
            expect(end.getMinutes()).toBe(59)
            expect(end.getSeconds()).toBe(59)
        })
    })

    // ─── getDaysInMonth ──────────────────────────────────────────────────────

    describe('getDaysInMonth', () => {
        it('retourne 31 pour janvier', () => {
            const { getDaysInMonth } = useNavigation()
            expect(getDaysInMonth(new Date(2024, 0, 1))).toBe(31)
        })

        it('retourne 29 pour février 2024 (année bissextile)', () => {
            const { getDaysInMonth } = useNavigation()
            expect(getDaysInMonth(new Date(2024, 1, 1))).toBe(29)
        })

        it('retourne 28 pour février 2023 (année non bissextile)', () => {
            const { getDaysInMonth } = useNavigation()
            expect(getDaysInMonth(new Date(2023, 1, 1))).toBe(28)
        })

        it('retourne 30 pour avril', () => {
            const { getDaysInMonth } = useNavigation()
            expect(getDaysInMonth(new Date(2024, 3, 1))).toBe(30)
        })
    })

    // ─── dateToDayId et dayIdToDate ──────────────────────────────────────────

    describe('dateToDayId / dayIdToDate', () => {
        it('effectue un aller-retour cohérent pour dayId 10', () => {
            // Utiliser un petit dayId (janvier 2020) pour éviter les problèmes DST
            const { dateToDayId, dayIdToDate } = useNavigation()
            expect(dateToDayId(dayIdToDate(10))).toBe(10)
        })

        it('effectue un aller-retour cohérent pour dayId 0', () => {
            const { dateToDayId, dayIdToDate } = useNavigation()
            expect(dateToDayId(dayIdToDate(0))).toBe(0)
        })

        it('effectue un aller-retour cohérent pour dayId 365', () => {
            const { dateToDayId, dayIdToDate } = useNavigation()
            expect(dateToDayId(dayIdToDate(365))).toBe(365)
        })
    })

    // ─── getWeekDays ─────────────────────────────────────────────────────────

    describe('getWeekDays', () => {
        it('retourne exactement 7 jours', () => {
            const { getWeekDays } = useNavigation()
            const days = getWeekDays(new Date(2024, 0, 15))
            expect(days).toHaveLength(7)
        })

        it('le premier jour est un lundi (dayOfWeek: 0 dans le composable)', () => {
            const { getWeekDays } = useNavigation()
            // startDate = lundi 15 janvier 2024
            const days = getWeekDays(new Date(2024, 0, 15))
            // dayOfWeek 0 correspond à Lundi dans le tableau interne
            expect(days[0].dayOfWeek).toBe(0)
            expect(days[0].dayName).toBe('Lundi')
        })

        it('le dernier jour est un dimanche (dayOfWeek: 6)', () => {
            const { getWeekDays } = useNavigation()
            const days = getWeekDays(new Date(2024, 0, 15))
            expect(days[6].dayOfWeek).toBe(6)
            expect(days[6].dayName).toBe('Dimanche')
        })
    })

    // ─── getMonthDays ────────────────────────────────────────────────────────

    describe('getMonthDays', () => {
        it('contient les jours du mois courant', () => {
            const { getMonthDays } = useNavigation()
            const days = getMonthDays(new Date(2024, 0, 15))
            const currentMonthDays = days.filter(d => d.isCurrentMonth)
            expect(currentMonthDays).toHaveLength(31) // janvier = 31 jours
        })

        it('contient des jours de padding avant le premier du mois', () => {
            const { getMonthDays } = useNavigation()
            // Janvier 2024 commence un lundi → pas de padding
            const days = getMonthDays(new Date(2024, 0, 1))
            const paddingBefore = days.filter(d => !d.isCurrentMonth && d.date < new Date(2024, 0, 1))
            // Lundi 1er janvier : aucun padding nécessaire
            expect(paddingBefore).toHaveLength(0)
        })

        it('contient des jours de padding quand le mois ne commence pas un lundi', () => {
            const { getMonthDays } = useNavigation()
            // Mars 2024 commence un vendredi
            const days = getMonthDays(new Date(2024, 2, 1))
            const marchDays = days.filter(d => d.isCurrentMonth)
            expect(marchDays).toHaveLength(31)
            // Il doit y avoir des jours de padding en début (lun, mar, mer, jeu = 4 jours)
            const padding = days.filter(d => !d.isCurrentMonth)
            expect(padding.length).toBeGreaterThan(0)
        })

        it('la longueur totale est un multiple de 7', () => {
            const { getMonthDays } = useNavigation()
            const days = getMonthDays(new Date(2024, 0, 1))
            expect(days.length % 7).toBe(0)
        })
    })

    // ─── currentWeekNumber ───────────────────────────────────────────────────

    describe('currentWeekNumber', () => {
        it('retourne une valeur numérique strictement positive et <= 53', () => {
            const { currentWeekNumber } = useNavigation()
            const wn = currentWeekNumber.value
            expect(typeof wn).toBe('number')
            expect(wn).toBeGreaterThan(0)
            expect(wn).toBeLessThanOrEqual(53)
        })

        it('retourne 3 pour le 15 janvier 2024 (semaine 3)', () => {
            const { currentWeekNumber } = useNavigation()
            // RESET_DATE = 15 jan 2024 = semaine ISO 3
            expect(currentWeekNumber.value).toBe(3)
        })
    })

    // ─── currentMonthName ────────────────────────────────────────────────────

    describe('currentMonthName', () => {
        it('retourne "Janvier" pour le mois 0 (janvier)', () => {
            const { currentMonthName } = useNavigation()
            // RESET_DATE = janvier 2024
            expect(currentMonthName.value).toBe('Janvier')
        })

        it('retourne "Juillet" après navigation en juillet', () => {
            const { goToDate, currentMonthName } = useNavigation()
            goToDate(new Date(2024, 6, 1))
            expect(currentMonthName.value).toBe('Juillet')
        })
    })

    // ─── formattedCurrentDate ────────────────────────────────────────────────

    describe('formattedCurrentDate', () => {
        it('retourne une chaîne non vide', () => {
            const { formattedCurrentDate } = useNavigation()
            expect(typeof formattedCurrentDate.value).toBe('string')
            expect(formattedCurrentDate.value.length).toBeGreaterThan(0)
        })

        it('contient l\'année courante', () => {
            const { formattedCurrentDate } = useNavigation()
            expect(formattedCurrentDate.value).toContain('2024')
        })
    })

    // ─── isToday ─────────────────────────────────────────────────────────────

    describe('isToday', () => {
        it('retourne true après goToToday', () => {
            const { goToToday, isToday } = useNavigation()
            goToToday()
            expect(isToday.value).toBe(true)
        })

        it('retourne false après nextDay (on n\'est plus aujourd\'hui)', () => {
            const { goToToday, nextDay, isToday } = useNavigation()
            goToToday()
            nextDay()
            expect(isToday.value).toBe(false)
        })
    })

    // ─── formattedCurrentWeek ────────────────────────────────────────────────

    describe('formattedCurrentWeek', () => {
        it('affiche une chaîne non vide pour la semaine courante', () => {
            const { formattedCurrentWeek } = useNavigation()
            expect(typeof formattedCurrentWeek.value).toBe('string')
            expect(formattedCurrentWeek.value.length).toBeGreaterThan(0)
        })

        it('affiche le bon format quand la semaine est dans le même mois', () => {
            const { goToDate, formattedCurrentWeek } = useNavigation()
            // Semaine du 15-21 janvier 2024, même mois
            goToDate(new Date(2024, 0, 15))
            expect(formattedCurrentWeek.value).toContain('2024')
            expect(formattedCurrentWeek.value).toContain('Janvier')
        })

        it('affiche le format court quand la semaine chevauche deux mois', () => {
            const { goToDate, formattedCurrentWeek } = useNavigation()
            // Semaine du 29 jan - 4 fév 2024 : chevauche janvier et février
            goToDate(new Date(2024, 0, 29))
            expect(formattedCurrentWeek.value).toContain('Jan')
            expect(formattedCurrentWeek.value).toContain('Fév')
            expect(formattedCurrentWeek.value).toContain('2024')
        })
    })

    // ─── getWeekDayIds ────────────────────────────────────────────────────────

    describe('getWeekDayIds', () => {
        it('retourne 7 jours avec un champ dayId pour chacun', () => {
            const { getWeekDayIds } = useNavigation()
            const days = getWeekDayIds(new Date(2024, 0, 15))
            expect(days).toHaveLength(7)
            expect(days[0]).toHaveProperty('dayId')
            expect(typeof days[0].dayId).toBe('number')
        })
    })

    // ─── getMonthDayIds ───────────────────────────────────────────────────────

    describe('getMonthDayIds', () => {
        it('retourne les jours du mois avec dayId, dayName, month et year', () => {
            const { getMonthDayIds } = useNavigation()
            const days = getMonthDayIds(new Date(2024, 0, 15))
            expect(days.length).toBeGreaterThan(0)
            expect(days[0]).toHaveProperty('dayId')
            expect(days[0]).toHaveProperty('dayName')
            expect(days[0]).toHaveProperty('month')
            expect(days[0]).toHaveProperty('year')
        })

        it('la longueur totale est un multiple de 7', () => {
            const { getMonthDayIds } = useNavigation()
            const days = getMonthDayIds(new Date(2024, 0, 1))
            expect(days.length % 7).toBe(0)
        })
    })

    // ─── handleKeyboardNavigation ────────────────────────────────────────────

    describe('handleKeyboardNavigation', () => {
        it('avance d\'un jour avec ArrowRight sans modificateur', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowRight', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before + 1)
            expect(event.preventDefault).toHaveBeenCalled()
        })

        it('avance d\'une semaine avec ArrowRight + Ctrl', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowRight', ctrlKey: true, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before + 7)
        })

        it('recule d\'un jour avec ArrowLeft sans modificateur', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowLeft', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before - 1)
        })

        it('recule d\'une semaine avec ArrowLeft + Ctrl', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowLeft', ctrlKey: true, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before - 7)
        })

        it('avance d\'un mois avec ArrowDown + Ctrl', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getMonth()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowDown', ctrlKey: true, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getMonth()).toBe(before + 1)
        })

        it('avance d\'une semaine avec ArrowDown sans modificateur', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowDown', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before + 7)
        })

        it('recule d\'un mois avec ArrowUp + Ctrl', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 1, 15))
            const before = currentDate.value.getMonth()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowUp', ctrlKey: true, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getMonth()).toBe(before - 1)
        })

        it('recule d\'une semaine avec ArrowUp sans modificateur', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 22))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'ArrowUp', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before - 7)
        })

        it('va à aujourd\'hui avec la touche "t" sans modificateur', () => {
            const { handleKeyboardNavigation, isToday } = useNavigation()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 't', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(isToday.value).toBe(true)
            expect(event.preventDefault).toHaveBeenCalled()
        })

        it('va à aujourd\'hui avec la touche "T" sans modificateur', () => {
            const { handleKeyboardNavigation, isToday } = useNavigation()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'T', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(isToday.value).toBe(true)
        })

        it('ne fait rien si la touche "t" est pressée avec un modificateur', () => {
            const { handleKeyboardNavigation, goToDate, currentDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 't', ctrlKey: true, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            // t + modifier ne fait rien
            expect(currentDate.value.getDate()).toBe(before)
            expect(event.preventDefault).not.toHaveBeenCalled()
        })

        it('ignore les événements clavier dans un input', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'INPUT', isContentEditable: false }, key: 'ArrowRight', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before) // pas de changement
        })

        it('ignore les événements clavier dans un textarea', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'TEXTAREA', isContentEditable: false }, key: 'ArrowRight', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before)
        })

        it('ignore les événements clavier dans un élément contentEditable', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: true }, key: 'ArrowRight', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before)
        })

        it('ignore les touches non reconnues', () => {
            const { handleKeyboardNavigation, currentDate, goToDate } = useNavigation()
            goToDate(new Date(2024, 0, 15))
            const before = currentDate.value.getDate()
            const event = { target: { tagName: 'DIV', isContentEditable: false }, key: 'Escape', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
            handleKeyboardNavigation(event as unknown as KeyboardEvent)
            expect(currentDate.value.getDate()).toBe(before)
            expect(event.preventDefault).not.toHaveBeenCalled()
        })
    })

    // ─── enableKeyboardNavigation / disableKeyboardNavigation ─────────────────

    describe('enableKeyboardNavigation / disableKeyboardNavigation', () => {
        it('enregistre et supprime l\'écouteur keydown sur window', () => {
            const { enableKeyboardNavigation, disableKeyboardNavigation } = useNavigation()
            const addSpy = vi.spyOn(window, 'addEventListener')
            const removeSpy = vi.spyOn(window, 'removeEventListener')

            enableKeyboardNavigation()
            expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

            disableKeyboardNavigation()
            expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

            addSpy.mockRestore()
            removeSpy.mockRestore()
        })
    })
})
