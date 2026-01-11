const collectEntries = async (dataTransfer) => {
  const files = []

  const traverseEntry = async (entry, pathPrefix = "") => {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject))
      const relPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name
      Object.defineProperty(file, "webkitRelativePath", { value: relPath, writable: false })
      files.push(file)
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const readAll = async () => {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
        if (!batch.length) return
        await Promise.all(batch.map((child) => traverseEntry(child, pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name)))
        await readAll()
      }
      await readAll()
    }
  }

  const items = dataTransfer.items ? Array.from(dataTransfer.items) : []
  await Promise.all(
    items
      .map((item) => item.webkitGetAsEntry && item.webkitGetAsEntry())
      .filter(Boolean)
      .map((entry) => traverseEntry(entry, ""))
  )
  return files
}

const buildHandlers = (el, binding) => {
  const { inputRef, onFiles, onOverChange, highlightClass = "is-over" } = binding.value || {}

  const setOver = (state) => {
    if (state) {
      el.classList.add(highlightClass)
    } else {
      el.classList.remove(highlightClass)
    }
    onOverChange && onOverChange(state)
  }

  const onDragOver = (event) => {
    event.preventDefault()
    setOver(true)
  }

  const onDragLeave = () => setOver(false)

  const onDrop = async (event) => {
    event.preventDefault()
    setOver(false)
    if (!event.dataTransfer?.items?.length) return
    const files = await collectEntries(event.dataTransfer)
    if (inputRef?.value) {
      const dt = new DataTransfer()
      files.forEach((f) => dt.items.add(f))
      inputRef.value.files = dt.files
      inputRef.value.dispatchEvent(new Event("change", { bubbles: true }))
    }
    onFiles && onFiles(files)
  }

  const onClick = () => {
    inputRef?.value?.click()
  }

  return { onDragOver, onDragLeave, onDrop, onClick }
}

export default {
  mounted(el, binding) {
    const handlers = buildHandlers(el, binding)
    el.__dropzoneHandlers = handlers
    el.addEventListener("dragover", handlers.onDragOver)
    el.addEventListener("dragleave", handlers.onDragLeave)
    el.addEventListener("drop", handlers.onDrop)
    el.addEventListener("click", handlers.onClick)
  },
  unmounted(el) {
    const handlers = el.__dropzoneHandlers
    if (!handlers) return
    el.removeEventListener("dragover", handlers.onDragOver)
    el.removeEventListener("dragleave", handlers.onDragLeave)
    el.removeEventListener("drop", handlers.onDrop)
    el.removeEventListener("click", handlers.onClick)
    delete el.__dropzoneHandlers
  },
}
