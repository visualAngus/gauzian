# Spec : Suite de tests des composables (Approche stratifiée)

**Date** : 2026-03-16
**Objectif** : Atteindre ≥80% de couverture SonarQube sur `app/**/*.{ts,js}`
**Framework** : Vitest + coverage V8 + lcov

---

## Contexte

Le projet dispose déjà de tests pour `useAuth` et `useNotification`.
16 composables restent sans tests. La configuration Vitest (`vitest.config.ts`) couvre `app/**` en excluant pages et composants.

---

## Fichiers à créer

```
tests/unit/composables/
  ├── useApiUrl.test.ts
  ├── useFetchWithAuth.test.ts
  ├── useTheme.test.ts
  ├── drive/
  │   ├── useSelection.test.ts
  │   ├── useLayout.test.ts
  │   ├── useContextMenu.test.ts
  │   ├── useAutoShare.test.ts
  │   ├── useDriveData.test.ts
  │   ├── useTransfers.test.ts
  │   ├── useInfoPanel.test.ts
  │   └── useFileActions.test.ts
  └── agenda/
      ├── useNavigation.test.ts
      ├── useCategories.test.ts
      ├── useView.test.ts
      ├── useLayout.test.ts
      └── useEvents.test.ts
```

---

## Stratégie de mocking

| Catégorie | Composables | Approche |
|---|---|---|
| Logique pure | `useNavigation`, `useCategories`, `useView`, `agenda/useLayout`, `useSelection`, `drive/useLayout` | Import direct, aucun mock |
| Nuxt auto-imports | `useApiUrl`, `useTheme` | `useState`/`useRuntimeConfig` déjà stubés dans `setup.ts` |
| Fetch-dépendants | `useFetchWithAuth`, `useAutoShare`, `useDriveData`, `useEvents` | `vi.stubGlobal('fetch', vi.fn())` |
| Crypto | `useAutoShare`, `useDriveData`, `useEvents` | `vi.mock('~/utils/crypto', ...)` |
| DOM-lourds (partiels) | `useTransfers`, `useFileActions`, `useInfoPanel` | Fonctions utilitaires pures uniquement |

---

## Décomposition en 4 groupes d'agents parallèles

### Groupe A — Composables simples (pas de dépendances externes)

**Fichiers** :
- `tests/unit/composables/useApiUrl.test.ts`
- `tests/unit/composables/useTheme.test.ts`
- `tests/unit/composables/drive/useSelection.test.ts`
- `tests/unit/composables/drive/useLayout.test.ts`
- `tests/unit/composables/drive/useContextMenu.test.ts`

**Périmètre** :
- `useApiUrl` : vérifie que la valeur de `runtimeConfig.public.apiUrl` est retournée
- `useTheme` : `initTheme` charge depuis localStorage, `toggleTheme` bascule et persiste, `applyClass` conditionnel à `import.meta.client`
- `useSelection` : sélection simple, sélection multiple (Ctrl/Meta), désélection, clearSelection
- `drive/useLayout` : `isSidebarOpen`, `toggleSidebar`, `totalSpaceLeft` computed, notification si espace bas
- `drive/useContextMenu` : `contextMenuVisible` initial à false

**Couverture cible** : ~95%

---

### Groupe B — Agenda (logique pure riche)

**Fichiers** :
- `tests/unit/composables/agenda/useNavigation.test.ts`
- `tests/unit/composables/agenda/useCategories.test.ts`
- `tests/unit/composables/agenda/useView.test.ts`
- `tests/unit/composables/agenda/useLayout.test.ts`

**Périmètre** :
- `useNavigation` : navigation (nextDay/previousDay/nextWeek/etc), computed (currentWeekStart, currentMonthName, currentWeekNumber, isToday), `dateToDayId`/`dayIdToDate`, `getWeekDays`, `getMonthDays`, keyboard navigation
- `useCategories` : getCategoryById/Name/Color/Icon, toggleFilter/addFilter/removeFilter/clearFilters/selectAllFilters, addCustomCategory/removeCustomCategory/updateCustomCategory, filterEventsByCategories, getCategoryStats
- `useView` : setView (valide/invalide), toggleWeekends, visibleHours (working hours / toutes heures), zoomIn/zoomOut/resetZoom, setDensity, savePreferences/loadPreferences (localStorage), setWorkingHours (valide/invalide)
- `agenda/useLayout` : eventsOverlap, eventsWithLayout (chevauchements, colonnes), getEventStyle, getOverlapGroups, getDayDensity, getBusiestHour, isTimeSlotFree, findNextFreeSlot

**Couverture cible** : ~90%

---

### Groupe C — Composables avec dépendances réseau/crypto

**Fichiers** :
- `tests/unit/composables/useFetchWithAuth.test.ts`
- `tests/unit/composables/useAutoShare.test.ts`
- `tests/unit/composables/agenda/useEvents.test.ts`

**Périmètre** :
- `useFetchWithAuth` : header Authorization injecté si token, Content-Type JSON par défaut, pas de Content-Type pour FormData, gestion 401 (appel logout), gestion erreur réseau, AbortError propagé, URL absolue vs relative, erreur non-ok avec JSON d'erreur
- `useAutoShare` : instancier avec `useAutoShare('/api')` pour atteindre les chemins de propagation. `getFolderSharedUsers` (succès, erreur réseau, réponse non-ok), `propagateFileAccess` (pas de folderId → early return, **pas d'API_URL → early return**, pas d'utilisateurs, propagation réussie, échec API), `propagateFolderAccess` (même logique)
- `useEvents` (fonctions pures — pas de mocks) : getEventById, getEventsByDay, getEventsByCategory, getEventsByDateRange, updateEvent (trouvé/non trouvé), deleteEvent (trouvé/non trouvé), deleteEventsByCategory, searchEvents, filterEvents, moveEvent, resizeEvent, getEventCount, getBusiestDay, clearAllEvents, saveEvents (localStorage)
- `useEvents` (fonctions async — avec mocks fetch+crypto) : createEvent (appel API + crypto), loadEvents avec startDayId/endDayId
- **Note singleton** : `beforeEach` doit appeler `clearAllEvents()` (pas seulement `vi.clearAllMocks()`). Le `watch` module-level déclenchera `saveEvents()` automatiquement sur chaque mutation — le stub `localStorage` de `setup.ts` absorbe silencieusement ces appels.

**Mocks** :
```ts
vi.mock('~/utils/crypto', () => ({
  generateDataKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  encryptWithStoredPublicKey: vi.fn().mockResolvedValue('encrypted-key'),
  encryptSimpleDataWithDataKey: vi.fn().mockResolvedValue('encrypted-data'),
  encryptWithPublicKey: vi.fn().mockResolvedValue('encrypted-key'),
}))
vi.mock('~/composables/useAuth', () => ({
  useAuth: vi.fn().mockReturnValue({
    authToken: { value: 'mock-token' },
    logout: vi.fn(),
  }),
}))
vi.mock('~/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { events: [] } }),
    }),
  }),
}))
```

**Couverture cible** : ~80%

---

### Groupe D — Composables complexes (fonctions pures uniquement)

**Fichiers** :
- `tests/unit/composables/drive/useDriveData.test.ts`
- `tests/unit/composables/drive/useTransfers.test.ts`
- `tests/unit/composables/drive/useInfoPanel.test.ts`
- `tests/unit/composables/drive/useFileActions.test.ts`  *(si le temps le permet)*

**Périmètre** :
- `useDriveData` : état initial, `findNodeById` (trouvé/non trouvé/null), `filterItemsByParent`, `updateDriveInfo`, `applyDriveItemsForDisplay` (mode direct/outIn), `onFileListAfterLeave`, `navigateToBreadcrumb`, `onBreadcrumbWheel`
- `useTransfers` : `formatSpeed` (0, octets, Ko, Mo), `formatETA` (0/Infinity, <60s, <3600s, >3600s), `getTransferStatus` (en pause, terminé, en cours, en attente), `isPaused`, `togglePauseTransfer`, `resumeAllTransfers`, `cancelDownload` (nettoyage état), état initial des refs
- `useInfoPanel` : `formatDateField` (valide, invalide, null), `closeInfoPanel`, état initial, `handleDownloadItem` (fichier → appelle downloadFile, dossier → notification), `buildInfo` (structure retournée)
- `useFileActions` : fonctions pures de formatage si présentes

**Mocks** :
```ts
vi.mock('~/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) }),
  }),
}))
vi.mock('~/utils/crypto', () => ({ ... }))
vi.mock('~/composables/drive/useAutoShare', () => ({
  useAutoShare: vi.fn().mockReturnValue({
    propagateFileAccess: vi.fn().mockResolvedValue({ success: true }),
  }),
}))
```

**Couverture cible** : ~55-65% (fichiers complexes)

---

## Règles communes

1. **Langue des tests** : libellés en français (`it("retourne false si..."`)
2. **Structure** : `describe` par composable → `describe` par fonction → `it` par cas
3. **beforeEach** : `vi.clearAllMocks()` + reset état si singleton
4. **Singletons** : `useNavigation`, `useCategories`, `useView`, `useEvents` utilisent des `ref` au module level — les tests doivent reset l'état via les fonctions exposées (ex: `clearAllEvents()`, `clearFilters()`, `goToDate(fixedDate)`)
5. **Pas de test DOM** : pas de `document.querySelector`, `URL.createObjectURL`, etc.
6. **Import style** : `import { composable } from "@/composables/..."` (alias `@` = `app/`)

---

## Critère de succès

- `npm run test:coverage` retourne ≥80% statements/branches/lines globalement
- Aucun test en échec
- Rapport lcov généré dans `./coverage/` pour SonarQube
