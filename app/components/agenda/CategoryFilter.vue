<template>
    <div class="category-filter">
        <div class="filter-header">
            <h3 class="filter-title">Catégories</h3>
            <button
                class="btn-manage"
                @click="handleManageCategories"
                title="Gérer les catégories"
            >
                Gérer
            </button>
        </div>

        <div class="filter-actions">
            <button
                class="btn-action"
                :class="{ active: allFiltersActive }"
                @click="handleSelectAll"
            >
                <svg v-if="allFiltersActive" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Tout sélectionner</span>
            </button>
        </div>

        <div class="category-list">
            <button
                v-for="category in categories"
                :key="category.id"
                class="category-item"
                :class="{
                    active: isFilterActive(category.id),
                    [`category-${category.color}`]: isFilterActive(category.id)
                }"
                @click="handleToggle(category.id)"
            >
                <div class="category-item-left">
                    <div
                        class="category-checkbox"
                        :class="{ checked: isFilterActive(category.id) }"
                    >
                        <svg v-if="isFilterActive(category.id)" width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M11.5 3.5L5.5 9.5L2.5 6.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <span class="category-icon">{{ category.icon }}</span>
                    <span class="category-name">{{ category.name }}</span>
                </div>
                <div class="category-item-right">
                    <span
                        v-if="getEventCount(category.id) > 0"
                        class="category-count"
                    >
                        {{ getEventCount(category.id) }}
                    </span>
                </div>
            </button>
        </div>

        <div v-if="activeFilterCount > 0" class="filter-summary">
            <span class="summary-text">
                {{ activeFilterCount }} catégorie{{ activeFilterCount > 1 ? 's' : '' }} sélectionnée{{ activeFilterCount > 1 ? 's' : '' }}
            </span>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useCategories } from '~/composables/agenda/useCategories';
import { useEvents } from '~/composables/agenda/useEvents';

const {
    categories,
    activeFilters,
    toggleFilter,
    clearFilters,
    selectAllFilters,
    isFilterActive,
    activeFilterCount,
    allFiltersActive
} = useCategories();

const { events } = useEvents();

const emit = defineEmits(['filter-change', 'manage-categories']);

const getEventCount = (categoryId) => {
    return events.value.filter(e => e.category === categoryId).length;
};

const handleToggle = (categoryId) => {
    toggleFilter(categoryId);
    emit('filter-change', activeFilters.value);
};

const handleSelectAll = () => {
    if (allFiltersActive.value) {
        clearFilters();
    } else {
        selectAllFilters();
    }
    emit('filter-change', activeFilters.value);
};

const handleClearAll = () => {
    clearFilters();
    emit('filter-change', activeFilters.value);
};

const handleManageCategories = () => {
    emit('manage-categories');
};
</script>

<style scoped>
.category-filter {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* Header */
.filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.filter-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin: 0;
}

.btn-manage {
    padding: 6px 12px;
    background-color: #3b82f6;
    border: none;
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
}

.btn-manage:hover {
    background-color: #2563eb;
}

/* Actions */
.filter-actions {
    display: flex;
    gap: 8px;
}

.btn-action {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-action:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
}

.btn-action.active {
    background-color: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
}

/* Category List */
.category-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.category-item:hover {
    background-color: #f9fafb;
    border-color: #d1d5db;
}

.category-item.active {
    background-color: #f0f9ff;
    border-color: currentColor;
}

.category-item-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.category-checkbox {
    width: 20px;
    height: 20px;
    border: 2px solid #d1d5db;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
}

.category-checkbox.checked {
    background-color: currentColor;
    border-color: currentColor;
}

.category-icon {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: -0.5px;
    flex-shrink: 0;
    color: inherit;
    color: #374151;

}

.category-name {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
}

.category-item.active .category-name {
    color: #111827;
}

.category-item-right {
    display: flex;
    align-items: center;
}

.category-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    background-color: #e5e7eb;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
}

.category-item.active .category-count {
    background-color: rgba(255, 255, 255, 0.3);
    color: currentColor;
}

/* Category Colors */
.category-blue {
    border-color: #4A90E2;
    color: #4A90E2;
}

.category-green {
    border-color: #10B981;
    color: #10B981;
}

.category-red {
    border-color: #EF4444;
    color: #EF4444;
}

.category-orange {
    border-color: #F59E0B;
    color: #F59E0B;
}

.category-purple {
    border-color: #8B5CF6;
    color: #8B5CF6;
}

.category-teal {
    border-color: #14B8A6;
    color: #14B8A6;
}

.category-pink {
    border-color: #EC4899;
    color: #EC4899;
}

.category-gray {
    border-color: #6B7280;
    color: #6B7280;
}

/* Summary */
.filter-summary {
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
    text-align: center;
}

.summary-text {
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
}

/* Responsive */
@media (max-width: 768px) {
    .category-filter {
        gap: 12px;
    }

    .category-item {
        padding: 8px 10px;
    }

    .category-name {
        font-size: 13px;
    }
}
</style>
