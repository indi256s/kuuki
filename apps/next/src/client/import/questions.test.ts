import { describe, expect, it } from 'vitest'
import { draft } from './fixtures'
import type { Draft, DraftFields } from './import-types'
import {
  answerTookFlight,
  answerYear,
  buildQuestions,
  openCauses,
  suggestedYears,
} from './questions'
import { isChosenOn, readiness, withUnsent } from './review-model'

const TODAY = '2026-10-12'

/** A barcode row: only the day of the year is known, so the date is empty until the member picks a year. */
const ordinal = (id: string, day: number, over: Partial<Draft> = {}): Draft =>
  draft({
    id,
    ordinal: Number(id.replace(/\D/g, '')) || 0,
    fields: {
      date: '',
      origin: 'JFK',
      destination: 'BOS',
      airline_iata: 'AA',
      date_ordinal_day: day,
      flown_required: true,
    },
    confidence: null,
    yearExplicit: false,
    selected: false,
    ...over,
  })

/** A Quick Add row that already has a calendar date. */
const dated = (id: string, date: string, fields: Partial<DraftFields> = {}): Draft =>
  draft({
    id,
    fields: {
      date,
      origin: 'JFK',
      destination: 'BOS',
      airline_iata: 'AA',
      flown_required: true,
      ...fields,
    },
    confidence: null,
    yearConfirmed: true,
    selected: false,
  })

const kinds = (drafts: Draft[]) => buildQuestions(drafts, TODAY).map((question) => question.kind)

describe('ordinal day to date', () => {
  it.each([
    [60, 2028, '2028-02-29'],
    [60, 2027, '2027-03-01'],
    [366, 2028, '2028-12-31'],
    [1, 2027, '2027-01-01'],
  ])('day %i of %i is %s', (day, year, date) => {
    expect(answerYear(ordinal('a', day), year, TODAY)?.fields?.date).toBe(date)
  })

  it('rejects day 366 in a non-leap year instead of rolling into January', () => {
    expect(answerYear(ordinal('a', 366), 2027, TODAY)).toBeNull()
  })

  it('records the year as the member’s decision', () => {
    expect(answerYear(ordinal('a', 100), 2025, TODAY)).toMatchObject({
      fields: { date: '2025-04-10' },
      yearConfirmed: true,
    })
  })
})

describe('year suggestions for ordinal days', () => {
  it('offers the latest year in which the day has happened by today plus two days, and the one before', () => {
    // 2026-10-14 is day 287, the last day a pass issued two days early could print.
    expect(suggestedYears([{ ordinal: 287 }], TODAY)).toEqual([2026, 2025])
    expect(suggestedYears([{ ordinal: 288 }], TODAY)).toEqual([2025, 2024])
  })

  it('skips non-leap years for day 366', () => {
    expect(suggestedYears([{ ordinal: 366 }], TODAY)).toEqual([2024, 2023])
  })

  it('splits days either side of New Year into two questions and keeps one season together', () => {
    const across = buildQuestions([ordinal('a1', 360), ordinal('a2', 10)], TODAY)
    expect(across.map((question) => question.kind)).toEqual(['year', 'year'])
    expect(buildQuestions([ordinal('a1', 120), ordinal('a2', 200)], TODAY)).toHaveLength(1)
  })

  it('asks about printed days and barcode days separately', () => {
    const printed = draft({
      id: 'p1',
      fields: {
        date: '',
        origin: 'JFK',
        destination: 'BOS',
        airline_iata: 'AA',
        date_month_day: '03-26',
      },
      yearExplicit: false,
    })
    const years = buildQuestions([printed, ordinal('a1', 85)], TODAY)
    expect(years.map((question) => question.kind === 'year' && question.evidence).sort()).toEqual([
      'monthDay',
      'ordinal',
    ])
  })
})

describe('flown question', () => {
  it.each([
    ['an empty date (the year comes first)', ordinal('a', 100), false],
    ['a future date', dated('a', '2026-10-13'), false],
    ['today', dated('a', TODAY), true],
    ['a past date', dated('a', '2026-03-01'), true],
    ['an already confirmed row', dated('a', TODAY, { flown_confirmed: true }), false],
    [
      'a row that never needed confirmation',
      dated('a', TODAY, { flown_required: undefined }),
      false,
    ],
  ])('%s: asked=%s', (_label, row, asked) => {
    expect(kinds([row]).includes('flown')).toBe(asked)
    expect(openCauses(row, TODAY).includes('flown')).toBe(asked)
  })

  it('does not ask about a skipped row', () => {
    expect(kinds([{ ...dated('a', TODAY), status: 'dismissed' }])).toEqual([])
  })

  it('asks about a duplicate that owes the answer, without ever selecting it', () => {
    const duplicate = { ...dated('a', '2026-03-01'), duplicateFlightId: 7 }
    expect(kinds([duplicate])).toEqual(['flown'])
    expect(answerTookFlight(duplicate, TODAY)).toEqual({ flownConfirmed: true })
  })

  it('answering yes confirms and selects a row that is otherwise ready', () => {
    expect(answerTookFlight(dated('a', TODAY), TODAY)).toEqual({
      flownConfirmed: true,
      selected: true,
    })
  })

  it('does not let a year answer select a row that still owes the flown answer', () => {
    expect(answerYear(ordinal('a', 100), 2025, TODAY)?.selected).toBeUndefined()
    expect(answerYear(ordinal('a', 300), 2027, TODAY)?.selected).toBe(true)
  })
})

describe('flown readiness', () => {
  it('blocks a today or past row until the member confirms, and only then lets it be chosen', () => {
    const row = dated('a', TODAY, { origin: 'JFK' })
    const selected = { ...row, selected: true }
    expect(readiness(selected, TODAY)).toEqual(['flown'])
    expect(isChosenOn(selected, TODAY)).toBe(false)
    const confirmed = withUnsent(selected, { flownConfirmed: true })
    expect(readiness(confirmed, TODAY)).toEqual([])
    expect(isChosenOn(confirmed, TODAY)).toBe(true)
  })

  it('leaves a future row alone, as it converts as upcoming', () => {
    expect(readiness(dated('a', '2026-10-13'), TODAY)).toEqual([])
  })
})

describe('withUnsent and the flown confirmation', () => {
  it('drops a confirmation when the date changes, as the server does, unless the change restates it', () => {
    const confirmed = dated('a', '2026-03-01', { flown_confirmed: true })
    expect(withUnsent(confirmed, { fields: { date: '2026-03-02' } }).fields.flown_confirmed).toBe(
      undefined,
    )
    expect(
      withUnsent(confirmed, { fields: { date: '2026-03-02' }, flownConfirmed: true }).fields
        .flown_confirmed,
    ).toBe(true)
    expect(withUnsent(confirmed, { fields: { origin: 'LAX' } }).fields.flown_confirmed).toBe(true)
  })
})
