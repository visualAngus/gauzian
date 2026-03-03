# File Type Filter Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un sélecteur de type de fichier (dropdown custom) dans la barre de recherche, entre l'input et les boutons, pour filtrer les items du drive côté client.

**Architecture:** Le composant `RechercheBar.vue` reçoit un dropdown custom Vue qui émet un événement `@filter` avec la catégorie sélectionnée. `drive.vue` expose un `computed` qui filtre `displayedDriveItems` en fonction de la catégorie active + du terme de recherche. Le filtre est purement client-side, pas de requête API supplémentaire.

**Tech Stack:** Vue 3 Composition API, CSS scoped avec variables du theme.css

---

### Task 1 : Ajouter le dropdown de filtre dans RechercheBar.vue

**Files:**
- Modify: `app/components/RechercheBar.vue`

**Step 1 : Ouvrir le fichier et comprendre l'état actuel**

Lire `app/components/RechercheBar.vue`. La structure actuelle :
- `<input>` — champ de recherche
- `<button>` — loupe (search)
- `<button>` — croix (clear)

**Step 2 : Ajouter le script setup avec la réactivité du dropdown**

Dans `<script setup>`, ajouter :

```js
import { ref } from 'vue'

const isOpen = ref(false)
const activeFilter = ref('all')

const filters = [
  { value: 'all',      label: 'Tout',      icon: '⊞' },
  { value: 'image',    label: 'Images',    icon: '🖼' },
  { value: 'document', label: 'Documents', icon: '📄' },
  { value: 'video',    label: 'Vidéos',    icon: '🎬' },
  { value: 'audio',    label: 'Audio',     icon: '🎵' },
  { value: 'archive',  label: 'Archives',  icon: '📦' },
  { value: 'folder',   label: 'Dossiers',  icon: '📁' },
]

const emit = defineEmits(['search', 'clear', 'filter'])

function selectFilter(value) {
  activeFilter.value = value
  isOpen.value = false
  emit('filter', value)
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

// Fermer le dropdown si clic en dehors
function handleClickOutside(e) {
  if (!e.target.closest('.filter-dropdown')) {
    isOpen.value = false
  }
}
```

**Step 3 : Mettre à jour le template**

Remplacer le contenu du `<div class="recherche-bar">` pour insérer le dropdown entre l'input et les boutons, et gérer le click-outside avec `@click.stop` :

```html
<template>
  <div class="recherche-bar" @click.self="isOpen = false">
    <input type="text" name="recherche" id="recherche" placeholder="Rechercher..." />

    <!-- Sélecteur de type -->
    <div class="filter-dropdown" :class="{ open: isOpen }">
      <button class="filter-trigger" @click.stop="toggleDropdown">
        <span class="filter-icon">{{ filters.find(f => f.value === activeFilter).icon }}</span>
        <span class="filter-label">{{ filters.find(f => f.value === activeFilter).label }}</span>
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
            <span class="filter-option-icon">{{ f.icon }}</span>
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
        <path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"/>
      </svg>
    </button>

    <!-- Bouton search -->
    <button @click="$emit('search', $event.target.closest('.recherche-bar').querySelector('input').value)">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z"/>
      </svg>
    </button>
  </div>
</template>
```

> Note: ajouter `document.addEventListener('click', handleClickOutside)` dans `onMounted` et le retirer dans `onUnmounted` via `onUnmounted(() => document.removeEventListener('click', handleClickOutside))`.

**Step 4 : Ajouter les styles CSS du dropdown**

Dans `<style scoped>`, ajouter après les règles existantes :

```css
/* Séparateur vertical */
.separator {
  width: 1px;
  height: 60%;
  background: var(--color-border);
  flex-shrink: 0;
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
  font-size: 14px;
}

.filter-label {
  font-size: 13px;
}

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
  font-size: 15px;
  width: 20px;
  text-align: center;
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
```

**Step 5 : Vérification visuelle**

Ouvrir le navigateur sur `/drive`, la barre de recherche doit afficher `⊞ Tout ▾` entre l'input et les boutons. Cliquer dessus ouvre le panel avec 7 options.

---

### Task 2 : Connecter le filtre dans drive.vue

**Files:**
- Modify: `app/pages/drive.vue`

**Step 1 : Ajouter le prop @filter au composant**

Trouver la section `<RechercheBar` (ligne ~38) et ajouter le handler :

```html
<RechercheBar
  v-if="activeSection === 'my_drive'"
  @search="handleSearch"
  @clear="handleClearSearch"
  @filter="handleFilter"
/>
```

**Step 2 : Ajouter les refs et handlers dans le script**

Dans la section `<script setup>`, après les imports et la définition de `useContextMenu()`, ajouter :

```js
// Recherche & filtrage
const searchQuery = ref('')
const activeFileFilter = ref('all')

function handleSearch(query) {
  searchQuery.value = query
}

function handleClearSearch() {
  searchQuery.value = ''
  activeFileFilter.value = 'all'
}

function handleFilter(filterValue) {
  activeFileFilter.value = filterValue
}
```

**Step 3 : Créer le computed filteredDriveItems**

Ajouter la map MIME → catégorie et le computed de filtrage. Placer ce bloc après les définitions `handleFilter`/`handleSearch` :

```js
const MIME_CATEGORIES = {
  image:    (mime) => mime?.startsWith('image/'),
  video:    (mime) => mime?.startsWith('video/'),
  audio:    (mime) => mime?.startsWith('audio/'),
  document: (mime) => mime?.startsWith('text/') || [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ].includes(mime),
  archive:  (mime) => [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
  ].includes(mime),
  folder:   (_mime, item) => item.type === 'folder',
}

const filteredDriveItems = computed(() => {
  let items = displayedDriveItems.value

  // Filtre par type
  if (activeFileFilter.value !== 'all') {
    const matcher = MIME_CATEGORIES[activeFileFilter.value]
    items = items.filter(item => {
      const mime = item.metadata?.mime_type
      return matcher(mime, item)
    })
  }

  // Filtre par texte
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(item => {
      const name = item.metadata?.filename || item.metadata?.folder_name || item._name || ''
      return name.toLowerCase().includes(q)
    })
  }

  return items
})
```

**Step 4 : Remplacer displayedDriveItems par filteredDriveItems dans le template**

Trouver dans le template (autour de la ligne 578) :

```html
<FileItem
  v-for="item in displayedDriveItems"
```

Remplacer par :

```html
<FileItem
  v-for="item in filteredDriveItems"
```

> Ne pas toucher aux `pendingAndUploadingFiles` — ceux-ci ne sont pas filtrables (uploads en cours).

**Step 5 : Vérification**

1. Taper du texte dans la recherche → les items se filtrent
2. Sélectionner "Images" → seules les images s'affichent
3. Combiner texte + type → filtre cumulatif
4. Cliquer "Effacer" → revient à tout afficher

---

### Task 3 : Commit

```bash
cd /home/dev/gauzian/gauzianFront
git add app/components/RechercheBar.vue app/pages/drive.vue
git commit -m "feat(drive): add file type filter selector in search bar"
```
