# Vitest Testing Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une infrastructure de tests Vitest complète au projet Gauzian Frontend pour passer de 0% à 75%+ de couverture SonarQube, avec une progression pédagogique pour un utilisateur débutant en tests.

**Architecture:** Vitest avec environnement Node (pas jsdom) pour accéder à Web Crypto API nativement. Les tests sont organisés en 3 phases : fonctions pures crypto, composables sans API, composables avec mocks fetch. Les auto-imports Nuxt sont stubés globalement dans un fichier `tests/setup.ts`.

**Tech Stack:** Vitest 3.x, @vitest/coverage-v8, @vue/test-utils 2.x, Node.js Web Crypto API (natif), lcov pour SonarQube.

---

## Chunk 1 : Infrastructure de base

### Task 1 : Installer les dépendances

**Files:**
- Modify: `package.json`

- [ ] **Step 1 : Installer les packages de test**

```bash
cd /home/dev/gauzian/gauzianFront
npm install --save-dev vitest @vitest/coverage-v8 @vue/test-utils jsdom
```

Expected: packages installés sans erreur, `package-lock.json` mis à jour.

- [ ] **Step 2 : Ajouter les scripts dans `package.json`**

Ouvrir `package.json`, dans la section `"scripts"`, ajouter après `"lint"` :

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3 : Vérifier l'installation**

```bash
npx vitest --version
```

Expected: affiche un numéro de version (ex: `3.x.x`).

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json
git commit -m "build(test): install vitest and coverage dependencies [skip ci]"
```

---

### Task 2 : Créer `vitest.config.ts`

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1 : Créer le fichier de config**

Créer `/home/dev/gauzian/gauzianFront/vitest.config.ts` :

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    // Node (pas jsdom) : Web Crypto API disponible nativement via globalThis.crypto
    environment: 'node',
    // describe/it/expect disponibles sans import explicite
    globals: true,
    // Fichier de setup global (mocks Nuxt auto-imports)
    setupFiles: ['./tests/setup.ts'],
    // Injection de import.meta.client/dev pour les composables Nuxt
    define: {
      'import.meta.client': 'true',
      'import.meta.dev': 'false',
    },
    coverage: {
      provider: 'v8',
      // text : résumé terminal, lcov : rapport pour SonarQube
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['app/**/*.{ts,js}'],
      exclude: [
        'app/pages/**',
        'app/components/**',
        'node_modules/**',
        '.nuxt/**',
      ],
    },
  },
  resolve: {
    alias: {
      // ~ et @ pointent vers app/ (comme dans Nuxt)
      '~': resolve(__dirname, './app'),
      '@': resolve(__dirname, './app'),
    },
  },
})
```

- [ ] **Step 2 : Commit**

```bash
git add vitest.config.ts
git commit -m "build(test): add vitest configuration [skip ci]"
```

---

### Task 3 : Créer `tests/setup.ts`

**Files:**
- Create: `tests/setup.ts`

Ce fichier est chargé avant chaque suite de tests. Il installe les polyfills et stubs Nuxt nécessaires.

- [ ] **Step 1 : Créer le dossier et le fichier**

Créer `/home/dev/gauzian/gauzianFront/tests/setup.ts` :

```typescript
import { vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { ref } from 'vue'

// ─── Web Crypto API ──────────────────────────────────────────────────────
// Node >= 16 expose globalThis.crypto mais on le force pour être sûr
if (!globalThis.crypto) {
  // @ts-expect-error polyfill nécessaire en environnement test
  globalThis.crypto = webcrypto
}

// ─── window (requis par assertClient() dans crypto.ts) ───────────────────
// crypto.ts appelle assertClient() qui vérifie typeof window !== 'undefined'
// En environnement Node, window n'existe pas → on le crée minimalement
if (typeof globalThis.window === 'undefined') {
  // @ts-expect-error polyfill pour environnement Node test
  globalThis.window = {
    crypto: webcrypto,
    btoa: (s: string) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
  }
}

// ─── Nuxt auto-imports stubs ─────────────────────────────────────────────
// Ces fonctions sont injectées automatiquement par Nuxt mais n'existent
// pas dans Vitest. On les définit globalement pour tous les composables.

// useState : simule un ref Vue réactif persistant (simplifié)
vi.stubGlobal('useState', (_key: string, init: () => unknown) => ref(init()))

// useRuntimeConfig : retourne la config avec apiUrl par défaut (dev)
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiUrl: '/api' },
}))

// navigateTo : stub vide — on vérifie juste qu'il est appelé
vi.stubGlobal('navigateTo', vi.fn())

// useRouter : stub minimal pour les composables qui appellent push/replace
vi.stubGlobal('useRouter', () => ({
  push: vi.fn(),
  replace: vi.fn(),
  currentRoute: { value: { query: {} } },
}))

// useRoute : stub minimal
vi.stubGlobal('useRoute', () => ({
  query: {},
  params: {},
  path: '/',
}))
```

- [ ] **Step 2 : Vérifier que Vitest démarre sans erreur**

```bash
npm run test
```

Expected: `No test files found` ou `0 tests passed` — pas d'erreur de config.

- [ ] **Step 3 : Commit**

```bash
git add tests/setup.ts
git commit -m "build(test): add global test setup with Nuxt stubs [skip ci]"
```

---

## Chunk 2 : Tests crypto.ts (Phase 1 - fonctions pures)

### Task 4 : Tests utilitaires de conversion (buffToB64, b64ToBuff, strToBuff)

**Files:**
- Create: `tests/unit/utils/crypto.test.ts`
- Read: `app/utils/crypto.ts` (pour vérifier les signatures exactes)

Ces tests sont synchrones et ne nécessitent aucun mock. C'est le point d'entrée idéal pour apprendre la syntaxe de base.

> **Concept clé — `describe` et `it` :**
> - `describe('nom du groupe', () => { ... })` : regroupe des tests liés
> - `it('comportement attendu', () => { ... })` : un test unitaire
> - `expect(valeur).toBe(attendu)` : l'assertion

- [ ] **Step 1 : Créer le fichier de test**

Créer `/home/dev/gauzian/gauzianFront/tests/unit/utils/crypto.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import {
  strToBuff,
  buffToB64,
  b64ToBuff,
  toPem,
  pemToArrayBuffer,
} from '~/utils/crypto'

// ─────────────────────────────────────────────────────────────────────────
// strToBuff : convertit une string en Uint8Array (bytes UTF-8)
// ─────────────────────────────────────────────────────────────────────────
describe('strToBuff', () => {
  it('encode une chaîne ASCII en Uint8Array', () => {
    const result = strToBuff('hello')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(5)
    expect(result[0]).toBe(104) // 'h' = 104 en ASCII
  })

  it('encode correctement les caractères UTF-8 multi-octets', () => {
    // 'é' prend 2 octets en UTF-8
    const result = strToBuff('é')
    expect(result.length).toBe(2)
  })

  it('retourne un Uint8Array vide pour une chaîne vide', () => {
    expect(strToBuff('').length).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// buffToB64 / b64ToBuff : encodage/décodage base64
// ─────────────────────────────────────────────────────────────────────────
describe('buffToB64 et b64ToBuff', () => {
  it('round-trip : encode puis décode donne la même valeur', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    const encoded = buffToB64(original)
    const decoded = b64ToBuff(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(original))
  })

  it('buffToB64 retourne une chaîne base64 valide', () => {
    const data = new Uint8Array([0, 1, 2, 255])
    const result = buffToB64(data)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('deux buffers différents donnent des base64 différents', () => {
    const a = buffToB64(new Uint8Array([1, 2, 3]))
    const b = buffToB64(new Uint8Array([4, 5, 6]))
    expect(a).not.toBe(b)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// toPem / pemToArrayBuffer : conversion format PEM
// ─────────────────────────────────────────────────────────────────────────
describe('toPem et pemToArrayBuffer', () => {
  it('toPem entoure les données avec les bons en-têtes PEM', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const pem = toPem(data.buffer, 'PUBLIC')
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----')
    expect(pem).toContain('-----END PUBLIC KEY-----')
  })

  it('round-trip : toPem puis pemToArrayBuffer donne le même buffer', () => {
    const original = new Uint8Array([10, 20, 30, 40, 50, 100, 200, 255])
    const pem = toPem(original.buffer, 'PRIVATE')
    const recovered = pemToArrayBuffer(pem)
    expect(Array.from(new Uint8Array(recovered))).toEqual(Array.from(original))
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils passent**

```bash
npm run test tests/unit/utils/crypto.test.ts
```

Expected: tous les tests passent (vert). Si erreur sur `assertClient()`, vérifier que `tests/setup.ts` crée bien `globalThis.window`.

- [ ] **Step 3 : Commit**

```bash
git add tests/unit/utils/crypto.test.ts
git commit -m "test(crypto): add conversion utility tests (strToBuff, buffToB64, toPem) [skip ci]"
```

---

### Task 5 : Tests chiffrement AES-GCM (generateDataKey, encrypt/decrypt)

**Files:**
- Modify: `tests/unit/utils/crypto.test.ts`

> **Concept clé — tests asynchrones :**
> Les fonctions crypto retournent des `Promise`. On utilise `async/await` dans les tests.
> `await expect(promise).rejects.toThrow()` : vérifie qu'une promesse échoue.

- [ ] **Step 1 : Ajouter les tests AES dans le fichier existant**

Ajouter à la fin de `tests/unit/utils/crypto.test.ts` :

```typescript
import { generateDataKey, encryptSimpleDataWithDataKey, decryptSimpleDataWithDataKey } from '~/utils/crypto'

// ─────────────────────────────────────────────────────────────────────────
// generateDataKey : génère une clé AES-256 (32 bytes) encodée en base64
// ─────────────────────────────────────────────────────────────────────────
describe('generateDataKey', () => {
  it('retourne une chaîne base64 de 44 caractères (32 bytes)', async () => {
    const key = await generateDataKey()
    expect(typeof key).toBe('string')
    expect(key.length).toBe(44) // 32 bytes en base64 = 44 chars avec padding
    expect(key).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('génère des clés différentes à chaque appel (aléatoire)', async () => {
    const key1 = await generateDataKey()
    const key2 = await generateDataKey()
    expect(key1).not.toBe(key2)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// encryptSimpleDataWithDataKey / decryptSimpleDataWithDataKey
// Chiffrement AES-256-GCM de métadonnées (strings)
// ─────────────────────────────────────────────────────────────────────────
describe('encryptSimpleDataWithDataKey / decryptSimpleDataWithDataKey', () => {
  // beforeEach : génère une clé fraîche avant chaque test de ce groupe
  let dataKey: string

  beforeEach(async () => {
    dataKey = await generateDataKey()
  })

  it('round-trip : chiffre puis déchiffre donne le texte original', async () => {
    const original = 'Réunion client à 14h30 — confidentiel'
    const cipher = await encryptSimpleDataWithDataKey(original, dataKey)
    const decrypted = await decryptSimpleDataWithDataKey(cipher, dataKey)
    expect(decrypted).toBe(original)
  })

  it('round-trip avec une chaîne vide', async () => {
    const cipher = await encryptSimpleDataWithDataKey('', dataKey)
    const decrypted = await decryptSimpleDataWithDataKey(cipher, dataKey)
    expect(decrypted).toBe('')
  })

  it('round-trip avec caractères spéciaux et emoji', async () => {
    const original = 'Données: €£¥ 🔐 日本語'
    const cipher = await encryptSimpleDataWithDataKey(original, dataKey)
    const decrypted = await decryptSimpleDataWithDataKey(cipher, dataKey)
    expect(decrypted).toBe(original)
  })

  it('le texte chiffré est différent du texte original', async () => {
    const cipher = await encryptSimpleDataWithDataKey('hello', dataKey)
    expect(cipher).not.toBe('hello')
  })

  it('deux chiffrements du même texte donnent des résultats différents (IV aléatoire)', async () => {
    const cipher1 = await encryptSimpleDataWithDataKey('hello', dataKey)
    const cipher2 = await encryptSimpleDataWithDataKey('hello', dataKey)
    expect(cipher1).not.toBe(cipher2)
  })

  it('lève une erreur si on déchiffre avec la mauvaise clé', async () => {
    const cipher = await encryptSimpleDataWithDataKey('secret', dataKey)
    const wrongKey = await generateDataKey()
    await expect(decryptSimpleDataWithDataKey(cipher, wrongKey)).rejects.toThrow()
  })
})
```

- [ ] **Step 2 : Lancer les tests**

```bash
npm run test tests/unit/utils/crypto.test.ts
```

Expected: tous les tests passent.

- [ ] **Step 3 : Commit**

```bash
git add tests/unit/utils/crypto.test.ts
git commit -m "test(crypto): add AES-256-GCM encrypt/decrypt tests [skip ci]"
```

---

### Task 6 : Tests PBKDF2 + RSA (optionnels — lents)

**Files:**
- Modify: `tests/unit/utils/crypto.test.ts`

> **Note :** PBKDF2 avec 310k itérations prend ~1-2s. RSA-4096 peut prendre jusqu'à 10s. On utilise le 3ème paramètre de `it()` pour fixer un timeout en millisecondes.

- [ ] **Step 1 : Ajouter les tests dans le fichier existant**

```typescript
import { encryptPrivateKeyPemWithPassword, decryptPrivateKeyPemWithPassword } from '~/utils/crypto'

// ─────────────────────────────────────────────────────────────────────────
// encryptPrivateKeyPemWithPassword / decryptPrivateKeyPemWithPassword
// PBKDF2 (310k itérations) + AES-256-GCM — TESTS LENTS (~2-4s)
// ─────────────────────────────────────────────────────────────────────────
describe('encryptPrivateKeyPemWithPassword / decryptPrivateKeyPemWithPassword', () => {
  const fakePem = '-----BEGIN PRIVATE KEY-----\nfakebase64data==\n-----END PRIVATE KEY-----'

  it('round-trip avec le bon mot de passe', async () => {
    const password = 'mot_de_passe_tres_securise_123!'
    const encrypted = await encryptPrivateKeyPemWithPassword(fakePem, password)

    // Le résultat contient 3 champs
    expect(typeof encrypted.encrypted_private_key).toBe('string')
    expect(typeof encrypted.private_key_salt).toBe('string')
    expect(typeof encrypted.iv).toBe('string')

    // On peut déchiffrer avec le bon mot de passe
    const decrypted = await decryptPrivateKeyPemWithPassword({ ...encrypted, password })
    expect(decrypted).toBe(fakePem)
  }, 15000) // timeout 15s pour PBKDF2

  it('lève une erreur avec un mauvais mot de passe', async () => {
    const encrypted = await encryptPrivateKeyPemWithPassword(fakePem, 'correct')
    await expect(
      decryptPrivateKeyPemWithPassword({ ...encrypted, password: 'incorrect' })
    ).rejects.toThrow()
  }, 15000)
})
```

- [ ] **Step 2 : Lancer les tests (prévoir 15-20s)**

```bash
npm run test tests/unit/utils/crypto.test.ts
```

Expected: tous les tests passent. Les tests PBKDF2 prendront quelques secondes.

- [ ] **Step 3 : Générer le rapport de couverture pour voir le résultat**

```bash
npm run test:coverage
```

Expected: `app/utils/crypto.ts` devrait être à 50-65% de couverture.

- [ ] **Step 4 : Commit**

```bash
git add tests/unit/utils/crypto.test.ts
git commit -m "test(crypto): add PBKDF2 password-based key encryption tests [skip ci]"
```

---

## Chunk 3 : Tests composables simples

### Task 7 : Tests useNotification (premier composable — aucun mock)

**Files:**
- Create: `tests/unit/composables/useNotification.test.ts`
- Read: `app/composables/useNotification.js`

> **Concept clé — `vi.useFakeTimers()` :**
> Remplace `setTimeout` par une version contrôlable.
> `vi.advanceTimersByTime(3000)` : fait avancer le temps de 3 secondes instantanément.

- [ ] **Step 1 : Lire le composable pour connaître son interface**

Ouvrir `app/composables/useNotification.js` et noter les fonctions exportées.

- [ ] **Step 2 : Créer le fichier de test**

Créer `/home/dev/gauzian/gauzianFront/tests/unit/composables/useNotification.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import direct — pas d'auto-import Nuxt ici
// L'alias ~ pointe vers app/ (configuré dans vitest.config.ts)
import { useNotification } from '~/composables/useNotification'

describe('useNotification', () => {
  beforeEach(() => {
    // Remplacer setTimeout par une version contrôlable
    vi.useFakeTimers()
  })

  afterEach(() => {
    // Restaurer les vrais timers après chaque test
    vi.useRealTimers()
  })

  it('commence avec une liste vide', () => {
    const { notifications } = useNotification()
    expect(notifications.value).toEqual([])
  })

  it('addNotification ajoute une notification avec les bonnes propriétés', () => {
    const { notifications, addNotification } = useNotification()
    addNotification({ title: 'Succès', message: 'Fichier uploadé', duration: 5000 })

    expect(notifications.value).toHaveLength(1)
    expect(notifications.value[0].title).toBe('Succès')
    expect(notifications.value[0].message).toBe('Fichier uploadé')
    // id doit exister
    expect(notifications.value[0].id).toBeDefined()
  })

  it('removeNotification supprime la notification par id', () => {
    const { notifications, addNotification, removeNotification } = useNotification()
    addNotification({ title: 'Test', message: '' })
    const id = notifications.value[0].id
    removeNotification(id)
    expect(notifications.value).toHaveLength(0)
  })

  it('supprime automatiquement la notification après sa durée', () => {
    const { notifications, addNotification } = useNotification()
    addNotification({ title: 'Temp', message: '', duration: 3000 })
    expect(notifications.value).toHaveLength(1)

    // Avancer le temps de 3 secondes
    vi.advanceTimersByTime(3000)
    expect(notifications.value).toHaveLength(0)
  })

  it('plusieurs notifications coexistent', () => {
    const { notifications, addNotification } = useNotification()
    addNotification({ message: 'Notif 1' })
    addNotification({ message: 'Notif 2' })
    expect(notifications.value).toHaveLength(2)
  })
})
```

- [ ] **Step 3 : Lancer les tests**

```bash
npm run test tests/unit/composables/useNotification.test.ts
```

Expected: tous les tests passent.

> **Si un test échoue** : lire le message d'erreur. Il indique quelle assertion a échoué et les valeurs attendues/reçues. Ajuster le test ou le mock en conséquence.

- [ ] **Step 4 : Commit**

```bash
git add tests/unit/composables/useNotification.test.ts
git commit -m "test(composables): add useNotification tests [skip ci]"
```

---

### Task 8 : Tests useNavigation (logique de dates pure)

**Files:**
- Create: `tests/unit/composables/agenda/useNavigation.test.ts`
- Read: `app/composables/agenda/useNavigation.js`

> **Attention — singleton module-level :** `currentDate` et `selectedDate` dans `useNavigation.js` sont déclarés en dehors de la fonction exportée. Ils persistent entre les tests. On appelle `goToToday()` ou `goToDate()` dans `beforeEach` pour resetter à une date connue.

- [ ] **Step 1 : Créer le fichier de test**

Créer `/home/dev/gauzian/gauzianFront/tests/unit/composables/agenda/useNavigation.test.ts` :

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useNavigation } from '~/composables/agenda/useNavigation'

describe('useNavigation - calculs de dates', () => {
  let nav: ReturnType<typeof useNavigation>

  beforeEach(() => {
    nav = useNavigation()
    // Fixer à une date connue pour isoler les tests
    nav.goToDate(new Date(2024, 5, 15)) // 15 juin 2024
  })

  it('getStartOfWeek retourne un lundi', () => {
    const monday = new Date(2024, 0, 1) // 1er janvier 2024 = lundi
    const start = nav.getStartOfWeek(monday)
    expect(start.getDay()).toBe(1) // 1 = Lundi
  })

  it('getEndOfWeek retourne un dimanche', () => {
    const monday = new Date(2024, 0, 1)
    const end = nav.getEndOfWeek(monday)
    expect(end.getDay()).toBe(0) // 0 = Dimanche
  })

  it('getDaysInMonth retourne 31 pour janvier', () => {
    expect(nav.getDaysInMonth(new Date(2024, 0, 1))).toBe(31)
  })

  it('getDaysInMonth retourne 29 pour février 2024 (année bissextile)', () => {
    expect(nav.getDaysInMonth(new Date(2024, 1, 1))).toBe(29)
  })

  it('getDaysInMonth retourne 28 pour février 2023 (année non-bissextile)', () => {
    expect(nav.getDaysInMonth(new Date(2023, 1, 1))).toBe(28)
  })
})

describe('useNavigation - navigation', () => {
  let nav: ReturnType<typeof useNavigation>

  beforeEach(() => {
    nav = useNavigation()
    nav.goToDate(new Date(2024, 5, 15)) // 15 juin 2024
  })

  it('nextDay avance d\'un jour', () => {
    nav.nextDay()
    expect(nav.currentDate.value.getDate()).toBe(16)
  })

  it('previousDay recule d\'un jour', () => {
    nav.previousDay()
    expect(nav.currentDate.value.getDate()).toBe(14)
  })

  it('nextMonth avance d\'un mois', () => {
    nav.nextMonth()
    expect(nav.currentDate.value.getMonth()).toBe(6) // juillet = index 6
  })

  it('previousMonth recule d\'un mois', () => {
    nav.previousMonth()
    expect(nav.currentDate.value.getMonth()).toBe(4) // mai = index 4
  })

  it('goToDate navigue vers une date précise', () => {
    const target = new Date(2025, 0, 1)
    nav.goToDate(target)
    expect(nav.currentDate.value.getFullYear()).toBe(2025)
    expect(nav.currentDate.value.getMonth()).toBe(0)
    expect(nav.currentDate.value.getDate()).toBe(1)
  })
})

describe('useNavigation - dateToDayId / dayIdToDate', () => {
  let nav: ReturnType<typeof useNavigation>

  beforeEach(() => {
    nav = useNavigation()
  })

  it('round-trip : dateToDayId puis dayIdToDate donne la même date', () => {
    const original = new Date(2024, 5, 15)
    const dayId = nav.dateToDayId(original)
    const recovered = nav.dayIdToDate(dayId)
    expect(recovered.getFullYear()).toBe(2024)
    expect(recovered.getMonth()).toBe(5)
    expect(recovered.getDate()).toBe(15)
  })

  it('deux dates différentes donnent des dayId différents', () => {
    const id1 = nav.dateToDayId(new Date(2024, 0, 1))
    const id2 = nav.dateToDayId(new Date(2024, 0, 2))
    expect(id1).not.toBe(id2)
    expect(id2 - id1).toBe(1)
  })
})
```

- [ ] **Step 2 : Lancer les tests**

```bash
npm run test tests/unit/composables/agenda/useNavigation.test.ts
```

Expected: tous les tests passent. Si certains tests de navigation échouent, lire `useNavigation.js` pour vérifier les noms exacts des fonctions.

- [ ] **Step 3 : Commit**

```bash
git add tests/unit/composables/agenda/useNavigation.test.ts
git commit -m "test(agenda): add useNavigation date calculation and navigation tests [skip ci]"
```

---

## Chunk 4 : Tests composables avec fetch

### Task 9 : Tests useFetchWithAuth (mock fetch global)

**Files:**
- Create: `tests/unit/composables/useFetchWithAuth.test.ts`
- Read: `app/composables/useFetchWithAuth.js`

> **Concept clé — `vi.mock()` :**
> Remplace un module entier par une version contrôlée. Doit être placé AVANT les imports du module qu'on teste. Vitest remonte automatiquement `vi.mock()` en haut du fichier.
>
> **Concept clé — `vi.fn()` :**
> Crée une "fonction espion" : on peut vérifier si elle a été appelée, avec quels arguments, et lui donner une valeur de retour.

- [ ] **Step 1 : Lire le composable**

Ouvrir `app/composables/useFetchWithAuth.js` pour noter les imports utilisés.

- [ ] **Step 2 : Créer le fichier de test**

Créer `/home/dev/gauzian/gauzianFront/tests/unit/composables/useFetchWithAuth.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// ─── Valeurs contrôlables depuis les tests ────────────────────────────────
const mockAuthToken = ref<string | null>('fake-jwt-token')
const mockLogout = vi.fn()

// vi.mock() est remonté automatiquement avant les imports par Vitest
// On remplace useAuth par une version qui retourne notre token contrôlable
vi.mock('~/composables/useAuth', () => ({
  useAuth: () => ({
    authToken: mockAuthToken,
    logout: mockLogout,
  }),
}))

// Import du composable à tester — APRÈS vi.mock()
import { useFetchWithAuth } from '~/composables/useFetchWithAuth'

describe('useFetchWithAuth', () => {
  beforeEach(() => {
    // Resetter les spies entre les tests
    vi.clearAllMocks()
    mockAuthToken.value = 'fake-jwt-token'
    // Remplacer fetch global par un espion
    vi.stubGlobal('fetch', vi.fn())
  })

  it('ajoute automatiquement le header Authorization avec le token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: 'ok' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { fetchWithAuth } = useFetchWithAuth()
    await fetchWithAuth('/files/list')

    // Vérifier que fetch a été appelé avec le bon header
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/files/list'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-jwt-token',
        }),
      }),
    )
  })

  it('appelle logout() et lève une erreur sur réponse 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    const { fetchWithAuth } = useFetchWithAuth()
    await expect(fetchWithAuth('/protected')).rejects.toThrow()
    expect(mockLogout).toHaveBeenCalled()
  })

  it('préfixe l\'URL avec l\'URL de l\'API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const { fetchWithAuth } = useFetchWithAuth()
    await fetchWithAuth('/test-endpoint')

    expect(mockFetch.mock.calls[0][0]).toContain('/test-endpoint')
  })
})
```

- [ ] **Step 3 : Lancer les tests**

```bash
npm run test tests/unit/composables/useFetchWithAuth.test.ts
```

Expected: tous les tests passent. Si des imports manquent dans le mock, ajuster `vi.mock()` en lisant les erreurs.

- [ ] **Step 4 : Commit**

```bash
git add tests/unit/composables/useFetchWithAuth.test.ts
git commit -m "test(composables): add useFetchWithAuth tests with fetch mock [skip ci]"
```

---

### Task 10 : Tests useEvents (mock fetch + crypto)

**Files:**
- Create: `tests/unit/composables/agenda/useEvents.test.ts`
- Read: `app/composables/agenda/useEvents.js`

> **Attention — singleton module-level :** `events` et `nextId` dans `useEvents.js` persistent entre les tests. On utilise `vi.resetModules()` + import dynamique dans `beforeEach` pour repartir de zéro à chaque test.

- [ ] **Step 1 : Créer le fichier de test**

Créer `/home/dev/gauzian/gauzianFront/tests/unit/composables/agenda/useEvents.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocker les dépendances avant tout import
vi.mock('~/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: () => ({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ events: [] }),
    }),
  }),
}))

vi.mock('~/utils/crypto', () => ({
  generateDataKey: vi.fn().mockResolvedValue('bW9ja0tleUZvckhBRVMtMjU2QUFBQUFBQUE='),
  encryptWithStoredPublicKey: vi.fn().mockResolvedValue('encryptedDataKey=='),
  encryptSimpleDataWithDataKey: vi.fn().mockImplementation(
    async (data: string) => `encrypted(${data})`,
  ),
  decryptWithStoredPrivateKey: vi.fn().mockResolvedValue('mockDataKey=='),
  decryptSimpleDataWithDataKey: vi.fn().mockImplementation(
    async (cipher: string) => cipher.replace('encrypted(', '').replace(')', ''),
  ),
}))

describe('useEvents - opérations synchrones sur les événements', () => {
  // useEvents est réimporté dynamiquement pour réinitialiser le singleton
  let useEvents: () => ReturnType<typeof import('~/composables/agenda/useEvents').default>

  beforeEach(async () => {
    vi.resetModules()
    const module = await import('~/composables/agenda/useEvents')
    useEvents = module.useEvents ?? module.default
  })

  it('la liste des événements commence vide', () => {
    const { events } = useEvents()
    expect(events.value).toEqual([])
  })

  it('getEventsByDay filtre les événements par dayId', () => {
    const { events, getEventsByDay } = useEvents()
    events.value = [
      { id: 1, dayId: 5, title: 'Réunion A', startHour: 9, endHour: 10 },
      { id: 2, dayId: 6, title: 'Réunion B', startHour: 14, endHour: 15 },
      { id: 3, dayId: 5, title: 'Call C', startHour: 11, endHour: 12 },
    ]
    const result = getEventsByDay(5)
    expect(result).toHaveLength(2)
    expect(result.every((e: { dayId: number }) => e.dayId === 5)).toBe(true)
  })

  it('deleteEvent supprime l\'événement et retourne true', () => {
    const { events, deleteEvent } = useEvents()
    events.value = [{ id: 1, dayId: 1, title: 'Test', startHour: 9, endHour: 10 }]
    const result = deleteEvent(1)
    expect(result).toBe(true)
    expect(events.value).toHaveLength(0)
  })

  it('deleteEvent retourne false si l\'id n\'existe pas', () => {
    const { deleteEvent } = useEvents()
    expect(deleteEvent(999)).toBe(false)
  })

  it('updateEvent met à jour les champs de l\'événement', () => {
    const { events, updateEvent } = useEvents()
    events.value = [{ id: 1, dayId: 1, title: 'Ancien titre', startHour: 9, endHour: 10 }]
    updateEvent(1, { title: 'Nouveau titre' })
    expect(events.value[0].title).toBe('Nouveau titre')
  })
})
```

- [ ] **Step 2 : Lancer les tests**

```bash
npm run test tests/unit/composables/agenda/useEvents.test.ts
```

Expected: tests passent. Si le composable a un nom d'export différent, ajuster l'import dynamique.

- [ ] **Step 3 : Commit**

```bash
git add tests/unit/composables/agenda/useEvents.test.ts
git commit -m "test(agenda): add useEvents CRUD operation tests [skip ci]"
```

---

## Chunk 5 : Intégration CI/CD + couverture SonarQube

### Task 11 : Modifier les workflows GitHub Actions

**Files:**
- Modify: `.github/workflows/lint.yml`
- Modify: `.github/workflows/codeql.yml`

- [ ] **Step 1 : Ajouter les tests dans `lint.yml`**

Ouvrir `.github/workflows/lint.yml` et ajouter après l'étape "Upload ESLint report" :

```yaml
      - name: Run unit tests with coverage
        run: npm run test:coverage 2>&1 | tee test-report.txt
        continue-on-error: true

      - name: Upload test coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

- [ ] **Step 2 : Ajouter la génération de coverage dans `codeql.yml`**

Dans le job `sonarqube` de `.github/workflows/codeql.yml`, ajouter après `actions/checkout@v4` et AVANT `sonarqube-scan-action` :

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm install
      - name: Generate coverage report for SonarQube
        run: npm run test:coverage
        continue-on-error: true
```

- [ ] **Step 3 : Vérifier `sonar-project.properties`**

```bash
grep "lcov" /home/dev/gauzian/gauzianFront/sonar-project.properties
```

Expected: `sonar.javascript.lcov.reportPaths=coverage/lcov.info` (non commenté). Si la ligne est commentée, retirer le `#`.

- [ ] **Step 4 : Tester la génération de couverture locale**

```bash
npm run test:coverage
ls coverage/
```

Expected: les fichiers `lcov.info` et `index.html` apparaissent dans `coverage/`.

- [ ] **Step 5 : Commit et push**

```bash
git add .github/workflows/lint.yml .github/workflows/codeql.yml sonar-project.properties
git commit -m "ci: add test coverage to lint workflow and SonarQube scan"
git push origin front
```

Expected: le workflow CI tourne, les tests passent (ou warn avec `continue-on-error`), SonarQube affiche un pourcentage de couverture > 0%.

---

## Résumé des fichiers créés/modifiés

| Fichier | Action | Description |
|---------|--------|-------------|
| `package.json` | Modify | +4 packages dev, +3 scripts |
| `vitest.config.ts` | Create | Config Vitest (env Node, alias, coverage LCOV) |
| `tests/setup.ts` | Create | Polyfills Web Crypto + stubs Nuxt auto-imports |
| `tests/unit/utils/crypto.test.ts` | Create | 20+ tests fonctions pures crypto |
| `tests/unit/composables/useNotification.test.ts` | Create | 5 tests, fake timers |
| `tests/unit/composables/agenda/useNavigation.test.ts` | Create | 12 tests calcul de dates |
| `tests/unit/composables/useFetchWithAuth.test.ts` | Create | 3 tests fetch mock |
| `tests/unit/composables/agenda/useEvents.test.ts` | Create | 5 tests CRUD events |
| `.github/workflows/lint.yml` | Modify | +2 étapes test coverage |
| `.github/workflows/codeql.yml` | Modify | +3 étapes Node + coverage avant SonarQube |

## Commandes de vérification finale

```bash
# Tous les tests
npm run test

# Couverture complète
npm run test:coverage

# Mode watch (développement)
npm run test:watch
```
