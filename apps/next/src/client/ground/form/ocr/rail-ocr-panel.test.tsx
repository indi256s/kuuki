// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@kuuki/client/apiClient'
import type {
  RailOcrResult,
  RailTicketCandidate,
} from '../../../../../../../functions/api/_services/railTicketOcr'
import { emptyLeg, type LegDraft } from '../model'
import { previewFromCandidate } from './model'
import { applyLegCandidates } from '../rail-editor'

vi.mock('../../api', () => ({ readRailTicket: vi.fn() }))
vi.mock('../../../activity', () => ({ trackPrivateOperation: () => () => {} }))
const { readRailTicket } = await import('../../api')
const { RailOcrPanel } = await import('./rail-ocr-panel')

const candidate = (patch: Partial<RailTicketCandidate> = {}): RailTicketCandidate => ({
  fromStation: 'Berlin Hbf',
  toStation: 'Praha hl.n.',
  fromCity: null,
  toCity: null,
  departureDate: '2026-03-12',
  arrivalDate: null,
  departureTime: '08:30',
  arrivalTime: null,
  trainNumber: 'EC 171',
  operator: null,
  uncertain: [],
  cancelled: null,
  otherPassenger: null,
  ...patch,
})
const result = (...candidates: RailTicketCandidate[]): RailOcrResult => ({
  candidates,
  warnings: [],
})

function deferred() {
  let resolve!: (value: RailOcrResult) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<RailOcrResult>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Harness({ initial = [] }: { initial?: LegDraft[] }) {
  const [legs, setLegs] = useState<LegDraft[]>(initial)
  return (
    <>
      <RailOcrPanel
        locale="en"
        api={{
          legs,
          disabled: false,
          restoredRows: [],
          onUnaddedChange: () => {},
          onCandidates: (candidates, mode, id) => {
            const next = applyLegCandidates(legs, candidates, mode, id)
            if (next) setLegs(next)
            return next !== null
          },
        }}
      />
      <ul aria-label="form legs">
        {legs.map((leg) => (
          <li key={leg.id}>{`${leg.trainNumber || '-'}|${leg.departureDate || 'no date'}`}</li>
        ))}
      </ul>
    </>
  )
}

const pdf = (name: string) => new File(['%PDF-'], name, { type: 'application/pdf' })
const choose = (...files: File[]) =>
  fireEvent.change(document.querySelector<HTMLInputElement>('input[type=file]')!, {
    target: { files },
  })
const formLegs = () =>
  within(screen.getByRole('list', { name: 'form legs', hidden: true }))
    .queryAllByRole('listitem', { hidden: true })
    .map((li) => li.textContent)

beforeEach(() => {
  vi.mocked(readRailTicket).mockReset()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  })
})

describe('RailOcrPanel', () => {
  it('reads two files at a time and shows a status line per file, with plurals', async () => {
    const [a, b, c] = [deferred(), deferred(), deferred()]
    vi.mocked(readRailTicket)
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise)
      .mockReturnValueOnce(c.promise)
    render(<Harness />)
    choose(pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf'))
    await screen.findAllByText('Reading…')
    expect(readRailTicket).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Waiting')).toBeTruthy()
    await act(async () => a.resolve(result(candidate(), candidate({ trainNumber: 'EC 173' }))))
    expect(await screen.findByText('2 trains')).toBeTruthy()
    await waitFor(() => expect(readRailTicket).toHaveBeenCalledTimes(3))
    await act(async () => b.resolve(result(candidate({ trainNumber: 'IC 5' }))))
    expect(await screen.findByText('1 train')).toBeTruthy()
    await act(async () => c.resolve(result()))
    expect(await screen.findByText('No trains found')).toBeTruthy()
  })

  it('refuses a too-large or unsupported file without a request, and says so per file', async () => {
    render(<Harness />)
    const big = pdf('big.pdf')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    choose(big, new File(['x'], 'pic.gif', { type: 'image/gif' }))
    expect(await screen.findByText('Too large (max 10 MB)')).toBeTruthy()
    expect(screen.getByText('Unsupported type')).toBeTruthy()
    expect(readRailTicket).not.toHaveBeenCalled()
  })

  it('stop starts nothing new, ignores the late answer and keeps what was received', async () => {
    const [a, b, c] = [deferred(), deferred(), deferred()]
    vi.mocked(readRailTicket)
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise)
      .mockReturnValueOnce(c.promise)
      .mockResolvedValue(result(candidate({ trainNumber: 'NEVER' })))
    render(<Harness />)
    choose(pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf'))
    await screen.findAllByText('Reading…')
    await act(async () => a.resolve(result(candidate({ trainNumber: 'EC 171' }))))
    expect(await screen.findByText('1 train')).toBeTruthy()
    await waitFor(() => expect(readRailTicket).toHaveBeenCalledTimes(3))
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getAllByText('Stopped').length).toBeGreaterThan(0)
    await act(async () => b.resolve(result(candidate({ trainNumber: 'LATE 2' }))))
    expect(screen.queryByDisplayValue('LATE 2')).toBeNull()
    await act(async () => c.resolve(result(candidate({ trainNumber: 'LATE 1' }))))
    expect(screen.queryByDisplayValue('LATE 1')).toBeNull()
    expect(screen.getByDisplayValue('EC 171')).toBeTruthy()
    expect(readRailTicket).toHaveBeenCalledTimes(3)
  })

  it('offers Retry for a failed file and for a rate limit, and retries only that file', async () => {
    vi.mocked(readRailTicket)
      .mockRejectedValueOnce(new ApiError(429, 'slow down', 'RATE_LIMITED'))
      .mockResolvedValueOnce(result(candidate()))
    render(<Harness />)
    choose(pdf('a.pdf'))
    expect(await screen.findByText('Rate limited, try later')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('1 train')).toBeTruthy()
    expect(readRailTicket).toHaveBeenCalledTimes(2)
  })

  it('flags unclear fields with text and never fills a missing year', async () => {
    vi.mocked(readRailTicket).mockResolvedValue(
      result(candidate({ departureDate: { month: 3, day: 12 }, uncertain: ['trainNumber'] })),
    )
    render(<Harness />)
    choose(pdf('a.pdf'))
    expect(await screen.findByText('1 train. Some fields unclear')).toBeTruthy()
    expect(screen.getByText('Check this')).toBeTruthy()
    expect(screen.getByText('The ticket has no year.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Add to route (1)' }))
    expect(formLegs()).toEqual(['EC 171|no date'])
  })

  it('adds a typed year to a partial date before it reaches the form', async () => {
    vi.mocked(readRailTicket).mockResolvedValue(
      result(candidate({ departureDate: { month: 3, day: 12 } })),
    )
    render(<Harness />)
    choose(pdf('a.pdf'))
    await screen.findByText(/^1 train/)
    await userEvent.type(screen.getByRole('textbox', { name: /Departure date: March 12/ }), '2026')
    await userEvent.click(screen.getByRole('button', { name: 'Add to route (1)' }))
    expect(formLegs()).toEqual(['EC 171|2026-03-12'])
  })

  it('appends after the existing legs, replaces one leg, and replaces the route only after confirming', async () => {
    const keep = { ...emptyLeg(), trainNumber: 'KEEP 1' }
    const swap = { ...emptyLeg(), trainNumber: 'SWAP 1' }
    vi.mocked(readRailTicket).mockResolvedValue(
      result(candidate({ trainNumber: 'NEW 1' }), candidate({ trainNumber: 'NEW 2' })),
    )
    render(<Harness initial={[keep, swap]} />)
    choose(pdf('a.pdf'))
    await screen.findByText('2 trains')
    await userEvent.click(screen.getByRole('button', { name: 'Add to route (2)' }))
    expect(formLegs()).toEqual([
      'KEEP 1|no date',
      'SWAP 1|no date',
      'NEW 1|2026-03-12',
      'NEW 2|2026-03-12',
    ])

    // Re-tick the first preview and swap only the second leg with it.
    const previews = screen.getAllByRole('group')
    await userEvent.selectOptions(
      within(previews[0]!).getByRole('combobox', { name: 'Leg to replace' }),
      screen.getAllByRole('option', { name: /^Leg 2/ })[0]!,
    )
    await userEvent.click(within(previews[0]!).getByRole('button', { name: 'Replace this leg' }))
    expect(formLegs()).toEqual([
      'KEEP 1|no date',
      'NEW 1|2026-03-12',
      'NEW 1|2026-03-12',
      'NEW 2|2026-03-12',
    ])

    await userEvent.click(within(previews[1]!).getByRole('checkbox', { name: 'Include' }))
    await userEvent.click(screen.getByRole('button', { name: 'Replace route' }))
    expect(formLegs()).toHaveLength(4)
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Replace route' }),
    )
    expect(formLegs()).toEqual(['NEW 2|2026-03-12'])
  })

  it('marks a repeat without removing it, and does not tick cancelled tickets', async () => {
    vi.mocked(readRailTicket).mockResolvedValue(
      result(candidate(), candidate(), candidate({ trainNumber: 'EC 9', cancelled: true })),
    )
    render(<Harness />)
    choose(pdf('a.pdf'))
    await screen.findByText('3 trains')
    expect(screen.getAllByText('Possible repeat')).toHaveLength(1)
    expect(screen.getAllByRole('group')).toHaveLength(3)
    expect(screen.getByText('Cancelled ticket')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add to route (2)' })).toBeTruthy()
  })
  it('moves focus to a neighbouring Remove after removing a row, and keeps the rows out of the live region', async () => {
    vi.mocked(readRailTicket).mockResolvedValue(result(candidate()))
    render(<Harness />)
    choose(pdf('a.pdf'), pdf('b.pdf'))
    await screen.findAllByText('1 train')
    expect(
      within(screen.getByRole('list', { name: 'Tickets' })).queryAllByRole('status'),
    ).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Remove a.pdf' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b.pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove b.pdf' }))
    expect(document.activeElement?.textContent).toContain('Choose tickets')
  })

  it('does not submit the surrounding form on Enter in a preview field', async () => {
    vi.mocked(readRailTicket).mockResolvedValue(result(candidate()))
    render(<Harness />)
    choose(pdf('a.pdf'))
    const input = await screen.findByLabelText('Train number')
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false)
  })

  it('reports unadded previews for the draft and restores them without a file', async () => {
    const report = vi.fn()
    const stored = {
      id: 'row-1',
      fileName: 'saved.pdf',
      fileSize: null,
      previews: [previewFromCandidate(candidate({ trainNumber: 'EC 99' }))],
    }
    render(
      <RailOcrPanel
        locale="en"
        api={{
          legs: [],
          disabled: false,
          restoredRows: [stored],
          onUnaddedChange: report,
          onCandidates: () => true,
        }}
      />,
    )
    expect(screen.getByText('saved.pdf')).toBeTruthy()
    expect((screen.getByLabelText('Train number') as HTMLInputElement).value).toBe('EC 99')
    expect(report).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'row-1' })])
    await userEvent.click(screen.getByRole('button', { name: /Add to route/ }))
    expect(report).toHaveBeenLastCalledWith([])
  })

  it('refuses a hand-off past 100 legs instead of cutting it', () => {
    const legs = Array.from({ length: 100 }, () => emptyLeg())
    expect(applyLegCandidates(legs, [emptyLeg()], 'append')).toBeNull()
    expect(applyLegCandidates(legs, [emptyLeg()], 'replace', legs[3]!.id)).toHaveLength(100)
  })
})
