<template>
    <div class="agenda-toolbar">
        <!-- Left Section: Navigation -->
        <div class="toolbar-section toolbar-left">
            <button class="btn-today" @click="handleToday">
                Aujourd'hui
            </button>

            <div class="nav-buttons">
                <button
                    class="btn-nav"
                    @click="handlePrevious"
                    :title="getPreviousLabel"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>

                <button
                    class="btn-nav"
                    @click="handleNext"
                    :title="getNextLabel"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>

            <div class="current-period">
                {{ formattedPeriod }}
            </div>
        </div>

        <!-- Center Section: View Switcher -->
        <div class="toolbar-section toolbar-center">
            <div class="view-switcher">
                <button
                    v-for="viewType in viewTypes"
                    :key="viewType.value"
                    class="view-button"
                    :class="{ active: currentView === viewType.value }"
                    @click="handleViewChange(viewType.value)"
                    :title="viewType.label"
                >
                    <span class="view-label">{{ viewType.label }}</span>
                </button>
            </div>
        </div>

        <!-- Right Section: Actions -->
        <div class="toolbar-section toolbar-right">
            <button class="btn-icon" @click="handleSearch" title="Rechercher">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2"/>
                    <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>

            <button class="btn-icon" @click="handleFilter" title="Filtrer">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5H17M5 10H15M8 15H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>

            <button class="btn-icon" @click="handleSettings" title="Paramètres">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                    <path d="M10 1V4M10 16V19M19 10H16M4 10H1M16.364 16.364L14.242 14.242M5.758 5.758L3.636 3.636M16.364 3.636L14.242 5.758M5.758 14.242L3.636 16.364" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>

            <button class="btn-primary" @click="handleNewEvent">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span>Nouvel événement</span>
            </button>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    currentView: {
        type: String,
        required: true
    },
    currentPeriod: {
        type: String,
        required: true
    }
});

const emit = defineEmits([
    'today',
    'previous',
    'next',
    'view-change',
    'new-event',
    'search',
    'filter',
    'settings'
]);

const viewTypes = [
    { value: 'day', label: 'Jour' },
    { value: 'week', label: 'Semaine' },
    { value: 'month', label: 'Mois' }
];

const formattedPeriod = computed(() => {
    return props.currentPeriod;
});

const getPreviousLabel = computed(() => {
    const labels = {
        day: 'Jour précédent',
        week: 'Semaine précédente',
        month: 'Mois précédent'
    };
    return labels[props.currentView] || 'Précédent';
});

const getNextLabel = computed(() => {
    const labels = {
        day: 'Jour suivant',
        week: 'Semaine suivante',
        month: 'Mois suivant'
    };
    return labels[props.currentView] || 'Suivant';
});

const handleToday = () => {
    emit('today');
};

const handlePrevious = () => {
    emit('previous');
};

const handleNext = () => {
    emit('next');
};

const handleViewChange = (view) => {
    emit('view-change', view);
};

const handleNewEvent = () => {
    emit('new-event');
};

const handleSearch = () => {
    emit('search');
};

const handleFilter = () => {
    emit('filter');
};

const handleSettings = () => {
    emit('settings');
};
</script>

<style scoped>
.agenda-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 8px;
}

.toolbar-section {
    display: flex;
    align-items: center;
    gap: 12px;
}

.toolbar-left {
    flex: 1;
}

.toolbar-center {
    flex-shrink: 0;
}

.toolbar-right {
    flex: 1;
    justify-content: flex-end;
}

/* Today Button */
.btn-today {
    padding: 8px 16px;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-today:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
    color: #111827;
}

/* Navigation Buttons */
.nav-buttons {
    display: flex;
    gap: 4px;
}

.btn-nav {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
    padding: 8px;
}

.btn-nav:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
    color: #111827;
}

.btn-nav svg {
    stroke: currentColor;
}

/* Current Period */
.current-period {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
}

/* View Switcher */
.view-switcher {
    display: flex;
    background-color: #f3f4f6;
    border-radius: 8px;
    padding: 3px;
}

.view-button {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    background-color: transparent;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
}

.view-button:hover {
    color: #374151;
    background-color: rgba(255, 255, 255, 0.5);
}

.view-button.active {
    background-color: #ffffff;
    color: #111827;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.view-label {
    font-weight: 500;
}

/* Icon Button */
.btn-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
    padding: 8px;
}

.btn-icon:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
    color: #111827;
}

.btn-icon svg {
    stroke: currentColor;
}

/* Primary Button */
.btn-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: #3b82f6;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary:hover {
    background-color: #2563eb;
}

.btn-primary svg {
    flex-shrink: 0;
}

/* Responsive */
@media (max-width: 1024px) {
    .agenda-toolbar {
        flex-wrap: wrap;
        gap: 12px;
    }

    .toolbar-left,
    .toolbar-right {
        flex-basis: 100%;
    }

    .toolbar-center {
        order: -1;
        flex-basis: 100%;
    }

    .view-switcher {
        width: 100%;
        justify-content: space-between;
    }

    .view-button {
        flex: 1;
        justify-content: center;
    }
}

@media (max-width: 768px) {
    .view-label {
        display: none;
    }

    .btn-primary span {
        display: none;
    }

    .btn-primary {
        width: 36px;
        height: 36px;
        padding: 0;
        justify-content: center;
    }

    .current-period {
        font-size: 14px;
    }
}

@media (max-width: 480px) {
    .btn-today {
        padding: 8px 12px;
        font-size: 13px;
    }

    .toolbar-right {
        gap: 8px;
    }

    .btn-icon {
        width: 32px;
        height: 32px;
    }
}
</style>
