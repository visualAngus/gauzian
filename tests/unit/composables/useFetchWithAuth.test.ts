import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFetchWithAuth } from '@/composables/useFetchWithAuth'

// useAuth est un auto-import Nuxt (global), pas un import ES module
// → vi.mock ne fonctionne pas ici, il faut vi.stubGlobal

// Helper : crée une Response mock minimale
const makeMockResponse = (options: {
  ok?: boolean
  status?: number
  json?: () => Promise<unknown>
}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: options.json ?? vi.fn().mockResolvedValue({}),
})

describe('useFetchWithAuth', () => {
  let fetchWithAuth: ReturnType<typeof useFetchWithAuth>['fetchWithAuth']
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Stub useAuth comme auto-import global (pas d'import ES dans useFetchWithAuth.js)
    vi.stubGlobal('useAuth', vi.fn().mockReturnValue({
      authToken: { value: 'mock-token' },
      logout: vi.fn().mockResolvedValue(undefined),
    }))

    mockFetch = vi.fn().mockResolvedValue(makeMockResponse({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', mockFetch)

    ;({ fetchWithAuth } = useFetchWithAuth())
  })

  describe('header Authorization', () => {
    it('ajoute Authorization Bearer si authToken est disponible', async () => {
      await fetchWithAuth('/files/list')

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers['Authorization']).toBe('Bearer mock-token')
    })

    it("n'ajoute pas Authorization si authToken est null", async () => {
      vi.stubGlobal('useAuth', vi.fn().mockReturnValue({
        authToken: { value: null },
        logout: vi.fn().mockResolvedValue(undefined),
      }))
      ;({ fetchWithAuth } = useFetchWithAuth())

      await fetchWithAuth('/files/list')

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers['Authorization']).toBeUndefined()
    })
  })

  describe('header Content-Type', () => {
    it("ajoute Content-Type: application/json par défaut pour un body non-FormData", async () => {
      await fetchWithAuth('/files/list', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) })

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers['Content-Type']).toBe('application/json')
    })

    it("ne définit pas Content-Type pour un body FormData", async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['content']), 'test.txt')

      await fetchWithAuth('/files/upload', { method: 'POST', body: formData })

      const [, options] = mockFetch.mock.calls[0]
      expect(options.headers['Content-Type']).toBeUndefined()
    })
  })

  describe('construction de l\'URL', () => {
    it("utilise l'URL complète si l'endpoint commence par 'http'", async () => {
      await fetchWithAuth('https://example.com/api/files')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://example.com/api/files')
    })

    it("préfixe avec apiUrl si l'endpoint est relatif", async () => {
      await fetchWithAuth('/files/list')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('/api/files/list')
    })
  })

  describe('suppression des credentials', () => {
    it("supprime credentials des fetchOptions avant l'appel fetch", async () => {
      await fetchWithAuth('/files/list', { credentials: 'include' } as RequestInit)

      const [, options] = mockFetch.mock.calls[0]
      expect(options.credentials).toBeUndefined()
    })
  })

  describe('réponse ok', () => {
    it('retourne la réponse si response.ok === true', async () => {
      const mockResponse = makeMockResponse({ ok: true, status: 200 })
      mockFetch.mockResolvedValue(mockResponse)

      const result = await fetchWithAuth('/files/list')

      expect(result).toBe(mockResponse)
    })
  })

  describe('erreurs HTTP', () => {
    it("lance 'Session expirée' et appelle logout() si status 401", async () => {
      const mockLogout = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('useAuth', vi.fn().mockReturnValue({
        authToken: { value: 'mock-token' },
        logout: mockLogout,
      }))
      ;({ fetchWithAuth } = useFetchWithAuth())

      mockFetch.mockResolvedValue(makeMockResponse({ ok: false, status: 401 }))

      await expect(fetchWithAuth('/files/list')).rejects.toThrow('Session expirée')
      expect(mockLogout).toHaveBeenCalledOnce()
    })

    it("lance une erreur avec le message JSON (errorData.error) si réponse non-ok avec JSON", async () => {
      mockFetch.mockResolvedValue(
        makeMockResponse({
          ok: false,
          status: 403,
          json: vi.fn().mockResolvedValue({ error: 'Accès refusé' }),
        })
      )

      await expect(fetchWithAuth('/files/secret')).rejects.toThrow('Accès refusé')
    })

    it("lance 'Request failed with status 500' si réponse non-ok sans JSON valide", async () => {
      mockFetch.mockResolvedValue(
        makeMockResponse({
          ok: false,
          status: 500,
          json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
        })
      )

      await expect(fetchWithAuth('/files/list')).rejects.toThrow('Request failed with status 500')
    })
  })

  describe('erreurs réseau et AbortError', () => {
    it("relance AbortError tel quel sans le transformer", async () => {
      const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' })
      mockFetch.mockRejectedValue(abortError)

      await expect(fetchWithAuth('/files/list')).rejects.toMatchObject({ name: 'AbortError' })
    })

    it("lance 'Cannot connect to server' en cas d'erreur réseau", async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(fetchWithAuth('/files/list')).rejects.toThrow('Cannot connect to server')
    })
  })
})
