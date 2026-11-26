import { describe, expect, it } from 'vitest'
import { draft } from './fixtures'
import type { Draft, DraftFields } from './import-types'
import {
  buildRoute,
  decisionChange,
  decisionOf,
  landVisits,
  legOf,
  placeOf,
  stampReach,
  type Leg,
  type RouteItem,
} from './route-model'

const NONE: ReadonlySet<string> = new Set()
const fly = (id: string, fields: Partial<DraftFields>, over: Partial<Draft> = {}) =>
  draft({
    id,
    ordinal: Number(id.replace(/\D/g, '')) || 0,
    fields: { date: '', origin: '', destination: '', airline_iata: '', ...fields },
    ...over,
  })
const legs = (drafts: Draft[], land: ReadonlySet<string> = NONE) =>
  drafts.map((item) => legOf(item, land))
const shape = (items: RouteItem[]) =>
  items.map((item) =>
    item.kind === 'leg'
      ? `leg ${item.leg.id}`
      : item.kind === 'station'
        ? `station ${item.place.code ?? item.place.hint} ${item.in?.id ?? '-'}>${item.out?.id ?? '-'}`
        : item.kind === 'month'
          ? `month ${item.year}-${item.month}${item.showYear ? ' year' : ''}`
          : 'undated',
  )

describe('places', () => {
  it('reads the country from the airport or the city hint', () => {
    const row = fly('d1', { origin: 'LIS', destination_hint: 'Bangkok, TH' })
    expect(placeOf(row, 'origin')).toMatchObject({ code: 'LIS', country: 'PT' })
    expect(placeOf(row, 'destination')).toMatchObject({ code: null, country: 'TH' })
  })

  it('treats two airports of one city and its hint as one place', () => {
    const a = placeOf(fly('d1', { origin: 'BKK' }), 'origin')
    const b = placeOf(fly('d2', { origin: 'DMK' }), 'origin')
    const c = placeOf(fly('d3', { origin_hint: 'Bangkok, TH' }), 'origin')
    expect(a.key).toBe(b.key)
    expect(a.key).toBe(c.key)
  })
})

describe('route grouping', () => {
  it('orders dated legs, shares stations along a continuous run and labels months', () => {
    const route = buildRoute(
      legs([
        fly('d3', { date: '2025-03-11', origin: 'BKK', destination: 'CNX' }),
        fly('d1', { date: '2025-02-01', origin: 'LIS', destination: 'OPO' }),
        fly('d2', { date: '2025-02-22', origin: 'OPO', destination_hint: 'Bangkok, TH' }),
      ]),
    )
    expect(shape(route)).toEqual([
      'month 2025-2 year',
      'station LIS ->d1',
      'leg d1',
      'station OPO d1>d2',
      'leg d2',
      'month 2025-3',
      'station BKK d2>d3',
      'leg d3',
      'station CNX d3>-',
    ])
    const through = route.find((item) => item.kind === 'month' && item.month === 3)
    expect(through).toMatchObject({ through: { id: 'd2' } })
  })

  it('starts a new segment where continuity breaks', () => {
    const route = buildRoute(
      legs([
        fly('d1', { date: '2025-02-01', origin: 'LIS', destination: 'OPO' }),
        fly('d2', { date: '2025-02-05', origin: 'JFK', destination: 'LAX' }),
      ]),
    )
    expect(shape(route)).toEqual([
      'month 2025-2 year',
      'station LIS ->d1',
      'leg d1',
      'station OPO d1>-',
      'station JFK ->d2',
      'leg d2',
      'station LAX d2>-',
    ])
  })

  it('collects undated and year-unconfirmed legs under No date at the end', () => {
    const route = buildRoute(
      legs([
        fly('d2', { origin: 'JFK', destination: 'LAX' }),
        fly(
          'd1',
          { date: '2024-12-30', origin: 'LAX', destination: 'JFK' },
          { yearExplicit: false },
        ),
        fly('d3', { date: '2023-05-01', origin: 'BOS', destination: 'JFK' }),
      ]),
    )
    expect(shape(route)).toEqual([
      'month 2023-5 year',
      'station BOS ->d3',
      'leg d3',
      'station JFK d3>-',
      'undated',
      'station LAX ->d1',
      'leg d1',
      'station JFK d1>d2',
      'leg d2',
      'station LAX d2>-',
    ])
  })

  it('repeats the year when the route crosses into a new one', () => {
    const route = buildRoute(
      legs([
        fly('d1', { date: '2024-12-30', origin: 'JFK', destination: 'LAX' }),
        fly('d2', { date: '2025-01-02', origin: 'LAX', destination: 'JFK' }),
      ]),
    )
    expect(shape(route).filter((line) => line.startsWith('month'))).toEqual([
      'month 2024-12 year',
      'month 2025-1 year',
    ])
  })
})

describe('decisions', () => {
  it('reads one decision from the draft state', () => {
    expect(decisionOf(fly('d1', {}, { selected: true }), NONE)).toBe('flew')
    expect(decisionOf(fly('d1', {}, { selected: false }), NONE)).toBeNull()
    expect(decisionOf(fly('d1', {}, { selected: false }), NONE, true)).toBe('flew')
    expect(decisionOf(fly('d1', {}, { status: 'dismissed' }), NONE)).toBe('skip')
    expect(decisionOf(fly('d1', {}, { status: 'dismissed' }), new Set(['d1']))).toBe('land')
    expect(decisionOf(fly('d1', {}, { duplicateFlightId: 4, selected: true }), NONE)).toBeNull()
    expect(
      decisionOf(
        fly('d1', {}, { duplicateFlightId: 4, selected: true, duplicateAcknowledged: true }),
        NONE,
      ),
    ).toBe('flew')
  })

  it('maps a decision to the existing draft change', () => {
    const open = fly('d1', {}, { selected: false })
    const gone = fly('d1', {}, { status: 'dismissed' })
    expect(decisionChange(open, 'flew')).toEqual({ selected: true })
    expect(decisionChange(gone, 'flew')).toEqual({ selected: true, dismissed: false })
    expect(decisionChange(fly('d1', {}, { duplicateFlightId: 7 }), 'flew')).toEqual({
      selected: true,
      duplicateAcknowledged: true,
    })
    expect(decisionChange(open, 'skip')).toEqual({ dismissed: true })
    expect(decisionChange(open, 'land')).toEqual({ dismissed: true })
    expect(decisionChange(gone, 'land')).toBeNull()
    expect(decisionChange(gone, 'skip')).toBeNull()
  })
})

describe('land visits', () => {
  const land = new Set(['d1', 'd2', 'd3', 'd4'])
  const route = legs(
    [
      fly('d1', { date: '2025-02-01', origin: 'LIS', destination: 'OPO' }, { status: 'dismissed' }),
      fly(
        'd2',
        { date: '2025-03-01', origin: 'OPO', destination_hint: 'Madrid, ES' },
        { status: 'dismissed' },
      ),
      fly(
        'd3',
        { origin_hint: 'Madrid, ES', destination_hint: 'Somewhere' },
        { status: 'dismissed' },
      ),
      fly('d4', { origin_hint: 'Somewhere', destination: 'CDG' }, { status: 'dismissed' }),
      fly('d5', { date: '2025-04-01', origin: 'CDG', destination: 'JFK' }, { status: 'dismissed' }),
    ],
    land,
  )

  it('records a crossing into a known country and nothing inside one country', () => {
    expect(landVisits(route)).toEqual([
      { id: 'd2', countryCode: 'ES', visitYear: 2025 },
      { id: 'd4', countryCode: 'FR', visitYear: null },
    ])
  })

  it('skips legs already recorded', () => {
    const saved: Leg[] = route.map((leg) => (leg.id === 'd2' ? { ...leg, saved: true } : leg))
    expect(landVisits(saved).map((visit) => visit.id)).toEqual(['d4'])
  })
})

describe('stamp reach', () => {
  it('lights countries reached by a flight or by land and keeps the rest as ghosts', () => {
    const reach = stampReach(
      legs(
        [
          fly('d1', { date: '2025-02-01', origin: 'LIS', destination: 'BKK' }, { selected: true }),
          fly(
            'd2',
            { date: '2025-03-01', origin: 'BKK', destination: 'DPS' },
            { status: 'dismissed' },
          ),
          fly(
            'd3',
            { date: '2025-04-01', origin: 'DPS', destination: 'JFK' },
            { status: 'dismissed' },
          ),
        ],
        new Set(['d2']),
      ),
    )
    expect(reach).toEqual([
      { code: 'PT', lit: true },
      { code: 'TH', lit: true },
      { code: 'ID', lit: true },
      { code: 'US', lit: false },
    ])
  })
})
