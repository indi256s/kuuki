import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lightbulb, Copy, Check, FileText, Camera, FileType } from 'lucide-react'

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
        <Card className="border-border/50">
          <CardContent className="p-5">
            {preview.type === 'image' && (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={`data:image/jpeg;base64,${preview.content}`}
                  alt="Preview"
                  className="max-h-48 rounded-lg shadow-sm object-contain"
                />
                {preview.fileName && (
                  <span className="text-sm text-muted-foreground">{preview.fileName}</span>
                )}
              </div>
            )}

            {preview.type === 'pdf' && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <FileType className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <div className="font-medium">{preview.fileName || 'Document.pdf'}</div>
                  <div className="text-sm text-muted-foreground">PDF Document</div>
                </div>
              </div>
            )}

            {preview.type === 'text' && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  {t('import.upload.textPreview', 'Text preview')}
                </div>
                <div className="text-sm bg-muted rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                  {preview.content.slice(0, 500)}
                  {preview.content.length > 500 && '...'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={disabled}
            className="flex-1"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disabled}
            className="flex-1"
          >
            {t('import.upload.parse', 'Parse Flights')}
          </Button>
        </div>
      </div>
    )
  }

  // Text mode (default for new users)
  if (mode === 'text') {
    return (
      <div className="space-y-5">
        {/* Gemini helper - always visible for text mode */}
        <Card className="border-border/50 bg-gradient-to-br from-muted to-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">
                  {t('import.tip.title', 'Use Google Gemini to find your flights')}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('import.tip.description', 'Copy this prompt to Gemini, then paste the results below.')}
                </p>
              </div>
            </div>

            <div className="mt-3 relative">
              <pre className="text-xs bg-card p-3 pr-12 rounded-lg border border-border overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground max-h-28 overflow-y-auto">
                {GEMINI_PROMPT}
              </pre>
              <Button
                size="sm"
                onClick={copyPrompt}
                className="absolute top-2 right-2 h-7 gap-1.5"
              >
                {showCopiedToast ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {t('import.tip.copied', 'Copied!')}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    {t('common.copy', 'Copy')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main textarea */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="relative"
        >
          <Textarea
            ref={textareaRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={t('import.upload.textPlaceholder', 'Paste Gemini output, booking confirmations, or flight details here...')}
            className={`
              h-48 font-mono text-sm resize-y transition-all
              ${isDragging ? 'border-primary bg-primary/10' : ''}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            disabled={disabled}
          />

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-xl border-2 border-dashed border-primary pointer-events-none">
              <div className="text-primary font-medium">
                {t('import.upload.dropFile', 'Drop file here')}
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="link"
            onClick={() => setMode('file')}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground gap-1.5 p-0"
          >
            <Camera className="w-4 h-4" />
            {t('import.upload.orUploadFile', 'Or upload a file')}
          </Button>

          <Button
            onClick={handleTextSubmit}
            disabled={disabled || textInput.trim().length < 10}
          >
            {t('import.upload.parseFlights', 'Parse Flights')}
          </Button>
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
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary hover:bg-muted'
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
            isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            <Camera className="w-8 h-8" />
          </div>

          <div>
            <div className="font-medium">
              {t('import.upload.dropzoneFile', 'Upload boarding pass or itinerary')}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {t('import.upload.formats', 'PDF, PNG, or JPG')}
              {' · '}
              {t('import.upload.maxSize', 'Max 10 MB')}
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono text-xs">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono text-xs">V</kbd>
            <span className="ml-1">{t('import.upload.pasteImage', 'to paste from clipboard')}</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Switch to text mode */}
      <div className="flex items-center justify-center">
        <Button
          variant="link"
          onClick={() => setMode('text')}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <FileText className="w-4 h-4" />
          {t('import.upload.orPasteText', 'Or paste text instead')}
        </Button>
      </div>
    </div>
  )
}
