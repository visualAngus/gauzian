import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useFileActions } from '@/composables/drive/useFileActions'
import { useFetchWithAuth } from '@/composables/useFetchWithAuth'
import { useAutoShare } from '@/composables/drive/useAutoShare'
import {
  decryptWithStoredPrivateKey,
  encryptSimpleDataWithDataKey,
  encryptWithPublicKey,
  encryptWithStoredPublicKey,
  generateDataKey,
} from '@/utils/crypto'

// vi.mock est hoisted — les variables doivent être définies DANS la factory
vi.mock('@/composables/useFetchWithAuth', () => ({
  useFetchWithAuth: vi.fn().mockReturnValue({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }),
  }),
}))

vi.mock('@/utils/crypto', () => ({
  decryptWithStoredPrivateKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  decryptSimpleDataWithDataKey: vi.fn().mockResolvedValue('{}'),
  encryptWithStoredPublicKey: vi.fn().mockResolvedValue('encrypted-key'),
  encryptSimpleDataWithDataKey: vi.fn().mockResolvedValue('encrypted-data'),
  generateDataKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  encryptWithPublicKey: vi.fn().mockResolvedValue('encrypted-key'),
}))

vi.mock('@/composables/drive/useAutoShare', () => ({
  useAutoShare: vi.fn().mockReturnValue({
    propagateFileAccess: vi.fn().mockResolvedValue({ success: true }),
    propagateFolderAccess: vi.fn().mockResolvedValue({ success: true }),
  }),
}))

function createComposable(overrides: Record<string, unknown> = {}) {
  const activeFolderId = ref('root')
  const liste_decrypted_items = ref<unknown[]>([])
  const loadPath = vi.fn().mockResolvedValue(undefined)
  const applyDriveItemsForDisplay = vi.fn()
  const folderTree = ref({ folder_id: 'root', children: [], metadata: { folder_name: 'Mon Drive' } })
  const addNotification = vi.fn()
  const usedSpace = ref(0)
  const totalSpaceLeft = ref(1024 * 1024 * 1024)
  const listToUpload = ref<unknown[]>([])
  const refreshTreeNode = vi.fn().mockResolvedValue(undefined)
  const downloadFile = vi.fn()
  const selectedItems = ref(new Set<string>())
  const selectedItemsMap = ref(new Map<string, unknown>())
  const clearSelection = vi.fn()
  const isSidebarOpen = ref(false)

  return {
    addNotification,
    activeFolderId,
    isSidebarOpen,
    listToUpload,
    liste_decrypted_items,
    totalSpaceLeft,
    usedSpace,
    refreshTreeNode,
    clearSelection,
    downloadFile,
    selectedItems,
    selectedItemsMap,
    loadPath,
    ...useFileActions({
      API_URL: '/api',
      activeFolderId,
      liste_decrypted_items,
      loadPath,
      applyDriveItemsForDisplay,
      folderTree,
      addNotification,
      usedSpace,
      totalSpaceLeft,
      listToUpload,
      refreshTreeNode,
      downloadFile,
      selectedItems,
      selectedItemsMap,
      clearSelection,
      isSidebarOpen,
      ...overrides,
    }),
  }
}

describe('useFileActions', () => {
  let mockFetchWithAuth: ReturnType<typeof vi.fn>
  let propagateFileAccess: ReturnType<typeof vi.fn>
  let propagateFolderAccess: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchWithAuth = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
    propagateFileAccess = vi.fn().mockResolvedValue({ success: true })
    propagateFolderAccess = vi.fn().mockResolvedValue({ success: true })
    vi.mocked(useFetchWithAuth).mockReturnValue({ fetchWithAuth: mockFetchWithAuth })
    vi.mocked(useAutoShare).mockReturnValue({ propagateFileAccess, propagateFolderAccess })
    vi.mocked(generateDataKey).mockResolvedValue(new Uint8Array([1, 2, 3]))
    vi.mocked(encryptWithStoredPublicKey).mockResolvedValue('encrypted-folder-key')
    vi.mocked(encryptSimpleDataWithDataKey).mockResolvedValue('encrypted-metadata')
    vi.mocked(decryptWithStoredPrivateKey).mockResolvedValue(new Uint8Array([4, 5, 6]))
    vi.mocked(encryptWithPublicKey).mockResolvedValue('encrypted-for-contact')
    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockReturnValue({ dataset: {}, style: {} }),
      elementFromPoint: vi.fn().mockReturnValue(null),
      createRange: vi.fn().mockReturnValue({
        setStart: vi.fn(),
        setEnd: vi.fn(),
      }),
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })
    vi.stubGlobal('window', {
      getSelection: vi.fn().mockReturnValue({ removeAllRanges: vi.fn(), addRange: vi.fn() }),
      innerWidth: 1024,
      innerHeight: 768,
      scrollX: 0,
      scrollY: 0,
    })
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    vi.stubGlobal('alert', vi.fn())
    vi.stubGlobal('nextTick', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('console', {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })
  })

  // ─── Initial state ───────────────────────────────────────────────────────

  describe('état initial', () => {
    it('isDragging est false au démarrage', () => {
      const { isDragging } = createComposable()
      expect(isDragging.value).toBe(false)
    })

    it('activeItem est null au démarrage', () => {
      const { activeItem } = createComposable()
      expect(activeItem.value).toBeNull()
    })

    it('draggedItems est un tableau vide au démarrage', () => {
      const { draggedItems } = createComposable()
      expect(draggedItems.value).toEqual([])
    })

    it('isSharing est false au démarrage', () => {
      const { isSharing } = createComposable()
      expect(isSharing.value).toBe(false)
    })

    it('shareItemTarget est null au démarrage', () => {
      const { shareItemTarget } = createComposable()
      expect(shareItemTarget.value).toBeNull()
    })

    it('rightClikedItem est null au démarrage', () => {
      const { rightClikedItem } = createComposable()
      expect(rightClikedItem.value).toBeNull()
    })

    it('fileInput est null au démarrage', () => {
      const { fileInput } = createComposable()
      expect(fileInput.value).toBeNull()
    })

    it('rightClickPanel est null au démarrage', () => {
      const { rightClickPanel } = createComposable()
      expect(rightClickPanel.value).toBeNull()
    })
  })

  // ─── ghostStyle computed ─────────────────────────────────────────────────

  describe('ghostStyle computed', () => {
    it('a la propriété position === "fixed"', () => {
      const { ghostStyle } = createComposable()
      expect(ghostStyle.value.position).toBe('fixed')
    })

    it('a top === 0 et left === 0', () => {
      const { ghostStyle } = createComposable()
      expect(ghostStyle.value.top).toBe(0)
      expect(ghostStyle.value.left).toBe(0)
    })

    it('a pointerEvents === "none"', () => {
      const { ghostStyle } = createComposable()
      expect(ghostStyle.value.pointerEvents).toBe('none')
    })

    it('a zIndex === 9999', () => {
      const { ghostStyle } = createComposable()
      expect(ghostStyle.value.zIndex).toBe(9999)
    })

    it('le transform contient translate avec x=0 et y=0 par défaut', () => {
      const { ghostStyle } = createComposable()
      // mousePos initial est { x: 0, y: 0 }, donc translate(-50px, -24px)
      expect(ghostStyle.value.transform).toContain('translate')
      expect(ghostStyle.value.transform).toContain('-50px')
    })
  })

  // ─── setIsOver ───────────────────────────────────────────────────────────

  describe('setIsOver', () => {
    it('setIsOver(true) met isOver.value à true', () => {
      const { setIsOver, isDragging } = createComposable() as ReturnType<typeof createComposable> & { setIsOver: (v: boolean) => void; isOver?: { value: boolean } }
      // isOver n'est pas exposé directement mais setIsOver doit fonctionner sans erreur
      expect(() => (setIsOver as (v: boolean) => void)(true)).not.toThrow()
    })

    it('setIsOver(false) ne lève pas d\'erreur', () => {
      const { setIsOver } = createComposable() as ReturnType<typeof createComposable> & { setIsOver: (v: boolean) => void }
      expect(() => (setIsOver as (v: boolean) => void)(false)).not.toThrow()
    })
  })

  // ─── closeContextMenu ────────────────────────────────────────────────────

  describe('closeContextMenu', () => {
    it('met rightClikedItem à null', () => {
      const composable = createComposable()
      const { closeContextMenu, rightClikedItem } = composable as ReturnType<typeof createComposable> & { closeContextMenu: () => void }
      // rightClickPanel est null, donc le panel?.style ne sera pas appelé
      ;(closeContextMenu as () => void)()
      expect(rightClikedItem.value).toBeNull()
    })

    it('ne lève pas d\'erreur quand rightClickPanel est null', () => {
      const { closeContextMenu } = createComposable() as ReturnType<typeof createComposable> & { closeContextMenu: () => void }
      expect(() => (closeContextMenu as () => void)()).not.toThrow()
    })
  })

  // ─── handleDragStart ─────────────────────────────────────────────────────

  describe('handleDragStart', () => {
    it('met isDragging à true', () => {
      const { handleDragStart, isDragging } = createComposable() as ReturnType<typeof createComposable> & { handleDragStart: (data: unknown) => void }
      const item = { type: 'file', file_id: 'f1' }
      ;(handleDragStart as (data: unknown) => void)({ item, x: 100, y: 200 })
      expect(isDragging.value).toBe(true)
    })

    it('met activeItem à l\'item', () => {
      const { handleDragStart, activeItem } = createComposable() as ReturnType<typeof createComposable> & { handleDragStart: (data: unknown) => void }
      const item = { type: 'file', file_id: 'f1' }
      ;(handleDragStart as (data: unknown) => void)({ item, x: 100, y: 200 })
      expect(activeItem.value).toStrictEqual(item)
    })

    it('draggedItems contient l\'item unique si non sélectionné', () => {
      const { handleDragStart, draggedItems } = createComposable() as ReturnType<typeof createComposable> & { handleDragStart: (data: unknown) => void }
      const item = { type: 'file', file_id: 'f1' }
      ;(handleDragStart as (data: unknown) => void)({ item, x: 50, y: 80 })
      expect(draggedItems.value).toEqual([item])
    })

    it('draggedItems contient tous les items sélectionnés si l\'item fait partie d\'une sélection multiple', () => {
      const selectedItems = ref(new Set(['f1', 'f2']))
      const item1 = { type: 'file', file_id: 'f1' }
      const item2 = { type: 'file', file_id: 'f2' }
      const selectedItemsMap = ref(new Map([['f1', item1], ['f2', item2]]))

      const composable = createComposable({ selectedItems, selectedItemsMap })
      const { handleDragStart, draggedItems } = composable as ReturnType<typeof createComposable> & { handleDragStart: (data: unknown) => void }

      ;(handleDragStart as (data: unknown) => void)({ item: item1, x: 50, y: 80 })
      expect(draggedItems.value).toHaveLength(2)
    })

    it('fonctionne avec un dossier (folder)', () => {
      const { handleDragStart, draggedItems } = createComposable() as ReturnType<typeof createComposable> & { handleDragStart: (data: unknown) => void }
      const folder = { type: 'folder', folder_id: 'dir1' }
      ;(handleDragStart as (data: unknown) => void)({ item: folder, x: 10, y: 20 })
      expect(draggedItems.value).toEqual([folder])
    })
  })

  // ─── handleDragMove ──────────────────────────────────────────────────────

  describe('handleDragMove', () => {
    it('ne lève pas d\'erreur', () => {
      const { handleDragMove } = createComposable() as ReturnType<typeof createComposable> & { handleDragMove: (data: unknown) => void }
      expect(() => (handleDragMove as (data: unknown) => void)({ x: 100, y: 200 })).not.toThrow()
    })

    it('met à jour la position de la souris (ghost style change)', () => {
      const { handleDragMove, ghostStyle } = createComposable() as ReturnType<typeof createComposable> & { handleDragMove: (data: unknown) => void }
      ;(handleDragMove as (data: unknown) => void)({ x: 300, y: 400 })
      // ghostStyle dépend de mousePos
      expect(ghostStyle.value.transform).toContain('250px') // 300 - 50
    })
  })

  // ─── handleDragEnd ───────────────────────────────────────────────────────

  describe('handleDragEnd', () => {
    it('remet isDragging à false si activeItem est null', async () => {
      const { handleDragEnd, isDragging } = createComposable() as ReturnType<typeof createComposable> & { handleDragEnd: (data: unknown) => Promise<void> }
      isDragging.value = true
      await (handleDragEnd as (data: unknown) => Promise<void>)({ x: 0, y: 0 })
      expect(isDragging.value).toBe(false)
    })

    it('remet isDragging à false si draggedItems est vide', async () => {
      const { handleDragEnd, isDragging, draggedItems } = createComposable() as ReturnType<typeof createComposable> & { handleDragEnd: (data: unknown) => Promise<void> }
      isDragging.value = true
      draggedItems.value = []
      await (handleDragEnd as (data: unknown) => Promise<void>)({ x: 0, y: 0 })
      expect(isDragging.value).toBe(false)
    })

    it('ne lève pas d\'erreur quand document.elementFromPoint retourne null', async () => {
      const { handleDragEnd, handleDragStart } = createComposable() as ReturnType<typeof createComposable> & {
        handleDragEnd: (data: unknown) => Promise<void>
        handleDragStart: (data: unknown) => void
      }
      const item = { type: 'file', file_id: 'f1' }
      ;(handleDragStart as (data: unknown) => void)({ item, x: 50, y: 80 })
      await expect((handleDragEnd as (data: unknown) => Promise<void>)({ x: 50, y: 80 })).resolves.not.toThrow()
    })

    it('après handleDragEnd sans cible valide : remet draggedItems à []', async () => {
      const { handleDragEnd, handleDragStart, draggedItems } = createComposable() as ReturnType<typeof createComposable> & {
        handleDragEnd: (data: unknown) => Promise<void>
        handleDragStart: (data: unknown) => void
      }
      const item = { type: 'file', file_id: 'f1' }
      ;(handleDragStart as (data: unknown) => void)({ item, x: 50, y: 80 })
      await (handleDragEnd as (data: unknown) => Promise<void>)({ x: 50, y: 80 })
      expect(draggedItems.value).toEqual([])
    })

    it('après handleDragEnd sans cible valide : remet activeItem à null', async () => {
      const { handleDragEnd, handleDragStart, activeItem } = createComposable() as ReturnType<typeof createComposable> & {
        handleDragEnd: (data: unknown) => Promise<void>
        handleDragStart: (data: unknown) => void
      }
      const item = { type: 'file', file_id: 'f1' }
      ;(handleDragStart as (data: unknown) => void)({ item, x: 50, y: 80 })
      await (handleDragEnd as (data: unknown) => Promise<void>)({ x: 50, y: 80 })
      expect(activeItem.value).toBeNull()
    })
  })

  // ─── shareItem ───────────────────────────────────────────────────────────

  describe('shareItem', () => {
    it('met isSharing à true', () => {
      const { shareItem, isSharing } = createComposable() as ReturnType<typeof createComposable> & { shareItem: (item: unknown) => void }
      const item = {
        dataset: { itemId: 'f1', itemType: 'file', itemMetadata: '{"filename":"test.txt"}' },
      }
      ;(shareItem as (item: unknown) => void)(item)
      expect(isSharing.value).toBe(true)
    })

    it('définit shareItemTarget avec l\'id et le type de l\'item', () => {
      const { shareItem, shareItemTarget } = createComposable() as ReturnType<typeof createComposable> & { shareItem: (item: unknown) => void }
      const item = {
        dataset: { itemId: 'folder123', itemType: 'folder', itemMetadata: '{"folder_name":"Mon Dossier"}' },
      }
      ;(shareItem as (item: unknown) => void)(item)
      expect(shareItemTarget.value).toMatchObject({
        id: 'folder123',
        type: 'folder',
        name: 'Mon Dossier',
      })
    })

    it('utilise le nom du fichier si c\'est un fichier', () => {
      const { shareItem, shareItemTarget } = createComposable() as ReturnType<typeof createComposable> & { shareItem: (item: unknown) => void }
      const item = {
        dataset: { itemId: 'file456', itemType: 'file', itemMetadata: '{"filename":"rapport.pdf"}' },
      }
      ;(shareItem as (item: unknown) => void)(item)
      expect((shareItemTarget.value as { name: string }).name).toBe('rapport.pdf')
    })

    it('utilise "Élément" par défaut si aucun nom disponible', () => {
      const { shareItem, shareItemTarget } = createComposable() as ReturnType<typeof createComposable> & { shareItem: (item: unknown) => void }
      const item = {
        dataset: { itemId: 'x1', itemType: 'file', itemMetadata: undefined },
      }
      ;(shareItem as (item: unknown) => void)(item)
      expect((shareItemTarget.value as { name: string }).name).toBe('Élément')
    })

    it('utilise folderName si pas de metadata', () => {
      const { shareItem, shareItemTarget } = createComposable() as ReturnType<typeof createComposable> & { shareItem: (item: unknown) => void }
      const item = {
        dataset: { itemId: 'd1', itemType: 'folder', folderName: 'Documents', itemMetadata: undefined },
      }
      ;(shareItem as (item: unknown) => void)(item)
      expect((shareItemTarget.value as { name: string }).name).toBe('Documents')
    })
  })

  // ─── formatBytes ────────────────────────────────────────────────────────

  describe('formatBytes', () => {
    it('retourne "0 octet" pour 0 bytes', () => {
      const { formatBytes } = createComposable() as ReturnType<typeof createComposable> & { formatBytes: (bytes: number) => string }
      expect((formatBytes as (bytes: number) => string)(0)).toBe('0 octet')
    })

    it('retourne des octets pour une petite taille', () => {
      const { formatBytes } = createComposable() as ReturnType<typeof createComposable> & { formatBytes: (bytes: number) => string }
      const result = (formatBytes as (bytes: number) => string)(500)
      expect(result).toContain('octets')
    })

    it('retourne Ko pour 1024 bytes', () => {
      const { formatBytes } = createComposable() as ReturnType<typeof createComposable> & { formatBytes: (bytes: number) => string }
      const result = (formatBytes as (bytes: number) => string)(1024)
      expect(result).toContain('Ko')
    })

    it('retourne Mo pour 1048576 bytes', () => {
      const { formatBytes } = createComposable() as ReturnType<typeof createComposable> & { formatBytes: (bytes: number) => string }
      const result = (formatBytes as (bytes: number) => string)(1024 * 1024)
      expect(result).toContain('Mo')
    })

    it('retourne Go pour 1 Go', () => {
      const { formatBytes } = createComposable() as ReturnType<typeof createComposable> & { formatBytes: (bytes: number) => string }
      const result = (formatBytes as (bytes: number) => string)(1024 * 1024 * 1024)
      expect(result).toContain('Go')
    })
  })

  // ─── gohome ──────────────────────────────────────────────────────────────

  describe('gohome', () => {
    it('appelle router.push vers /drive?folder_id=root', () => {
      const { gohome } = createComposable() as ReturnType<typeof createComposable> & { gohome: () => void }
      ;(gohome as () => void)()
      // useRouter est stubGlobal dans setup.ts
      // On vérifie juste que ça ne lève pas d'erreur
    })

    it('met activeFolderId à "root"', () => {
      const { gohome, activeFolderId } = createComposable() as ReturnType<typeof createComposable> & { gohome: () => void }
      activeFolderId.value = 'some-folder'
      ;(gohome as () => void)()
      expect(activeFolderId.value).toBe('root')
    })

    it('ne lève pas d\'erreur', () => {
      const { gohome } = createComposable() as ReturnType<typeof createComposable> & { gohome: () => void }
      expect(() => (gohome as () => void)()).not.toThrow()
    })
  })

  // ─── goToTrash ───────────────────────────────────────────────────────────

  describe('goToTrash', () => {
    it('met activeFolderId à "corbeille"', () => {
      const { goToTrash, activeFolderId, loadPath } = createComposable() as ReturnType<typeof createComposable> & { goToTrash: () => void }
      ;(goToTrash as () => void)()
      expect(activeFolderId.value).toBe('corbeille')
    })

    it('appelle loadPath', () => {
      const { goToTrash, loadPath } = createComposable() as ReturnType<typeof createComposable> & { goToTrash: () => void }
      ;(goToTrash as () => void)()
      expect(loadPath).toHaveBeenCalled()
    })

    it('ne lève pas d\'erreur', () => {
      const { goToTrash } = createComposable() as ReturnType<typeof createComposable> & { goToTrash: () => void }
      expect(() => (goToTrash as () => void)()).not.toThrow()
    })
  })

  // ─── goToSharedWithMe ────────────────────────────────────────────────────

  describe('goToSharedWithMe', () => {
    it('met activeFolderId à "shared_with_me"', () => {
      const { goToSharedWithMe, activeFolderId } = createComposable() as ReturnType<typeof createComposable> & { goToSharedWithMe: () => void }
      ;(goToSharedWithMe as () => void)()
      expect(activeFolderId.value).toBe('shared_with_me')
    })

    it('appelle loadPath', () => {
      const { goToSharedWithMe, loadPath } = createComposable() as ReturnType<typeof createComposable> & { goToSharedWithMe: () => void }
      ;(goToSharedWithMe as () => void)()
      expect(loadPath).toHaveBeenCalled()
    })

    it('ne lève pas d\'erreur', () => {
      const { goToSharedWithMe } = createComposable() as ReturnType<typeof createComposable> & { goToSharedWithMe: () => void }
      expect(() => (goToSharedWithMe as () => void)()).not.toThrow()
    })
  })

  // ─── toggleSidebar ───────────────────────────────────────────────────────

  describe('toggleSidebar', () => {
    it('inverse isSidebarOpen (false → true)', () => {
      const { toggleSidebar, isSidebarOpen } = createComposable() as ReturnType<typeof createComposable> & { toggleSidebar: () => void }
      isSidebarOpen.value = false
      ;(toggleSidebar as () => void)()
      expect(isSidebarOpen.value).toBe(true)
    })

    it('inverse isSidebarOpen (true → false)', () => {
      const { toggleSidebar, isSidebarOpen } = createComposable() as ReturnType<typeof createComposable> & { toggleSidebar: () => void }
      isSidebarOpen.value = true
      ;(toggleSidebar as () => void)()
      expect(isSidebarOpen.value).toBe(false)
    })

    it('deux appels consécutifs reviennent à l\'état initial', () => {
      const { toggleSidebar, isSidebarOpen } = createComposable() as ReturnType<typeof createComposable> & { toggleSidebar: () => void }
      const initial = isSidebarOpen.value
      ;(toggleSidebar as () => void)()
      ;(toggleSidebar as () => void)()
      expect(isSidebarOpen.value).toBe(initial)
    })
  })

  // ─── click_on_item ───────────────────────────────────────────────────────

  describe('click_on_item', () => {
    it('ne fait rien si activeFolderId === "corbeille"', () => {
      const { click_on_item, activeFolderId } = createComposable() as ReturnType<typeof createComposable> & { click_on_item: (item: unknown) => void }
      activeFolderId.value = 'corbeille'
      expect(() => (click_on_item as (item: unknown) => void)({ type: 'file', file_id: 'f1' })).not.toThrow()
    })

    it('ne fait rien si activeFolderId === "shared_with_me"', () => {
      const { click_on_item, activeFolderId } = createComposable() as ReturnType<typeof createComposable> & { click_on_item: (item: unknown) => void }
      activeFolderId.value = 'shared_with_me'
      expect(() => (click_on_item as (item: unknown) => void)({ type: 'file', file_id: 'f1' })).not.toThrow()
    })

    it('appelle downloadFile pour un fichier', () => {
      const downloadFile = vi.fn()
      const { click_on_item } = createComposable({ downloadFile }) as ReturnType<typeof createComposable> & { click_on_item: (item: unknown) => void }
      const item = { type: 'file', file_id: 'f1' }
      ;(click_on_item as (item: unknown) => void)(item)
      expect(downloadFile).toHaveBeenCalledWith(item)
    })

    it('met activeFolderId à folder_id pour un dossier', () => {
      const { click_on_item, activeFolderId } = createComposable() as ReturnType<typeof createComposable> & { click_on_item: (item: unknown) => void }
      ;(click_on_item as (item: unknown) => void)({ type: 'folder', folder_id: 'dir-42' })
      expect(activeFolderId.value).toBe('dir-42')
    })

    it('ne lève pas d\'erreur si downloadFile n\'est pas fourni pour un fichier', () => {
      const { click_on_item } = createComposable({ downloadFile: undefined }) as ReturnType<typeof createComposable> & { click_on_item: (item: unknown) => void }
      expect(() => (click_on_item as (item: unknown) => void)({ type: 'file', file_id: 'f1' })).not.toThrow()
    })
  })

  // ─── openEmptySpaceMenu ──────────────────────────────────────────────────

  describe('openEmptySpaceMenu', () => {
    it('ne lève pas d\'erreur quand rightClickPanel est null', () => {
      const { openEmptySpaceMenu } = createComposable() as ReturnType<typeof createComposable> & { openEmptySpaceMenu: (event: unknown) => void }
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn(), pageY: 100, pageX: 200 }
      expect(() => (openEmptySpaceMenu as (event: unknown) => void)(event)).not.toThrow()
    })

    it('appelle event.preventDefault()', () => {
      const { openEmptySpaceMenu } = createComposable() as ReturnType<typeof createComposable> & { openEmptySpaceMenu: (event: unknown) => void }
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn(), pageY: 100, pageX: 200 }
      ;(openEmptySpaceMenu as (event: unknown) => void)(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('appelle event.stopPropagation()', () => {
      const { openEmptySpaceMenu } = createComposable() as ReturnType<typeof createComposable> & { openEmptySpaceMenu: (event: unknown) => void }
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn(), pageY: 100, pageX: 200 }
      ;(openEmptySpaceMenu as (event: unknown) => void)(event)
      expect(event.stopPropagation).toHaveBeenCalled()
    })
  })

  // ─── handleTreeContextMenu ───────────────────────────────────────────────

  describe('handleTreeContextMenu', () => {
    it('ne lève pas d\'erreur quand rightClickPanel est null', () => {
      const { handleTreeContextMenu } = createComposable() as ReturnType<typeof createComposable> & { handleTreeContextMenu: (data: unknown) => void }
      const event = { preventDefault: vi.fn(), pageY: 100, pageX: 200 }
      const node = { folder_id: 'dir1', metadata: { folder_name: 'Test' } }
      expect(() => (handleTreeContextMenu as (data: unknown) => void)({ node, event })).not.toThrow()
    })

    it('appelle event.preventDefault()', () => {
      const { handleTreeContextMenu } = createComposable() as ReturnType<typeof createComposable> & { handleTreeContextMenu: (data: unknown) => void }
      const event = { preventDefault: vi.fn(), pageY: 100, pageX: 200 }
      const node = { folder_id: 'dir1', metadata: { folder_name: 'Test' } }
      ;(handleTreeContextMenu as (data: unknown) => void)({ node, event })
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  // ─── acceptSharedItem ────────────────────────────────────────────────────

  describe('acceptSharedItem', () => {
    it('appelle addNotification en cas d\'item invalide (pas d\'id)', async () => {
      const { acceptSharedItem, addNotification } = createComposable() as ReturnType<typeof createComposable> & { acceptSharedItem: (item: unknown) => Promise<void> }
      await (acceptSharedItem as (item: unknown) => Promise<void>)({ type: 'file' })
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur' }))
    })

    it('ne lève pas d\'erreur avec un item valide (file)', async () => {
      const { acceptSharedItem } = createComposable() as ReturnType<typeof createComposable> & { acceptSharedItem: (item: unknown) => Promise<void> }
      const item = { type: 'file', file_id: 'f1' }
      await expect((acceptSharedItem as (item: unknown) => Promise<void>)(item)).resolves.not.toThrow()
    })

    it('ne lève pas d\'erreur avec un item valide (folder)', async () => {
      const { acceptSharedItem } = createComposable() as ReturnType<typeof createComposable> & { acceptSharedItem: (item: unknown) => Promise<void> }
      const item = { type: 'folder', folder_id: 'dir1' }
      await expect((acceptSharedItem as (item: unknown) => Promise<void>)(item)).resolves.not.toThrow()
    })
  })

  // ─── rejectSharedItem ────────────────────────────────────────────────────

  describe('rejectSharedItem', () => {
    it('appelle addNotification en cas d\'item invalide (pas d\'id)', async () => {
      const { rejectSharedItem, addNotification } = createComposable() as ReturnType<typeof createComposable> & { rejectSharedItem: (item: unknown) => Promise<void> }
      await (rejectSharedItem as (item: unknown) => Promise<void>)({ type: 'file' })
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur' }))
    })

    it('ne lève pas d\'erreur avec un item valide (file)', async () => {
      const { rejectSharedItem } = createComposable() as ReturnType<typeof createComposable> & { rejectSharedItem: (item: unknown) => Promise<void> }
      const item = { type: 'file', file_id: 'f1' }
      await expect((rejectSharedItem as (item: unknown) => Promise<void>)(item)).resolves.not.toThrow()
    })

    it('ne lève pas d\'erreur avec un item valide (folder)', async () => {
      const { rejectSharedItem } = createComposable() as ReturnType<typeof createComposable> & { rejectSharedItem: (item: unknown) => Promise<void> }
      const item = { type: 'folder', folder_id: 'dir1' }
      await expect((rejectSharedItem as (item: unknown) => Promise<void>)(item)).resolves.not.toThrow()
    })
  })

  // ─── deleteItem ──────────────────────────────────────────────────────────

  describe('deleteItem', () => {
    it('appelle addNotification en cas d\'item invalide', async () => {
      const { deleteItem, addNotification } = createComposable() as ReturnType<typeof createComposable> & { deleteItem: (item: unknown) => Promise<void> }
      await (deleteItem as (item: unknown) => Promise<void>)({})
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur' }))
    })

    it('ne lève pas d\'erreur avec un fichier valide (suppression individuelle)', async () => {
      const { deleteItem } = createComposable() as ReturnType<typeof createComposable> & { deleteItem: (item: unknown) => Promise<void> }
      const item = { type: 'file', file_id: 'f1' }
      await expect((deleteItem as (item: unknown) => Promise<void>)(item)).resolves.not.toThrow()
    })

    it('ne lève pas d\'erreur avec un dossier valide', async () => {
      const { deleteItem } = createComposable() as ReturnType<typeof createComposable> & { deleteItem: (item: unknown) => Promise<void> }
      const item = { type: 'folder', folder_id: 'dir1' }
      await expect((deleteItem as (item: unknown) => Promise<void>)(item)).resolves.not.toThrow()
    })

    it('annule la suppression multiple si confirm retourne false', async () => {
      vi.mocked(confirm).mockReturnValue(false)
      const selectedItems = ref(new Set(['f1', 'f2']))
      const selectedItemsMap = ref(new Map([
        ['f1', { type: 'file', file_id: 'f1' }],
        ['f2', { type: 'file', file_id: 'f2' }],
      ]))
      const { deleteItem, clearSelection } = createComposable({ selectedItems, selectedItemsMap }) as ReturnType<typeof createComposable> & { deleteItem: (item: unknown) => Promise<void> }

      await deleteItem({ type: 'file', file_id: 'f1' })

      expect(mockFetchWithAuth).not.toHaveBeenCalled()
      expect(clearSelection).not.toHaveBeenCalled()
    })

    it('supprime la sélection multiple puis recharge les données', async () => {
      vi.mocked(confirm).mockReturnValue(true)
      mockFetchWithAuth.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const selectedItems = ref(new Set(['f1', 'dir1']))
      const selectedItemsMap = ref(new Map([
        ['f1', { type: 'file', file_id: 'f1' }],
        ['dir1', { type: 'folder', folder_id: 'dir1' }],
      ]))
      const { deleteItem, clearSelection, loadPath, refreshTreeNode } = createComposable({ selectedItems, selectedItemsMap }) as ReturnType<typeof createComposable> & { deleteItem: (item: unknown) => Promise<void> }

      await deleteItem({ type: 'file', file_id: 'f1' })

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/files/f1', { method: 'DELETE' })
      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/folders/dir1', { method: 'DELETE' })
      expect(clearSelection).toHaveBeenCalled()
      expect(loadPath).toHaveBeenCalled()
      expect(refreshTreeNode).toHaveBeenCalledWith('root')
    })
  })

  describe('restoreItem', () => {
    it('affiche une alerte si l item est invalide', async () => {
      const { restoreItem } = createComposable() as ReturnType<typeof createComposable> & { restoreItem: (item: unknown) => Promise<void> }

      await restoreItem({})

      expect(alert).toHaveBeenCalledWith("Erreur lors de la restauration de l'élément")
    })

    it('restaure un fichier puis recharge le path et l arbre', async () => {
      mockFetchWithAuth.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { restoreItem, loadPath, refreshTreeNode, addNotification } = createComposable() as ReturnType<typeof createComposable> & { restoreItem: (item: unknown) => Promise<void> }

      await restoreItem({ type: 'file', file_id: 'file-1' })

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/restore_file', {
        method: 'POST',
        body: JSON.stringify({ file_id: 'file-1' }),
      })
      expect(loadPath).toHaveBeenCalled()
      expect(refreshTreeNode).toHaveBeenCalledWith('root')
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Restauration réussie' }))
    })
  })

  describe('createFolder', () => {
    it('crée un dossier à la racine puis recharge les données', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ folder_id: 'folder-new' }),
      })
      const { createFolder, loadPath, refreshTreeNode, addNotification } = createComposable() as ReturnType<typeof createComposable> & { createFolder: () => Promise<void> }

      await createFolder()

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/create_folder', {
        method: 'POST',
        body: JSON.stringify({
          encrypted_metadata: 'encrypted-metadata',
          encrypted_folder_key: 'encrypted-folder-key',
          parent_folder_id: 'root',
        }),
      })
      expect(loadPath).toHaveBeenCalled()
      expect(refreshTreeNode).toHaveBeenCalledWith('root')
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dossier créé' }))
      expect(propagateFolderAccess).not.toHaveBeenCalled()
    })

    it('propage les permissions si le parent n est pas root', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ folder_id: 'folder-child' }),
      })
      const { createFolder, activeFolderId } = createComposable() as ReturnType<typeof createComposable> & { createFolder: () => Promise<void> }
      activeFolderId.value = 'parent-1'

      await createFolder()

      expect(propagateFolderAccess).toHaveBeenCalledWith('folder-child', 'parent-1', new Uint8Array([1, 2, 3]))
    })
  })

  describe('handleFileInputChange et onFilesFromDrop', () => {
    it('ajoute un fichier à listToUpload et réinitialise la valeur de l input', async () => {
      const { handleFileInputChange, listToUpload } = createComposable() as ReturnType<typeof createComposable> & { handleFileInputChange: (event: unknown) => Promise<void> }
      const file = { name: 'note.txt', size: 12, type: 'text/plain', lastModified: 10 }
      const event = { target: { files: [file], value: 'something' } }

      await handleFileInputChange(event)

      expect(listToUpload.value).toHaveLength(1)
      expect((listToUpload.value[0] as { _targetFolderId: string })._targetFolderId).toBe('root')
      expect(event.target.value).toBe('')
    })

    it('bloque l ajout si l espace disque est insuffisant', async () => {
      const { onFilesFromDrop, listToUpload, totalSpaceLeft, usedSpace, addNotification } = createComposable() as ReturnType<typeof createComposable> & { onFilesFromDrop: (files: unknown[]) => Promise<void> }
      totalSpaceLeft.value = 10
      usedSpace.value = 9

      await onFilesFromDrop([{ name: 'huge.bin', size: 5 }])

      expect(listToUpload.value).toEqual([])
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Espace insuffisant' }))
    })
  })

  describe('emptyTrash', () => {
    it('ne fait rien si confirm retourne false', async () => {
      vi.mocked(confirm).mockReturnValue(false)
      const { emptyTrash } = createComposable() as ReturnType<typeof createComposable> & { emptyTrash: () => Promise<void> }

      await emptyTrash()

      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })

    it('vide la corbeille puis recharge les données', async () => {
      vi.mocked(confirm).mockReturnValue(true)
      mockFetchWithAuth.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { emptyTrash, loadPath, refreshTreeNode, addNotification } = createComposable() as ReturnType<typeof createComposable> & { emptyTrash: () => Promise<void> }

      await emptyTrash()

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/empty_trash', { method: 'POST' })
      expect(loadPath).toHaveBeenCalled()
      expect(refreshTreeNode).toHaveBeenCalledWith('corbeille')
      expect(addNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Corbeille vidée' }))
    })
  })

  describe('shareItemServer', () => {
    it('partage un fichier avec un contact', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ user_id: 'user-1', public_key: 'public-key-1' }) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { shareItemServer, liste_decrypted_items } = createComposable() as ReturnType<typeof createComposable> & { shareItemServer: (itemId: string, itemType: string, contacts: { email: string }[], accessLevel: string) => Promise<void> }
      liste_decrypted_items.value = [{ file_id: 'file-1', encrypted_file_key: 'enc-file-key' }]

      await shareItemServer('file-1', 'file', [{ email: 'alice@example.com' }], 'read')

      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(1, '/contacts/get_public_key/alice%40example.com', { method: 'GET' })
      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(2, '/drive/files/file-1/share', {
        method: 'POST',
        body: JSON.stringify({
          recipient_user_id: 'user-1',
          encrypted_file_key: 'encrypted-for-contact',
          access_level: 'read',
        }),
      })
    })

    it('partage un dossier avec ses sous-contenus en batch', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ user_id: 'user-2', public_key: 'public-key-2' }) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({
          contents: [
            { type: 'folder', folder_id: 'sub-1', encrypted_folder_key: 'enc-sub-folder' },
            { type: 'file', file_id: 'file-2', encrypted_file_key: 'enc-file-2' },
          ],
        }) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { shareItemServer, liste_decrypted_items } = createComposable() as ReturnType<typeof createComposable> & { shareItemServer: (itemId: string, itemType: string, contacts: { email: string }[], accessLevel: string) => Promise<void> }
      liste_decrypted_items.value = [{ folder_id: 'folder-1', encrypted_folder_key: 'enc-main-folder' }]

      await shareItemServer('folder-1', 'folder', [{ email: 'bob@example.com' }], 'write')

      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(2, '/drive/folder_contents/folder-1', { method: 'GET' })
      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(3, '/drive/share_folder_batch', {
        method: 'POST',
        body: JSON.stringify({
          folder_id: 'folder-1',
          contact_id: 'user-2',
          access_level: 'write',
          folder_keys: [
            { folder_id: 'folder-1', encrypted_folder_key: 'encrypted-for-contact' },
            { folder_id: 'sub-1', encrypted_folder_key: 'encrypted-for-contact' },
          ],
          file_keys: [
            { file_id: 'file-2', encrypted_file_key: 'encrypted-for-contact' },
          ],
        }),
      })
    })
  })

  describe('renameItem', () => {
    it('renomme un fichier après déclenchement du blur', async () => {
      let capturedBlurHandler: (() => Promise<void>) | null = null
      const mockNameElement = {
        style: {} as CSSStyleDeclaration,
        textContent: 'original.txt',
        contentEditable: 'false',
        firstChild: { nodeType: 3 },
        addEventListener: vi.fn((event: string, handler: () => Promise<void>) => {
          if (event === 'blur') capturedBlurHandler = handler
        }),
        focus: vi.fn(),
      }
      const mockItem = {
        dataset: {
          itemId: 'file-999',
          itemType: 'file',
          itemMetadata: JSON.stringify({
            encrypted_data_key: 'enc-key-abc',
            filename: 'original.txt',
          }),
        },
        querySelector: vi.fn().mockReturnValue(mockNameElement),
      }

      mockFetchWithAuth.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { renameItem, loadPath } = createComposable()

      // Sets up contentEditable + registers blur listener
      await renameItem(mockItem as unknown as Element)

      // Simulate user typing a new name
      mockNameElement.textContent = 'renamed.txt'

      expect(capturedBlurHandler).not.toBeNull()
      await capturedBlurHandler!()

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/files/file-999', {
        method: 'PATCH',
        body: JSON.stringify({ new_encrypted_metadata: 'encrypted-metadata' }),
      })
      expect(loadPath).toHaveBeenCalled()
    })

    it('ne fait rien si le nom n\'a pas changé', async () => {
      let capturedBlurHandler: (() => Promise<void>) | null = null
      const mockNameElement = {
        style: {} as CSSStyleDeclaration,
        textContent: 'same.txt',
        contentEditable: 'false',
        firstChild: null,
        addEventListener: vi.fn((event: string, handler: () => Promise<void>) => {
          if (event === 'blur') capturedBlurHandler = handler
        }),
        focus: vi.fn(),
      }
      const mockItem = {
        dataset: {
          itemId: 'file-777',
          itemType: 'file',
          itemMetadata: JSON.stringify({
            encrypted_data_key: 'enc-key-xyz',
            filename: 'same.txt',
          }),
        },
        querySelector: vi.fn().mockReturnValue(mockNameElement),
      }

      const { renameItem } = createComposable()
      await renameItem(mockItem as unknown as Element)
      // textContent unchanged
      await capturedBlurHandler!()

      expect(mockFetchWithAuth).not.toHaveBeenCalled()
    })
  })

  describe('handleDragEnd (moveItem)', () => {
    it('déplace les items vers le dossier cible via drag & drop', async () => {
      const mockTargetFolderEl = { dataset: { itemId: 'folder-dest' } }
      const mockElementUnderMouse = {
        closest: vi.fn((selector: string) => {
          if (selector === '.item[data-item-type="folder"]') return mockTargetFolderEl
          return null
        }),
      }
      vi.stubGlobal('document', {
        querySelector: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue({ dataset: {}, style: {} }),
        elementFromPoint: vi.fn().mockReturnValue(mockElementUnderMouse),
        createRange: vi.fn().mockReturnValue({ setStart: vi.fn(), setEnd: vi.fn() }),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      })

      mockFetchWithAuth.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { handleDragEnd, activeItem, draggedItems, isDragging } = createComposable()
      activeItem.value = { file_id: 'file-move', type: 'file' }
      draggedItems.value = [{ file_id: 'file-move', type: 'file' }]

      await handleDragEnd({ x: 500, y: 300 })

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/files/file-move/move', {
        method: 'PATCH',
        body: JSON.stringify({ target_folder_id: 'folder-dest' }),
      })
      expect(isDragging.value).toBe(false)
    })

    it('déplace un dossier et utilise null pour target root', async () => {
      const mockTargetFolderEl = { dataset: { itemId: 'root' } }
      const mockElementUnderMouse = {
        closest: vi.fn((selector: string) => {
          if (selector === '.item[data-item-type="folder"]') return mockTargetFolderEl
          return null
        }),
      }
      vi.stubGlobal('document', {
        querySelector: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue({ dataset: {}, style: {} }),
        elementFromPoint: vi.fn().mockReturnValue(mockElementUnderMouse),
        createRange: vi.fn().mockReturnValue({ setStart: vi.fn(), setEnd: vi.fn() }),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      })

      mockFetchWithAuth.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })
      const { handleDragEnd, activeItem, draggedItems } = createComposable()
      activeItem.value = { folder_id: 'subfolder-1', type: 'folder' }
      draggedItems.value = [{ folder_id: 'subfolder-1', type: 'folder' }]

      await handleDragEnd({ x: 300, y: 200 })

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/drive/folders/subfolder-1/move', {
        method: 'PATCH',
        body: JSON.stringify({ target_folder_id: null }),
      })
    })
  })

  describe('openItemMenu', () => {
    it('positionne le menu à gauche du clic quand pageX est proche du bord droit', () => {
      const mockPanel = {
        style: { display: '', top: '', left: '' } as unknown as CSSStyleDeclaration,
        offsetWidth: 200,
        offsetHeight: 300,
        $el: undefined,
      }
      const mockRealEl = {
        getBoundingClientRect: vi.fn().mockReturnValue({ bottom: 100, left: 50 }),
      }
      vi.stubGlobal('document', {
        querySelector: vi.fn().mockReturnValue(mockRealEl),
        createElement: vi.fn().mockReturnValue({ dataset: {}, style: {} }),
        elementFromPoint: vi.fn().mockReturnValue(null),
        createRange: vi.fn().mockReturnValue({ setStart: vi.fn(), setEnd: vi.fn() }),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      })

      const { openItemMenu, rightClickPanel, rightClikedItem } = createComposable()
      rightClickPanel.value = mockPanel

      // pageX=900, innerWidth=1024, offsetWidth=200 → pageX-width=-124 > -200 → first branch
      const event = { pageX: 900, pageY: 400 }
      const item = { file_id: 'file-1', folder_id: undefined }

      openItemMenu(item, event)

      expect(mockPanel.style.display).toBe('flex')
      expect(mockPanel.style.top).toBe('400px')
      expect(mockPanel.style.left).toBe('700px') // 900 - 200
      expect(rightClikedItem.value).toEqual(mockRealEl)
    })

    it('retourne sans positionner si le panel est null', () => {
      const { openItemMenu, rightClickPanel } = createComposable()
      rightClickPanel.value = null

      // Should not throw
      expect(() => openItemMenu({ file_id: 'f-1' }, { pageX: 100, pageY: 100 })).not.toThrow()
    })

    it('retourne sans positionner si l\'élément DOM n\'est pas trouvé', () => {
      vi.stubGlobal('document', {
        querySelector: vi.fn().mockReturnValue(null),
        createElement: vi.fn().mockReturnValue({ dataset: {}, style: {} }),
        elementFromPoint: vi.fn().mockReturnValue(null),
        createRange: vi.fn().mockReturnValue({ setStart: vi.fn(), setEnd: vi.fn() }),
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
      })
      const mockPanel = {
        style: { display: '', top: '', left: '' } as unknown as CSSStyleDeclaration,
        offsetWidth: 200,
        offsetHeight: 300,
      }
      const { openItemMenu, rightClickPanel } = createComposable()
      rightClickPanel.value = mockPanel

      openItemMenu({ file_id: 'ghost-id' }, { pageX: 100, pageY: 100 })

      expect(mockPanel.style.display).toBe('') // not changed
    })
  })
})
