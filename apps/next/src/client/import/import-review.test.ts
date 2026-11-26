import { describe, expect, it } from 'vitest'
import { draft } from './fixtures'
import type { Draft } from './import-types'
import { buildReview, completionOf, finishOf, type ReviewInput } from './import-review'

const review = (drafts: Draft[], over: Partial<ReviewInput> = {}) =>
  buildReview({
    drafts,
    outcomes: new Map(),
    states: {},
    entries: [],
    requiresSelection: true,
    deferred: new Set(),
    today: '2026-11-26',
    locale: 'en',
    ...over,
  })

const same = { date: '2026-03-01', origin: 'JFK', destination: 'BOS', airline_iata: 'AA' }

describe('copies inside one import', () => {
  it('keeps a preselected copy undecided and out of the save after the first is skipped', () => {
    const first = draft({ id: 'd1', ordinal: 1, fields: same, selected: true })
    const copy = draft({ id: 'd2', ordinal: 2, fields: same, selected: true })
    const before = review([first, copy])
    expect(before.legById.get('d2')).toMatchObject({ copyOf: 'd1', decision: null })
    expect(before.chosen).toEqual(['d1'])

    const skipped = review([{ ...first, status: 'dismissed' }, copy])
    expect(skipped.legById.get('d2')).toMatchObject({ copyOf: 'd1', decision: null })
    expect(skipped.chosen).toEqual([])
    expect(skipped.undecided).toBe(1)
  })

  it('saves the copy once the member explicitly chooses Flew on it', () => {
    const first = draft({ id: 'd1', ordinal: 1, fields: same, status: 'dismissed' })
    const copy = draft({
      id: 'd2',
      ordinal: 2,
      fields: same,
      selected: true,
      duplicateAcknowledged: true,
    })
    expect(review([first, copy]).chosen).toEqual(['d2'])
  })
})

describe('finish', () => {
  it('counts flights saved before a reload from the converted drafts, once each', () => {
    const drafts = [
      draft({ id: 'd1', ordinal: 1, status: 'converted', convertedFlightId: 11, fields: same }),
      draft({
        id: 'd2',
        ordinal: 2,
        status: 'dismissed',
        fields: { ...same, destination: 'LAX' },
      }),
      draft({
        id: 'd3',
        ordinal: 3,
        status: 'converted',
        convertedFlightId: 13,
        fields: { ...same, origin: 'BOS', destination: 'JFK' },
      }),
    ]
    const reloaded = review(drafts)
    expect(reloaded.recorded).toBe(true)
    const finish = finishOf({
      drafts,
      outcomes: new Map(),
      landSaved: new Set(),
      legs: reloaded.legs,
    })
    expect(finish).toMatchObject({ flights: 2, firstFlightId: 11, land: 0, touched: ['US'] })
    expect(finish.km).toBeGreaterThan(0)

    const outcomes = new Map([
      ['d3', { status: 'saved' as const, flightId: 13, replayed: false, aircraftIcao: null }],
    ])
    expect(finishOf({ drafts, outcomes, landSaved: new Set(), legs: reloaded.legs })).toMatchObject(
      {
        flights: 2,
        firstFlightId: 13,
      },
    )
  })
})

describe('completion', () => {
  const ready = { text: false, unsent: false, reading: false, sourceFailed: false }
  const state = (over: Partial<Parameters<typeof completionOf>[0]> = {}) => ({
    chosen: [],
    visits: [],
    blanks: 0,
    recorded: false,
    pendingLand: [],
    ...over,
  })

  it('saves what is decided and finishes only when everything decided is recorded', () => {
    expect(completionOf(state({ chosen: ['d1'] }), ready)).toEqual({ kind: 'save', count: 1 })
    expect(completionOf(state({ recorded: true }), ready)).toEqual({ kind: 'finish' })
    expect(completionOf(state(), ready)).toEqual({ kind: 'blocked', reason: 'nothing' })
    expect(completionOf(state({ recorded: true, blanks: 1 }), ready)).toEqual({
      kind: 'blocked',
      reason: 'not-ready',
    })
  })

  it('names the reason a finish is refused, so the bar and the handler agree', () => {
    const recorded = state({ recorded: true })
    expect(completionOf(recorded, { ...ready, sourceFailed: true })).toEqual({
      kind: 'blocked',
      reason: 'source',
    })
    expect(completionOf(recorded, { ...ready, unsent: true })).toMatchObject({ reason: 'unsent' })
    expect(completionOf(recorded, { ...ready, reading: true })).toMatchObject({ reason: 'reading' })
    expect(
      completionOf(state({ chosen: ['d1'] }), { ...ready, text: true, unsent: true }),
    ).toMatchObject({ reason: 'text' })
    expect(completionOf(state({ chosen: ['d1'] }), { ...ready, sourceFailed: true })).toEqual({
      kind: 'save',
      count: 1,
    })
  })
})

describe('leg views', () => {
  it('hands each ticket its outcome, notes and questions', () => {
    const drafts = [
      draft({ id: 'd1', ordinal: 1, fields: same }),
      draft({ id: 'd2', ordinal: 2, fields: same }),
      draft({ id: 'd3', ordinal: 3, fields: { ...same, destination: 'LAX' } }),
      draft({
        id: 'd4',
        ordinal: 4,
        status: 'dismissed',
        fields: { ...same, origin: 'LAX', destination: 'SFO', by_land: true },
      }),
    ]
    const { views } = review(drafts, {
      outcomes: new Map([
        [
          'd1',
          {
            status: 'failed' as const,
            code: 'INTERNAL',
            httpStatus: 503,
            failure: 'transient' as const,
            retryable: true,
          },
        ],
        ['d3', { status: 'uncertain' as const }],
      ]),
      landFailed: new Set(['d4']),
    })
    expect(views.get('d1')).toMatchObject({ locked: false, done: false, line: 'flew' })
    expect(views.get('d1')!.problems).toHaveLength(1)
    expect(views.get('d2')).toMatchObject({ duplicate: 'Twice in this import', problems: [] })
    expect(views.get('d3')).toMatchObject({ locked: true })
    expect(views.get('d4')).toMatchObject({
      line: 'land',
      land: 'failed',
      landNote: 'Trips inside one country add no stamps.',
      problems: ['Not added to your Passport yet.'],
    })
  })
})
