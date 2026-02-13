import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportUpload } from './ImportUpload'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'import.upload.pasteFlightDetails': 'Paste flight details',
        'import.upload.textPlaceholder': 'Paste booking confirmations, itineraries...',
        'import.parseFlights': 'Parse Flights',
        'import.dropFile': 'Drop file here',
        'import.upload.invalidFormat': 'Invalid file format. Please use PDF, PNG, or JPG.',
        'import.upload.fileTooLarge': 'File too large. Maximum size is 10 MB.',
        'import.upload.textTooShort': 'Please enter more text to analyze.',
        'import.upload.clearText': 'Clear text',
        'import.upload.clearFile': 'Clear file',
        'import.tip.teaser': 'Let AI find all your flights from Gmail & Calendar',
        'import.tip.description': 'Copy this prompt → feed it to Gemini → paste the results below',
        'import.tip.showPrompt': 'Show prompt',
        'import.tip.hidePrompt': 'Hide prompt',
        'import.tip.easterEgg':
          'This is the prompt FOR your AI assistant. Copy it to Gemini or Claude, get the results, then paste THOSE here. I believe in you.',
        'onboarding.import.skipOption': 'Skip for now',
      }
      return translations[key] || fallback || key
    },
  }),
}))

describe('ImportUpload', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
  }

  beforeEach(() => {
    defaultProps.onSubmit.mockReset()
  })

  // --- Test 1: Renders text area and upload zone ---
  it('renders text area and upload zone', () => {
    render(<ImportUpload {...defaultProps} />)

    expect(screen.getByPlaceholderText(/paste booking confirmations/i)).toBeInTheDocument()
    expect(screen.getByText(/drop file here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /parse flights/i })).toBeInTheDocument()
  })

  // --- Test 2: Parse button disabled when empty ---
  it('has parse button disabled when no content', () => {
    render(<ImportUpload {...defaultProps} />)

    const parseBtn = screen.getByRole('button', { name: /parse flights/i })
    expect(parseBtn).toBeDisabled()
  })

  // --- Test 3: Text input (10+ chars) enables parse button ---
  it('enables parse button when text input has 10+ characters', async () => {
    const user = userEvent.setup()
    render(<ImportUpload {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/paste booking confirmations/i)
    await user.type(textarea, 'Flight from JFK to LAX on March 15')

    const parseBtn = screen.getByRole('button', { name: /parse flights/i })
    expect(parseBtn).toBeEnabled()
  })

  // --- Test 4: onSubmit called with { type: 'text', content } on valid text ---
  it('calls onSubmit with text content when parse is clicked', async () => {
    const user = userEvent.setup()
    render(<ImportUpload {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/paste booking confirmations/i)
    await user.type(textarea, 'Flight from JFK to LAX on March 15')
    await user.click(screen.getByRole('button', { name: /parse flights/i }))

    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      type: 'text',
      content: 'Flight from JFK to LAX on March 15',
    })
  })

  // --- Test 5: File upload — selecting PDF shows file name, enables parse ---
  it('shows file name and enables parse after selecting a PDF', async () => {
    const user = userEvent.setup()
    render(<ImportUpload {...defaultProps} />)

    const file = new File(['pdf-content'], 'boarding-pass.pdf', { type: 'application/pdf' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText('boarding-pass.pdf')).toBeInTheDocument()
    })

    const parseBtn = screen.getByRole('button', { name: /parse flights/i })
    expect(parseBtn).toBeEnabled()
  })

  // --- Test 6: File type rejection — invalid file type shows error ---
  it('shows error for invalid file type', async () => {
    render(<ImportUpload {...defaultProps} />)

    const file = new File(['content'], 'data.csv', { type: 'text/csv' })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement

    // Manually set files and fire change, since userEvent.upload respects accept attribute
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await waitFor(() => {
      expect(screen.getByText(/invalid file format/i)).toBeInTheDocument()
    })
  })

  // --- Test 7: File size rejection — >10MB file shows error ---
  it('shows error for file exceeding 10MB', async () => {
    const user = userEvent.setup()
    render(<ImportUpload {...defaultProps} />)

    // Create a file object with size > 10MB by overriding the size property
    const file = new File(['x'], 'huge.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument()
    })
  })

  // --- Test 8: Easter egg — pasting Gemini prompt text shows special message ---
  it('shows easter egg when prompt text is pasted', async () => {
    const user = userEvent.setup()
    render(<ImportUpload {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/paste booking confirmations/i)
    // Include at least 2 prompt signatures to trigger easter egg
    await user.type(
      textarea,
      '@Gmail @Google Calendar Search for all flight bookings, boarding passes, itineraries'
    )

    await waitFor(() => {
      expect(screen.getByText(/this is the prompt FOR your AI assistant/i)).toBeInTheDocument()
    })
  })

  // --- Test 9: Disabled state — textarea and file input disabled ---
  it('disables textarea and file input when disabled prop is true', () => {
    render(<ImportUpload {...defaultProps} disabled />)

    const textarea = screen.getByPlaceholderText(/paste booking confirmations/i)
    expect(textarea).toBeDisabled()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeDisabled()

    const parseBtn = screen.getByRole('button', { name: /parse flights/i })
    expect(parseBtn).toBeDisabled()
  })

  // --- Test 10: Onboarding variant — shows skip button ---
  it('shows skip button when variant is onboarding and onSkip is provided', async () => {
    const onSkip = vi.fn()
    const user = userEvent.setup()
    render(<ImportUpload {...defaultProps} variant="onboarding" onSkip={onSkip} />)

    const skipBtn = screen.getByRole('button', { name: /skip for now/i })
    expect(skipBtn).toBeInTheDocument()

    await user.click(skipBtn)
    expect(onSkip).toHaveBeenCalled()
  })
})
