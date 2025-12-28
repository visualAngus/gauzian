import dynamic from 'next/dynamic'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { useState } from 'react'
import '../styles/editeur.css'

const Tiptap = () => {
  const [title, setTitle] = useState('Document sans titre')
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Commencez à écrire votre document...</p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose-editor',
      },
    },
  })

  if (!editor) return null

  const toggleBold = () => editor.chain().focus().toggleBold().run()
  const toggleItalic = () => editor.chain().focus().toggleItalic().run()
  const toggleStrike = () => editor.chain().focus().toggleStrike().run()
  const toggleHeading = (level) => editor.chain().focus().toggleHeading({ level }).run()
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run()
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run()
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run()
  const setHorizontalRule = () => editor.chain().focus().setHorizontalRule().run()
  const undo = () => editor.chain().focus().undo().run()
  const redo = () => editor.chain().focus().redo().run()

  return (
    <div className="editor-container">
      {/* Header avec titre et actions */}
      <div className="editor-header">
        <div className="editor-title-section">
          {isEditingTitle ? (
            <input
              type="text"
              className="editor-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyPress={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
            />
          ) : (
            <h1 className="editor-title" onClick={() => setIsEditingTitle(true)}>
              {title}
            </h1>
          )}
        </div>
        <div className="editor-actions">
          <button className="btn-action" onClick={undo} title="Annuler">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-9 9"></path>
            </svg>
          </button>
          <button className="btn-action" onClick={redo} title="Rétablir">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 019 9"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            onClick={() => toggleHeading(1)}
            className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            title="Titre 1"
          >
            <span className="toolbar-text">T1</span>
          </button>
          <button
            onClick={() => toggleHeading(2)}
            className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            title="Titre 2"
          >
            <span className="toolbar-text">T2</span>
          </button>
          <button
            onClick={() => toggleHeading(3)}
            className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
            title="Titre 3"
          >
            <span className="toolbar-text">T3</span>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button
            onClick={toggleBold}
            className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
            title="Gras"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
            </svg>
          </button>
          <button
            onClick={toggleItalic}
            className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
            title="Italique"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
            </svg>
          </button>
          <button
            onClick={toggleStrike}
            className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
            title="Barré"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button
            onClick={toggleBulletList}
            className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
            title="Liste à puces"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
            </svg>
          </button>
          <button
            onClick={toggleOrderedList}
            className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
            title="Liste numérotée"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
            </svg>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="toolbar-group">
          <button
            onClick={toggleBlockquote}
            className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
            title="Citation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
            </svg>
          </button>
          <button
            onClick={setHorizontalRule}
            className="toolbar-btn"
            title="Ligne horizontale"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Éditeur principal */}
      <div className="editor-wrapper">
        <div className="editor-content-wrapper">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Menu bulle pour sélection */}
      <BubbleMenu editor={editor} className="bubble-menu">
        <button onClick={toggleBold} className={editor.isActive('bold') ? 'active' : ''}>
          <strong>G</strong>
        </button>
        <button onClick={toggleItalic} className={editor.isActive('italic') ? 'active' : ''}>
          <em>I</em>
        </button>
        <button onClick={toggleStrike} className={editor.isActive('strike') ? 'active' : ''}>
          <s>S</s>
        </button>
      </BubbleMenu>
    </div>
  )
}

export default dynamic(() => Promise.resolve(Tiptap), { ssr: false })