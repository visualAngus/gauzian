import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    // Node (pas jsdom) : Web Crypto API disponible nativement via globalThis.crypto
    environment: 'node',
    // describe/it/expect disponibles sans import explicite
    globals: true,
    // Fichier de setup global (mocks Nuxt auto-imports + polyfills crypto)
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
