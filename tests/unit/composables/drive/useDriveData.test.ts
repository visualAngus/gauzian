import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDriveData } from '@/composables/drive/useDriveData'
import { useFetchWithAuth } from '@/composables/useFetchWithAuth'
import { decryptSimpleDataWithDataKey, decryptWithStoredPrivateKey } from '@/utils/crypto'

// vi.mock est hoisted — les variables doivent être définies DANS la factory
vi.mock('@/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        files_and_folders: { folders: [], files: [] },
        full_path: [],
        drive_info: { used_space: 0, storage_limit_bytes: 1024 * 1024 * 1024 },
      }),
    }),
  }),
}))

vi.mock('@/utils/crypto', () => ({
  decryptWithStoredPrivateKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  decryptSimpleDataWithDataKey: vi.fn().mockResolvedValue('{"folder_name":"Test"}'),
  encryptWithStoredPublicKey: vi.fn().mockResolvedValue('encrypted-key'),
  encryptSimpleDataWithDataKey: vi.fn().mockResolvedValue('encrypted-data'),
  generateDataKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  encryptWithPublicKey: vi.fn().mockResolvedValue('encrypted-key'),
}))

vi.mock('@/composables/drive/useAutoShare', () => ({
  useAutoShare: vi.fn().mockReturnValue({
    propagateFileAccess: vi.fn().mockResolvedValue({ success: true }),
  }),
}))

function createComposable() {
  const router = { push: vi.fn() }
  const API_URL = '/api'
  const usedSpace = ref(0)
  const listUploaded = ref([])
  const addNotification = vi.fn()
  const maxspace = ref(1024 * 1024 * 1024)
  return {
    router,
    addNotification,
    usedSpace,
    listUploaded,
    maxspace,
    ...useDriveData(router, API_URL, usedSpace, listUploaded, addNotification, maxspace),
  }
}

async function flushAsyncState() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

describe('useDriveData', () => {
  let mockFetchWithAuth: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchWithAuth = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/get_folder/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ folder_contents: [] }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          files_and_folders: { folders: [], files: [] },
          full_path: [],
          drive_info: { used_space: 0, storage_limit_bytes: 1024 * 1024 * 1024 },
        }),
      })
    })
    vi.mocked(useFetchWithAuth).mockReturnValue({ fetchWithAuth: mockFetchWithAuth })
    vi.mocked(decryptWithStoredPrivateKey).mockResolvedValue(new Uint8Array(32))
    vi.mocked(decryptSimpleDataWithDataKey).mockResolvedValue('{"folder_name":"Test"}')
    window.location = { search: '' } as Location
  })

  describe('état initial', () => {
    it('activeFolderId vaut "root" au démarrage', () => {
      const { activeFolderId } = createComposable()
      expect(activeFolderId.value).toBe('root')
    })

    it('liste_decrypted_items est vide au démarrage', () => {
      const { liste_decrypted_items } = createComposable()
      expect(liste_decrypted_items.value).toEqual([])
    })

    it('loadingDrive est true au démarrage', () => {
      const { loadingDrive } = createComposable()
      expect(loadingDrive.value).toBe(true)
    })

    it('driveListTransition a leaving=false et pendingLeaves=0 au démarrage', () => {
      const { driveListTransition } = createComposable()
      expect(driveListTransition.value.leaving).toBe(false)
      expect(driveListTransition.value.pendingLeaves).toBe(0)
    })
  })

  describe('folderTree', () => {
    it('folderTree a folder_id === "root" au démarrage', () => {
      const { folderTree } = createComposable()
      expect(folderTree.value.folder_id).toBe('root')
    })

    it('folderTree a isExpanded === true au démarrage', () => {
      const { folderTree } = createComposable()
      expect(folderTree.value.isExpanded).toBe(true)
    })

    it('folderTree a metadata.folder_name === "Mon Drive" au démarrage', () => {
      const { folderTree } = createComposable()
      expect(folderTree.value.metadata.folder_name).toBe('Mon Drive')
    })

    it('folderTree a children vide au démarrage', () => {
      const { folderTree } = createComposable()
      expect(folderTree.value.children).toEqual([])
    })

    it('folderTree a isLoaded === false au démarrage', () => {
      const { folderTree } = createComposable()
      expect(folderTree.value.isLoaded).toBe(false)
    })
  })

  describe('applyDriveItemsForDisplay', () => {
    it('sans outIn : met à jour directement displayedDriveItems', async () => {
      const { applyDriveItemsForDisplay, displayedDriveItems } = createComposable()
      const items = [{ file_id: 'f1', type: 'file' }, { file_id: 'f2', type: 'file' }]
      await applyDriveItemsForDisplay(items)
      expect(displayedDriveItems.value).toEqual(items)
    })

    it('sans outIn : met également à jour liste_decrypted_items', async () => {
      const { applyDriveItemsForDisplay, liste_decrypted_items } = createComposable()
      const items = [{ file_id: 'f1', type: 'file' }]
      await applyDriveItemsForDisplay(items)
      expect(liste_decrypted_items.value).toEqual(items)
    })

    it('avec outIn et displayedDriveItems vide : met à jour directement sans transition', async () => {
      const { applyDriveItemsForDisplay, displayedDriveItems, driveListTransition } = createComposable()
      const items = [{ file_id: 'f1', type: 'file' }]
      await applyDriveItemsForDisplay(items, { outIn: true })
      // displayedDriveItems est vide au départ → mise à jour directe
      expect(displayedDriveItems.value).toEqual(items)
      expect(driveListTransition.value.leaving).toBe(false)
    })

    it('avec outIn et displayedDriveItems non vide : déclenche la transition leaving', async () => {
      const { applyDriveItemsForDisplay, displayedDriveItems, driveListTransition } = createComposable()
      // Pré-remplir displayedDriveItems
      await applyDriveItemsForDisplay([{ file_id: 'existing', type: 'file' }])
      expect(displayedDriveItems.value.length).toBe(1)

      const newItems = [{ file_id: 'f2', type: 'file' }]
      // Ne pas await : la transition est en cours
      applyDriveItemsForDisplay(newItems, { outIn: true })
      await nextTick()
      // leaving doit être true (transition déclenchée)
      expect(driveListTransition.value.leaving).toBe(true)
    })

    it('avec outIn et liste vide : queuedItems null après mise à jour directe', async () => {
      const { applyDriveItemsForDisplay, displayedDriveItems } = createComposable()
      const items = [{ file_id: 'f1', type: 'file' }]
      await applyDriveItemsForDisplay(items, { outIn: true })
      expect(displayedDriveItems.value).toEqual(items)
    })
  })

  describe('onFileListAfterLeave', () => {
    it('ignore si dataset.itemGroup !== "drive"', async () => {
      const { onFileListAfterLeave, driveListTransition } = createComposable()
      driveListTransition.value.leaving = true
      driveListTransition.value.pendingLeaves = 1
      const el = { dataset: { itemGroup: 'other' } }
      await onFileListAfterLeave(el)
      // pendingLeaves ne doit pas avoir diminué
      expect(driveListTransition.value.pendingLeaves).toBe(1)
    })

    it('ignore si leaving === false', async () => {
      const { onFileListAfterLeave, driveListTransition } = createComposable()
      driveListTransition.value.leaving = false
      driveListTransition.value.pendingLeaves = 2
      const el = { dataset: { itemGroup: 'drive' } }
      await onFileListAfterLeave(el)
      // pendingLeaves ne doit pas avoir changé
      expect(driveListTransition.value.pendingLeaves).toBe(2)
    })

    it('décrémente pendingLeaves si el.dataset.itemGroup === "drive" et leaving === true', async () => {
      const { onFileListAfterLeave, driveListTransition } = createComposable()
      driveListTransition.value.leaving = true
      driveListTransition.value.pendingLeaves = 3
      const el = { dataset: { itemGroup: 'drive' } }
      await onFileListAfterLeave(el)
      expect(driveListTransition.value.pendingLeaves).toBe(2)
    })

    it('vide la file et remet leaving à false quand pendingLeaves atteint 0', async () => {
      const { onFileListAfterLeave, driveListTransition } = createComposable()
      driveListTransition.value.leaving = true
      driveListTransition.value.pendingLeaves = 1
      const el = { dataset: { itemGroup: 'drive' } }
      await onFileListAfterLeave(el)
      await nextTick()
      expect(driveListTransition.value.leaving).toBe(false)
    })
  })

  describe('navigateToBreadcrumb', () => {
    it('appelle router.push et addNotification si index !== dernier item', () => {
      const { navigateToBreadcrumb, full_path, router, addNotification } = createComposable()
      full_path.value = [
        { folder_id: 'folder-1', metadata: { folder_name: 'Documents' } },
        { folder_id: 'folder-2', metadata: { folder_name: 'Sous-dossier' } },
      ]
      navigateToBreadcrumb(full_path.value[0], 0)
      expect(router.push).toHaveBeenCalledWith('/drive?folder_id=folder-1')
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Navigation' }),
      )
    })

    it('ne fait rien si index === dernier item du breadcrumb', () => {
      const { navigateToBreadcrumb, full_path, router, addNotification } = createComposable()
      full_path.value = [
        { folder_id: 'folder-1', metadata: { folder_name: 'Documents' } },
        { folder_id: 'folder-2', metadata: { folder_name: 'Sous-dossier' } },
      ]
      navigateToBreadcrumb(full_path.value[1], 1)
      expect(router.push).not.toHaveBeenCalled()
      expect(addNotification).not.toHaveBeenCalled()
    })

    it('ne fait rien si folder_id est absent du pathItem', () => {
      const { navigateToBreadcrumb, full_path, router } = createComposable()
      full_path.value = [
        { metadata: { folder_name: 'Sans ID' } },
        { folder_id: 'folder-2', metadata: { folder_name: 'Fin' } },
      ]
      navigateToBreadcrumb(full_path.value[0], 0)
      expect(router.push).not.toHaveBeenCalled()
    })
  })

  describe('onBreadcrumbWheel', () => {
    it('modifie scrollLeft du breadcrumb ref en fonction de deltaY', () => {
      const { onBreadcrumbWheel, breadcrumbRef } = createComposable()
      // Simuler un élément DOM avec scrollLeft
      const mockBreadcrumb = { scrollLeft: 0 }
      breadcrumbRef.value = mockBreadcrumb as unknown as HTMLElement

      const event = { deltaY: 50 }
      onBreadcrumbWheel(event)
      expect(mockBreadcrumb.scrollLeft).toBe(50)
    })

    it('ne fait rien si breadcrumbRef est null', () => {
      const { onBreadcrumbWheel, breadcrumbRef } = createComposable()
      breadcrumbRef.value = null
      // Ne doit pas lever d'erreur
      expect(() => onBreadcrumbWheel({ deltaY: 100 })).not.toThrow()
    })

    it('scrollLeft augmente avec deltaY positif', () => {
      const { onBreadcrumbWheel, breadcrumbRef } = createComposable()
      const mockBreadcrumb = { scrollLeft: 100 }
      breadcrumbRef.value = mockBreadcrumb as unknown as HTMLElement

      onBreadcrumbWheel({ deltaY: 30 })
      expect(mockBreadcrumb.scrollLeft).toBe(130)
    })

    it('scrollLeft diminue avec deltaY négatif', () => {
      const { onBreadcrumbWheel, breadcrumbRef } = createComposable()
      const mockBreadcrumb = { scrollLeft: 100 }
      breadcrumbRef.value = mockBreadcrumb as unknown as HTMLElement

      onBreadcrumbWheel({ deltaY: -40 })
      expect(mockBreadcrumb.scrollLeft).toBe(60)
    })
  })

  describe('loadTreeNode et arbre', () => {
    it('charge les sous-dossiers du noeud et décrypte leurs métadonnées', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          folder_contents: [
            {
              type: 'folder',
              folder_id: 'folder-a',
              parent_folder_id: null,
              encrypted_metadata: 'enc-meta-a',
              encrypted_folder_key: 'enc-key-a',
            },
            {
              type: 'folder',
              folder_id: 'folder-ignored',
              parent_folder_id: 'other-parent',
              encrypted_metadata: 'enc-meta-b',
              encrypted_folder_key: 'enc-key-b',
            },
            { type: 'file', file_id: 'file-1' },
          ],
        }),
      })
      vi.mocked(decryptSimpleDataWithDataKey).mockResolvedValue('{"folder_name":"Documents"}')

      const { loadTreeNode, folderTree } = createComposable()
      await loadTreeNode(folderTree.value)

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/get_folder/root', { method: 'GET' })
      expect(folderTree.value.children).toHaveLength(1)
      expect(folderTree.value.children[0]).toMatchObject({
        folder_id: 'folder-a',
        metadata: { folder_name: 'Documents', encrypted_data_key: 'enc-key-a' },
      })
      expect(folderTree.value.isLoaded).toBe(true)
      expect(folderTree.value.isLoading).toBe(false)
    })

    it('préserve l état d expansion et les enfants existants si preserveExpanded=true', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          folder_contents: [
            {
              type: 'folder',
              folder_id: 'folder-a',
              parent_folder_id: null,
              encrypted_metadata: 'enc-meta-a',
              encrypted_folder_key: 'enc-key-a',
            },
          ],
        }),
      })

      const { loadTreeNode, folderTree } = createComposable()
      folderTree.value.children = [
        {
          folder_id: 'folder-a',
          children: [{ folder_id: 'nested-a' }],
          isExpanded: true,
          isLoaded: true,
        },
      ]

      await loadTreeNode(folderTree.value, true)

      expect(folderTree.value.children[0].isExpanded).toBe(true)
      expect(folderTree.value.children[0].isLoaded).toBe(true)
      expect(folderTree.value.children[0].children).toEqual([{ folder_id: 'nested-a' }])
    })

    it('toggleFolderNode charge le noeud quand il devient expanded', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ folder_contents: [] }),
      })

      const { toggleFolderNode } = createComposable()
      const node = {
        folder_id: 'folder-a',
        children: [],
        isExpanded: false,
        isLoaded: false,
        isLoading: false,
      }

      await toggleFolderNode(node)

      expect(node.isExpanded).toBe(true)
      expect(node.isLoaded).toBe(true)
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/get_folder/folder-a', { method: 'GET' })
    })

    it('refreshTreeNode ne fait rien si le noeud est introuvable', async () => {
      const { refreshTreeNode, folderTree } = createComposable()
      folderTree.value.children = []

      await refreshTreeNode('missing-folder')

      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })

    it('selectFolderFromTree met à jour le dossier actif et pousse la route', async () => {
      const { selectFolderFromTree, activeFolderId, router } = createComposable()

      await selectFolderFromTree({ folder_id: 'folder-z' })

      expect(activeFolderId.value).toBe('folder-z')
      expect(router.push).toHaveBeenCalledWith('/drive?folder_id=folder-z')
    })
  })

  describe('loadPath et get_all_info', () => {
    it('charge la corbeille avec uniquement les fichiers et met à jour le breadcrumb', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files_and_folders: {
            files: [
              {
                type: 'file',
                file_id: 'file-trash',
                encrypted_metadata: 'enc-file-meta',
                encrypted_file_key: 'enc-file-key',
              },
            ],
            folders: [
              {
                type: 'folder',
                folder_id: 'folder-trash',
                encrypted_metadata: 'enc-folder-meta',
                encrypted_folder_key: 'enc-folder-key',
              },
            ],
          },
          full_path: [],
          folder_contents: [],
          drive_info: { used_space: 42, storage_limit_bytes: 4096 },
        }),
      })
      vi.mocked(decryptSimpleDataWithDataKey).mockResolvedValue('{"filename":"trashed.txt"}')

      const { activeFolderId, loadPath, full_path, liste_decrypted_items, usedSpace } = createComposable()
      activeFolderId.value = 'corbeille'
      await loadPath()
      await flushAsyncState()

      expect(full_path.value).toEqual([
        { folder_id: 'corbeille', metadata: { folder_name: 'Corbeille' } },
      ])
      expect(liste_decrypted_items.value).toHaveLength(1)
      expect(usedSpace.value).toBe(42)
    })

    it('charge shared_with_me avec fichiers et dossiers', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files_and_folders: {
            files: [
              {
                type: 'file',
                file_id: 'shared-file',
                encrypted_metadata: 'enc-file-meta',
                encrypted_file_key: 'enc-file-key',
              },
            ],
            folders: [
              {
                type: 'folder',
                folder_id: 'shared-folder',
                encrypted_metadata: 'enc-folder-meta',
                encrypted_folder_key: 'enc-folder-key',
              },
            ],
          },
          full_path: [],
          folder_contents: [],
          drive_info: { used_space: 12, storage_limit_bytes: 2048 },
        }),
      })
      vi.mocked(decryptSimpleDataWithDataKey)
        .mockResolvedValueOnce('{"folder_name":"Projet partagé"}')
        .mockResolvedValueOnce('{"filename":"spec.pdf"}')

      const { activeFolderId, loadPath, full_path, liste_decrypted_items } = createComposable()
      activeFolderId.value = 'shared_with_me'
      await loadPath()
      await flushAsyncState()

      expect(full_path.value).toEqual([
        { folder_id: 'shared_with_me', metadata: { folder_name: 'Partagés avec moi' } },
      ])
      expect(liste_decrypted_items.value).toHaveLength(2)
    })

    it('redirige vers root si full_path est vide pour un dossier non-root', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files_and_folders: { folders: [], files: [] },
          full_path: [],
          folder_contents: [],
          drive_info: { used_space: 0, storage_limit_bytes: 1024 },
        }),
      })

      const { activeFolderId, loadPath, router } = createComposable()
      activeFolderId.value = 'missing-folder'
      await loadPath()

      expect(activeFolderId.value).toBe('root')
      expect(router.push).toHaveBeenCalledWith('/drive?folder_id=root')
    })

    it('retire de listUploaded les placeholders du dossier courant', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          files_and_folders: { folders: [], files: [] },
          full_path: [
            {
              folder_id: 'folder-a',
              encrypted_metadata: 'enc-path-meta',
              encrypted_folder_key: 'enc-path-key',
            },
          ],
          folder_contents: [],
          drive_info: { used_space: 0, storage_limit_bytes: 1024 },
        }),
      })

      const composable = createComposable()
      composable.activeFolderId.value = 'folder-a'
      composable.listUploaded.value = [
        { _targetFolderId: 'folder-a', name: 'remove-me' },
        { _targetFolderId: 'folder-b', name: 'keep-me' },
      ]

      await composable.loadPath()

      expect(composable.listUploaded.value).toEqual([
        { _targetFolderId: 'folder-b', name: 'keep-me' },
      ])
    })

    it('get_all_info charge les infos globales puis loadPath quand le dossier reste root', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ used_space: 7, storage_limit_bytes: 777 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            files_and_folders: { folders: [], files: [] },
            full_path: [
              {
                folder_id: 'root',
                encrypted_metadata: 'enc-path-meta',
                encrypted_folder_key: 'enc-path-key',
              },
            ],
            drive_info: { used_space: 7, storage_limit_bytes: 777 },
          }),
        })

      const { get_all_info, loadingDrive, usedSpace, maxspace } = createComposable()
      await get_all_info()

      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(1, '/drive/get_drive_info', { method: 'GET' })
      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(2, '/drive/get_file_folder/root', { method: 'GET' })
      expect(usedSpace.value).toBe(7)
      expect(maxspace.value).toBe(777)
      expect(loadingDrive.value).toBe(false)
    })
  })
})
