import { describe, expect, it } from 'vitest'
import { draft } from '../../import/fixtures'
import type { Draft } from '../../import/import-types'
import { answerDate } from './rows'

const undated = (over: Partial<Draft> = {}) =>
  draft({
    id: 'a',
    fields: {
      date: '',
      origin: 'JFK',
      destination: 'BOS',
      airline_iata: 'AA',
      date_month_day: '03-01',
      flown_confirmed: true,
    },
    yearExplicit: false,
    selected: false,
    ...over,
  })

describe('answerDate', () => {
  it('selects a row the date answer completes', () => {
    expect(answerDate(undated(), '2026-03-01').selected).toBe(true)
  })

  it('leaves a row unselected while another required field is low', () => {
    const row = undated({ fieldConfidence: { origin: 0.2 } })
    expect(answerDate(row, '2026-03-01').selected).toBeUndefined()
  })

  it('leaves a row unselected while overall confidence is low', () => {
    expect(answerDate(undated({ confidence: 0.3 }), '2026-03-01').selected).toBeUndefined()
  })
})
