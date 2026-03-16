import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, watch } from 'vue'
import { useTransfers } from '@/composables/drive/useTransfers'

// useTransfers.js utilise `watch` comme auto-import Nuxt (pas d'import ES)
vi.stubGlobal('watch', watch)

vi.mock('@/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
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

vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(new Blob()),
  })),
}))

function createComposable() {
  const addNotification = vi.fn()
  const activeFolderId = ref('root')
  const loadPath = vi.fn()
  const liste_decrypted_items = ref([])
  return {
    addNotification,
    activeFolderId,
    loadPath,
    liste_decrypted_items,
    ...useTransfers({ API_URL: '/api', activeFolderId, loadPath, liste_decrypted_items, addNotification }),
  }
}

describe('useTransfers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('état initial', () => {
    it('listToUpload est vide', () => {
      const { listToUpload } = createComposable()
      expect(listToUpload.value).toEqual([])
    })

    it('listUploadInProgress est vide', () => {
      const { listUploadInProgress } = createComposable()
      expect(listUploadInProgress.value).toEqual([])
    })

    it('listUploaded est vide', () => {
      const { listUploaded } = createComposable()
      expect(listUploaded.value).toEqual([])
    })

    it('fileProgressMap est vide', () => {
      const { fileProgressMap } = createComposable()
      expect(fileProgressMap.value).toEqual({})
    })

    it('isPanelCollapsed est false', () => {
      const { isPanelCollapsed } = createComposable()
      expect(isPanelCollapsed.value).toBe(false)
    })

    it('allTransfersPaused est false', () => {
      const { allTransfersPaused } = createComposable()
      expect(allTransfersPaused.value).toBe(false)
    })
  })

  describe('formatSpeed', () => {
    it('retourne "" pour 0', () => {
      const { formatSpeed } = createComposable()
      expect(formatSpeed(0)).toBe('')
    })

    it('retourne "" pour undefined', () => {
      const { formatSpeed } = createComposable()
      expect(formatSpeed(undefined)).toBe('')
    })

    it('retourne "512.0 o/s" pour 512 bytes/s', () => {
      const { formatSpeed } = createComposable()
      expect(formatSpeed(512)).toBe('512.0 o/s')
    })

    it('retourne "1.0 Ko/s" pour 1024 bytes/s', () => {
      const { formatSpeed } = createComposable()
      expect(formatSpeed(1024)).toBe('1.0 Ko/s')
    })

    it('retourne "1.0 Mo/s" pour 1024*1024 bytes/s', () => {
      const { formatSpeed } = createComposable()
      expect(formatSpeed(1024 * 1024)).toBe('1.0 Mo/s')
    })
  })

  describe('formatETA', () => {
    it('retourne "" pour 0', () => {
      const { formatETA } = createComposable()
      expect(formatETA(0)).toBe('')
    })

    it('retourne "" pour undefined', () => {
      const { formatETA } = createComposable()
      expect(formatETA(undefined)).toBe('')
    })

    it('retourne "" pour Infinity', () => {
      const { formatETA } = createComposable()
      expect(formatETA(Infinity)).toBe('')
    })

    it('retourne "30s restantes" pour 30 secondes', () => {
      const { formatETA } = createComposable()
      expect(formatETA(30)).toBe('30s restantes')
    })

    it('retourne "2min restantes" pour 120 secondes', () => {
      const { formatETA } = createComposable()
      expect(formatETA(120)).toBe('2min restantes')
    })

    it('retourne "1h restantes" pour 3600 secondes', () => {
      const { formatETA } = createComposable()
      expect(formatETA(3600)).toBe('1h restantes')
    })
  })

  describe('getTransferStatus', () => {
    it('retourne "En pause" si transferId est dans pausedTransfers', () => {
      const { getTransferStatus, togglePauseTransfer } = createComposable()
      togglePauseTransfer('transfer-1')
      expect(getTransferStatus('transfer-1', 'upload')).toBe('En pause')
    })

    it('retourne "Terminé" si progress >= 100', () => {
      const { getTransferStatus, fileProgressMap } = createComposable()
      fileProgressMap.value['transfer-2'] = 100
      expect(getTransferStatus('transfer-2', 'upload')).toBe('Terminé')
    })

    it('retourne "En cours" si progress > 0', () => {
      const { getTransferStatus, fileProgressMap } = createComposable()
      fileProgressMap.value['transfer-3'] = 50
      expect(getTransferStatus('transfer-3', 'upload')).toBe('En cours')
    })

    it('retourne "En attente" si progress === 0', () => {
      const { getTransferStatus, fileProgressMap } = createComposable()
      fileProgressMap.value['transfer-4'] = 0
      expect(getTransferStatus('transfer-4', 'upload')).toBe('En attente')
    })

    it('retourne "En attente" si progress est undefined', () => {
      const { getTransferStatus } = createComposable()
      expect(getTransferStatus('transfer-unknown', 'upload')).toBe('En attente')
    })
  })

  describe('isPaused', () => {
    it('retourne false initialement', () => {
      const { isPaused } = createComposable()
      expect(isPaused('transfer-1')).toBe(false)
    })

    it('retourne true après togglePauseTransfer', () => {
      const { isPaused, togglePauseTransfer } = createComposable()
      togglePauseTransfer('transfer-1')
      expect(isPaused('transfer-1')).toBe(true)
    })
  })

  describe('togglePauseTransfer', () => {
    it('met en pause un transfert non pausé', () => {
      const { togglePauseTransfer, isPaused } = createComposable()
      togglePauseTransfer('transfer-1')
      expect(isPaused('transfer-1')).toBe(true)
    })

    it('reprend un transfert pausé', () => {
      const { togglePauseTransfer, isPaused } = createComposable()
      togglePauseTransfer('transfer-1')
      expect(isPaused('transfer-1')).toBe(true)
      togglePauseTransfer('transfer-1')
      expect(isPaused('transfer-1')).toBe(false)
    })
  })

  describe('resumeAllTransfers', () => {
    it('vide pausedTransfers et met allTransfersPaused à false', () => {
      const { resumeAllTransfers, togglePauseTransfer, isPaused, allTransfersPaused } = createComposable()
      togglePauseTransfer('transfer-1')
      togglePauseTransfer('transfer-2')
      allTransfersPaused.value = true

      resumeAllTransfers()

      expect(isPaused('transfer-1')).toBe(false)
      expect(isPaused('transfer-2')).toBe(false)
      expect(allTransfersPaused.value).toBe(false)
    })
  })

  describe('cancelDownload', () => {
    it('retire le téléchargement de listDownloadInProgress', () => {
      const { cancelDownload, listDownloadInProgress } = createComposable()
      listDownloadInProgress.value.push({ name: 'fichier.pdf', _downloadId: 'dl-1' })
      cancelDownload('dl-1')
      expect(listDownloadInProgress.value.find(d => d._downloadId === 'dl-1')).toBeUndefined()
    })

    it('nettoie downloadProgressMap', () => {
      const { cancelDownload, listDownloadInProgress, downloadProgressMap } = createComposable()
      listDownloadInProgress.value.push({ name: 'fichier.pdf', _downloadId: 'dl-1' })
      downloadProgressMap.value['dl-1'] = 42
      cancelDownload('dl-1')
      expect(downloadProgressMap.value['dl-1']).toBeUndefined()
    })

    it('appelle addNotification', () => {
      const { cancelDownload, listDownloadInProgress, addNotification } = createComposable()
      listDownloadInProgress.value.push({ name: 'fichier.pdf', _downloadId: 'dl-1' })
      cancelDownload('dl-1')
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Téléchargement annulé' }),
      )
    })

    it('ne plante pas si le downloadId n\'est pas dans la liste', () => {
      const { cancelDownload } = createComposable()
      expect(() => cancelDownload('dl-inexistant')).not.toThrow()
    })
  })

  describe('togglePanelCollapse', () => {
    it('bascule isPanelCollapsed de false à true', () => {
      const { togglePanelCollapse, isPanelCollapsed } = createComposable()
      expect(isPanelCollapsed.value).toBe(false)
      togglePanelCollapse()
      expect(isPanelCollapsed.value).toBe(true)
    })

    it('bascule isPanelCollapsed de true à false', () => {
      const { togglePanelCollapse, isPanelCollapsed } = createComposable()
      togglePanelCollapse()
      expect(isPanelCollapsed.value).toBe(true)
      togglePanelCollapse()
      expect(isPanelCollapsed.value).toBe(false)
    })
  })
})
