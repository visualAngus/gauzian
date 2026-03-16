import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useInfoPanel } from '@/composables/drive/useInfoPanel'

vi.mock('@/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ shared_users: [] }),
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
  const selectedItemsMap = ref(new Map())
  const formatBytes = vi.fn().mockReturnValue('1.5 MB')
  const addNotification = vi.fn()
  const clearSelection = vi.fn()
  const renameItem = vi.fn()
  const downloadFile = vi.fn()
  const deleteItem = vi.fn()
  const shareItem = vi.fn()

  return {
    selectedItemsMap,
    formatBytes,
    addNotification,
    clearSelection,
    renameItem,
    downloadFile,
    deleteItem,
    shareItem,
    ...useInfoPanel({
      selectedItemsMap,
      formatBytes,
      addNotification,
      clearSelection,
      renameItem,
      downloadFile,
      deleteItem,
      shareItem,
    }),
  }
}

describe('useInfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('état initial', () => {
    it('infoPanelVisible est false', () => {
      const { infoPanelVisible } = createComposable()
      expect(infoPanelVisible.value).toBe(false)
    })

    it('infoItemData est null', () => {
      const { infoItemData } = createComposable()
      expect(infoItemData.value).toBeNull()
    })
  })

  describe('closeInfoPanel', () => {
    it('met infoPanelVisible à false', async () => {
      const { closeInfoPanel, infoPanelVisible, selectedItemsMap, openInfoPanel } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      await openInfoPanel()
      expect(infoPanelVisible.value).toBe(true)
      closeInfoPanel()
      expect(infoPanelVisible.value).toBe(false)
    })

    it('met infoItemData à null', async () => {
      const { closeInfoPanel, infoItemData, selectedItemsMap, openInfoPanel } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      await openInfoPanel()
      closeInfoPanel()
      expect(infoItemData.value).toBeNull()
    })

    it('appelle clearSelection', () => {
      const { closeInfoPanel, clearSelection } = createComposable()
      closeInfoPanel()
      expect(clearSelection).toHaveBeenCalledTimes(1)
    })
  })

  describe('openInfoPanel', () => {
    it('ne fait rien si selectedItemsMap est vide', async () => {
      const { openInfoPanel, infoPanelVisible } = createComposable()
      await openInfoPanel()
      expect(infoPanelVisible.value).toBe(false)
    })

    it('met infoPanelVisible à true si un item est sélectionné', async () => {
      const { openInfoPanel, infoPanelVisible, selectedItemsMap } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'document.pdf', size: 1024 },
      })
      await openInfoPanel()
      expect(infoPanelVisible.value).toBe(true)
    })

    it('construit infoItemData avec le nom du fichier', async () => {
      const { openInfoPanel, infoItemData, selectedItemsMap } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'rapport.pdf', size: 2048 },
      })
      await openInfoPanel()
      expect(infoItemData.value?.name).toBe('rapport.pdf')
    })
  })

  describe('handleDownloadItem', () => {
    it('appelle downloadFile si item est de type "file"', () => {
      const { handleDownloadItem, downloadFile, selectedItemsMap } = createComposable()
      const fileItem = { type: 'file', file_id: 'file-1', metadata: { filename: 'doc.pdf' } }
      selectedItemsMap.value.set('file-1', fileItem)
      handleDownloadItem('file-1')
      expect(downloadFile).toHaveBeenCalledWith(fileItem)
    })

    it('appelle addNotification si item est de type "folder"', () => {
      const { handleDownloadItem, addNotification, downloadFile, selectedItemsMap } = createComposable()
      selectedItemsMap.value.set('folder-1', {
        type: 'folder',
        folder_id: 'folder-1',
        metadata: { folder_name: 'Documents' },
      })
      handleDownloadItem('folder-1')
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Téléchargement' }),
      )
      expect(downloadFile).not.toHaveBeenCalled()
    })

    it('ne fait rien si item non trouvé dans selectedItemsMap', () => {
      const { handleDownloadItem, downloadFile, addNotification } = createComposable()
      handleDownloadItem('id-inexistant')
      expect(downloadFile).not.toHaveBeenCalled()
      expect(addNotification).not.toHaveBeenCalled()
    })
  })

  describe('handleDeleteItem', () => {
    it('appelle addNotification si element DOM non trouvé', () => {
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(null) })
      const { handleDeleteItem, addNotification, selectedItemsMap } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      handleDeleteItem('file-1')
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Erreur' }),
      )
    })

    it('ne fait rien si item non trouvé dans selectedItemsMap', () => {
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(null) })
      const { handleDeleteItem, addNotification, deleteItem } = createComposable()
      handleDeleteItem('id-inexistant')
      expect(addNotification).not.toHaveBeenCalled()
      expect(deleteItem).not.toHaveBeenCalled()
    })
  })

  describe('handleRenameItem', () => {
    it('appelle addNotification si element DOM non trouvé', () => {
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(null) })
      const { handleRenameItem, addNotification, selectedItemsMap } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      handleRenameItem('file-1')
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Erreur' }),
      )
    })

    it('ne fait rien si item non trouvé dans selectedItemsMap', () => {
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(null) })
      const { handleRenameItem, addNotification, renameItem } = createComposable()
      handleRenameItem('id-inexistant')
      expect(addNotification).not.toHaveBeenCalled()
      expect(renameItem).not.toHaveBeenCalled()
    })
  })

  describe('handleShareItem', () => {
    it('appelle addNotification si element DOM non trouvé', () => {
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(null) })
      const { handleShareItem, addNotification, selectedItemsMap } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      handleShareItem('file-1')
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Erreur' }),
      )
    })

    it('ne fait rien si item non trouvé dans selectedItemsMap', () => {
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(null) })
      const { handleShareItem, addNotification, shareItem } = createComposable()
      handleShareItem('id-inexistant')
      expect(addNotification).not.toHaveBeenCalled()
      expect(shareItem).not.toHaveBeenCalled()
    })

    it('appelle shareItem si element DOM trouvé', () => {
      const mockEl = { dataset: {} }
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(mockEl) })
      const { handleShareItem, shareItem, selectedItemsMap, infoPanelVisible } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      handleShareItem('file-1')
      expect(shareItem).toHaveBeenCalledWith(mockEl)
      expect(infoPanelVisible.value).toBe(false)
    })
  })

  describe('handleDeleteItem', () => {
    it('appelle deleteItem si element DOM trouvé', () => {
      const mockEl = { dataset: {} }
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(mockEl) })
      const { handleDeleteItem, deleteItem, selectedItemsMap, infoPanelVisible } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      handleDeleteItem('file-1')
      expect(deleteItem).toHaveBeenCalledWith(mockEl)
      expect(infoPanelVisible.value).toBe(false)
    })
  })

  describe('handleRenameItem', () => {
    it('appelle renameItem si element DOM trouvé', () => {
      const mockEl = { dataset: {} }
      vi.stubGlobal('document', { querySelector: vi.fn().mockReturnValue(mockEl) })
      const { handleRenameItem, renameItem, selectedItemsMap, infoPanelVisible } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf', encrypted_file_key: 'key-enc' },
      })
      handleRenameItem('file-1')
      expect(renameItem).toHaveBeenCalledWith(mockEl)
      expect(infoPanelVisible.value).toBe(false)
    })
  })

  describe('handleRevokeAccess', () => {
    it('appelle fetchWithAuth et addNotification après révocation', async () => {
      const { handleRevokeAccess, infoItemData, addNotification, selectedItemsMap, openInfoPanel } = createComposable()
      selectedItemsMap.value.set('file-1', {
        type: 'file',
        file_id: 'file-1',
        metadata: { filename: 'doc.pdf' },
      })
      await openInfoPanel()
      // infoItem.value should have id set
      const sharedUser = { username: 'alice', user_id: 'user-alice' }
      handleRevokeAccess(sharedUser)
      // fetchWithAuth is called async, use nextTick
      await new Promise(r => setTimeout(r, 10))
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Partage' }),
      )
    })

    it('ne fait rien si infoItem.value est null', () => {
      const { handleRevokeAccess, addNotification } = createComposable()
      handleRevokeAccess({ username: 'alice', user_id: 'user-1' })
      expect(addNotification).not.toHaveBeenCalled()
    })
  })
})
