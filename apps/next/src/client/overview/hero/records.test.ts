import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload, OverviewRow } from '@kuuki/shared/overview/model'
import { pickLine, recordLine } from '../narrator/pick'
import { compactNumber, pickStickers, railValue, stubBucket } from './records'

const board = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../../../packages/shared/src/overview/__fixtures__/board.json'),
    'utf8',
  ),
) as OverviewPayload
const template = board.rows[0]
const flight = (id: number, date: string, origin: string, destination: string): OverviewRow => ({
  ...template,
  id,
  date,
  origin,
  destination,
})
const withRows = (rows: OverviewRow[]): OverviewPayload => ({ ...board, rows })

describe('stubBucket', () => {
  it('steps the stack at 25, 75 and 200 flights', () => {
    expect([0, 24, 25, 74, 75, 199, 200, 5000].map(stubBucket)).toEqual([3, 3, 5, 5, 8, 8, 12, 12])
  })
})

describe('pickStickers', () => {
  // Visits: TR 7, AE 5, GB 2, QA 2, DE 1, GE 1. GE (Tbilisi, 2024) is the newest country.
  const rows = [
    ...[1, 2, 3].map((id) => flight(id, '2014-03-01', 'IST', 'DXB')),
    ...[4, 5].map((id) => flight(id, '2015-05-01', 'IST', 'LHR')),
    ...[6, 7].map((id) => flight(id, '2016-07-01', 'DOH', 'DXB')),
    flight(8, '2017-01-01', 'FRA', 'IST'),
    flight(9, '2024-02-01', 'TBS', 'IST'),
  ]
  const pick = (filter: OverviewFilter) =>
    pickStickers(withRows(rows), filter, computeOverview(withRows(rows), filter))

  it('puts the newest country in place of the fourth, oldest first, and lights it', () => {
    expect(pick({})).toEqual({ stickers: ['DXB', 'IST', 'LHR', 'TBS'], lit: 3 })
  })

  it('re-picks from the filtered rows', () => {
    expect(pick({ period: { years: [2014, 2015, 2016] } })).toEqual({
      stickers: ['DXB', 'IST', 'LHR', 'DOH'],
      lit: 3,
    })
  })

  it('draws a bare case without flights', () => {
    expect(pick({ airlines: ['ZZ'] })).toEqual({ stickers: [], lit: null })
  })
})

describe('rail values', () => {
  it('abbreviates by locale and never rounds up', () => {
    expect([69, 1999, 141_999, 2_460_000].map((n) => compactNumber('en', n))).toEqual([
      '69',
      '1.9k',
      '141k',
      '2.4M',
    ])
    expect(compactNumber('ru', 141_204)).toBe('141 тыс.')
    const figures = computeOverview(board, {}).figures
    expect(railValue('en', 'air', { ...figures, durationMinutes: 216 * 60 + 59 })).toBe('216h')
    expect(railValue('ru', 'air', { ...figures, durationMinutes: 216 * 60 })).toBe('216 ч')
  })
})

describe('record lines', () => {
  const all = computeOverview(board, {})

  it('falls back to the small-number line below the bar, and has no footer then', () => {
    const small = {
      ...withRows([1, 2, 3].map((id) => flight(id, '2024-02-01', 'TBS', 'IST'))),
      passport: { countries: 0, regions: 0, countryCodes: [] },
    }
    const scope = computeOverview(small, {})
    expect(recordLine('flights', scope, scope, 'owner', 'en', 0)).toMatch(/^Flights: 3\./)
    expect(pickLine('hero', scope, scope, 'owner', 'en')).toBe(null)
  })

  it('reads the footer line on first opening, then rotates through all three', () => {
    // The board journal clears 100,000 km, so the timing-belt trigger wins the footer for kilometres.
    const footer = pickLine('hero', all, all, 'owner', 'en')
    const turns = [0, 1, 2, 3].map((turn) => recordLine('km', all, all, 'owner', 'en', turn))
    expect(turns[0]).toBe(footer)
    expect(new Set(turns.slice(0, 3)).size).toBe(3)
    expect(turns[3]).toBe(turns[0])
  })
})
