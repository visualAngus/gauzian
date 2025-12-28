// Client-only Tiptap editor to avoid `document` access during SSR/static export.
import dynamic from 'next/dynamic'
import { useEditor, EditorContent } from '@tiptap/react'
import { FloatingMenu, BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'

const Tiptap = () => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello World!</p>',
    // Avoid hydration mismatch: wait to render on client
    immediatelyRender: false,
  })

  if (!editor) return null

  return (
    <>
      <EditorContent editor={editor} />
      <FloatingMenu editor={editor}>This is the floating menu</FloatingMenu>
      <BubbleMenu editor={editor}>This is the bubble menu</BubbleMenu>
    </>
  )
}

// Disable SSR so Tiptap only runs in the browser (avoids `document` on the server)
export default dynamic(() => Promise.resolve(Tiptap), { ssr: false })