import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCategories } from '@/composables/agenda/useCategories'

// useCategories utilise des refs SINGLETON.
// On réinitialise les filtres avec clearFilters() dans beforeEach.
// Les catégories ont une valeur initiale fixe de 9 entrées.

describe('useCategories', () => {
    beforeEach(() => {
        const { clearFilters } = useCategories()
        clearFilters()
    })

    // ─── getCategoryById ──────────────────────────────────────────────────────

    describe('getCategoryById', () => {
        it('retourne la catégorie "meeting"', () => {
            const { getCategoryById } = useCategories()
            const cat = getCategoryById('meeting')
            expect(cat).toBeDefined()
            expect(cat?.id).toBe('meeting')
            expect(cat?.name).toBe('Réunion')
        })

        it('retourne undefined pour un id inconnu', () => {
            const { getCategoryById } = useCategories()
            expect(getCategoryById('inexistant')).toBeUndefined()
        })
    })

    // ─── getCategoryName ──────────────────────────────────────────────────────

    describe('getCategoryName', () => {
        it('retourne "Réunion" pour l\'id "meeting"', () => {
            const { getCategoryName } = useCategories()
            expect(getCategoryName('meeting')).toBe('Réunion')
        })

        it('retourne "Inconnu" pour un id inexistant', () => {
            const { getCategoryName } = useCategories()
            expect(getCategoryName('inexistant')).toBe('Inconnu')
        })
    })

    // ─── getCategoryColor ─────────────────────────────────────────────────────

    describe('getCategoryColor', () => {
        it('retourne "blue" pour l\'id "meeting"', () => {
            const { getCategoryColor } = useCategories()
            expect(getCategoryColor('meeting')).toBe('blue')
        })

        it('retourne "blue" (valeur par défaut) pour un id inconnu', () => {
            const { getCategoryColor } = useCategories()
            expect(getCategoryColor('inexistant')).toBe('blue')
        })
    })

    // ─── getCategoryIcon ──────────────────────────────────────────────────────

    describe('getCategoryIcon', () => {
        it('retourne "RE" pour l\'id "meeting"', () => {
            const { getCategoryIcon } = useCategories()
            expect(getCategoryIcon('meeting')).toBe('RE')
        })

        it('retourne "📌" (valeur par défaut) pour un id inconnu', () => {
            const { getCategoryIcon } = useCategories()
            expect(getCategoryIcon('inexistant')).toBe('📌')
        })
    })

    // ─── toggleFilter ─────────────────────────────────────────────────────────

    describe('toggleFilter', () => {
        it('ajoute "meeting" aux filtres actifs lors du premier appel', () => {
            const { toggleFilter, activeFilters } = useCategories()
            toggleFilter('meeting')
            expect(activeFilters.value).toContain('meeting')
        })

        it('retire "meeting" des filtres actifs lors du second appel', () => {
            const { toggleFilter, activeFilters } = useCategories()
            toggleFilter('meeting')
            toggleFilter('meeting')
            expect(activeFilters.value).not.toContain('meeting')
        })
    })

    // ─── addFilter ────────────────────────────────────────────────────────────

    describe('addFilter', () => {
        it('ajoute un filtre qui n\'est pas encore actif', () => {
            const { addFilter, activeFilters } = useCategories()
            addFilter('project')
            expect(activeFilters.value).toContain('project')
        })

        it('ne duplique pas un filtre déjà présent', () => {
            const { addFilter, activeFilters } = useCategories()
            addFilter('project')
            addFilter('project')
            const occurrences = activeFilters.value.filter(f => f === 'project')
            expect(occurrences).toHaveLength(1)
        })
    })

    // ─── removeFilter ─────────────────────────────────────────────────────────

    describe('removeFilter', () => {
        it('retire un filtre existant', () => {
            const { addFilter, removeFilter, activeFilters } = useCategories()
            addFilter('urgent')
            removeFilter('urgent')
            expect(activeFilters.value).not.toContain('urgent')
        })

        it('n\'a aucun effet si le filtre est absent', () => {
            const { removeFilter, activeFilters } = useCategories()
            const before = activeFilters.value.length
            removeFilter('nexistepas')
            expect(activeFilters.value.length).toBe(before)
        })
    })

    // ─── clearFilters ─────────────────────────────────────────────────────────

    describe('clearFilters', () => {
        it('vide tous les filtres actifs', () => {
            const { addFilter, clearFilters, activeFilters } = useCategories()
            addFilter('meeting')
            addFilter('project')
            clearFilters()
            expect(activeFilters.value).toHaveLength(0)
        })
    })

    // ─── selectAllFilters ─────────────────────────────────────────────────────

    describe('selectAllFilters', () => {
        it('active tous les filtres (9 catégories)', () => {
            const { selectAllFilters, activeFilters, categories } = useCategories()
            selectAllFilters()
            expect(activeFilters.value).toHaveLength(categories.value.length)
        })

        it('contient les 9 ids de catégories prédéfinies', () => {
            const { selectAllFilters, activeFilters } = useCategories()
            selectAllFilters()
            const predefined = ['meeting', 'project', 'deadline', 'urgent', 'personal', 'learning', 'special', 'blocked', 'other']
            for (const id of predefined) {
                expect(activeFilters.value).toContain(id)
            }
        })
    })

    // ─── isFilterActive ───────────────────────────────────────────────────────

    describe('isFilterActive', () => {
        it('retourne true si le filtre est actif', () => {
            const { addFilter, isFilterActive } = useCategories()
            addFilter('meeting')
            expect(isFilterActive('meeting')).toBe(true)
        })

        it('retourne false si le filtre est inactif', () => {
            const { isFilterActive } = useCategories()
            expect(isFilterActive('meeting')).toBe(false)
        })
    })

    // ─── filteredCategories ───────────────────────────────────────────────────

    describe('filteredCategories', () => {
        it('retourne toutes les catégories quand aucun filtre n\'est actif', () => {
            const { filteredCategories, categories } = useCategories()
            expect(filteredCategories.value).toHaveLength(categories.value.length)
        })

        it('retourne seulement les catégories filtrées quand des filtres sont actifs', () => {
            const { addFilter, filteredCategories } = useCategories()
            addFilter('meeting')
            addFilter('urgent')
            expect(filteredCategories.value).toHaveLength(2)
            expect(filteredCategories.value.map(c => c.id)).toContain('meeting')
            expect(filteredCategories.value.map(c => c.id)).toContain('urgent')
        })
    })

    // ─── activeFilterCount ────────────────────────────────────────────────────

    describe('activeFilterCount', () => {
        it('vaut 0 initialement', () => {
            const { activeFilterCount } = useCategories()
            expect(activeFilterCount.value).toBe(0)
        })

        it('vaut 1 après avoir ajouté un filtre', () => {
            const { addFilter, activeFilterCount } = useCategories()
            addFilter('meeting')
            expect(activeFilterCount.value).toBe(1)
        })
    })

    // ─── allFiltersActive ─────────────────────────────────────────────────────

    describe('allFiltersActive', () => {
        it('retourne false par défaut', () => {
            const { allFiltersActive } = useCategories()
            expect(allFiltersActive.value).toBe(false)
        })

        it('retourne true après selectAllFilters', () => {
            const { selectAllFilters, allFiltersActive } = useCategories()
            selectAllFilters()
            expect(allFiltersActive.value).toBe(true)
        })
    })

    // ─── filterEventsByCategories ─────────────────────────────────────────────

    describe('filterEventsByCategories', () => {
        const events = [
            { id: 1, category: 'meeting', title: 'Stand-up' },
            { id: 2, category: 'urgent', title: 'Incident prod' },
            { id: 3, category: 'personal', title: 'Anniversaire' },
        ]

        it('retourne tous les événements quand aucun filtre n\'est actif', () => {
            const { filterEventsByCategories } = useCategories()
            const result = filterEventsByCategories(events)
            expect(result).toHaveLength(3)
        })

        it('filtre les événements selon les catégories actives', () => {
            const { addFilter, filterEventsByCategories } = useCategories()
            addFilter('meeting')
            const result = filterEventsByCategories(events)
            expect(result).toHaveLength(1)
            expect(result[0].category).toBe('meeting')
        })

        it('retourne plusieurs événements si plusieurs filtres actifs', () => {
            const { addFilter, filterEventsByCategories } = useCategories()
            addFilter('meeting')
            addFilter('urgent')
            const result = filterEventsByCategories(events)
            expect(result).toHaveLength(2)
        })
    })

    // ─── addCustomCategory ────────────────────────────────────────────────────

    describe('addCustomCategory', () => {
        it('ajoute une nouvelle catégorie avec les données fournies', () => {
            const { addCustomCategory, getCategoryById } = useCategories()
            addCustomCategory({ id: 'test_custom', name: 'Test', color: 'red', icon: 'TC' })
            const cat = getCategoryById('test_custom')
            expect(cat).toBeDefined()
            expect(cat?.name).toBe('Test')
            expect(cat?.color).toBe('red')
        })

        it('génère un id automatique si aucun id n\'est fourni', () => {
            const { addCustomCategory } = useCategories()
            const cat = addCustomCategory({ name: 'Sans id' })
            expect(cat.id).toBeTruthy()
            expect(typeof cat.id).toBe('string')
        })

        it('retourne la nouvelle catégorie avec la propriété custom: true', () => {
            const { addCustomCategory } = useCategories()
            const cat = addCustomCategory({ id: 'mon_custom', name: 'Perso' })
            expect(cat.custom).toBe(true)
        })
    })

    // ─── removeCustomCategory ─────────────────────────────────────────────────

    describe('removeCustomCategory', () => {
        it('supprime une catégorie existante et retourne true', () => {
            const { addCustomCategory, removeCustomCategory, getCategoryById } = useCategories()
            addCustomCategory({ id: 'a_supprimer', name: 'À supprimer' })
            const result = removeCustomCategory('a_supprimer')
            expect(result).toBe(true)
            expect(getCategoryById('a_supprimer')).toBeUndefined()
        })

        it('retourne false si la catégorie n\'existe pas', () => {
            const { removeCustomCategory } = useCategories()
            const result = removeCustomCategory('nexistepas')
            expect(result).toBe(false)
        })
    })

    // ─── updateCustomCategory ─────────────────────────────────────────────────

    describe('updateCustomCategory', () => {
        it('met à jour une catégorie existante et retourne true', () => {
            const { addCustomCategory, updateCustomCategory, getCategoryById } = useCategories()
            addCustomCategory({ id: 'a_modifier', name: 'Original' })
            const result = updateCustomCategory('a_modifier', { name: 'Modifié', color: 'green' })
            expect(result).toBe(true)
            const cat = getCategoryById('a_modifier')
            expect(cat?.name).toBe('Modifié')
            expect(cat?.color).toBe('green')
        })

        it('retourne false si la catégorie n\'existe pas', () => {
            const { updateCustomCategory } = useCategories()
            const result = updateCustomCategory('nexistepas', { name: 'X' })
            expect(result).toBe(false)
        })
    })

    // ─── getCategoryStats ─────────────────────────────────────────────────────

    describe('getCategoryStats', () => {
        it('retourne un objet avec une entrée par catégorie', () => {
            const { getCategoryStats, categories } = useCategories()
            const events = [
                { id: 1, category: 'meeting' },
                { id: 2, category: 'meeting' },
                { id: 3, category: 'urgent' },
            ]
            const stats = getCategoryStats(events)
            expect(Object.keys(stats)).toHaveLength(categories.value.length)
        })

        it('compte correctement les événements par catégorie', () => {
            const { getCategoryStats } = useCategories()
            const events = [
                { id: 1, category: 'meeting' },
                { id: 2, category: 'meeting' },
                { id: 3, category: 'urgent' },
            ]
            const stats = getCategoryStats(events)
            expect(stats['meeting'].count).toBe(2)
            expect(stats['urgent'].count).toBe(1)
            expect(stats['personal'].count).toBe(0)
        })
    })
})
