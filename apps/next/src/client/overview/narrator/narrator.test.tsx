// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { bandOf } from '@kuuki/shared/overview/filter'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import type { OverviewScope } from '@kuuki/shared/overview/figures'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewProvider } from '../store/overview-context'
import { CORPUS } from './corpus'
import { canonicalFilter, pickLine } from './pick'
import { TRIGGERS, type NarratorSlot } from './triggers'
import { Narrator } from './narrator'

const payload = fixture as OverviewPayload
const all = computeOverview(payload, {})
const scope = (filter: OverviewFilter = {}) => computeOverview(payload, filter)
const gates = ['records', 'crossings', 'manufacturers', 'fleet', 'clock', 'rhythm'] as const
const gateKeys = ['records', 'crossings', 'makers', 'fleet', 'clock', 'rhythm'] as const
afterEach(cleanup)

it('keeps seed selection stable across key, facet value and nested year insertion order without mutation', () => {
  const filter: OverviewFilter = { airlines: ['QR', 'TK'], period: { years: [2025, 2024] }, depHours: [7, 12] }
  const reversed: OverviewFilter = { depHours: [12, 7], period: { years: [2024, 2025] }, airlines: ['TK', 'QR'] }
  const before = structuredClone(filter)
  expect(canonicalFilter(filter)).toBe('{"airlines":["QR","TK"],"depHours":[12,7],"period":{"years":[2024,2025]}}')
  expect(canonicalFilter(reversed)).toBe(canonicalFilter(filter))
  for (let i = 0; i < 30; i++) {
    expect(pickLine('globe', scope(filter), all, `owner${i}`, 'en')).toBe(pickLine('globe', scope(reversed), all, `owner${i}`, 'en'))
  }
  expect(filter).toEqual(before)
  expect(canonicalFilter({ period: { to: '2025-12', from: '2024-01' } })).toBe(canonicalFilter({ period: { from: '2024-01', to: '2025-12' } }))
  expect(canonicalFilter({ period: { from: '2024-01', to: '2025-12' } })).not.toBe(canonicalFilter({ period: { from: '2025-01', to: '2025-12' } }))
})

const fallbackScope = { ...all, globe: { ...all.globe, routes: [] } }

it('spreads thirty seeds over three variants while locale changes only presentation', () => {
  const seen = new Set<string | null>()
  for (let i = 0; i < 30; i++) {
    const en = pickLine('globe', fallbackScope, all, `owner${i}`, 'en')!
    const ru = pickLine('globe', fallbackScope, all, `owner${i}`, 'ru')!
    const variant = CORPUS.globe.findIndex(line => line.en.replace('{flights}', String(all.figures.flights)) === en)
    expect(variant).toBeGreaterThanOrEqual(0)
    expect(ru).toBe(CORPUS.globe[variant].ru.replace('{flights}', String(all.figures.flights)))
    seen.add(en)
  }
  expect(seen.size).toBe(3)
  // FNV1a32('owner2|globe|{}') = 3047448297; unsigned modulo three is zero.
  expect(pickLine('globe', fallbackScope, all, 'owner2', 'en')).toBe(CORPUS.globe[0].en.replace('{flights}', String(all.figures.flights)))
})

it('fills RU numbers with Unicode grouping and EN numbers with comma grouping', () => {
  const large = { ...fallbackScope, figures: { ...all.figures, flights: 14535 } }
  expect(pickLine('globe', large, all, 'owner', 'ru')).toMatch(/14[\u00a0\u202f]535/)
  expect(pickLine('globe', large, all, 'owner', 'en')).toContain('14,535')
})

it.each(gates)('%s uses its actual below gate and admits normal copy only when ready', slot => {
  const index = gates.indexOf(slot), key = gateKeys[index]
  const below = { ...all, [key]: { status: 'below', have: 17, need: 23 } }
  const normal = TRIGGERS.find(trigger => trigger.id === slot)!
  const fallback = TRIGGERS.find(trigger => trigger.id === `below:${slot}`)!
  for (const trigger of TRIGGERS.filter(candidate => candidate.slot === slot && !candidate.id.startsWith('below:'))) {
    expect(trigger.when(below, all), trigger.id).toBeNull()
  }
  expect(fallback.when(below, all)).toEqual({ have: 17, need: 23 })
  const line = pickLine(slot, below, all, 'owner', 'en')!
  expect(line).toContain('17')
  expect(line).toContain('23')
  expect(all[key].status).toBe('ready')
  expect(normal.when(all, all)).not.toBeNull()
  expect(fallback.when(all, all)).toBeNull()
  const actual = scope({ airlines: ['ZZ'] })
  const gate = actual[key]
  expect(gate.status).toBe('below')
  if (gate.status === 'below') expect(fallback.when(actual, all)).toEqual({ have: gate.have, need: gate.need })
})

it('keeps rankings ungated even without flights', () => {
  const empty = scope({ airlines: ['ZZ'] })
  expect(pickLine('rankings', empty, all, 'owner', 'en')).not.toBeNull()
  expect(TRIGGERS.find(trigger => trigger.id === 'below:rankings')).toBeUndefined()
})

it('first-run and zero-result slots are exclusive and use semantic filter emptiness', () => {
  const emptyPayload = { ...payload, rows: [] }
  for (const filter of [{}, { airlines: [], period: { years: [] } }] satisfies OverviewFilter[]) {
    const empty = computeOverview(emptyPayload, filter)
    expect(pickLine('firstRun', empty, all, 'owner', 'en')).not.toBeNull()
    expect(pickLine('zero', empty, all, 'owner', 'en')).toBeNull()
  }
  const zero = scope({ airlines: ['ZZ'] })
  expect(pickLine('firstRun', zero, all, 'owner', 'en')).toBeNull()
  expect(pickLine('zero', zero, all, 'owner', 'en')).not.toBeNull()
  expect(pickLine('firstRun', all, all, 'owner', 'en')).toBeNull()
  expect(pickLine('zero', all, all, 'owner', 'en')).toBeNull()
})

it('selects descending priority, skips null matches and keeps declared-order ties', () => {
  const original = [...TRIGGERS]
  const base = TRIGGERS.find(trigger => trigger.id === 'globe')!
  try {
    TRIGGERS.splice(0, TRIGGERS.length,
      { ...base, id: 'zero', priority: 1, when: () => ({}) },
      { ...base, id: 'firstRun', priority: 20, when: () => null },
      { ...base, id: 'firstRun', priority: 10, when: () => ({}) },
      { ...base, id: 'zero', priority: 10, when: () => ({}) })
    expect(CORPUS.firstRun.map(line => line.en)).toContain(pickLine('globe', all, all, 'owner', 'en'))
    expect(TRIGGERS.map(trigger => trigger.priority)).toEqual([1, 20, 10, 10])
    TRIGGERS[2] = { ...base, priority: 10, when: () => ({ flights: 'TBS–DOH' }) }
    expect(pickLine('globe', all, all, 'owner', 'ru')).toContain('TBS–DOH')
  } finally { TRIGGERS.splice(0, TRIGGERS.length, ...original) }
})

it('every trigger has three EN and RU lines with matching params, unique ids and valid slots', () => {
  const empty = computeOverview({ ...payload, rows: [] }, {})
  const zero = scope({ airlines: ['ZZ'] })
  const alternate: OverviewScope = { ...all,
    figures: { ...all.figures, flights: 80 },
    records: { status: 'ready', value: { ...ready(all.records), busiestDay: { date: '2024-07-01', flights: 3 } } },
    crossings: { status: 'ready', value: { ...ready(all.crossings), dateLine: 2, forwardHours: 10, backHours: 2 } },
    makers: { status: 'ready', value: { ...ready(all.makers), rows: ready(all.makers).rows.map(row => ({ ...row,
      flights: row.key === 'boeing' ? 40 : row.key === 'airbus' ? 20 : row.key === 'unknown' ? 2 : 0 })) } },
    rhythm: { status: 'ready', value: { ...ready(all.rhythm), years: [2024, 2023],
      cells: ready(all.rhythm).cells.filter(cell => cell.year === 2023 || cell.year === 2024)
        .map(cell => ({ ...cell, flights: cell.month === 7 ? 2 : 0 })) } },
    rankings: { ...all.rankings, airports: [{ key: 'TBS', count: 40 }] },
  }
  const specimens = [all, empty, zero, alternate, scope({ airlines: ['TK'] }), scope({ routes: ['IST-TBS'] }),
    computeOverview({ ...payload, mode: 'aggregate', rows: aggregateRows(payload.rows) }, {})]
  const slots = [...gates, 'rankings', 'globe', 'firstRun', 'zero']
  expect(new Set(TRIGGERS.map(trigger => trigger.id)).size).toBe(TRIGGERS.length)
  expect(Object.keys(CORPUS).sort()).toEqual(TRIGGERS.map(trigger => trigger.id).sort())
  expect(TRIGGERS.length).toBeGreaterThanOrEqual(35)
  expect(TRIGGERS.length).toBeLessThanOrEqual(45)
  for (const trigger of TRIGGERS) {
    expect(slots).toContain(trigger.slot)
    const matches = specimens.map(value => trigger.when(value, all)).filter(value => value !== null)
    expect(matches.length, trigger.id).toBeGreaterThan(0)
    const lines = CORPUS[trigger.id]
    expect(lines, trigger.id).toHaveLength(3)
    for (const locale of ['en', 'ru'] as const) {
      expect(new Set(lines.map(line => line[locale])).size).toBe(3)
      for (const line of lines) {
        const placeholders = [...line[locale].matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
        for (const params of matches) expect(placeholders, `${trigger.id}:${locale}`).toEqual(Object.keys(params).sort())
        expect(line.en.trim()).not.toBe('')
        expect(line.ru).toMatch(/[А-Яа-яЁё]/)
        expect(line.ru).not.toMatch(/(?<!\p{L})ты(?!\p{L})|твой|тебя|тебе/iu)
        expect(line[locale]).not.toMatch(/\d/)
      }
    }
  }
})

it('renders only a paragraph through the actual provider and omits unavailable or inapplicable data', () => {
  const saver = async (prefs: typeof DEFAULT_PREFS) => prefs
  const view = (locale: 'en' | 'ru', slot: NarratorSlot = 'globe', data: OverviewPayload | null = payload) =>
    <OverviewProvider payload={data} prefs={DEFAULT_PREFS} ownerKey="owner" locale={locale} live={false} saver={saver}><Narrator slot={slot} /></OverviewProvider>
  const { container, rerender, unmount } = render(view('en'))
  expect(container.children).toHaveLength(1)
  expect(container.firstElementChild?.tagName).toBe('P')
  expect(container.firstElementChild?.className).toBe('narrator')
  expect(container.textContent).toBe(pickLine('globe', all, all, 'owner', 'en'))
  rerender(view('ru'))
  expect(container.textContent).toBe(pickLine('globe', all, all, 'owner', 'ru'))
  rerender(view('en', 'firstRun'))
  expect(container).toBeEmptyDOMElement()
  unmount()
  const unavailable = render(view('en', 'globe', null))
  expect(unavailable.container).toBeEmptyDOMElement()
})

const paramsFor = (id: string, value: OverviewScope) => {
  const trigger = TRIGGERS.find(candidate => candidate.id === id)
  expect(trigger, id).toBeDefined()
  return trigger!.when(value, all)
}
const ready = <T,>(gate: { status: 'ready'; value: T } | { status: 'below'; have: number; need: number }): T => {
  if (gate.status !== 'ready') throw new Error('Expected ready evidence')
  return gate.value
}

it('admits a unique actual departure peak and rejects a tied peak', () => {
  const clock = ready(all.clock)
  const atSeven = { ...all, clock: { status: 'ready' as const, value: { ...clock,
    peakHour: { hour: 7, flights: 19 }, byHour: clock.byHour.map(row => ({ ...row, flights: row.hour === 7 ? 19 : 2 })) } } }
  expect(paramsFor('clock:unique-peak', atSeven)).toEqual({ hour: '07:00', count: 19, timed: clock.withDepartureTime })
  expect(pickLine('clock', atSeven, all, 'owner', 'en')).toContain('07:00')
  const noon = { ...atSeven, clock: { status: 'ready' as const, value: { ...atSeven.clock.value,
    peakHour: { hour: 12, flights: 19 }, byHour: clock.byHour.map(row => ({ ...row, flights: row.hour === 12 ? 19 : 2 })) } } }
  expect(paramsFor('clock:unique-peak', noon)).toEqual({ hour: '12:00', count: 19, timed: clock.withDepartureTime })
  const tied = { ...atSeven, clock: { status: 'ready' as const, value: { ...atSeven.clock.value,
    byHour: atSeven.clock.value.byHour.map(row => row.hour === 8 ? { ...row, flights: 19 } : row) } } }
  expect(paramsFor('clock:unique-peak', tied)).toBeNull()
  expect(pickLine('clock', tied, all, 'owner', 'en')).not.toContain('More departures')
})

it('uses actual AKL duration evidence, never distance or an illustrative duration', () => {
  const records = ready(all.records)
  const akl = { ...all, records: { status: 'ready' as const, value: { ...records,
    longestDuration: { flightId: null, origin: 'DOH', destination: 'AKL', value: 905 } } } }
  expect(paramsFor('records:auckland-duration', akl)).toEqual({ hours: 15.1 })
  expect(pickLine('records', akl, all, 'owner', 'en')).toContain('15.1')
  for (const longestDuration of [null, { flightId: null, origin: 'AKL', destination: 'DOH', value: 905 }]) {
    expect(paramsFor('records:auckland-duration', { ...akl, records: { status: 'ready', value: { ...akl.records.value, longestDuration } } })).toBeNull()
  }
})

it('uses actual Airbus counts and requires a strict lead over known makers including Boeing', () => {
  const makers = ready(all.makers)
  const contrast = { ...all, makers: { status: 'ready' as const, value: { ...makers,
    rows: makers.rows.map(row => ({ ...row, flights: row.key === 'airbus' ? 41 : row.key === 'boeing' ? 12 : 0 })) } } }
  expect(paramsFor('manufacturers:airbus-boeing', contrast)).toEqual({ airbus: 41, boeing: 12 })
  expect(pickLine('manufacturers', contrast, all, 'owner', 'en')).toContain('41')
  const tie = { ...contrast, makers: { status: 'ready' as const, value: { ...contrast.makers.value,
    rows: contrast.makers.value.rows.map(row => row.key === 'boeing' ? { ...row, flights: 41 } : row) } } }
  expect(paramsFor('manufacturers:airbus-boeing', tie)).toBeNull()
})

it('compares TBS endpoint count to flight total, not airport share, and names endpoint denominators', () => {
  const half = { ...all, figures: { ...all.figures, flights: 80 }, rankings: { ...all.rankings,
    airports: [{ key: 'TBS', count: 40 }], leaders: { ...all.rankings.leaders,
      airports: { top: [{ key: 'TBS', count: 40 }], total: 160, topShare: 0.25, top5Share: 0.25 } } } }
  expect(paramsFor('rankings:tbilisi-half', half)).toEqual({ count: 40, flights: 80 })
  expect(pickLine('rankings', half, all, 'owner', 'en')).toMatch(/half/i)
  const endpointHalf = { ...half, rankings: { ...half.rankings, airports: [{ key: 'TBS', count: 80 }] } }
  expect(paramsFor('rankings:tbilisi-half', endpointHalf)).toBeNull()
  expect(paramsFor('rankings:airport-leader', half)).toEqual({ code: 'TBS', count: 40, endpoints: 160 })
})

it('requires ready crossing evidence for zero date-line crossings', () => {
  const crossings = ready(all.crossings)
  expect(paramsFor('crossings:no-date-line', { ...all, crossings: { status: 'ready', value: { ...crossings, dateLine: 0 } } })).toEqual({ count: 0 })
  expect(paramsFor('crossings:no-date-line', { ...all, crossings: { status: 'below', have: 0, need: 3 } })).toBeNull()
  expect(paramsFor('crossings:no-date-line', { ...all, crossings: { status: 'ready', value: { ...crossings, dateLine: 1 } } })).toBeNull()
})

it('requires July evidence in every year of the scoped span, not a pooled peak', () => {
  const rhythm = ready(all.rhythm)
  const recurring = { ...all, rhythm: { status: 'ready' as const, value: { ...rhythm, years: [2024, 2023, 2022],
    cells: rhythm.cells.filter(cell => [2022, 2023, 2024].includes(cell.year)).map(cell => ({ ...cell, flights: cell.month === 7 ? 2 : 0 })) } } }
  expect(paramsFor('rhythm:every-july', recurring)).toEqual({ from: '2022', to: '2024', years: 3 })
  const gap = { ...recurring, rhythm: { status: 'ready' as const, value: { ...recurring.rhythm.value,
    cells: recurring.rhythm.value.cells.filter(cell => cell.year !== 2023) } } }
  expect(paramsFor('rhythm:every-july', gap)).toBeNull()
  expect(paramsFor('rhythm:every-july', { ...recurring, rhythm: { status: 'ready', value: { ...recurring.rhythm.value, years: [2024] } } })).toBeNull()
})

it('counts known narrowbody classifications without treating regional or unknown aircraft as narrowbodies', () => {
  const fleet = ready(all.fleet)
  const narrow = { ...all, fleet: { status: 'ready' as const, value: { ...fleet, total: 100,
    byBodyType: [{ key: 'narrowbody', flights: 30 }, { key: 'widebody', flights: 10 }, { key: 'unknown', flights: 60 }] } } }
  expect(paramsFor('fleet:narrow-majority', narrow)).toEqual({ narrow: 30, known: 40, total: 100 })
  expect(pickLine('fleet', narrow, all, 'owner', 'en')).toContain('known')
  expect(paramsFor('fleet:narrow-majority', { ...narrow, fleet: { status: 'ready', value: { ...narrow.fleet.value,
    byBodyType: [{ key: 'regional', flights: 30 }, { key: 'widebody', flights: 10 }] } } })).toBeNull()
  expect(paramsFor('fleet:narrow-majority', { ...narrow, fleet: { status: 'ready', value: { ...narrow.fleet.value,
    byBodyType: [{ key: 'narrowbody', flights: 20 }, { key: 'widebody', flights: 20 }] } } })).toBeNull()
})

it('uses actual board evidence and does not force illustrative motifs that the board contradicts', () => {
  expect(paramsFor('records:auckland-duration', all)).toEqual({ hours: 16.1 })
  expect(paramsFor('manufacturers:airbus-boeing', all)).toEqual({ airbus: 38, boeing: 21 })
  expect(paramsFor('clock:unique-peak', all)).toEqual({ hour: '07:00', count: 9, timed: 69 })
  expect(paramsFor('fleet:narrow-majority', all)).toEqual({ narrow: 46, known: 64, total: 69 })
  expect(paramsFor('rankings:tbilisi-half', all)).toBeNull()
  expect(paramsFor('rhythm:every-july', all)).toBeNull()
  expect(paramsFor('rankings:airport-leader', all)).toEqual({ code: 'IST', count: 29, endpoints: 138 })
  expect(pickLine('rankings', all, all, 'owner', 'en')).toContain('IST')
  expect(pickLine('rhythm', all, all, 'owner', 'en')).not.toContain('July')
})

it('preserves factual params through actual aggregation and falls back for missing record witnesses', () => {
  const aggregate = computeOverview({ ...payload, mode: 'aggregate', rows: aggregateRows(payload.rows) }, {})
  for (const id of ['records:auckland-duration', 'records:longest-distance', 'manufacturers:airbus-boeing',
    'fleet:narrow-majority', 'clock:unique-peak', 'rhythm:every-july', 'rankings:airport-leader', 'globe:route-footprint']) {
    expect(paramsFor(id, aggregate), id).toEqual(paramsFor(id, all))
  }
  expect(ready(aggregate.records).longestDuration?.flightId).toBeNull()
  expect(paramsFor('records:busiest-day', aggregate)).toBeNull()
  const missing = { ...aggregate, records: { status: 'ready' as const, value: { ...ready(aggregate.records),
    longest: null, longestDuration: null, busiestDay: null, busiestYear: null, longestStreakMonths: 0 } } }
  expect(pickLine('records', missing, all, 'owner', 'en')).toContain('69')
  for (const trigger of TRIGGERS) {
    const params = trigger.when(aggregate, all)
    if (params) expect(Object.keys(params)).not.toContain('flightId')
  }
})

it('keeps scoped and all-time totals and missing-time denominators explicit', () => {
  const filtered = scope({ airlines: ['TK'] })
  expect(paramsFor('globe:filtered-total', filtered)).toEqual({ selected: 24, total: 69 })
  expect(pickLine('globe', filtered, all, 'owner', 'en')).toMatch(/24.*69.*all-time|24.*all-time.*69/)
  expect(paramsFor('globe:filtered-total', all)).toBeNull()
  expect(paramsFor('globe:filtered-total', scope({ airlines: ['ZZ'] }))).toBeNull()
  const clock = { ...all, clock: { status: 'ready' as const, value: { ...ready(all.clock),
    peakHour: null, beforeNoonShare: 0.6, withDepartureTime: 10, total: 80 } } }
  expect(paramsFor('clock:morning-majority', clock)).toEqual({ percent: 60, timed: 10 })
  expect(pickLine('clock', clock, all, 'owner', 'en')).toContain('10')
  expect(pickLine('clock', clock, all, 'owner', 'en')).not.toContain('80')
  const airlines = { ...all, rankings: { ...all.rankings, leaders: { ...all.rankings.leaders,
    airlines: { top: [{ key: 'TK', count: 6 }], total: 10, topShare: 0.6, top5Share: 0.6 } } } }
  expect(paramsFor('rankings:airline-leader', airlines)).toEqual({ code: 'TK', count: 6, known: 10 })
})

it('selects specific actual observations above generic leaders without making lower facts unreachable', () => {
  const day = { ...all, records: { status: 'ready' as const, value: { ...ready(all.records),
    longestDuration: null, busiestDay: { date: '2024-07-01', flights: 3 } } } }
  expect(pickLine('records', day, all, 'owner', 'en')).toContain('2024-07-01')
  const forward = { ...all, crossings: { status: 'ready' as const, value: { ...ready(all.crossings),
    dateLine: 2, forwardHours: 10, backHours: 2 } } }
  expect(pickLine('crossings', forward, all, 'owner', 'en')).toContain('10')
  const route = scope({ routes: ['IST-TBS'] })
  expect(paramsFor('rankings:route-leader', route)).toEqual({ route: 'IST-TBS', count: 11 })
  expect(pickLine('rankings', route, all, 'owner', 'en')).toContain('IST-TBS')
  const airline = scope({ airlines: ['TK'] })
  expect(paramsFor('rankings:airline-leader', airline)).toEqual({ code: 'TK', count: 24, known: 24 })
  expect(pickLine('rankings', airline, all, 'owner', 'en')).toContain('TK')
})


it('keeps unknown evidence below actual gates despite a nonempty journal', () => {
  const unknown = computeOverview({ ...payload, rows: payload.rows.map(row => ({ ...row,
    aircraft: null, depMinute: null, originTz: null, destTz: null })) }, {})
  expect(unknown.figures.flights).toBe(69)
  for (const slot of ['manufacturers', 'fleet', 'clock', 'crossings'] as const) {
    const key = slot === 'manufacturers' ? 'makers' : slot
    const gate = unknown[key]
    expect(gate.status).toBe('below')
    if (gate.status === 'below') expect(paramsFor(`below:${slot}`, unknown)).toEqual({ have: 0, need: gate.need })
  }
  expect(paramsFor('fleet:narrow-majority', unknown)).toBeNull()
  expect(paramsFor('crossings:no-date-line', unknown)).toBeNull()
  expect(pickLine('firstRun', unknown, all, 'owner', 'en')).toBeNull()
})

// Real hash seeds exercise every paired variant at each semantic boundary.
const pickedVariants = (slot: NarratorSlot, value: OverviewScope) => {
  const pairs = new Map<string, { en: string; ru: string }>()
  for (let i = 0; i < 30; i++) {
    const en = pickLine(slot, value, all, `review${i}`, 'en')
    const ru = pickLine(slot, value, all, `review${i}`, 'ru')
    expect(en).not.toBeNull()
    expect(ru).not.toBeNull()
    pairs.set(en!, { en: en!, ru: ru! })
  }
  expect(pairs.size).toBe(3)
  expect(new Set([...pairs.values()].map(pair => pair.ru)).size).toBe(3)
  return [...pairs.values()]
}

it('does not claim family recurrence when five ready flights use distinct families', () => {
  const rows = ['A333', 'A359', 'B77W', 'AT76', 'A320'].map(aircraft => {
    const row = payload.rows.find(candidate => candidate.aircraft === aircraft)
    expect(row, aircraft).toBeDefined()
    return row!
  })
  const distinct = computeOverview({ ...payload, rows }, {})
  const fleet = ready(distinct.fleet)
  expect(fleet.typed).toBe(5)
  expect(fleet.familyCount).toBe(5)
  expect(fleet.familyRows.every(row => row.flights === 1)).toBe(true)
  expect(fleet.topFamily).toEqual({ family: '777', flights: 1 })
  expect(paramsFor('fleet:narrow-majority', distinct)).toBeNull()
  expect(paramsFor('fleet:top-family', distinct)).toEqual({ family: '777', count: 1 })
  for (const { en, ru } of pickedVariants('fleet', distinct)) {
    expect(en).toMatch(/777.*flights 1/)
    expect(ru).toMatch(/777.*перелётов 1/)
    expect(en).not.toMatch(/recurr|repeat/iu)
    expect(ru).not.toMatch(/повтор|регуляр/iu)
  }
})

it('describes before-noon coverage without calling tied night departures morning', () => {
  const rows = payload.rows.slice(0, 12).map((row, index) => ({ ...row, depMinute: Math.floor(index / 2) * 60 }))
  expect(rows.every(row => bandOf(row.depMinute) === 'night')).toBe(true)
  const night = computeOverview({ ...payload, rows }, {})
  const clock = ready(night.clock)
  expect(clock.redEyes).toBe(12)
  expect(clock.withDepartureTime).toBe(12)
  expect(clock.beforeNoonShare).toBe(1)
  expect(clock.byHour.filter(row => row.flights === 2)).toHaveLength(6)
  expect(paramsFor('clock:unique-peak', night)).toBeNull()
  expect(paramsFor('clock:morning-majority', night)).toEqual({ percent: 100, timed: 12 })
  for (const { en, ru } of pickedVariants('clock', night)) {
    expect(en).toMatch(/before.?noon/iu)
    expect(ru).toMatch(/до полудня/iu)
    expect(en).toContain('100%')
    expect(en).toContain('12')
    expect(ru).toContain('100%')
    expect(ru).toContain('12')
    expect(en).not.toMatch(/morning/iu)
    expect(ru).not.toMatch(/утр/iu)
  }
})

it.each([
  { months: ['2019-02', '2019-04'], id: 'rhythm:gap', params: { months: 1, from: '2019-03', to: '2019-03' } },
  { months: ['2019-01', '2019-02'], id: 'rhythm:pooled-month', params: { month: 1, count: 1 } },
])('keeps all paired variants grammatical for singleton $id evidence', ({ months, id, params }) => {
  const rows = months.map(month => {
    const row = payload.rows.find(candidate => candidate.date.startsWith(month))
    expect(row, month).toBeDefined()
    return row!
  })
  const singleton = computeOverview({ ...payload, rows }, {})
  expect(singleton.rhythm.status).toBe('ready')
  expect(paramsFor('rhythm:every-july', singleton)).toBeNull()
  expect(paramsFor(id, singleton)).toEqual(params)
  if (id === 'rhythm:pooled-month') expect(ready(singleton.rhythm).longestGap).toBeNull()
  for (const { en, ru } of pickedVariants('rhythm', singleton)) {
    expect(en).not.toMatch(/\b1 (?:consecutive )?(?:months|flights)\b/iu)
    expect(ru).not.toMatch(/\b1 (?:месяцев|месяца|перелётов|перелёта)(?!\p{L})/iu)
    if (id === 'rhythm:gap') {
      expect(en).toMatch(/months: 1/iu)
      expect(ru).toMatch(/месяцев(?: подряд)? 1/iu)
      expect(en).toContain('2019-03–2019-03')
      expect(ru).toContain('2019-03–2019-03')
    } else {
      expect(en).toMatch(/flights(?::)? 1/iu)
      expect(ru).toContain('перелётов 1')
      expect(en).toMatch(/month(?: number)? 1|month number here is 1/iu)
      expect(ru).toContain('номер 1')
    }
  }
})
