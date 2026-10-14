import { describe, expect, it } from 'vitest'
import type { RailTicketCandidate } from '../../../../../../../functions/api/_services/railTicketOcr'
import {
  findRepeats,
  legFromPreview,
  newRow,
  precheckFile,
  previewFromCandidate,
  resolveDate,
  retryRow,
  settleRow,
  startRow,
  statusForFailure,
  stopRows,
} from './model'

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
const file = (name: string, type: string, size = 100) => ({ name, type, size })

describe('precheckFile', () => {
  it('admits the four supported types and falls back to the extension when the type is empty', () => {
    for (const type of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
      expect(precheckFile(file('t', type))).toBeNull()
    expect(precheckFile(file('ticket.WEBP', ''))).toBeNull()
  })
  it('refuses other types and files over 10 MiB without asking the server', () => {
    expect(precheckFile(file('t.heic', 'image/heic'))).toBe('unsupported')
    expect(precheckFile(file('t.gif', ''))).toBe('unsupported')
    expect(precheckFile(file('t.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toBe('too-large')
    expect(precheckFile(file('t.pdf', 'application/pdf', 10 * 1024 * 1024))).toBeNull()
  })
  it('starts a refused file as a refused row, never as waiting', () => {
    expect(newRow(new File(['x'], 'a.gif', { type: 'image/gif' })).status).toBe('unsupported')
  })
})

describe('statusForFailure', () => {
  it('tells the failures apart', () => {
    expect(statusForFailure({ status: 429 })).toBe('rate-limited')
    expect(statusForFailure({ status: 413 })).toBe('too-large')
    expect(statusForFailure({ status: 415 })).toBe('unsupported')
    expect(statusForFailure({ status: 422, code: 'NO_TRAINS_FOUND' })).toBe('none')
    expect(statusForFailure({ status: 422, code: 'UNREADABLE_FILE' })).toBe('failed')
    expect(statusForFailure(new Error('network'))).toBe('failed')
  })
})

describe('row states', () => {
  const waiting = () => [newRow(new File(['x'], 'a.pdf', { type: 'application/pdf' }))]

  it('applies an answer only to the attempt that is still reading', () => {
    const [row] = waiting()
    const reading = startRow([row!], row!.id)!
    const stopped = stopRows(reading)
    expect(stopped[0]!.status).toBe('stopped')
    // The answer to the stopped attempt arrives late.
    const late = settleRow(stopped, row!.id, 1, { candidates: [candidate()] })
    expect(late[0]!.status).toBe('stopped')
    expect(late[0]!.previews).toEqual([])
  })

  it('ignores the answer to an older attempt after a retry', () => {
    const [row] = waiting()
    const failed = settleRow(startRow([row!], row!.id)!, row!.id, 1, { status: 'failed' })
    const again = startRow(retryRow(failed, row!.id), row!.id)!
    expect(settleRow(again, row!.id, 1, { status: 'failed' })[0]!.status).toBe('reading')
    expect(settleRow(again, row!.id, 3, { candidates: [candidate()] })[0]!.status).toBe('found')
  })

  it('keeps rows that already have an answer when stopping', () => {
    const [row] = waiting()
    const found = settleRow(startRow([row!], row!.id)!, row!.id, 1, { candidates: [candidate()] })
    expect(stopRows(found)[0]!.status).toBe('found')
  })

  it('reads an empty candidate list as no trains', () => {
    const [row] = waiting()
    expect(settleRow(startRow([row!], row!.id)!, row!.id, 1, { candidates: [] })[0]!.status).toBe(
      'none',
    )
  })
})

describe('previews never invent a year', () => {
  const partial = previewFromCandidate(candidate({ departureDate: { month: 3, day: 12 } }))

  it('leaves a partial date empty in the leg until a real year is typed', () => {
    expect(legFromPreview(partial).departureDate).toBe('')
    expect(resolveDate({ ...partial.departureDate, year: '26' })).toBe('')
    expect(resolveDate({ partial: { month: 2, day: 30 }, value: '', year: '2026' })).toBe('')
    expect(resolveDate({ ...partial.departureDate, year: '2026' })).toBe('2026-03-12')
  })

  it('keeps a stated date and an absent date as they are', () => {
    expect(legFromPreview(previewFromCandidate(candidate())).departureDate).toBe('2026-03-12')
    expect(
      legFromPreview(previewFromCandidate(candidate({ departureDate: null }))).departureDate,
    ).toBe('')
  })

  it('carries city text into the station field only when the station is absent, and never a place', () => {
    const leg = legFromPreview(
      previewFromCandidate(candidate({ fromStation: null, fromCity: 'Berlin', toCity: 'Praha' })),
    )
    expect(leg.fromStation).toBe('Berlin')
    expect(leg.toStation).toBe('Praha hl.n.')
    expect(leg.from).toBeNull()
    expect(leg.to).toBeNull()
  })

  it('starts cancelled and other-passenger tickets unticked', () => {
    expect(previewFromCandidate(candidate({ cancelled: true })).include).toBe(false)
    expect(previewFromCandidate(candidate({ otherPassenger: true })).include).toBe(false)
    expect(previewFromCandidate(candidate()).include).toBe(true)
  })
})

describe('findRepeats', () => {
  it('marks the later of two matching previews and a preview that matches a leg in the form', () => {
    const first = previewFromCandidate(candidate())
    const second = previewFromCandidate(candidate({ trainNumber: ' ec 171 ' }))
    const other = previewFromCandidate(candidate({ trainNumber: 'EC 173' }))
    expect(findRepeats([first, second, other], [])).toEqual(new Set([second.id]))
    expect(findRepeats([other], [legFromPreview(other)])).toEqual(new Set([other.id]))
  })
  it('calls nothing a repeat without both stations', () => {
    const a = previewFromCandidate(candidate({ fromStation: null }))
    const b = previewFromCandidate(candidate({ fromStation: null }))
    expect(findRepeats([a, b], []).size).toBe(0)
  })
})
