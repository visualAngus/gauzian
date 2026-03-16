import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useView } from '@/composables/agenda/useView'

// useView utilise des refs SINGLETON au niveau module.
// On reset l'état dans beforeEach via les fonctions exposées.

describe('useView', () => {
    beforeEach(() => {
        const {
            setView,
            showWeekends,
            workingHoursOnly,
            workingHoursRange,
            compactMode,
            density,
            zoomLevel,
            showGridLines,
            showCurrentTimeLine,
            snap15Minutes,
            resetZoom,
        } = useView()

        // Reset vers les valeurs initiales
        setView('week')
        showWeekends.value = true
        workingHoursOnly.value = false
        workingHoursRange.value = { start: 8, end: 18 }
        compactMode.value = false
        density.value = 'normal'
        resetZoom()
        showGridLines.value = true
        showCurrentTimeLine.value = true
        snap15Minutes.value = false
        localStorage.clear()
    })

    // ─── setView ──────────────────────────────────────────────────────────────

    describe('setView', () => {
        it('met à jour currentView avec "week"', () => {
            const { setView, currentView } = useView()
            setView('week')
            expect(currentView.value).toBe('week')
        })

        it('met à jour currentView avec "day"', () => {
            const { setView, currentView } = useView()
            setView('day')
            expect(currentView.value).toBe('day')
        })

        it('met à jour currentView avec "month"', () => {
            const { setView, currentView } = useView()
            setView('month')
            expect(currentView.value).toBe('month')
        })

        it('met à jour currentView avec "year"', () => {
            const { setView, currentView } = useView()
            setView('year')
            expect(currentView.value).toBe('year')
        })

        it('ne change pas currentView avec une valeur invalide', () => {
            const { setView, currentView } = useView()
            setView('week')
            setView('invalid_view' as any)
            expect(currentView.value).toBe('week')
        })
    })

    // ─── isCurrentView ────────────────────────────────────────────────────────

    describe('isCurrentView', () => {
        it('retourne true pour la vue courante', () => {
            const { setView, isCurrentView } = useView()
            setView('month')
            expect(isCurrentView('month')).toBe(true)
        })

        it('retourne false pour une vue différente', () => {
            const { setView, isCurrentView } = useView()
            setView('week')
            expect(isCurrentView('day')).toBe(false)
        })
    })

    // ─── getViewConfig ────────────────────────────────────────────────────────

    describe('getViewConfig', () => {
        it('retourne la config de la vue "week" avec name "Semaine" et numberOfDays 7', () => {
            const { getViewConfig } = useView()
            const config = getViewConfig('week')
            expect(config).toBeDefined()
            expect(config.name).toBe('Semaine')
            expect(config.numberOfDays).toBe(7)
        })

        it('retourne la config de la vue "day" avec numberOfDays 1', () => {
            const { getViewConfig } = useView()
            const config = getViewConfig('day')
            expect(config.numberOfDays).toBe(1)
        })
    })

    // ─── toggleWeekends ───────────────────────────────────────────────────────

    describe('toggleWeekends', () => {
        it('bascule showWeekends de true à false', () => {
            const { toggleWeekends, showWeekends } = useView()
            showWeekends.value = true
            toggleWeekends()
            expect(showWeekends.value).toBe(false)
        })

        it('bascule showWeekends de false à true', () => {
            const { toggleWeekends, showWeekends } = useView()
            showWeekends.value = false
            toggleWeekends()
            expect(showWeekends.value).toBe(true)
        })
    })

    // ─── numberOfVisibleDays ──────────────────────────────────────────────────

    describe('numberOfVisibleDays', () => {
        it('vaut 7 en vue semaine avec weekends activés', () => {
            const { setView, showWeekends, numberOfVisibleDays } = useView()
            setView('week')
            showWeekends.value = true
            expect(numberOfVisibleDays.value).toBe(7)
        })

        it('vaut 5 en vue semaine avec weekends désactivés', () => {
            const { setView, showWeekends, numberOfVisibleDays } = useView()
            setView('week')
            showWeekends.value = false
            expect(numberOfVisibleDays.value).toBe(5)
        })

        it('vaut 1 en vue jour', () => {
            const { setView, numberOfVisibleDays } = useView()
            setView('day')
            expect(numberOfVisibleDays.value).toBe(1)
        })
    })

    // ─── toggleWorkingHours ───────────────────────────────────────────────────

    describe('toggleWorkingHours', () => {
        it('bascule workingHoursOnly de false à true', () => {
            const { toggleWorkingHours, workingHoursOnly } = useView()
            workingHoursOnly.value = false
            toggleWorkingHours()
            expect(workingHoursOnly.value).toBe(true)
        })

        it('bascule workingHoursOnly de true à false', () => {
            const { toggleWorkingHours, workingHoursOnly } = useView()
            workingHoursOnly.value = true
            toggleWorkingHours()
            expect(workingHoursOnly.value).toBe(false)
        })
    })

    // ─── visibleHours ─────────────────────────────────────────────────────────

    describe('visibleHours', () => {
        it('retourne 24 heures si working hours est désactivé', () => {
            const { workingHoursOnly, visibleHours } = useView()
            workingHoursOnly.value = false
            expect(visibleHours.value).toHaveLength(24)
        })

        it('retourne seulement les heures de travail si activé (8h-18h = 10 heures)', () => {
            const { setView, workingHoursOnly, workingHoursRange, visibleHours } = useView()
            setView('week')
            workingHoursOnly.value = true
            workingHoursRange.value = { start: 8, end: 18 }
            expect(visibleHours.value).toHaveLength(10)
            expect(visibleHours.value[0]).toBe(8)
            expect(visibleHours.value[visibleHours.value.length - 1]).toBe(17)
        })

        it('retourne 24 heures en vue mois même si working hours est activé', () => {
            const { setView, workingHoursOnly, visibleHours } = useView()
            setView('month')
            workingHoursOnly.value = true
            expect(visibleHours.value).toHaveLength(24)
        })
    })

    // ─── setWorkingHours ──────────────────────────────────────────────────────

    describe('setWorkingHours', () => {
        it('met à jour workingHoursRange avec des valeurs valides (8, 18)', () => {
            const { setWorkingHours, workingHoursRange } = useView()
            setWorkingHours(8, 18)
            expect(workingHoursRange.value.start).toBe(8)
            expect(workingHoursRange.value.end).toBe(18)
        })

        it('ne change pas workingHoursRange si start >= end', () => {
            const { setWorkingHours, workingHoursRange } = useView()
            workingHoursRange.value = { start: 8, end: 18 }
            setWorkingHours(18, 8)
            expect(workingHoursRange.value.start).toBe(8)
            expect(workingHoursRange.value.end).toBe(18)
        })

        it('ne change pas workingHoursRange si start === end', () => {
            const { setWorkingHours, workingHoursRange } = useView()
            workingHoursRange.value = { start: 8, end: 18 }
            setWorkingHours(10, 10)
            expect(workingHoursRange.value.start).toBe(8)
            expect(workingHoursRange.value.end).toBe(18)
        })
    })

    // ─── zoomIn / zoomOut / resetZoom ─────────────────────────────────────────

    describe('zoomIn', () => {
        it('augmente zoomLevel de 10', () => {
            const { zoomIn, zoomLevel, resetZoom } = useView()
            resetZoom()
            zoomIn()
            expect(zoomLevel.value).toBe(110)
        })

        it('ne dépasse pas 200', () => {
            const { zoomIn, zoomLevel } = useView()
            zoomLevel.value = 195
            zoomIn()
            zoomIn()
            expect(zoomLevel.value).toBe(200)
        })
    })

    describe('zoomOut', () => {
        it('diminue zoomLevel de 10', () => {
            const { zoomOut, zoomLevel, resetZoom } = useView()
            resetZoom()
            zoomOut()
            expect(zoomLevel.value).toBe(90)
        })

        it('ne descend pas en dessous de 50', () => {
            const { zoomOut, zoomLevel } = useView()
            zoomLevel.value = 55
            zoomOut()
            zoomOut()
            expect(zoomLevel.value).toBe(50)
        })
    })

    describe('resetZoom', () => {
        it('remet zoomLevel à 100', () => {
            const { zoomIn, resetZoom, zoomLevel } = useView()
            zoomIn()
            zoomIn()
            resetZoom()
            expect(zoomLevel.value).toBe(100)
        })
    })

    // ─── setDensity ───────────────────────────────────────────────────────────

    describe('setDensity', () => {
        it('met à jour density avec "compact"', () => {
            const { setDensity, density } = useView()
            setDensity('compact')
            expect(density.value).toBe('compact')
        })

        it('met à jour density avec "normal"', () => {
            const { setDensity, density } = useView()
            setDensity('normal')
            expect(density.value).toBe('normal')
        })

        it('met à jour density avec "comfortable"', () => {
            const { setDensity, density } = useView()
            setDensity('comfortable')
            expect(density.value).toBe('comfortable')
        })

        it('ne change pas density avec une valeur invalide', () => {
            const { setDensity, density } = useView()
            density.value = 'normal'
            setDensity('ultra' as any)
            expect(density.value).toBe('normal')
        })
    })

    // ─── densityConfig ────────────────────────────────────────────────────────

    describe('densityConfig', () => {
        it('retourne cellHeight: 50 pour density "normal"', () => {
            const { setDensity, densityConfig } = useView()
            setDensity('normal')
            expect(densityConfig.value.cellHeight).toBe(50)
        })

        it('retourne cellHeight: 40 pour density "compact"', () => {
            const { setDensity, densityConfig } = useView()
            setDensity('compact')
            expect(densityConfig.value.cellHeight).toBe(40)
        })

        it('retourne cellHeight: 60 pour density "comfortable"', () => {
            const { setDensity, densityConfig } = useView()
            setDensity('comfortable')
            expect(densityConfig.value.cellHeight).toBe(60)
        })
    })

    // ─── toggleCompactMode ────────────────────────────────────────────────────

    describe('toggleCompactMode', () => {
        it('bascule compactMode de false à true', () => {
            const { toggleCompactMode, compactMode } = useView()
            compactMode.value = false
            toggleCompactMode()
            expect(compactMode.value).toBe(true)
        })

        it('bascule compactMode de true à false', () => {
            const { toggleCompactMode, compactMode } = useView()
            compactMode.value = true
            toggleCompactMode()
            expect(compactMode.value).toBe(false)
        })
    })

    // ─── savePreferences / loadPreferences ────────────────────────────────────

    describe('savePreferences / loadPreferences', () => {
        it('effectue un aller-retour complet des préférences via localStorage', () => {
            const { setView, showWeekends, setDensity, zoomLevel, savePreferences, loadPreferences, currentView, density } = useView()

            setView('day')
            showWeekends.value = false
            setDensity('comfortable')
            zoomLevel.value = 150

            savePreferences()

            // Reset à la main pour vérifier le rechargement
            setView('week')
            showWeekends.value = true
            setDensity('normal')
            zoomLevel.value = 100

            loadPreferences()

            expect(currentView.value).toBe('day')
            expect(showWeekends.value).toBe(false)
            expect(density.value).toBe('comfortable')
            expect(zoomLevel.value).toBe(150)
        })
    })

    // ─── toggleGridLines ──────────────────────────────────────────────────────

    describe('toggleGridLines', () => {
        it('bascule showGridLines', () => {
            const { toggleGridLines, showGridLines } = useView()
            showGridLines.value = true
            toggleGridLines()
            expect(showGridLines.value).toBe(false)
            toggleGridLines()
            expect(showGridLines.value).toBe(true)
        })
    })

    // ─── toggleCurrentTimeLine ────────────────────────────────────────────────

    describe('toggleCurrentTimeLine', () => {
        it('bascule showCurrentTimeLine', () => {
            const { toggleCurrentTimeLine, showCurrentTimeLine } = useView()
            showCurrentTimeLine.value = true
            toggleCurrentTimeLine()
            expect(showCurrentTimeLine.value).toBe(false)
            toggleCurrentTimeLine()
            expect(showCurrentTimeLine.value).toBe(true)
        })
    })

    // ─── toggleSnap15Minutes ──────────────────────────────────────────────────

    describe('toggleSnap15Minutes', () => {
        it('bascule snap15Minutes', () => {
            const { toggleSnap15Minutes, snap15Minutes } = useView()
            snap15Minutes.value = false
            toggleSnap15Minutes()
            expect(snap15Minutes.value).toBe(true)
            toggleSnap15Minutes()
            expect(snap15Minutes.value).toBe(false)
        })
    })
})
