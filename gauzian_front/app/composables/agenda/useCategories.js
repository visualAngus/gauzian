// useCategories.js - Gestion des catégories d'événements

import { ref, computed } from 'vue';

// #ICIBACK - Au chargement initial, charger les catégories depuis l'API
// const loadCategories = async () => {
//     const response = await fetch('/api/categories', { credentials: 'include' })
//     categories.value = await response.json()
// }
// loadCategories()

// Catégories prédéfinies avec couleurs et icônes
const categories = ref([
    {
        id: 'meeting',
        name: 'Réunion',
        color: 'blue',
        icon: 'RE',
        description: 'Meetings et rendez-vous professionnels'
    },
    {
        id: 'project',
        name: 'Projet',
        color: 'green',
        icon: 'PR',
        description: 'Tâches et projets en cours'
    },
    {
        id: 'deadline',
        name: 'Deadline',
        color: 'orange',
        icon: 'DL',
        description: 'Dates limites importantes'
    },
    {
        id: 'urgent',
        name: 'Urgent',
        color: 'red',
        icon: 'UR',
        description: 'Événements urgents et prioritaires'
    },
    {
        id: 'personal',
        name: 'Personnel',
        color: 'purple',
        icon: 'PE',
        description: 'Événements personnels et sociaux'
    },
    {
        id: 'learning',
        name: 'Formation',
        color: 'teal',
        icon: 'FO',
        description: 'Formation et apprentissage'
    },
    {
        id: 'special',
        name: 'Spécial',
        color: 'pink',
        icon: 'SP',
        description: 'Événements spéciaux'
    },
    {
        id: 'blocked',
        name: 'Bloqué',
        color: 'gray',
        icon: 'BL',
        description: 'Temps bloqué ou indisponible'
    },
    {
        id: 'other',
        name: 'Autre',
        color: 'blue',
        icon: 'AU',
        description: 'Autres événements'
    }
]);

// Filtres actifs
const activeFilters = ref([]);

export const useCategories = () => {
    // Obtenir une catégorie par son ID
    const getCategoryById = (id) => {
        return categories.value.find(cat => cat.id === id);
    };

    // Obtenir le nom d'une catégorie
    const getCategoryName = (id) => {
        const category = getCategoryById(id);
        return category ? category.name : 'Inconnu';
    };

    // Obtenir la couleur d'une catégorie
    const getCategoryColor = (id) => {
        const category = getCategoryById(id);
        return category ? category.color : 'blue';
    };

    // Obtenir l'icône d'une catégorie
    const getCategoryIcon = (id) => {
        const category = getCategoryById(id);
        return category ? category.icon : '📌';
    };

    // Toggle un filtre de catégorie
    const toggleFilter = (categoryId) => {
        const index = activeFilters.value.indexOf(categoryId);
        if (index === -1) {
            activeFilters.value.push(categoryId);
        } else {
            activeFilters.value.splice(index, 1);
        }
    };

    // Activer un filtre
    const addFilter = (categoryId) => {
        if (!activeFilters.value.includes(categoryId)) {
            activeFilters.value.push(categoryId);
        }
    };

    // Désactiver un filtre
    const removeFilter = (categoryId) => {
        const index = activeFilters.value.indexOf(categoryId);
        if (index !== -1) {
            activeFilters.value.splice(index, 1);
        }
    };

    // Réinitialiser tous les filtres
    const clearFilters = () => {
        activeFilters.value = [];
    };

    // Activer tous les filtres
    const selectAllFilters = () => {
        activeFilters.value = categories.value.map(cat => cat.id);
    };

    // Vérifier si un filtre est actif
    const isFilterActive = (categoryId) => {
        return activeFilters.value.includes(categoryId);
    };

    // Computed: Catégories filtrées
    const filteredCategories = computed(() => {
        if (activeFilters.value.length === 0) {
            return categories.value;
        }
        return categories.value.filter(cat =>
            activeFilters.value.includes(cat.id)
        );
    });

    // Computed: Nombre de filtres actifs
    const activeFilterCount = computed(() => activeFilters.value.length);

    // Computed: Tous les filtres sont actifs
    const allFiltersActive = computed(() =>
        activeFilters.value.length === categories.value.length
    );

    // Filtrer des événements selon les catégories actives
    const filterEventsByCategories = (events) => {
        if (activeFilters.value.length === 0) {
            return events;
        }
        return events.filter(event =>
            activeFilters.value.includes(event.category)
        );
    };

    // Ajouter une catégorie personnalisée
    const addCustomCategory = (categoryData) => {
        // #ICIBACK - Appel API POST /api/categories
        // const response = await fetch('/api/categories', {
        //     method: 'POST',
        //     credentials: 'include',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(categoryData)
        // })
        // const newCategory = await response.json()
        // categories.value.push(newCategory)
        // return newCategory

        const newCategory = {
            id: categoryData.id || `custom_${Date.now()}`,
            name: categoryData.name || 'Nouvelle catégorie',
            color: categoryData.color || 'blue',
            icon: categoryData.icon || '📌',
            description: categoryData.description || '',
            custom: true
        };

        categories.value.push(newCategory);
        return newCategory;
    };

    // Supprimer une catégorie (personnalisée ou prédéfinie)
    const removeCustomCategory = (categoryId) => {
        // #ICIBACK - Appel API DELETE /api/categories/:id
        // await fetch(`/api/categories/${categoryId}`, {
        //     method: 'DELETE',
        //     credentials: 'include'
        // })
        // const index = categories.value.findIndex(cat => cat.id === categoryId)
        // if (index !== -1) {
        //     categories.value.splice(index, 1)
        //     removeFilter(categoryId)
        // }
        // return true

        const index = categories.value.findIndex(cat => cat.id === categoryId);
        if (index !== -1) {
            categories.value.splice(index, 1);
            removeFilter(categoryId);
            return true;
        }
        return false;
    };

    // Modifier une catégorie (personnalisée ou prédéfinie)
    const updateCustomCategory = (categoryId, updates) => {
        // #ICIBACK - Appel API PUT /api/categories/:id
        // const response = await fetch(`/api/categories/${categoryId}`, {
        //     method: 'PUT',
        //     credentials: 'include',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(updates)
        // })
        // const updatedCategory = await response.json()
        // const index = categories.value.findIndex(cat => cat.id === categoryId)
        // if (index !== -1) categories.value[index] = updatedCategory
        // return true

        const index = categories.value.findIndex(cat => cat.id === categoryId);
        if (index !== -1) {
            categories.value[index] = {
                ...categories.value[index],
                ...updates
            };
            return true;
        }
        return false;
    };

    // Obtenir les statistiques par catégorie
    const getCategoryStats = (events) => {
        const stats = {};
        categories.value.forEach(cat => {
            stats[cat.id] = {
                category: cat,
                count: events.filter(e => e.category === cat.id).length
            };
        });
        return stats;
    };

    return {
        // État
        categories,
        activeFilters,

        // Getters
        getCategoryById,
        getCategoryName,
        getCategoryColor,
        getCategoryIcon,

        // Filtres
        toggleFilter,
        addFilter,
        removeFilter,
        clearFilters,
        selectAllFilters,
        isFilterActive,
        filteredCategories,
        activeFilterCount,
        allFiltersActive,
        filterEventsByCategories,

        // Catégories custom
        addCustomCategory,
        removeCustomCategory,
        updateCustomCategory,

        // Stats
        getCategoryStats
    };
};
