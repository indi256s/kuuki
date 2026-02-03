import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Note, NoteContent } from '@/components/ui/note'
import { Copy, Check, ChevronDown, Upload, X, FileType } from 'lucide-react'
import { cn } from '@/lib/utils'

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

export function ImportUpload({ onSubmit, disabled }: ImportUploadProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [filePreview, setFilePreview] = useState<{
    type: 'pdf' | 'image'
    content: string
    fileName?: string
  } | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [textareaHeight, setTextareaHeight] = useState('96px') // min-h-24
  const [showCopiedToast, setShowCopiedToast] = useState(false)
  const [tipExpanded, setTipExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Copy prompt to clipboard
  const copyPrompt = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent collapsing the tip
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

  // Process uploaded file
  const processFile = useCallback(async (file: File) => {
    setFileError(null)

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError(t('import.upload.invalidFormat', 'Invalid file format. Please use PDF, PNG, or JPG.'))
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError(t('import.upload.fileTooLarge', 'File too large. Maximum size is 10 MB.'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      const type = file.type === 'application/pdf' ? 'pdf' : 'image'

      setFilePreview({
        type,
        content: base64,
        fileName: file.name,
      })
      // Clear text when file is added
      setTextInput('')
      setTextareaHeight('96px')
      setTextError(null)
    }
    reader.onerror = () => {
      setFileError(t('import.upload.readError', 'Failed to read file.'))
    }
    reader.readAsDataURL(file)
  }, [t])

  // Smart paste detection - global paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (disabled) return

      const items = e.clipboardData?.items
      if (!items) return

      // Check for image in clipboard first
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

      // If pasting text and textarea is focused, let it flow naturally
      // but clear file if there's one
      if (filePreview) {
        setFilePreview(null)
        setFileError(null)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [disabled, filePreview, processFile])

  // Handle drag events for file card
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

  // Auto-grow textarea
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setTextInput(value)
    setTextError(null)

    // Auto-grow logic
    const textarea = e.target
    textarea.style.height = '96px' // Reset to min
    const scrollHeight = Math.min(textarea.scrollHeight, 256) // max-h-64
    setTextareaHeight(`${Math.max(96, scrollHeight)}px`)

    // Clear file when typing
    if (value && filePreview) {
      setFilePreview(null)
      setFileError(null)
    }
  }, [filePreview])

  // Clear handlers
  const clearText = useCallback(() => {
    setTextInput('')
    setTextareaHeight('96px')
    setTextError(null)
  }, [])

  const clearFile = useCallback(() => {
    setFilePreview(null)
    setFileError(null)
  }, [])

  // Submit handler
  const handleSubmit = useCallback(() => {
    // Prefer text if both have content (shouldn't happen with clear logic)
    if (textInput.trim().length >= 10) {
      onSubmit({
        type: 'text',
        content: textInput.trim(),
      })
    } else if (textInput.trim().length > 0 && textInput.trim().length < 10) {
      setTextError(t('import.upload.textTooShort', 'Please enter more text to analyze.'))
    } else if (filePreview) {
      onSubmit({
        type: filePreview.type,
        content: filePreview.content,
      })
    }
  }, [textInput, filePreview, onSubmit, t])

  const hasContent = textInput.trim().length >= 10 || filePreview !== null

  return (
    <div className="space-y-4">
      {/* Card 1: AI Tip (Collapsible Note) */}
      <Note
        accent="info"
        size="sm"
        className="cursor-pointer select-none"
        onClick={() => setTipExpanded(!tipExpanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {t('import.tip.teaser', 'Copy prompt for AI')}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={copyPrompt}
              className="h-7 px-3 gap-1.5 text-xs"
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
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform duration-200',
                tipExpanded && 'rotate-180'
              )}
            />
          </div>
        </div>

        {/* Expanded content */}
        <div
          className={cn(
            'grid transition-all duration-200 ease-out',
            tipExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
          )}
        >
          <div className="overflow-hidden">
            <NoteContent>
              <p className="text-sm text-muted-foreground mb-3 italic">
                {t('import.tip.recommendation', "Use Gemini (native Calendar integration) or Claude. Don't use ChatGPT (it sucks)")}
              </p>
              <pre className="text-xs bg-muted/50 p-3 rounded-lg font-mono overflow-x-auto whitespace-pre-wrap text-foreground/80 border border-border/50">
                {GEMINI_PROMPT}
              </pre>
            </NoteContent>
          </div>
        </div>
      </Note>

      {/* Card 2: Text Input */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              {t('import.upload.pasteFlightDetails', 'Paste flight details')}
            </CardTitle>
            {filePreview && !textInput && (
              <Button
                variant="ghost"
                onClick={clearText}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title={t('import.upload.clearText', 'Clear text')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            ref={textareaRef}
            value={textInput}
            onChange={handleTextChange}
            className={cn(
              'resize-none font-mono text-sm transition-all duration-150',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={{ height: textareaHeight }}
            placeholder={t('import.upload.textPlaceholder', 'Paste booking confirmations, itineraries...')}
            disabled={disabled}
          />
          {textError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{textError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Card 3: File Upload (Icon-Centered) */}
      <Card
        className={cn(
          'border-border/50 cursor-pointer transition-colors',
          isDragging && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        <CardContent className="py-6 flex flex-col items-center justify-center gap-3">
          {filePreview ? (
            // File preview
            <div className="flex items-center gap-3 w-full">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                filePreview.type === 'pdf' ? 'bg-destructive/10' : 'bg-primary/10'
              )}>
                {filePreview.type === 'pdf' ? (
                  <FileType className="w-6 h-6 text-destructive" />
                ) : (
                  <img
                    src={`data:image/jpeg;base64,${filePreview.content}`}
                    alt="Preview"
                    className="w-full h-full rounded-xl object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {filePreview.fileName || (filePreview.type === 'pdf' ? 'Document.pdf' : 'Image')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {filePreview.type === 'pdf' ? 'PDF Document' : 'Image'}
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  clearFile()
                }}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title={t('import.upload.clearFile', 'Clear file')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            // Empty drop zone
            <>
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm text-muted-foreground">
                {t('import.dropFile', 'Drop file here')}
              </span>
              {textInput && (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFile()
                  }}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </CardContent>
        {fileError && (
          <div className="px-6 pb-4">
            <Alert variant="destructive">
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          </div>
        )}
      </Card>

      {/* Parse Button */}
      <Button
        onClick={handleSubmit}
        disabled={disabled || !hasContent}
        className="w-full"
        size="lg"
      >
        {t('import.parseFlights', 'Parse Flights')}
      </Button>
    </div>
  )
}
