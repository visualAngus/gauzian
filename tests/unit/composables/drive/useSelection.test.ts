import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSelection } from '@/composables/drive/useSelection'

describe('useSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('état initial', () => {
    it('selectedItems commence vide', () => {
      const { selectedItems } = useSelection()
      expect(selectedItems.value.size).toBe(0)
    })

    it('selectedItemsMap commence vide', () => {
      const { selectedItemsMap } = useSelection()
      expect(selectedItemsMap.value.size).toBe(0)
    })
  })

  describe('selectItem', () => {
    it("sélectionne un item de type 'file' (utilise file_id) sans Ctrl", () => {
      const { selectedItems, selectedItemsMap, selectItem } = useSelection()
      const file = { type: 'file', file_id: 'f1', name: 'document.pdf' }
      selectItem(file, { ctrlKey: false, metaKey: false })
      expect(selectedItems.value.has('f1')).toBe(true)
      expect(selectedItemsMap.value.get('f1')).toEqual(file)
    })

    it("sélectionne un item de type 'folder' (utilise folder_id) sans Ctrl", () => {
      const { selectedItems, selectedItemsMap, selectItem } = useSelection()
      const folder = { type: 'folder', folder_id: 'dir1', name: 'Dossier' }
      selectItem(folder, { ctrlKey: false, metaKey: false })
      expect(selectedItems.value.has('dir1')).toBe(true)
      expect(selectedItemsMap.value.get('dir1')).toEqual(folder)
    })

    it('remplace la sélection précédente sans Ctrl', () => {
      const { selectedItems, selectedItemsMap, selectItem } = useSelection()
      const file1 = { type: 'file', file_id: 'f1', name: 'premier.pdf' }
      const file2 = { type: 'file', file_id: 'f2', name: 'second.pdf' }
      selectItem(file1, { ctrlKey: false, metaKey: false })
      selectItem(file2, { ctrlKey: false, metaKey: false })
      expect(selectedItems.value.size).toBe(1)
      expect(selectedItems.value.has('f2')).toBe(true)
      expect(selectedItems.value.has('f1')).toBe(false)
      expect(selectedItemsMap.value.size).toBe(1)
    })

    it('ajoute un item à la sélection existante avec ctrlKey: true', () => {
      const { selectedItems, selectedItemsMap, selectItem } = useSelection()
      const file1 = { type: 'file', file_id: 'f1', name: 'premier.pdf' }
      const file2 = { type: 'file', file_id: 'f2', name: 'second.pdf' }
      selectItem(file1, { ctrlKey: false, metaKey: false })
      selectItem(file2, { ctrlKey: true, metaKey: false })
      expect(selectedItems.value.size).toBe(2)
      expect(selectedItems.value.has('f1')).toBe(true)
      expect(selectedItems.value.has('f2')).toBe(true)
      expect(selectedItemsMap.value.size).toBe(2)
    })

    it('désélectionne un item déjà sélectionné avec ctrlKey: true', () => {
      const { selectedItems, selectedItemsMap, selectItem } = useSelection()
      const file = { type: 'file', file_id: 'f1', name: 'document.pdf' }
      selectItem(file, { ctrlKey: false, metaKey: false })
      expect(selectedItems.value.has('f1')).toBe(true)
      selectItem(file, { ctrlKey: true, metaKey: false })
      expect(selectedItems.value.has('f1')).toBe(false)
      expect(selectedItemsMap.value.has('f1')).toBe(false)
    })

    it('ajoute un item avec metaKey: true', () => {
      const { selectedItems, selectItem } = useSelection()
      const file1 = { type: 'file', file_id: 'f1', name: 'premier.pdf' }
      const file2 = { type: 'file', file_id: 'f2', name: 'second.pdf' }
      selectItem(file1, { ctrlKey: false, metaKey: false })
      selectItem(file2, { ctrlKey: false, metaKey: true })
      expect(selectedItems.value.size).toBe(2)
      expect(selectedItems.value.has('f1')).toBe(true)
      expect(selectedItems.value.has('f2')).toBe(true)
    })
  })

  describe('clearSelection', () => {
    it('vide selectedItems et selectedItemsMap', () => {
      const { selectedItems, selectedItemsMap, selectItem, clearSelection } = useSelection()
      const file = { type: 'file', file_id: 'f1', name: 'document.pdf' }
      selectItem(file, { ctrlKey: false, metaKey: false })
      expect(selectedItems.value.size).toBe(1)
      clearSelection()
      expect(selectedItems.value.size).toBe(0)
      expect(selectedItemsMap.value.size).toBe(0)
    })
  })
})
