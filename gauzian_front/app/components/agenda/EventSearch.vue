<template>
    <div class="event-search">
        <div class="search-input-wrapper">
            <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2"/>
                <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <input
                v-model="searchQuery"
                type="text"
                class="search-input"
                placeholder="Rechercher un événement..."
                @input="handleSearch"
                @focus="showResults = true"
            />
            <button
                v-if="searchQuery.length > 0"
                class="btn-clear-search"
                @click="clearSearch"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>

        <Transition name="results">
            <div v-if="showResults && searchQuery.length > 0" class="search-results">
                <div v-if="searchResults.length === 0" class="no-results">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="20" stroke="#d1d5db" stroke-width="2"/>
                        <circle cx="18" cy="20" r="2" fill="#d1d5db"/>
                        <circle cx="30" cy="20" r="2" fill="#d1d5db"/>
                        <path d="M18 30C18 30 20 28 24 28C28 28 30 30 30 30" stroke="#d1d5db" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <p class="no-results-text">Aucun événement trouvé</p>
                    <p class="no-results-hint">Essayez avec d'autres mots-clés</p>
                </div>

                <div v-else class="results-list">
                    <div class="results-header">
                        <span class="results-count">
                            {{ searchResults.length }} résultat{{ searchResults.length > 1 ? 's' : '' }}
                        </span>
                    </div>

                    <button
                        v-for="event in searchResults"
                        :key="event.id"
                        class="result-item"
                        :class="`result-${getCategoryColor(event.category)}`"
                        @click="handleSelectEvent(event)"
                    >
                        <div class="result-main">
                            <div class="result-title-wrapper">
                                <span class="result-title">{{ event.title }}</span>
                            </div>
                            <p v-if="event.description" class="result-description">
                                {{ event.description }}
                            </p>
                        </div>
                        <div class="result-meta">
                            <span class="result-category">{{ getCategoryName(event.category) }}</span>
                            <span class="result-time">{{ formatEventTime(event) }}</span>
                        </div>
                    </button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useEvents } from '~/composables/agenda/useEvents';
import { useCategories } from '~/composables/agenda/useCategories';

const emit = defineEmits(['select-event', 'close']);

const { searchEvents } = useEvents();
const { getCategoryById, getCategoryName, getCategoryColor, getCategoryIcon } = useCategories();

const searchQuery = ref('');
const showResults = ref(false);
const searchResults = ref([]);

const handleSearch = () => {
    if (searchQuery.value.trim().length > 0) {
        searchResults.value = searchEvents(searchQuery.value);
    } else {
        searchResults.value = [];
    }
};

const clearSearch = () => {
    searchQuery.value = '';
    searchResults.value = [];
    showResults.value = false;
};

const handleSelectEvent = (event) => {
    emit('select-event', event);
    clearSearch();
};

const formatEventTime = (event) => {
    const startHour = event.startHour.toString().padStart(2, '0');
    const endHour = event.endHour.toString().padStart(2, '0');
    return `${startHour}:00 - ${endHour}:00`;
};

// Close results on click outside
const handleClickOutside = (event) => {
    const searchElement = event.target.closest('.event-search');
    if (!searchElement) {
        showResults.value = false;
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

// Watch for escape key
const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
        showResults.value = false;
        searchQuery.value = '';
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.event-search {
    position: relative;
    width: 100%;
}

/* Search Input */
.search-input-wrapper {
    position: relative;
    width: 100%;
}

.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding: 10px 40px 10px 44px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #111827;
    background-color: #ffffff;
    transition: all 0.2s;
}

.search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
}

.btn-clear-search:hover {
    background-color: #f3f4f6;
    color: #6b7280;
}

/* Search Results */
.search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    max-height: 500px;
    overflow-y: auto;
    z-index: 1000;
}

/* No Results */
.no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
}

.no-results-text {
    margin-top: 16px;
    font-size: 16px;
    font-weight: 600;
    color: #374151;
}

.no-results-hint {
    margin-top: 4px;
    font-size: 14px;
    color: #9ca3af;
}

/* Results List */
.results-list {
    padding: 8px;
}

.results-header {
    padding: 8px 12px;
    border-bottom: 1px solid #f3f4f6;
    margin-bottom: 4px;
}

.results-count {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Result Item */
.result-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 12px;
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    border-left: 3px solid currentColor;
    border-radius: 8px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
}

.result-item:hover {
    background-color: #f9fafb;
    border-color: currentColor;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.result-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.result-title-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
}

.result-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    flex: 1;
}

.result-description {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.5;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.result-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
}

.result-category {
    padding: 2px 8px;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    font-weight: 500;
    color: currentColor;
}

.result-time {
    color: #9ca3af;
    font-weight: 500;
}

/* Result Colors */
.result-blue { color: #4A90E2; }
.result-green { color: #10B981; }
.result-red { color: #EF4444; }
.result-orange { color: #F59E0B; }
.result-purple { color: #8B5CF6; }
.result-teal { color: #14B8A6; }
.result-pink { color: #EC4899; }
.result-gray { color: #6B7280; }

/* Transitions */
.results-enter-active,
.results-leave-active {
    transition: all 0.2s ease;
}

.results-enter-from {
    opacity: 0;
    transform: translateY(-10px);
}

.results-leave-to {
    opacity: 0;
    transform: translateY(-5px);
}

/* Scrollbar */
.search-results {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.search-results::-webkit-scrollbar {
    width: 6px;
}

.search-results::-webkit-scrollbar-track {
    background: transparent;
}

.search-results::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
}

.search-results::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
    .search-results {
        max-height: 400px;
    }

    .result-item {
        padding: 10px;
    }

    .result-title {
        font-size: 13px;
    }

    .result-description {
        font-size: 12px;
    }
}
</style>
