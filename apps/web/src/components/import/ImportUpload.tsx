import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface ImportUploadProps {
  onSubmit: (data: { type: 'pdf' | 'image' | 'text'; content: string }) => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

export function ImportUpload({ onSubmit, disabled }: ImportUploadProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<{
    type: 'pdf' | 'image' | 'text'
    content: string
    fileName?: string
    pageCount?: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle paste events for images and text
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (disabled) return

      const items = e.clipboardData?.items
      if (!items) return

      // Check for image in clipboard
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await processFile(file)
          }
          return
        }
      }

      // Check for text (only if text input is focused or visible)
      if (showTextInput) {
        // Let default paste behavior handle it
        return
      }

      // If not in text mode, check if pasted content is flight-related text
      const text = e.clipboardData?.getData('text')
      if (text && text.length > 20) {
        // Switch to text mode and populate
        setShowTextInput(true)
        setTextInput(text)
        setError(null)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [disabled, showTextInput])

  const processFile = useCallback(async (file: File) => {
    setError(null)

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('import.upload.invalidFormat', 'Invalid file format. Please use PDF, PNG, or JPG.'))
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(t('import.upload.fileTooLarge', 'File too large. Maximum size is 10 MB.'))
      return
    }

    // Read file as base64
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1]

      const type = file.type === 'application/pdf' ? 'pdf' : 'image'

      setPreview({
        type,
        content: base64,
        fileName: file.name,
      })
    }
    reader.onerror = () => {
      setError(t('import.upload.readError', 'Failed to read file.'))
    }
    reader.readAsDataURL(file)
  }, [t])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      await processFile(files[0])
    }
  }, [disabled, processFile])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await processFile(files[0])
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [processFile])

  const handleTextSubmit = useCallback(() => {
    if (textInput.trim().length < 10) {
      setError(t('import.upload.textTooShort', 'Please enter more text to analyze.'))
      return
    }
    setPreview({
      type: 'text',
      content: textInput.trim(),
    })
  }, [textInput, t])

  const handleSubmit = useCallback(() => {
    if (!preview) return
    onSubmit({
      type: preview.type,
      content: preview.content,
    })
  }, [preview, onSubmit])

  const handleClear = useCallback(() => {
    setPreview(null)
    setError(null)
    setTextInput('')
  }, [])

  // Render preview content
  const renderPreview = () => {
    if (!preview) return null

    return (
      <div className="border border-edge-strong rounded-lg p-4 bg-sky-raised">
        {preview.type === 'image' && (
          <div className="flex flex-col items-center gap-3">
            <img
              src={`data:image/jpeg;base64,${preview.content}`}
              alt="Preview"
              className="max-h-48 rounded-lg shadow-sm object-contain"
            />
            {preview.fileName && (
              <span className="text-sm text-ink-muted">{preview.fileName}</span>
            )}
          </div>
        )}

        {preview.type === 'pdf' && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emergency-muted rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-emergency" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="font-medium text-ink">{preview.fileName || 'Document.pdf'}</div>
              <div className="text-sm text-ink-muted">PDF Document</div>
            </div>
          </div>
        )}

        {preview.type === 'text' && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-ink-muted">
              {t('import.upload.textPreview', 'Text preview')}
            </div>
            <div className="text-sm text-ink bg-sky-sunken rounded p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
              {preview.content.slice(0, 500)}
              {preview.content.length > 500 && '...'}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-2 border border-edge-strong rounded-lg text-ink-muted hover:bg-sky-sunken transition-colors"
            disabled={disabled}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors font-medium"
            disabled={disabled}
          >
            {t('import.upload.parse', 'Parse')}
          </button>
        </div>
      </div>
    )
  }

  // If showing text input mode
  if (showTextInput && !preview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-ink">
            {t('import.upload.pasteFlightDetails', 'Paste flight details')}
          </h3>
          <button
            onClick={() => {
              setShowTextInput(false)
              setTextInput('')
              setError(null)
            }}
            className="text-sm text-ink-muted hover:text-ink"
          >
            {t('common.back', 'Back')}
          </button>
        </div>

        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={t('import.upload.textPlaceholder', 'Paste booking confirmation, itinerary, or flight details here...')}
          className="w-full h-40 px-4 py-3 border border-edge-strong rounded-lg bg-sky-raised focus:outline-none focus:ring-2 focus:ring-runway resize-none text-sm"
          disabled={disabled}
          autoFocus
        />

        {error && (
          <div className="text-sm text-emergency bg-emergency-muted px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowTextInput(false)
              setTextInput('')
            }}
            className="flex-1 px-4 py-2 border border-edge-strong rounded-lg text-ink-muted hover:bg-sky-sunken transition-colors"
            disabled={disabled}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleTextSubmit}
            className="flex-1 px-4 py-2 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors font-medium"
            disabled={disabled || textInput.trim().length < 10}
          >
            {t('common.next', 'Next')}
          </button>
        </div>
      </div>
    )
  }

  // If we have a preview, show it
  if (preview) {
    return renderPreview()
  }

  // Default: show upload zone
  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer
          ${isDragging
            ? 'border-runway bg-runway-muted'
            : 'border-edge-strong hover:border-runway hover:bg-sky-sunken'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {/* Upload icon */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
            isDragging ? 'bg-runway text-ink-inverse' : 'bg-sky-sunken text-ink-muted'
          }`}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div>
            <div className="font-medium text-ink">
              {t('import.upload.dropzone', 'Drag and drop or click to upload')}
            </div>
            <div className="text-sm text-ink-muted mt-1">
              {t('import.upload.formats', 'Supports PDF, PNG, JPG')}
              {' · '}
              {t('import.upload.maxSize', 'Max 10 MB')}
            </div>
          </div>

          {/* Paste hint */}
          <div className="text-xs text-ink-faint flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-sky-sunken rounded text-ink-muted font-mono">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 bg-sky-sunken rounded text-ink-muted font-mono">V</kbd>
            <span className="ml-1">{t('import.upload.pasteHint', 'to paste an image')}</span>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-emergency bg-emergency-muted px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Text input toggle */}
      <div className="text-center">
        <button
          onClick={() => setShowTextInput(true)}
          className="text-sm text-runway hover:text-runway-hover transition-colors"
          disabled={disabled}
        >
          {t('import.upload.orPasteText', 'Or paste text instead')}
        </button>
      </div>
    </div>
  )
}
