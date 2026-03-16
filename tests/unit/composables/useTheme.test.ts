import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useTheme } from '@/composables/useTheme'

// Map-based localStorage partagé entre les tests (évite la pollution des stubs)
const localStorageStore = new Map<string, string>()

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageStore.clear()
    // Re-stubs localStorage avec Map (annule tout stub précédent)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageStore.get(key) ?? null,
      setItem: (key: string, value: string) => localStorageStore.set(key, value),
      removeItem: (key: string) => localStorageStore.delete(key),
      clear: () => localStorageStore.clear(),
    })
    vi.stubGlobal('document', {
      documentElement: {
        classList: {
          toggle: vi.fn(),
        },
      },
    })
    // Réinitialise useState pour que isDark reparte à false à chaque test
    vi.stubGlobal('useState', (_key: string, init: () => unknown) => ref(init()))
  })

  describe('état initial', () => {
    it('isDark commence à false', () => {
      const { isDark } = useTheme()
      expect(isDark.value).toBe(false)
    })
  })

  describe('initTheme', () => {
    it("charge 'dark' depuis localStorage → isDark = true", () => {
      localStorage.setItem('gauzian-theme', 'dark')
      const { isDark, initTheme } = useTheme()
      initTheme()
      expect(isDark.value).toBe(true)
    })

    it("charge 'light' depuis localStorage → isDark = false", () => {
      localStorage.setItem('gauzian-theme', 'light')
      const { isDark, initTheme } = useTheme()
      initTheme()
      expect(isDark.value).toBe(false)
    })

    it('localStorage vide → isDark = false', () => {
      // localStorage est déjà vide (clear() dans beforeEach)
      const { isDark, initTheme } = useTheme()
      initTheme()
      expect(isDark.value).toBe(false)
    })

    it("charge 'dark' → appelle classList.toggle('dark', true)", () => {
      localStorage.setItem('gauzian-theme', 'dark')
      const { initTheme } = useTheme()
      initTheme()
      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith('dark', true)
    })
  })

  describe('toggleTheme', () => {
    it("bascule isDark de false à true et sauvegarde 'dark' dans localStorage", () => {
      const { isDark, toggleTheme } = useTheme()
      expect(isDark.value).toBe(false)
      toggleTheme()
      expect(isDark.value).toBe(true)
      expect(localStorage.getItem('gauzian-theme')).toBe('dark')
    })

    it("bascule isDark de true à false et sauvegarde 'light' dans localStorage", () => {
      localStorage.setItem('gauzian-theme', 'dark')
      const { isDark, initTheme, toggleTheme } = useTheme()
      initTheme()
      expect(isDark.value).toBe(true)
      toggleTheme()
      expect(isDark.value).toBe(false)
      expect(localStorage.getItem('gauzian-theme')).toBe('light')
    })
  })
})
