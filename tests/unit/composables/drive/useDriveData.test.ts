import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDriveData } from '@/composables/drive/useDriveData'

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
    maxspace,
    ...useDriveData(router, API_URL, usedSpace, listUploaded, addNotification, maxspace),
  }
}

describe('useDriveData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
