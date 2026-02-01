import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const GEMINI_PROMPT = `@Gmail @Google Calendar Search for all flight bookings, boarding passes, itineraries, and travel confirmations.

For each flight, try to find (include only what you can find):
- Date (any format is fine)
- Origin and destination airports (city names or airport codes)
- Airline name or code
- Flight number (if available)
- Departure/arrival times (if available)

Format: one flight per line, include whatever info you found.

Example outputs:
2024-03-15 | JFK → LAX | American Airlines 123 | 08:30-11:45
2024-03-20 | Los Angeles to New York | Delta
March 25 | SVO-LED | Aeroflot

List ALL flights. Partial info is OK - just include what's available.`

interface ImportUploadProps {
  onSubmit: (data: { type: 'pdf' | 'image' | 'text'; content: string }) => void
  disabled?: boolean
  hasExistingFlights?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

export function ImportUpload({ onSubmit, disabled, hasExistingFlights = false }: ImportUploadProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<{
    type: 'pdf' | 'image' | 'text'
    content: string
    fileName?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  // Smart default: text mode for new users, file mode for returning users
  const [mode, setMode] = useState<'text' | 'file'>(hasExistingFlights ? 'file' : 'text')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when in text mode
  useEffect(() => {
    if (mode === 'text' && textareaRef.current && !preview) {
      textareaRef.current.focus()
    }
  }, [mode, preview])

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(GEMINI_PROMPT)
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = GEMINI_PROMPT
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setShowCopiedToast(true)
      setTimeout(() => setShowCopiedToast(false), 2000)
    }
  }, [])

  const processFile = useCallback(async (file: File) => {
    setError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('import.upload.invalidFormat', 'Invalid file format. Please use PDF, PNG, or JPG.'))
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(t('import.upload.fileTooLarge', 'File too large. Maximum size is 10 MB.'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
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

  // Handle paste events globally
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (disabled || preview) return

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

      // If in file mode but user pastes text, auto-switch to text mode
      if (mode === 'file') {
        const text = e.clipboardData?.getData('text')
        if (text && text.length > 20) {
          setMode('text')
          setTextInput(text)
          setError(null)
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [disabled, preview, mode, processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
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

  // Preview state
  if (preview) {
    return (
      <div className="space-y-4">
        <div className="border border-edge-strong rounded-xl p-5 bg-sky-raised">
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
              <div className="text-sm text-ink bg-sky-sunken rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                {preview.content.slice(0, 500)}
                {preview.content.length > 500 && '...'}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-2.5 border border-edge-strong rounded-lg text-ink-muted hover:bg-sky-sunken transition-colors"
            disabled={disabled}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors font-medium"
            disabled={disabled}
          >
            {t('import.upload.parse', 'Parse Flights')}
          </button>
        </div>
      </div>
    )
  }

  // Text mode (default for new users)
  if (mode === 'text') {
    return (
      <div className="space-y-5">
        {/* Gemini helper - always visible for text mode */}
        <div className="p-4 bg-gradient-to-br from-sky-sunken to-sky-sunken/50 rounded-xl border border-edge">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-runway-muted flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-runway" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-ink text-sm">
                {t('import.tip.title', 'Use Google Gemini to find your flights')}
              </h3>
              <p className="text-sm text-ink-muted mt-1">
                {t('import.tip.description', 'Copy this prompt to Gemini, then paste the results below.')}
              </p>
            </div>
          </div>

          <div className="mt-3 relative">
            <pre className="text-xs bg-sky-raised p-3 pr-12 rounded-lg border border-edge overflow-x-auto whitespace-pre-wrap font-mono text-ink-muted max-h-28 overflow-y-auto">
              {GEMINI_PROMPT}
            </pre>
            <button
              onClick={copyPrompt}
              className="absolute top-2 right-2 px-2.5 py-1.5 bg-runway text-ink-inverse text-xs font-medium rounded-md hover:bg-runway-hover transition-colors flex items-center gap-1.5"
            >
              {showCopiedToast ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('import.tip.copied', 'Copied!')}
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('common.copy', 'Copy')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main textarea */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="relative"
        >
          <textarea
            ref={textareaRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={t('import.upload.textPlaceholder', 'Paste Gemini output, booking confirmations, or flight details here...')}
            className={`
              w-full h-48 px-4 py-3 border rounded-xl bg-sky-raised
              focus:outline-none focus:ring-2 focus:ring-runway focus:border-transparent
              resize-y text-sm font-mono transition-all
              ${isDragging ? 'border-runway bg-runway-muted' : 'border-edge-strong'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            disabled={disabled}
          />

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-runway-muted/80 rounded-xl border-2 border-dashed border-runway pointer-events-none">
              <div className="text-runway font-medium">
                {t('import.upload.dropFile', 'Drop file here')}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-emergency bg-emergency-muted px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMode('file')}
            className="text-sm text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
            disabled={disabled}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t('import.upload.orUploadFile', 'Or upload a file')}
          </button>

          <button
            onClick={handleTextSubmit}
            className="px-5 py-2.5 bg-runway text-ink-inverse rounded-lg hover:bg-runway-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={disabled || textInput.trim().length < 10}
          >
            {t('import.upload.parseFlights', 'Parse Flights')}
          </button>
        </div>
      </div>
    )
  }

  // File mode (default for returning users)
  return (
    <div className="space-y-5">
      {/* File dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-10 transition-all cursor-pointer
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
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
            isDragging ? 'bg-runway text-ink-inverse' : 'bg-sky-sunken text-ink-muted'
          }`}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>

          <div>
            <div className="font-medium text-ink">
              {t('import.upload.dropzoneFile', 'Upload boarding pass or itinerary')}
            </div>
            <div className="text-sm text-ink-muted mt-1">
              {t('import.upload.formats', 'PDF, PNG, or JPG')}
              {' · '}
              {t('import.upload.maxSize', 'Max 10 MB')}
            </div>
          </div>

          <div className="text-xs text-ink-faint flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-sky-sunken rounded text-ink-muted font-mono text-xs">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 bg-sky-sunken rounded text-ink-muted font-mono text-xs">V</kbd>
            <span className="ml-1">{t('import.upload.pasteImage', 'to paste from clipboard')}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-emergency bg-emergency-muted px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Switch to text mode */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => setMode('text')}
          className="text-sm text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5"
          disabled={disabled}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t('import.upload.orPasteText', 'Or paste text instead')}
        </button>
      </div>
    </div>
  )
}
