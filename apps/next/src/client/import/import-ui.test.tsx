// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DoneStep } from './done-step'
import { FailurePanel } from './failure-panel'
import { classifyBatchFailure } from './import-errors'
import { draft } from './fixtures'
import { ReviewStep, type ReviewStepProps } from './review-step'
import { SourceStep } from './source-step'

vi.mock('../signature/stamp', () => ({ Stamp: ({ countryCode }: { countryCode: string }) => <div data-testid="stamp">{countryCode}</div> }))

describe('SourceStep', () => {
  it('leads with a labelled dropzone button, keeps paste secondary and the email helper collapsed', async () => {
    const user = userEvent.setup()
    render(<SourceStep locale="en" busy={false} initialMode={null} onSubmit={vi.fn()} />)
    const drop = screen.getByRole('button', { name: /choose a file or drop it here/i })
    expect(drop.tagName).toBe('BUTTON')
    expect(screen.getByRole('radio', { name: /paste text/i })).toBeInTheDocument()
    const helper = screen.getByRole('button', { name: /export flights from your email/i })
    expect(helper).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: /prompt text/i })).not.toBeInTheDocument()
    await user.click(helper)
    expect(screen.getByRole('textbox', { name: /prompt text/i })).toBeInTheDocument()
  })

  it('submits pasted text with one operation id per source and never touches browser storage', async () => {
    const user = userEvent.setup()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const onSubmit = vi.fn()
    render(<SourceStep locale="en" busy={false} initialMode="text" onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/booking or itinerary text/i), 'JFK to BOS 2026-03-01')
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit.mock.calls[0][0]).toEqual({ type: 'text', content: 'JFK to BOS 2026-03-01' })
    expect(onSubmit.mock.calls[1][1]).toBe(onSubmit.mock.calls[0][1])
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('says why nothing was sent when the source is empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SourceStep locale="en" busy={false} initialMode="text" onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: /find flights/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/paste some text first/i)
  })
})

describe('FailurePanel', () => {
  const failure = (code: string, retryAfter: string | null = null) => classifyBatchFailure(code, retryAfter)!
  it.each([
    ['PROVIDER_QUOTA', /recognition limit is used up/i, ['Enter flights by hand']],
    ['MODEL_UNAVAILABLE', /recognition service is unavailable/i, ['Try again', 'Enter flights by hand']],
    ['PROVIDER_TIMEOUT', /took too long/i, ['Try again']],
    ['INVALID_FILE', /could not be read/i, ['Choose another file', 'Paste text instead']],
    ['NO_FLIGHTS_FOUND', /no flights found/i, ['Enter flights by hand', 'Choose another file']],
  ])('%s shows its own cause and action', (code, title, actions) => {
    render(<FailurePanel failure={failure(code)} locale="en" onAction={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(title)
    for (const action of actions) expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument()
  })
  it('shows when to retry only when the server gave an instant', () => {
    const { rerender } = render(<FailurePanel failure={failure('PROVIDER_QUOTA')} locale="en" onAction={vi.fn()} />)
    expect(screen.queryByText(/you can try again after/i)).not.toBeInTheDocument()
    rerender(<FailurePanel failure={failure('PROVIDER_QUOTA', '2026-10-06T00:00:00.000Z')} locale="en" onAction={vi.fn()} />)
    expect(screen.getByText(/you can try again after/i)).toBeInTheDocument()
  })
  it('reports the action chosen', async () => {
    const onAction = vi.fn()
    render(<FailurePanel failure={failure('PROVIDER_TIMEOUT')} locale="ru" onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onAction).toHaveBeenCalledWith('retry')
  })
})

const review = (over: Partial<ReviewStepProps> = {}): ReviewStepProps => ({
  locale: 'en', mobile: false, saveStates: {}, partial: false, failure: null, dirty: new Set<string>(), onDirty: vi.fn(), manualRows: [], onManualRows: vi.fn(), onManualRetryOriginal: vi.fn(), onManualNewOperation: vi.fn(), confirming: false,
  onChange: vi.fn(), onSelectAll: vi.fn(), onRetry: vi.fn(), onDiscardEdit: vi.fn(), onConfirm: vi.fn(), onDiscardImport: vi.fn(async () => {}),
  drafts: [
    draft({ id: 'a', ordinal: 0 }),
    draft({ id: 'dup', ordinal: 1, duplicateFlightId: 7, selected: true, fields: { date: '2026-04-01', origin: 'LHR', destination: 'CDG', airline_iata: 'BA' } }),
    draft({ id: 'b', ordinal: 2, selected: false, fields: { date: '2026-05-01', origin: 'LAX', destination: 'SFO', airline_iata: 'UA' } }),
  ],
  ...over,
})

describe('ReviewStep', () => {
  it('shows select-all with the count, puts duplicates last and collapsed, and counts only chosen rows in the bar', () => {
    render(<ReviewStep {...review()} />)
    expect(screen.getByRole('checkbox', { name: /select all/i })).toBeInTheDocument()
    expect(screen.getByText(/1 selected of 2/i)).toBeInTheDocument()
    const bar = screen.getByRole('region', { name: /import actions/i })
    expect(within(bar).getByRole('button', { name: /import 1/i })).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /already in your journal · 1 flight/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('JFK')
    expect(trigger.compareDocumentPosition(screen.getAllByRole('listitem')[0]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('blocks the import with a visible reason when nothing is chosen', () => {
    render(<ReviewStep {...review({ drafts: [draft({ id: 'a', selected: false })] })} />)
    const bar = screen.getByRole('region', { name: /import actions/i })
    expect(within(bar).getByRole('button', { name: /import 0/i })).toHaveAttribute('aria-disabled', 'true')
    expect(within(bar).getByText(/select at least one flight/i)).toBeInTheDocument()
  })

  it('blocks the import while an edit is unsent and names the row state', () => {
    render(<ReviewStep {...review({ saveStates: { a: { status: 'error', unsent: { fields: { destination: 'LAX' } }, failure: null, rejected: false } } })} />)
    expect(screen.getByText(/some edits are not saved yet/i)).toBeInTheDocument()
    expect(screen.getByText(/not saved yet\. your edit is kept here/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try saving again/i })).toBeInTheDocument()
  })

  it('shows unsent edits over the stored row', () => {
    render(<ReviewStep {...review({ saveStates: { a: { status: 'saving', unsent: { fields: { destination: 'LAX' } }, failure: null, rejected: false } } })} />)
    expect(screen.getAllByText('LAX').length).toBeGreaterThan(0)
  })

  it('keeps a row with no year unselectable until the year is confirmed, and never claims a year was added', () => {
    render(<ReviewStep {...review({ drafts: [draft({ id: 'a', yearExplicit: false, selected: false, fields: { date: '', origin: 'JFK', destination: 'BOS', airline_iata: 'AA' } })] })} />)
    expect(screen.getByText(/add a date to include this flight/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /include in import/i })).toBeDisabled()
    expect(document.body.textContent).not.toMatch(/assumed|inserted|filled in|подставлен/i)
    expect(document.body.textContent).toMatch(/did not show a year/i)
  })

  it('shows row and field confidence while collapsed', () => {
    render(<ReviewStep {...review({ drafts: [draft({ id: 'a', confidence: 0.55, fieldConfidence: { date: 0.3, origin: 0.99 } })] })} />)
    expect(screen.getByText(/check · 55%/i)).toBeInTheDocument()
    expect(screen.getByText(/unsure: date/i)).toBeInTheDocument()
  })

  it('renders a source snippet only when one is supplied', () => {
    const { rerender } = render(<ReviewStep {...review({ drafts: [draft({ id: 'a' })] })} />)
    expect(screen.queryByText(/found in the document/i)).not.toBeInTheDocument()
    rerender(<ReviewStep {...review({ drafts: [draft({ id: 'a', snippet: 'JFK-BOS 01MAR' })] })} />)
    expect(screen.getByText('JFK-BOS 01MAR')).toBeInTheDocument()
  })

  it('shows a partial heading and keeps the rows', () => {
    render(<ReviewStep {...review({ partial: true, failure: classifyBatchFailure('JOB_INTERRUPTED', null) })} />)
    expect(screen.getByRole('heading', { name: /partial result/i })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(1)
  })

  it('selects a duplicate only together with its acknowledgement', async () => {
    const onChange = vi.fn()
    render(<ReviewStep {...review({ onChange })} />)
    await userEvent.click(screen.getByRole('button', { name: /already in your journal/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /save anyway/i }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'dup' }), { selected: true, duplicateAcknowledged: true })
  })

  it('adds an inline manual row that is validated like a draft edit', async () => {
    const onManualRows = vi.fn()
    const { rerender } = render(<ReviewStep {...review({ onManualRows })} />)
    await userEvent.click(screen.getByRole('button', { name: /add a flight manually/i }))
    expect(onManualRows).toHaveBeenCalledWith([expect.objectContaining({ key: expect.any(String) })])
    rerender(<ReviewStep {...review({ manualRows: [{ key: 'm1', operationId: 'op1', values: { date: '', origin: 'JFK', destination: 'JFK', airline_iata: '', flight_number: '', aircraft_icao: '', departure_time: '', arrival_time: '' } }] })} />)
    expect(screen.getByText(/choose a different airport/i)).toBeInTheDocument()
    expect(screen.getByText(/fix the highlighted fields/i)).toBeInTheDocument()
  })
})

describe('DoneStep', () => {
  const base = { locale: 'en' as const, savedCount: 12, requested: 12, totalKm: 18400, newCountries: 3, stamps: [] as Array<{ code: string; name: string; eventId: string }>, publication: 'ready' as const,
    failures: [], retryCount: 0, retrying: false, checking: false, checkFailed: false, remaining: 0, aircraftTargets: [], theme: 'light' as const,
    onRetry: vi.fn(), onReview: vi.fn(), onImportMore: vi.fn(), onAircraftSaved: vi.fn() }
  it('shows the final numbers at once and the three destinations', () => {
    render(<DoneStep {...base} />)
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Added 12 flights · 3 new countries · 18,400 km')
    expect(screen.getByRole('link', { name: /open passport/i })).toHaveAttribute('href', '/passport')
    expect(screen.getByRole('link', { name: /go to journal/i })).toHaveAttribute('href', '/journal')
    expect(screen.getByRole('button', { name: /import more/i })).toBeInTheDocument()
  })
  it('presses at most eight stamps', () => {
    const stamps = Array.from({ length: 11 }, (_, index) => ({ code: `C${index}`, name: `Country ${index}`, eventId: `e${index}` }))
    render(<DoneStep {...base} stamps={stamps} newCountries={11} />)
    expect(screen.getAllByTestId('stamp')).toHaveLength(8)
  })
  it('lists the failed rows and retries only for them', async () => {
    const onRetry = vi.fn()
    render(<DoneStep {...base} savedCount={10} failures={[{ key: 'x', label: 'JFK → BOS · 1 Mar 2026', message: 'The service had a problem.', retryable: true }, { key: 'y', label: 'LAX → SFO', message: 'The year was not confirmed.', retryable: false }]}
      retryCount={1} remaining={1} onRetry={onRetry} />)
    expect(screen.getByRole('heading', { name: /some flights were not saved/i })).toBeInTheDocument()
    expect(screen.getByTestId('import-summary')).toHaveTextContent('Saved 10 of 12')
    expect(screen.getByText('JFK → BOS · 1 Mar 2026')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again for 1' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /back to review/i })).toBeInTheDocument()
  })
  it('explains a held retry, visibly and to assistive tech, and sends the member back to review', async () => {
    const onRetry = vi.fn()
    const onReview = vi.fn()
    render(<DoneStep {...base} savedCount={1} requested={2} failures={[{ key: 'x', label: 'JFK → BOS', message: 'The service had a problem.', retryable: true }]} retryCount={1} remaining={1}
      retryBlocked="Some edits on the review page are not saved yet. Go back to review to save or discard them, then try again." onRetry={onRetry} onReview={onReview} />)
    const retry = screen.getByRole('button', { name: 'Try again for 1' })
    expect(retry).toHaveAttribute('aria-disabled', 'true')
    expect(retry).toHaveAccessibleDescription(/go back to review to save or discard/i)
    await userEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /back to review/i }))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
  it('offers a way back to the remaining rows after a fully successful save', async () => {
    const onReview = vi.fn()
    render(<DoneStep {...base} savedCount={1} requested={1} remaining={2} onReview={onReview} />)
    expect(screen.getByText('2 flights are still waiting in review.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /review the remaining flights/i }))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
  it('shows no review action when nothing is left to review', () => {
    render(<DoneStep {...base} remaining={0} />)
    expect(screen.queryByRole('button', { name: /review the remaining|back to review/i })).not.toBeInTheDocument()
  })
  it('leaves the new-country line out while totals are unknown', () => {
    render(<DoneStep {...base} newCountries={null} publication="pending" />)
    expect(screen.getByTestId('import-summary')).not.toHaveTextContent(/new countr/i)
    expect(screen.getByText(/totals are still updating/i)).toBeInTheDocument()
  })
})

describe('ReviewStep corrections, retention and cancelled batches', () => {
  it('blocks the import with a visible reason while a typed correction is unsaved, even with no save state', () => {
    render(<ReviewStep {...review({ dirty: new Set(['a']) })} />)
    const bar = screen.getByRole('region', { name: /import actions/i })
    expect(within(bar).getByRole('button', { name: /import 1/i })).toHaveAttribute('aria-disabled', 'true')
    expect(within(bar).getByText(/some edits are not saved yet/i)).toBeInTheDocument()
  })

  it('reports a typed correction as unsaved, names it on the row, and clears it on save or unmount', async () => {
    const onDirty = vi.fn()
    const { unmount } = render(<ReviewStep {...review({ drafts: [draft({ id: 'a' })], onDirty })} />)
    expect(onDirty).toHaveBeenLastCalledWith('a', false)
    await userEvent.click(screen.getByText('Edit'))
    const destination = screen.getByLabelText(/^To \(airport code\)/)
    await userEvent.clear(destination)
    await userEvent.type(destination, 'LAX')
    expect(onDirty).toHaveBeenLastCalledWith('a', true)
    expect(screen.getByText(/changes not saved yet/i)).toBeInTheDocument()
    unmount()
    expect(onDirty).toHaveBeenLastCalledWith('a', false)
  })

  it('keeps typed text when an unrelated change gives the draft a newer version', async () => {
    const props = review({ drafts: [draft({ id: 'a', version: 1 })] })
    const { rerender } = render(<ReviewStep {...props} />)
    await userEvent.click(screen.getByText('Edit'))
    const destination = screen.getByLabelText(/^To \(airport code\)/)
    await userEvent.clear(destination)
    await userEvent.type(destination, 'LAX')
    rerender(<ReviewStep {...props} drafts={[draft({ id: 'a', version: 2, selected: false })]} />)
    expect(screen.getByLabelText(/^To \(airport code\)/)).toHaveValue('LAX')
  })

  it('discarding a failed edit returns the form to the stored row, not to the unsent overlay', async () => {
    const onDiscardEdit = vi.fn()
    render(<ReviewStep {...review({ drafts: [draft({ id: 'a' })], onDiscardEdit, saveStates: { a: { status: 'error', unsent: { fields: { destination: 'LAX' } }, failure: null, rejected: false } } })} />)
    await userEvent.click(screen.getByText('Edit'))
    await userEvent.click(screen.getByRole('button', { name: /discard my edit/i }))
    expect(onDiscardEdit).toHaveBeenCalledWith('a')
    expect(screen.getByLabelText(/^To \(airport code\)/)).toHaveValue('BOS')
  })

  it('shows when the stored draft is removed, in the viewer locale', () => {
    const { rerender } = render(<ReviewStep {...review({ expiresAt: '2026-11-04T12:00:00.000Z' })} />)
    expect(screen.getByTestId('import-retention')).toHaveTextContent('Kept until Nov 4, 2026.')
    rerender(<ReviewStep {...review({ locale: 'ru', expiresAt: '2026-11-04T12:00:00.000Z' })} />)
    expect(screen.getByTestId('import-retention')).toHaveTextContent('Хранится до 4 нояб. 2026 г.')
  })

  it('says a stopped review was cancelled by the member', () => {
    render(<ReviewStep {...review({ partial: true, cancelled: true })} />)
    expect(screen.getByText(/you cancelled recognition/i)).toBeInTheDocument()
  })

  it('offers the explicit recovery for an unconfirmed manual save', async () => {
    const onManualRetryOriginal = vi.fn(), onManualNewOperation = vi.fn()
    const values = { date: '2026-03-01', origin: 'JFK', destination: 'BOS', airline_iata: '', flight_number: '', aircraft_icao: '', departure_time: '', arrival_time: '' }
    render(<ReviewStep {...review({ onManualRetryOriginal, onManualNewOperation, manualRows: [{ key: 'm1', operationId: 'op1', values, failure: { kind: 'unconfirmed', code: null } }] })} />)
    expect(screen.getByText(/changed details were not sent/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry original save/i }))
    await userEvent.click(screen.getByRole('button', { name: /i checked the journal/i }))
    expect(onManualRetryOriginal).toHaveBeenCalledWith('m1')
    expect(onManualNewOperation).toHaveBeenCalledWith('m1')
  })
})
