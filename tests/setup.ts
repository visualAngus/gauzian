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
