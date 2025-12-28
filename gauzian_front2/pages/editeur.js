import dynamic from 'next/dynamic'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'
import { useEffect, useRef, useState } from 'react'
import styles from '../styles/editeur.module.css'

const Tiptap = () => {
  const [title, setTitle] = useState('Document sans titre')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const ydocRef = useRef(null)
  const providerRef = useRef(null)
  const awarenessRef = useRef(null)
  const fileInputRef = useRef(null)

  const [localUser] = useState(() => {
    const colors = ['#f97316', '#2563eb', '#10b981', '#7c3aed', '#dc2626', '#0ea5e9']
    const name = `User-${Math.floor(Math.random() * 900 + 100)}`
    const color = colors[Math.floor(Math.random() * colors.length)]
    return { name, color }
  })

  if (!ydocRef.current) {
    const ydoc = new Y.Doc()
    const docId = 'shared-document'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    // On empêche la connexion auto pour rafraîchir le cookie avant
    const provider = new WebsocketProvider(`${protocol}//${host}/ws`, docId, ydoc, {
      connect: false,
    })
    ydocRef.current = ydoc
    providerRef.current = provider
    awarenessRef.current = provider.awareness
    awarenessRef.current.setLocalStateField('user', {
      name: localUser.name,
      color: localUser.color,
    })
  }

  // Debug connexion WS : status / close / error
  useEffect(() => {
    const provider = providerRef.current
    if (!provider) return

    const onStatus = ({ status }) => {
      console.log('🌐 WS status:', status)
    }
    const onClose = (event) => {
      console.log('🔌 WS connection-close', {
        code: event?.code,
        reason: event?.reason,
        wasClean: event?.wasClean,
      })
    }
    const onError = (event) => {
      console.error('⚠️ WS connection-error', event)
    }

    provider.on('status', onStatus)
    provider.on('connection-close', onClose)
    provider.on('connection-error', onError)

    // Log initial state
    console.log('🔌 WebSocket provider initialized, awaiting connection...')

    return () => {
      provider.off('status', onStatus)
      provider.off('connection-close', onClose)
      provider.off('connection-error', onError)
    }
  }, [providerRef])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      Underline,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Collaboration.configure({
        document: ydocRef.current,
      }),
      CollaborationCursor.configure({
        provider: providerRef.current,
        user: {
          name: localUser.name,
          color: localUser.color,
        },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { class: styles.editorLink },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: { class: styles.editorImage },
      }),
    ],
    content: '<p>Commencez à écrire votre document...</p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: styles.proseEditor,
        spellCheck: 'true',
      },
      handleDOMEvents: {
        contextmenu: (_view, event) => {
          event.stopPropagation()
          return false
        },
      },
    },
  })

  useEffect(() => {
    let cancelled = false

    const refreshAndConnect = async () => {
      try {
        await fetch('/api/auth/autologin', {
          method: 'POST',
          credentials: 'include',
        })
      } catch (err) {
        console.warn('Autologin failed before WS connect:', err)
      }

      if (!cancelled) {
        const provider = providerRef.current
        if (provider) {
          // Log when provider sends data
          const originalSend = provider.ws?.send
          if (originalSend) {
            provider.ws.send = function(data) {
              console.log('📤 Provider sending via WS:', data)
              return originalSend.call(this, data)
            }
          }
          provider.connect()
          console.log('✅ Provider connected')
        }
      }
    }

    refreshAndConnect()

    return () => {
      cancelled = true
    }
  }, [])

  // Debug : log chaque mise à jour locale envoyée via Yjs
  useEffect(() => {
    if (!ydocRef.current) {
      console.log('⚠️ ydocRef.current is null')
      return
    }
    let lastLogMs = 0
    const handler = (update, origin) => {
      // Log every update (no throttle for now)
      console.log('📝 Yjs update', {
        bytes: update?.length,
        origin,
        timestamp: new Date().toISOString(),
      })
    }
    console.log('✅ Attaching Yjs update listener')
    ydocRef.current.on('update', handler)
    return () => {
      console.log('❌ Removing Yjs update listener')
      ydocRef.current?.off('update', handler)
    }
  }, [ydocRef])

  useEffect(() => {
    return () => {
      providerRef.current?.destroy()
      ydocRef.current?.destroy()
    }
  }, [])

  if (!editor) return null

  const toggleBold = () => editor.chain().focus().toggleBold().run()
  const toggleItalic = () => editor.chain().focus().toggleItalic().run()
  const toggleStrike = () => editor.chain().focus().toggleStrike().run()
  const toggleHeading = (level) => editor.chain().focus().toggleHeading({ level }).run()
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run()
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run()
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run()
  const setHorizontalRule = () => editor.chain().focus().setHorizontalRule().run()
  const toggleCodeBlock = () => editor.chain().focus().toggleCodeBlock().run()
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run()
  const toggleHighlight = () => editor.chain().focus().toggleHighlight().run()
  const setHighlightColor = (color) => editor.chain().focus().setHighlight({ color }).run()
  const unsetHighlight = () => editor.chain().focus().unsetHighlight().run()
  const setTextColor = (color) => editor.chain().focus().setColor(color).run()
  const unsetTextColor = () => editor.chain().focus().unsetColor().run()
  const setTextAlign = (alignment) => editor.chain().focus().setTextAlign(alignment).run()
  const undo = () => editor.chain().focus().undo().run()
  const redo = () => editor.chain().focus().redo().run()

  const textColors = ['#0f172a', '#dc2626', '#16a34a', '#2563eb', '#7c3aed', '#f97316']
  const highlightColors = ['#fef08a', '#fde68a', '#bbf7d0', '#bae6fd', '#e9d5ff', '#ffe4e6']

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL du lien', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href: url, target: '_blank' }).run()
  }

  const addImageFromUrl = () => {
    const url = window.prompt("URL de l'image")
    if (!url) return
    editor.chain().focus().setImage({ src: url }).run()
  }

  const addImageFromFile = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result }).run()
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    addImageFromFile(file)
    event.target.value = ''
  }

  const triggerFilePicker = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={styles.editorContainer}>
      {/* Header avec titre et actions */}
      <div className={styles.editorHeader}>
        <div className={styles.editorTitleSection}>
          {isEditingTitle ? (
            <input
              type="text"
              className={styles.editorTitleInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyPress={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
            />
          ) : (
            <h1 className={styles.editorTitle} onClick={() => setIsEditingTitle(true)}>
              {title}
            </h1>
          )}
        </div>
        <div className={styles.editorActions}>
          <button className={styles.btnAction} onClick={undo} title="Annuler">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-9 9"></path>
            </svg>
          </button>
          <button className={styles.btnAction} onClick={redo} title="Rétablir">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6M3 17a9 9 0 019-9 9 9 0 019 9"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className={styles.editorToolbar}>
        <div className={styles.toolbarGroup}>
          <button
            onClick={() => toggleHeading(1)}
            className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 1 }) ? styles.active : ''}`}
            title="Titre 1"
          >
            <span className={styles.toolbarText}>T1</span>
          </button>
          <button
            onClick={() => toggleHeading(2)}
            className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 2 }) ? styles.active : ''}`}
            title="Titre 2"
          >
            <span className={styles.toolbarText}>T2</span>
          </button>
          <button
            onClick={() => toggleHeading(3)}
            className={`${styles.toolbarBtn} ${editor.isActive('heading', { level: 3 }) ? styles.active : ''}`}
            title="Titre 3"
          >
            <span className={styles.toolbarText}>T3</span>
          </button>
        </div>

        <div className={styles.toolbarDivider}></div>

        <div className={styles.toolbarGroup}>
          <button
            onClick={toggleBold}
            className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.active : ''}`}
            title="Gras"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
            </svg>
          </button>
          <button
            onClick={toggleItalic}
            className={`${styles.toolbarBtn} ${editor.isActive('italic') ? styles.active : ''}`}
            title="Italique"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
            </svg>
          </button>
          <button
            onClick={toggleStrike}
            className={`${styles.toolbarBtn} ${editor.isActive('strike') ? styles.active : ''}`}
            title="Barré"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
            </svg>
          </button>
          <button
            onClick={toggleUnderline}
            className={`${styles.toolbarBtn} ${editor.isActive('underline') ? styles.active : ''}`}
            title="Souligné"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4v6a6 6 0 1 0 12 0V4h-2v6a4 4 0 1 1-8 0V4H6zm-1 16v-2h14v2H5z" />
            </svg>
          </button>
          <button
            onClick={toggleHighlight}
            className={`${styles.toolbarBtn} ${editor.isActive('highlight') ? styles.active : ''}`}
            title="Surligner"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25 12.06 8.2l3.74 3.74L6.74 21H3v-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-2.27 2.27 3.75 3.75 2.27-2.27z" />
            </svg>
          </button>
        </div>

        <div className={styles.toolbarDivider}></div>

        <div className={styles.toolbarGroup}>
          {textColors.map((color) => (
            <button
              key={color}
              onClick={() => setTextColor(color)}
              className={`${styles.toolbarBtn} ${styles.colorSwatch} ${editor.isActive('textStyle', { color }) ? styles.active : ''}`}
              style={{ color, borderColor: 'transparent' }}
              title={`Texte ${color}`}
            >
              A
            </button>
          ))}
          <button onClick={unsetTextColor} className={styles.toolbarBtn} title="Réinitialiser couleur texte">✕</button>
        </div>

        <div className={styles.toolbarGroup}>
          {highlightColors.map((color) => (
            <button
              key={color}
              onClick={() => setHighlightColor(color)}
              className={`${styles.toolbarBtn} ${styles.colorSwatch}`}
              style={{ backgroundColor: color, color: '#0f172a', borderColor: 'transparent' }}
              title={`Surlignage ${color}`}
            >
              ■
            </button>
          ))}
          <button onClick={unsetHighlight} className={styles.toolbarBtn} title="Retirer surlignage">✕</button>
        </div>

        <div className={styles.toolbarDivider}></div>

        <div className={styles.toolbarGroup}>
          <button
            onClick={toggleBulletList}
            className={`${styles.toolbarBtn} ${editor.isActive('bulletList') ? styles.active : ''}`}
            title="Liste à puces"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
            </svg>
          </button>
          <button
            onClick={toggleOrderedList}
            className={`${styles.toolbarBtn} ${editor.isActive('orderedList') ? styles.active : ''}`}
            title="Liste numérotée"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
            </svg>
          </button>
        </div>

        <div className={styles.toolbarDivider}></div>

        <div className={styles.toolbarGroup}>
          <button
            onClick={toggleBlockquote}
            className={`${styles.toolbarBtn} ${editor.isActive('blockquote') ? styles.active : ''}`}
            title="Citation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
            </svg>
          </button>
          <button
            onClick={setHorizontalRule}
            className={styles.toolbarBtn}
            title="Ligne horizontale"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z" />
            </svg>
          </button>
          <button
            onClick={toggleCodeBlock}
            className={`${styles.toolbarBtn} ${editor.isActive('codeBlock') ? styles.active : ''}`}
            title="Bloc de code"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.4 16.6 5.8 13l3.6-3.6L8 8l-5 5 5 5 1.4-1.4zm5.2 0L18.2 13l-3.6-3.6L16 8l5 5-5 5-1.4-1.4z" />
            </svg>
          </button>
        </div>

        <div className={styles.toolbarDivider}></div>

        <div className={styles.toolbarGroup}>
          <button
            onClick={setLink}
            className={`${styles.toolbarBtn} ${editor.isActive('link') ? styles.active : ''}`}
            title="Ajouter un lien"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59 13.41a1.99 1.99 0 0 0 2.82 0l4.24-4.24a2 2 0 0 0-2.83-2.83l-1.06 1.06-1.41-1.41 1.06-1.06a4 4 0 1 1 5.66 5.66l-4.24 4.24a4 4 0 0 1-5.66 0l-1.06-1.06 1.41-1.41 1.06 1.06z" />
              <path d="M13.41 10.59a1.99 1.99 0 0 0-2.82 0L6.35 14.83a2 2 0 1 0 2.83 2.83l1.06-1.06 1.41 1.41-1.06 1.06a4 4 0 1 1-5.66-5.66l4.24-4.24a4 4 0 0 1 5.66 0l1.06 1.06-1.41 1.41-1.06-1.06z" />
            </svg>
          </button>
          <button
            onClick={addImageFromUrl}
            className={styles.toolbarBtn}
            title="Image via URL"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 5v14H3V5h18zm-2 2H5v10h14V7zm-6.5 3.5 2.5 3.01 1.5-1.76L19 17H7l3-4 1.5 1.8 1-1.2z" />
            </svg>
          </button>
          <button
            onClick={triggerFilePicker}
            className={styles.toolbarBtn}
            title="Importer une image"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5c-1.1 0-2-.9-2-2V7c0-1.1.9-2 2-2h4l2 2h8c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2zm-8-4 2.03-2.71 1.43 1.8L16 12l3 4H11z" />
            </svg>
          </button>
        </div>

        <div className={styles.toolbarDivider}></div>

        <div className={styles.toolbarGroup}>
          <button
            onClick={() => setTextAlign('left')}
            className={`${styles.toolbarBtn} ${editor.isActive({ textAlign: 'left' }) ? styles.active : ''}`}
            title="Aligner à gauche"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6h16v2H4V6zm0 4h12v2H4v-2zm0 4h16v2H4v-2zm0 4h12v2H4v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setTextAlign('center')}
            className={`${styles.toolbarBtn} ${editor.isActive({ textAlign: 'center' }) ? styles.active : ''}`}
            title="Centrer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v2H6V6zm-2 4h16v2H4v-2zm2 4h12v2H6v-2zm-2 4h16v2H4v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setTextAlign('right')}
            className={`${styles.toolbarBtn} ${editor.isActive({ textAlign: 'right' }) ? styles.active : ''}`}
            title="Aligner à droite"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6h16v2H4V6zm4 4h12v2H8v-2zm-4 4h16v2H4v-2zm4 4h12v2H8v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Éditeur principal */}
      <div className={styles.editorWrapper}>
        <div className={styles.editorContentWrapper}>
          <EditorContent editor={editor} />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      {/* Menu bulle pour sélection */}
      <BubbleMenu editor={editor} className={styles.bubbleMenu}>
        <button onClick={toggleBold} className={editor.isActive('bold') ? styles.active : ''}>
          <strong>G</strong>
        </button>
        <button onClick={toggleItalic} className={editor.isActive('italic') ? styles.active : ''}>
          <em>I</em>
        </button>
        <button onClick={toggleStrike} className={editor.isActive('strike') ? styles.active : ''}>
          <s>S</s>
        </button>
        <button onClick={toggleUnderline} className={editor.isActive('underline') ? styles.active : ''}>
          <u>S</u>
        </button>
        <button onClick={toggleHighlight} className={editor.isActive('highlight') ? styles.active : ''}>
          ✺
        </button>
        <button onClick={setLink} className={editor.isActive('link') ? styles.active : ''}>
          🔗
        </button>
      </BubbleMenu>
    </div>
  )
}

export default dynamic(() => Promise.resolve(Tiptap), { ssr: false })