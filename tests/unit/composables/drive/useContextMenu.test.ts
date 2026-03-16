import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useContextMenu } from '@/composables/drive/useContextMenu'

describe('useContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('état initial', () => {
    it('contextMenuVisible commence à false', () => {
      const { contextMenuVisible } = useContextMenu()
      expect(contextMenuVisible.value).toBe(false)
    })
  })
})
