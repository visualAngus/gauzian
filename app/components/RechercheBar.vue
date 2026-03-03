<template>
    <div class="recherche-bar">
        <input v-model="searchValue" type="text" name="recherche" id="recherche" placeholder="Rechercher..." />

        <!-- Sélecteur de type -->
        <div class="filter-dropdown" :class="{ open: isOpen }">
            <button class="filter-trigger" @click.stop="toggleDropdown">
                <svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path :d="activeFilterObj.icon"/>
                </svg>
                <span class="filter-label">{{ activeFilterObj.label }}</span>
                <svg class="filter-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"/>
                </svg>
            </button>
            <Transition name="dropdown">
                <div v-if="isOpen" class="filter-panel" @click.stop>
                    <button
                        v-for="f in filters"
                        :key="f.value"
                        class="filter-option"
                        :class="{ active: activeFilter === f.value }"
                        @click="selectFilter(f.value)"
                    >
                        <svg class="filter-option-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path :d="f.icon"/>
                        </svg>
                        <span>{{ f.label }}</span>
                    </button>
                </div>
            </Transition>
        </div>

        <!-- Séparateur -->
        <div class="separator"></div>

        <!-- Bouton clear -->
        <button @click="$emit('clear')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z">
                </path>
            </svg>
        </button>

        <!-- Bouton search -->
        <!-- <button @click="$emit('search', searchValue)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z">
                </path>
            </svg>
        </button> -->

    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const searchValue = ref('')
const isOpen = ref(false)
const activeFilter = ref('all')

watch(searchValue, (val) => {
  emit('search', val)
})

const filters = [
    { value: 'all',      label: 'Tout',      icon: 'M3 4.5C3 3.12 4.12 2 5.5 2h13C19.88 2 21 3.12 21 4.5v15c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 22 3 20.88 3 19.5v-15zm2 0v15c0 .28.22.5.5.5h13c.28 0 .5-.22.5-.5v-15c0-.28-.22-.5-.5-.5h-13c-.28 0-.5.22-.5.5zM8 7h8v2H8V7zm0 4h8v2H8v-2zm0 4h5v2H8v-2z' },
    { value: 'image',    label: 'Images',    icon: 'M2.9918 21C2.44405 21 2 20.5551 2 19.9918V4.00827C2 3.45552 2.44495 3 2.9918 3H21.0082C21.561 3 22 3.44495 22 3.9918V20.0082C22 20.5552 21.5551 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15ZM20 17.8284L14 11.8284L6.82843 19H20V17.8284ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z' },
    { value: 'document', label: 'Documents', icon: 'M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z' },
    { value: 'video',    label: 'Vidéos',    icon: 'M2 3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44476 21 2 20.5551 2 20.0066V3.9934ZM8 6.5V17.5L17 12L8 6.5Z' },
    { value: 'audio',    label: 'Audio',     icon: 'M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17C6 19.21 7.79 21 10 21C12.21 21 14 19.21 14 17V7H18V3H12Z' },
    { value: 'folder',   label: 'Dossiers',  icon: 'M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z' },
]

const activeFilterObj = computed(
  () => filters.find(f => f.value === activeFilter.value) ?? filters[0]
)

const emit = defineEmits(['search', 'clear', 'filter'])

function selectFilter(value) {
    activeFilter.value = value
    isOpen.value = false
    emit('filter', value)
}

function toggleDropdown() {
    isOpen.value = !isOpen.value
}

function handleClickOutside(e) {
    if (!e.target.closest('.filter-dropdown')) {
        isOpen.value = false
    }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

function reset() {
  searchValue.value = ''
  activeFilter.value = 'all'
  isOpen.value = false
  emit('filter', 'all')
}

defineExpose({ reset })
</script>

<style scoped>
.recherche-bar {
    height: 50px;
    width: 55%;
    max-width: 800px;
    min-width: 300px;
    position: fixed;
    top: 50px;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 100;
    display: flex;
    background: var(--color-white);
    border-radius: 8px;
}

@media (max-width: 1200px) {
    .recherche-bar {
        width: 50%;
        top: 45px;
    }
}

@media (max-width: 1000px) {
    .recherche-bar {
        width: 40%;
        top: 40px;
    }
}

@media (max-width: 900px) {
    .recherche-bar {
        width: 35%;
        left: 47.5%;
        min-width: unset;
        /* top: 30px; */
    }
}

@media (max-width: 770px) {
    .recherche-bar {
        display: none;
    }
}

.recherche-bar input {
    width: 100%;
    height: 100%;
    padding: 0 20px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    background-color: transparent;
}

.recherche-bar input:focus {
    outline: none;

}

.recherche-bar button:not(.filter-trigger):not(.filter-option) {
    background: var(--color-white);
    color: var(--color-text-muted);
    border: none;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.18s ease, color 0.18s ease;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* svg */
.recherche-bar button:not(.filter-trigger):not(.filter-option) svg {
    width: 20px;
    height: 20px;
    fill: var(--color-text-muted);
    transition: fill 0.18s ease, transform 0.18s ease;
}

/* Bouton clear (croix) — seul bouton restant */
.recherche-bar button:not(.filter-trigger):not(.filter-option):hover {
    background: var(--color-primary-soft);
}

.recherche-bar button:not(.filter-trigger):not(.filter-option):hover svg {
    fill: var(--color-primary);
    transform: rotate(90deg) scale(1.1);
}

.recherche-bar button:not(.filter-trigger):not(.filter-option):active svg {
    transform: rotate(90deg) scale(0.92);
}

/* Arrondi des extrémités (remplace overflow:hidden) */
.recherche-bar input {
    border-radius: 8px 0 0 8px;
}

.recherche-bar button:not(.filter-trigger):not(.filter-option) {
    border-radius: 0 8px 8px 0;
}

/* Séparateur vertical */
.separator {
    width: 1px;
    height: 60%;
    background: var(--color-border);
    flex-shrink: 0;
    align-self: center;
}

/* Dropdown container */
.filter-dropdown {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
}

/* Bouton trigger */
.filter-trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
    padding: 0 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    font-size: 13px;
    white-space: nowrap;
    transition: color 0.18s ease;
}

.filter-trigger:hover {
    color: var(--color-primary);
}

.filter-icon {
    width: 15px;
    height: 15px;
    fill: currentColor;
    flex-shrink: 0;
}

.filter-label { font-size: 13px; }

.filter-chevron {
    width: 14px;
    height: 14px;
    fill: currentColor;
    transition: transform 0.18s ease;
}

.filter-dropdown.open .filter-chevron {
    transform: rotate(180deg);
}

/* Panel dropdown */
.filter-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--color-white);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 10001;
    min-width: 150px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

/* Options */
.filter-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 6px;
    font-size: 13px;
    color: var(--color-text);
    width: 100%;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
}

.filter-option:hover {
    background: var(--color-primary-soft);
    color: var(--color-primary);
}

.filter-option.active {
    background: var(--color-primary-soft);
    color: var(--color-primary);
    font-weight: 500;
}

.filter-option-icon {
    width: 16px;
    height: 16px;
    fill: currentColor;
    flex-shrink: 0;
}

/* Transition dropdown */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}
</style>
