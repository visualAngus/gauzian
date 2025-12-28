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
import { useEffect, useState, useRef } from 'react'
import styles from '../styles/editeur.module.css'

// --- COMPOSANT 1 : L'Éditeur pur (UI) ---
// Il ne se charge que quand "provider" et "ydoc" existent.
const TiptapEditor = ({ provider, ydoc, user }) => {
  const [title, setTitle] = useState('Document sans titre')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const fileInputRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }), // Désactiver l'historique local pour laisser Yjs gérer
      Underline,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: user,
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
    editorProps: {
      attributes: {
        class: styles.proseEditor,
        spellCheck: 'true',
      },
    },
  })

  // Gestion des fonctions de l'éditeur (Toolbar)
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

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => editor.chain().focus().setImage({ src: reader.result }).run()
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  // Couleurs pour la toolbar
  const textColors = ['#0f172a', '#dc2626', '#16a34a', '#2563eb', '#7c3aed', '#f97316']
  const highlightColors = ['#fef08a', '#fde68a', '#bbf7d0', '#bae6fd', '#e9d5ff', '#ffe4e6']

  return (
    <div className={styles.editorContainer}>
      {/* Header */}
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
            {/* Statut de connexion visible */}
            <div style={{marginRight: '10px', fontSize: '0.8rem', color: provider.synced ? 'green' : 'orange'}}>
                {provider.synced ? '● Synchronisé' : '○ Connexion...'}
            </div>
            <button className={styles.btnAction} onClick={undo} title="Annuler">↩</button>
            <button className={styles.btnAction} onClick={redo} title="Rétablir">↪</button>
        </div>
      </div>

      {/* Toolbar simplifiée pour l'exemple (tu peux remettre la tienne complète) */}
      <div className={styles.editorToolbar}>
        <div className={styles.toolbarGroup}>
            <button onClick={toggleBold} className={editor.isActive('bold') ? styles.active : ''}>B</button>
            <button onClick={toggleItalic} className={editor.isActive('italic') ? styles.active : ''}>I</button>
            <button onClick={toggleStrike} className={editor.isActive('strike') ? styles.active : ''}>S</button>
            <button onClick={toggleUnderline} className={editor.isActive('underline') ? styles.active : ''}>U</button>
        </div>
        <div className={styles.toolbarDivider}></div>
        {/* ... Ajoute ici le reste de ta toolbar ... */}
      </div>

      <div className={styles.editorWrapper}>
        <EditorContent editor={editor} />
      </div>

      <BubbleMenu editor={editor} className={styles.bubbleMenu}>
        <button onClick={toggleBold}>B</button>
        <button onClick={toggleItalic}>I</button>
        <button onClick={toggleHighlight}>H</button>
      </BubbleMenu>

      <input ref={fileInputRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleFileChange} />
    </div>
  )
}

// --- COMPOSANT 2 : Wrapper de Connexion (Logique) ---
const TiptapCollaborative = () => {
  const [provider, setProvider] = useState(null)
  const [ydoc, setYdoc] = useState(null)
  const [localUser] = useState(() => {
    const colors = ['#f97316', '#2563eb', '#10b981', '#7c3aed', '#dc2626', '#0ea5e9']
    return { 
        name: `User-${Math.floor(Math.random() * 900 + 100)}`, 
        color: colors[Math.floor(Math.random() * colors.length)] 
    }
  })

  useEffect(() => {
    const doc = new Y.Doc()
    const docId = 'shared-document'
    
    // IMPORTANT : On pointe vers /api/ws pour que Caddy redirige vers le Rust
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/ws` 

    console.log(`🔌 Initialisation Websocket vers : ${wsUrl} (Doc: ${docId})`)

    const wsProvider = new WebsocketProvider(wsUrl, docId, doc, {
        connect: true 
    })

    wsProvider.on('status', event => {
      console.log('🌐 WS Status:', event.status)
    })

    // Setup de la couleur utilisateur
    wsProvider.awareness.setLocalStateField('user', localUser)

    setYdoc(doc)
    setProvider(wsProvider)

    // CLEANUP : Très important pour éviter les connexions zombies en React 18
    return () => {
      console.log('🧹 Cleanup Tiptap Wrapper')
      wsProvider.destroy()
      doc.destroy()
    }
  }, []) // Tableau vide = s'exécute une seule fois au montage

  // Tant que la connexion n'est pas initialisée (provider est null), on affiche un chargement
  if (!provider || !ydoc) {
    return <div className={styles.loading}>Chargement de l'éditeur...</div>
  }

  return <TiptapEditor provider={provider} ydoc={ydoc} user={localUser} />
}

export default dynamic(() => Promise.resolve(TiptapCollaborative), { ssr: false })