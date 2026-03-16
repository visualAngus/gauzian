import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, watch } from 'vue'
import { useTransfers } from '@/composables/drive/useTransfers'
import { useFetchWithAuth } from '@/composables/useFetchWithAuth'
import { useAutoShare } from '@/composables/drive/useAutoShare'
import {
  decryptSimpleDataWithDataKey,
  decryptWithStoredPrivateKey,
  encryptSimpleDataWithDataKey,
  encryptWithStoredPublicKey,
  generateDataKey,
} from '@/utils/crypto'

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
  default: vi.fn().mockImplementation(function() {
    return {
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new Blob()),
    }
  }),
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
  let mockFetchWithAuth: ReturnType<typeof vi.fn>
  let propagateFileAccess: ReturnType<typeof vi.fn>
  let mockDownloadAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchWithAuth = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    })
    propagateFileAccess = vi.fn().mockResolvedValue({ success: true })

    vi.mocked(useFetchWithAuth).mockReturnValue({ fetchWithAuth: mockFetchWithAuth })
    vi.mocked(useAutoShare).mockReturnValue({ propagateFileAccess })
    vi.mocked(generateDataKey).mockResolvedValue(new Uint8Array([1, 2, 3]))
    vi.mocked(encryptWithStoredPublicKey).mockResolvedValue('encrypted-file-key')
    vi.mocked(encryptSimpleDataWithDataKey).mockResolvedValue('encrypted-metadata')
    vi.mocked(decryptWithStoredPrivateKey).mockResolvedValue(new Uint8Array([9, 9, 9]))
    vi.mocked(decryptSimpleDataWithDataKey).mockResolvedValue('{"filename":"test.txt","size":12,"mime_type":"text/plain"}')

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    vi.stubGlobal('alert', vi.fn())
    vi.stubGlobal('encryptDataWithDataKeyRaw', vi.fn().mockResolvedValue({
      cipherBytes: new Uint8Array([1, 2, 3]),
      iv: 'iv-value',
    }))
    vi.stubGlobal('decryptDataWithDataKeyRaw', vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])))
    vi.stubGlobal('TransformStream', vi.fn().mockImplementation(function() {
      return {
        readable: 'mock-readable',
        writable: {
          getWriter: () => ({
            write: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
            abort: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }
    }))
    vi.stubGlobal('Response', vi.fn().mockImplementation(function() {
      return {
        blob: vi.fn().mockResolvedValue(new Blob(['decrypted-content'])),
      }
    }))
    mockDownloadAnchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    ;(URL as typeof URL & { createObjectURL: ReturnType<typeof vi.fn> }).createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    ;(URL as typeof URL & { revokeObjectURL: ReturnType<typeof vi.fn> }).revokeObjectURL = vi.fn()
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(mockDownloadAnchor),
      body: { appendChild: vi.fn() },
    })
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

  describe('updateTransferStats', () => {
    it('initialise les timestamps au premier appel', () => {
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000)
      const { updateTransferStats, transferSpeeds, transferETAs } = createComposable()

      updateTransferStats('transfer-1', 10, 1000)

      expect(transferSpeeds.value['transfer-1']).toBeUndefined()
      expect(transferETAs.value['transfer-1']).toBeUndefined()
      nowSpy.mockRestore()
    })

    it('calcule vitesse et ETA après un delta de temps suffisant', () => {
      const nowSpy = vi.spyOn(Date, 'now')
      nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(3000)

      const { updateTransferStats, transferSpeeds, transferETAs } = createComposable()
      updateTransferStats('transfer-2', 10, 1000)
      updateTransferStats('transfer-2', 60, 1000)

      expect(transferSpeeds.value['transfer-2']).toBeGreaterThan(0)
      expect(transferETAs.value['transfer-2']).toBeGreaterThan(0)
      nowSpy.mockRestore()
    })
  })

  describe('pauseAllTransfers', () => {
    it('marque tous les uploads et téléchargements comme pausés', () => {
      const { pauseAllTransfers, listUploadInProgress, listDownloadInProgress, allTransfersPaused, isPaused } = createComposable()
      listUploadInProgress.value = [{ _uploadId: 'up-1' }, { _uploadId: 'up-2' }]
      listDownloadInProgress.value = [{ _downloadId: 'down-1' }]

      pauseAllTransfers()

      expect(allTransfersPaused.value).toBe(true)
      expect(isPaused('up-1')).toBe(true)
      expect(isPaused('up-2')).toBe(true)
      expect(isPaused('down-1')).toBe(true)
    })
  })

  describe('cancelAllTransfers', () => {
    it('ne fait rien si confirm retourne false', () => {
      vi.mocked(confirm).mockReturnValue(false)
      const { cancelAllTransfers, listToUpload } = createComposable()
      listToUpload.value = [{ name: 'pending.txt' }]

      cancelAllTransfers()

      expect(listToUpload.value).toHaveLength(1)
    })

    it('vide la file d attente et annule les transferts en cours', async () => {
      const { cancelAllTransfers, listToUpload, listUploadInProgress, listDownloadInProgress } = createComposable()
      listToUpload.value = [{ _uploadId: 'queued-1', name: 'queued.txt' }]
      listUploadInProgress.value = [{ _uploadId: 'up-1', name: 'uploading.txt' }]
      listDownloadInProgress.value = [{ _downloadId: 'down-1', name: 'downloading.txt' }]

      cancelAllTransfers()
      await Promise.resolve()

      expect(listToUpload.value).toEqual([])
      expect(listUploadInProgress.value).toEqual([])
      expect(listDownloadInProgress.value).toEqual([])
    })
  })

  describe('initializeFileInDB', () => {
    it('initialise un fichier en base et retourne son file_id ainsi que la dataKey', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ file_id: 'file-123' }),
      })
      const { initializeFileInDB } = createComposable()
      const file = { name: 'doc.txt', size: 12, type: 'text/plain', lastModified: 1700000000000 }

      const [fileId, dataKey] = await initializeFileInDB(file as File, 'root')

      expect(fileId).toBe('file-123')
      expect(dataKey).toEqual(new Uint8Array([1, 2, 3]))
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/initialize_file', {
        method: 'POST',
        body: JSON.stringify({
          encrypted_metadata: 'encrypted-metadata',
          encrypted_file_key: 'encrypted-file-key',
          size: 12,
          mime_type: 'text/plain',
          folder_id: 'root',
        }),
      })
      expect(propagateFileAccess).not.toHaveBeenCalled()
    })

    it('propage les permissions si le dossier cible n est pas root', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ file_id: 'file-456' }),
      })
      const { initializeFileInDB } = createComposable()
      const file = { name: 'shared.txt', size: 8, type: 'text/plain', lastModified: 1700000000000 }

      await initializeFileInDB(file as File, 'folder-1')

      expect(propagateFileAccess).toHaveBeenCalledWith('file-456', 'folder-1', new Uint8Array([1, 2, 3]))
    })
  })

  describe('abort_upload', () => {
    it('nettoie l état local, notifie et appelle l API serveur', async () => {
      mockFetchWithAuth.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { abort_upload, abortControllers, listUploadInProgress, listToUpload, listUploaded, fileProgressMap, transferSpeeds, transferETAs } = createComposable()
      const abort = vi.fn()
      abortControllers.value['upload-1'] = { abort } as AbortController
      listUploadInProgress.value = [{ _uploadId: 'upload-1', name: 'photo.png' }]
      listToUpload.value = [{ _uploadId: 'upload-1', name: 'photo.png' }]
      listUploaded.value = [{ _uploadId: 'upload-1', name: 'photo.png' }]
      fileProgressMap.value['upload-1'] = 40
      transferSpeeds.value['upload-1'] = 200
      transferETAs.value['upload-1'] = 5

      await abort_upload('upload-1')

      expect(abort).toHaveBeenCalled()
      expect(listUploadInProgress.value).toEqual([])
      expect(listToUpload.value).toEqual([])
      expect(listUploaded.value).toEqual([])
      expect(fileProgressMap.value['upload-1']).toBeUndefined()
      expect(transferSpeeds.value['upload-1']).toBeUndefined()
      expect(transferETAs.value['upload-1']).toBeUndefined()
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/abort_upload', {
        method: 'POST',
        body: JSON.stringify({ file_id: 'upload-1' }),
      })
    })
  })

  describe('uploadFile', () => {
    it('uploade un chunk puis finalise le fichier', async () => {
      vi.useFakeTimers()
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })

      const { uploadFile, fileProgressMap, abortControllers } = createComposable()
      const file = {
        name: 'tiny.txt',
        size: 3,
        slice: vi.fn().mockReturnValue(new Blob(['abc'])),
      }

      const promise = uploadFile(file as unknown as File, 'file-789', new Uint8Array([7, 8, 9]))
      await vi.advanceTimersByTimeAsync(60)
      await promise
      vi.useRealTimers()

      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(1, '/drive/files/file-789/upload-chunk', expect.objectContaining({ method: 'POST' }))
      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(2, '/drive/finalize_upload/file-789/completed', { method: 'POST' })
      expect(fileProgressMap.value['file-789']).toBe(100)
      expect(abortControllers.value['file-789']).toBeUndefined()
    })
  })

  describe('downloadFile', () => {
    it('récupère les infos, déchiffre les chunks et déclenche le lien de téléchargement', async () => {
      const chunkHeaders = { get: (key: string) => key === 'x-chunk-iv' ? 'test-iv' : null }
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            encrypted_file_key: 'enc-file-key',
            encrypted_metadata: 'enc-metadata',
            chunks: [{ s3_key: 'bucket/path/chunk.bin' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: chunkHeaders,
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(6)),
        })
      vi.mocked(decryptWithStoredPrivateKey).mockResolvedValue(new Uint8Array([9, 0, 1]))
      vi.mocked(decryptSimpleDataWithDataKey).mockResolvedValue('{"filename":"doc.pdf","size":100,"mime_type":"application/pdf"}')

      const { downloadFile, addNotification, listDownloadInProgress } = createComposable()
      const item = { file_id: 'file-abc', metadata: { filename: 'doc.pdf' } }

      await downloadFile(item)
      // Flush remaining microtasks from the fire-and-forget chunk-writing IIFE
      await new Promise(r => setTimeout(r, 0))

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/file/file-abc', expect.objectContaining({ method: 'GET' }))
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/drive/download_chunk_binary/bucket%2Fpath%2Fchunk.bin',
        expect.objectContaining({ method: 'GET' }),
      )
      expect((URL as typeof URL & { createObjectURL: ReturnType<typeof vi.fn> }).createObjectURL).toHaveBeenCalled()
      expect(mockDownloadAnchor.click).toHaveBeenCalled()
      expect((URL as typeof URL & { revokeObjectURL: ReturnType<typeof vi.fn> }).revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      expect(listDownloadInProgress.value).toEqual([])
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Téléchargement terminé' }))
    })

    it('notifie avec une erreur si la requête de fichier échoue', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) })

      const { downloadFile, addNotification, listDownloadInProgress } = createComposable()
      const item = { file_id: 'file-fail', metadata: { filename: 'fail.pdf' } }

      await downloadFile(item)

      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur de téléchargement' }))
      expect(listDownloadInProgress.value).toEqual([])
    })
  })

  describe('downloadFolderAsZip', () => {
    it('télécharge un dossier en ZIP avec ses fichiers déchiffrés', async () => {
      const chunkHeaders = { get: (key: string) => key === 'x-chunk-iv' ? 'folder-iv' : null }
      mockFetchWithAuth
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            contents: [
              {
                type: 'file',
                encrypted_file_key: 'enc-key',
                encrypted_metadata: 'enc-meta',
                chunks: [{ s3_key: 'folder/chunk1.bin' }],
                path: 'docs/',
                mime_type: 'text/plain',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: chunkHeaders,
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
        })
      vi.mocked(decryptWithStoredPrivateKey).mockResolvedValue(new Uint8Array([9, 0, 1]))
      vi.mocked(decryptSimpleDataWithDataKey).mockResolvedValue('{"filename":"report.txt","size":50}')

      const { downloadFolderAsZip, addNotification, listDownloadInProgress } = createComposable()

      await downloadFolderAsZip('folder-zip', 'MonDossier')
      await new Promise(r => setTimeout(r, 0))

      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(1, '/drive/folder_contents/folder-zip', expect.objectContaining({ method: 'GET' }))
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        '/drive/download_chunk_binary/folder%2Fchunk1.bin',
        expect.objectContaining({ method: 'GET' }),
      )
      expect((URL as typeof URL & { createObjectURL: ReturnType<typeof vi.fn> }).createObjectURL).toHaveBeenCalled()
      expect(mockDownloadAnchor.click).toHaveBeenCalled()
      expect(listDownloadInProgress.value).toEqual([])
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Téléchargement terminé' }))
    })

    it('notifie avec une erreur si la récupération du contenu échoue', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({ ok: false, json: vi.fn().mockResolvedValue({}) })

      const { downloadFolderAsZip, addNotification, listDownloadInProgress } = createComposable()

      await downloadFolderAsZip('folder-err', 'ErrDossier')

      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur de téléchargement' }))
      expect(listDownloadInProgress.value).toEqual([])
    })
  })
})
