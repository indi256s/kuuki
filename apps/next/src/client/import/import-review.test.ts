import { describe, expect, it } from 'vitest'
import { draft } from './fixtures'
import type { Draft } from './import-types'
import { buildReview, type ReviewInput } from './import-review'

const review = (drafts: Draft[], over: Partial<ReviewInput> = {}) =>
  buildReview({
    drafts,
    outcomes: new Map(),
    states: {},
    entries: [],
    requiresSelection: true,
    deferred: new Set(),
    today: '2026-11-26',
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
