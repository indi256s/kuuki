import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload, OverviewRow } from '@kuuki/shared/overview/model'
import { pickLine, recordLine } from '../narrator/pick'
import { stubBucket } from './records'

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
