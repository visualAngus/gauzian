import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAutoShare } from '@/composables/drive/useAutoShare'

vi.mock('@/utils/crypto', () => ({
  encryptWithPublicKey: vi.fn().mockResolvedValue('encrypted-key'),
}))

vi.mock('@/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn(),
  }),
}))

describe('useAutoShare', () => {
  let mockFetchWithAuth: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()

    const { useFetchWithAuth } = await import('@/composables/useFetchWithAuth')
    mockFetchWithAuth = vi.fn()
    vi.mocked(useFetchWithAuth).mockReturnValue({ fetchWithAuth: mockFetchWithAuth })
  })

  // ─── getFolderSharedUsers ──────────────────────────────────────────────

  describe('getFolderSharedUsers', () => {
    it('retourne les utilisateurs si la réponse est ok', async () => {
      const sharedUsers = [
        { user_id: 1, username: 'alice', public_key: 'pk-alice', access_level: 'read' },
      ]
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ shared_users: sharedUsers }),
      })

      const { getFolderSharedUsers } = useAutoShare('/api')
      const result = await getFolderSharedUsers('folder-123')

      expect(result).toEqual(sharedUsers)
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/folder/folder-123/shared_users', {
        method: 'GET',
      })
    })

    it('retourne [] si la réponse est non-ok', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({}),
      })

      const { getFolderSharedUsers } = useAutoShare('/api')
      const result = await getFolderSharedUsers('folder-456')

      expect(result).toEqual([])
    })

    it("retourne [] en cas d'erreur réseau", async () => {
      mockFetchWithAuth.mockRejectedValue(new Error('Cannot connect to server'))

      const { getFolderSharedUsers } = useAutoShare('/api')
      const result = await getFolderSharedUsers('folder-789')

      expect(result).toEqual([])
    })
  })

  // ─── propagateFileAccess ───────────────────────────────────────────────

  describe('propagateFileAccess', () => {
    it('retourne { success: true, propagated: false } si folderId est falsy', async () => {
      const { propagateFileAccess } = useAutoShare('/api')
      const result = await propagateFileAccess('file-1', null, 'file-key')

      expect(result).toEqual({ success: true, propagated: false })
      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })

    it('retourne { success: true, propagated: false } si API_URL est absent', async () => {
      const { propagateFileAccess } = useAutoShare(undefined as unknown as string)
      const result = await propagateFileAccess('file-1', 'folder-1', 'file-key')

      expect(result).toEqual({ success: true, propagated: false })
      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })

    it("retourne { success: true, propagated: false } s'il n'y a aucun utilisateur partagé", async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ shared_users: [] }),
      })

      const { propagateFileAccess } = useAutoShare('/api')
      const result = await propagateFileAccess('file-1', 'folder-1', 'file-key')

      expect(result).toEqual({ success: true, propagated: false })
    })

    it('propage les permissions si des utilisateurs sont présents', async () => {
      const sharedUsers = [
        { user_id: 42, username: 'bob', public_key: 'pk-bob', access_level: 'write' },
      ]

      // Premier appel : getFolderSharedUsers → ok avec utilisateurs
      // Deuxième appel : POST propagate → ok
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ shared_users: sharedUsers }),
        })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })

      const { propagateFileAccess } = useAutoShare('/api')
      const result = await propagateFileAccess('file-99', 'folder-1', 'file-key')

      expect(result).toEqual({ success: true, propagated: true, userCount: 1 })
    })

    it("appelle /drive/propagate_file_access avec la méthode POST", async () => {
      const sharedUsers = [
        { user_id: 7, username: 'charlie', public_key: 'pk-charlie', access_level: 'read' },
      ]

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ shared_users: sharedUsers }),
        })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })

      const { propagateFileAccess } = useAutoShare('/api')
      await propagateFileAccess('file-7', 'folder-5', 'file-key')

      const [endpoint, options] = mockFetchWithAuth.mock.calls[1]
      expect(endpoint).toBe('/drive/propagate_file_access')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body)
      expect(body.file_id).toBe('file-7')
      expect(body.user_keys).toHaveLength(1)
      expect(body.user_keys[0]).toMatchObject({
        user_id: 7,
        encrypted_key: 'encrypted-key',
        access_level: 'read',
      })
    })

    it("retourne { success: false } si l'API retourne une erreur", async () => {
      const sharedUsers = [
        { user_id: 3, username: 'dave', public_key: 'pk-dave', access_level: 'read' },
      ]

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ shared_users: sharedUsers }),
        })
        .mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) })

      const { propagateFileAccess } = useAutoShare('/api')
      const result = await propagateFileAccess('file-3', 'folder-3', 'file-key')

      expect(result).toMatchObject({ success: false })
    })
  })

  // ─── propagateFolderAccess ─────────────────────────────────────────────

  describe('propagateFolderAccess', () => {
    it('retourne { success: true, propagated: false } si parentFolderId est falsy', async () => {
      const { propagateFolderAccess } = useAutoShare('/api')
      const result = await propagateFolderAccess('folder-new', null, 'folder-key')

      expect(result).toEqual({ success: true, propagated: false })
      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })

    it('retourne { success: true, propagated: false } si API_URL est absent', async () => {
      const { propagateFolderAccess } = useAutoShare(undefined as unknown as string)
      const result = await propagateFolderAccess('folder-new', 'folder-parent', 'folder-key')

      expect(result).toEqual({ success: true, propagated: false })
      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })

    it("retourne { success: true, propagated: false } s'il n'y a aucun utilisateur partagé", async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ shared_users: [] }),
      })

      const { propagateFolderAccess } = useAutoShare('/api')
      const result = await propagateFolderAccess('folder-new', 'folder-parent', 'folder-key')

      expect(result).toEqual({ success: true, propagated: false })
    })

    it('propage les permissions du dossier si des utilisateurs sont présents', async () => {
      const sharedUsers = [
        { user_id: 10, username: 'eve', public_key: 'pk-eve', access_level: 'admin' },
      ]

      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ shared_users: sharedUsers }),
        })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })

      const { propagateFolderAccess } = useAutoShare('/api')
      const result = await propagateFolderAccess('folder-new', 'folder-parent', 'folder-key')

      expect(result).toEqual({ success: true, propagated: true, userCount: 1 })

      const [endpoint, options] = mockFetchWithAuth.mock.calls[1]
      expect(endpoint).toBe('/drive/propagate_folder_access')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body)
      expect(body.folder_id).toBe('folder-new')
      expect(body.user_keys[0]).toMatchObject({
        user_id: 10,
        encrypted_key: 'encrypted-key',
        access_level: 'admin',
      })
    })
  })
})
