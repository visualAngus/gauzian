import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useApiUrl } from '@/composables/useApiUrl'

describe('useApiUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retourne '/api' par défaut (valeur du stub setup.ts)", () => {
    const url = useApiUrl()
    expect(url).toBe('/api')
  })

  it('retourne une URL personnalisée si useRuntimeConfig retourne une autre valeur', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { apiUrl: 'https://gauzian.pupin.fr/api' },
    }))

    const url = useApiUrl()
    expect(url).toBe('https://gauzian.pupin.fr/api')
  })
})
