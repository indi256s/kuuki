import { expect, it } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import type { Gate, OverviewScope } from '@kuuki/shared/overview/figures'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import dateLineFixture from '../../../../../../packages/shared/src/overview/__fixtures__/dateLine.json'
import { CORPUS } from './corpus'
import { pickLine } from './pick'
import { TRIGGERS } from './triggers'

const payload = fixture as OverviewPayload
const scope = computeOverview(payload, {})

it('keeps a corpus triple for every trigger and only the removed slots are gone', () => {
  for (const trigger of TRIGGERS) expect(CORPUS[trigger.id], trigger.id).toHaveLength(3)
  const slots = new Set<string>(TRIGGERS.map((trigger) => trigger.slot))
  for (const gone of ['manufacturers', 'fleet', 'timeline'])
    expect(slots.has(gone), gone).toBe(false)
  for (const kept of ['routes', 'aircraft', 'rhythm']) expect(slots.has(kept), kept).toBe(true)
})

it('fires routes lines from the routes figures', () => {
  if (scope.routes.status !== 'ready') throw new Error('Board must satisfy Routes minimum')
  const data = scope.routes.value
  const expected = TRIGGERS.filter(
    (trigger) => trigger.slot === 'routes' && trigger.when(scope, scope) !== null,
  )
  expect(expected.length).toBeGreaterThan(0)
  const en = pickLine('routes', scope, scope, 'owner', 'en'),
    ru = pickLine('routes', scope, scope, 'owner', 'ru')
  expect(en).toBeTruthy()
  expect(ru).toMatch(/[а-я]/i)
  expect(en).not.toMatch(/\{\w+\}/)
  expect(ru).not.toMatch(/\{\w+\}/)
  if (data.top) expect(expected.map((trigger) => trigger.id)).toContain('routes:top-repeat')
})

it('keeps aircraft lines on the merged slot', () => {
  expect(pickLine('aircraft', scope, scope, 'owner', 'en')).toBeTruthy()
})

it('describes clock refunds without calling eastbound date-line flights westbound', () => {
  const payload = dateLineFixture as OverviewPayload
  const candidate = computeOverview(
    { ...payload, rows: payload.rows.filter((row) => row.origin === 'NRT') },
    {},
  )
  const crossings = ready(candidate.crossings)
  expect(crossings.eastboundShare).toBe(1)
  expect(crossings.backHours).toBeGreaterThan(2 * crossings.forwardHours)
  for (const locale of ['en', 'ru'] as const) {
    const line = pickLine('crossings', candidate, candidate, 'owner', locale)
    expect(line).not.toMatch(/west|запад/i)
    expect(
      CORPUS['crossings:mostly-backwards'].some(
        (variant) => variant[locale].replace('{back}', String(crossings.backHours)) === line,
      ),
    ).toBe(true)
  }
})

function ready<T>(gate: Gate<T>): T {
  if (gate.status !== 'ready') throw new Error('Board must satisfy the section minimum')
  return gate.value
}

function params(id: string, candidate: OverviewScope, all = scope) {
  const trigger = TRIGGERS.find((trigger) => trigger.id === id)
  if (!trigger) throw new Error(`Missing trigger: ${id}`)
  return trigger.when(candidate, all)
}

it('does not infer empty summers from a view that excludes a flight year', () => {
  const archive: OverviewPayload = {
    ...payload,
    rows: ['2020-01-01', '2021-07-01', '2022-01-01'].map((date, index) => ({
      ...payload.rows[0],
      id: index + 1,
      date,
    })),
  }
  const all = computeOverview(archive, {})
  const filtered = computeOverview(archive, { period: { years: [2020, 2022] } })
  expect(
    ready(filtered.rhythm)
      .cells.filter((cell) => cell.month === 7)
      .every((cell) => cell.flights === 0),
  ).toBe(true)
  expect(params('rhythm:july-and-august-empty', filtered, all)).toBeNull()
  const withoutSummer = computeOverview(
    { ...archive, rows: [archive.rows[0], archive.rows[2]] },
    {},
  )
  expect(params('rhythm:july-and-august-empty', withoutSummer, withoutSummer)).toEqual({
    from: '2020',
    to: '2022',
  })
})

it('lets majority coverage gaps win and treats exactly half as a boundary', () => {
  const candidate = structuredClone(scope)
  const fleet = ready(candidate.fleet),
    clock = ready(candidate.clock)
  fleet.total = clock.total = 11
  fleet.typed = clock.withDepartureTime = 5
  fleet.untyped = 6
  for (const [slot, id] of [
    ['aircraft', 'aircraft:sample'],
    ['clock', 'clock:sample'],
  ] as const) {
    expect(params(id, candidate)).toEqual({})
    expect(
      CORPUS[id].some((line) => line.en === pickLine(slot, candidate, scope, 'owner', 'en')),
    ).toBe(true)
  }
  fleet.total = clock.total = 10
  fleet.untyped = 5
  expect(params('aircraft:sample', candidate)).toBeNull()
  expect(params('clock:sample', candidate)).toBeNull()
})

it('requires unique arrival and pooled-month peaks, with enough evidence', () => {
  const candidate = structuredClone(scope)
  const clock = ready(candidate.clock),
    rhythm = ready(candidate.rhythm)
  clock.withArrivalTime = 5
  clock.arrPeakHour = { hour: 10, flights: 2 }
  clock.arrByHour = [
    { key: '10', hour: 10, flights: 2 },
    { key: '11', hour: 11, flights: 2 },
  ]
  expect(params('clock:arrival-peak', candidate)).toBeNull()
  clock.arrByHour[1].flights = 1
  expect(params('clock:arrival-peak', candidate)).toEqual({ hour: '10:00' })
  clock.withArrivalTime = 4
  expect(params('clock:arrival-peak', candidate)).toBeNull()
  rhythm.busiestMonthOfYear = { month: 1, flights: 2 }
  rhythm.cells = rhythm.cells.map((cell) => ({ ...cell, flights: 0 }))
  const jan = rhythm.cells.find((cell) => cell.month === 1)!
  const feb = rhythm.cells.find((cell) => cell.month === 2)!
  jan.flights = feb.flights = 2
  expect(params('rhythm:pooled-month', candidate)).toBeNull()
  feb.flights = 1
  expect(params('rhythm:pooled-month', candidate)).toEqual({ month: 1, count: 2 })
  jan.flights = 1
  rhythm.busiestMonthOfYear.flights = 1
  expect(params('rhythm:pooled-month', candidate)).toBeNull()
})

it('does not search past a latest year with only one flight', () => {
  const candidate = structuredClone(scope)
  const routes = ready(candidate.routes)
  for (const [id, newRoutes] of [
    ['routes:all-new-year', 2],
    ['routes:nothing-new-year', 0],
  ] as const) {
    routes.byYear = [{ key: '2024', year: 2024, flights: 2, newRoutes }]
    expect(params(id, candidate)).toEqual({ year: '2024', flights: 2 })
    routes.byYear.push({ key: '2025', year: 2025, flights: 1, newRoutes: 1 })
    expect(params(id, candidate)).toBeNull()
  }
})

it('includes missing airlines in the two-carrier denominator and skips single-airline leadership', () => {
  const candidate = structuredClone(scope)
  candidate.figures.flights = 10
  candidate.rankings.airlines = [
    { key: 'EK', count: 5 },
    { key: 'TK', count: 3 },
  ]
  expect(params('rankings:two-airline-split', candidate)).toEqual({ percent: 80 })
  candidate.figures.flights = 11
  expect(params('rankings:two-airline-split', candidate)).toBeNull()
  candidate.rankings.airlines = [{ key: 'EK', count: 5 }]
  candidate.rankings.leaders.airlines = {
    top: candidate.rankings.airlines,
    total: 5,
    topShare: 1,
    top5Share: 1,
  }
  expect(params('rankings:airline-leader', candidate)).toBeNull()
})

it('does not call a shortlisted annual airline a new leader when omitted counts could tie it', () => {
  const candidate = structuredClone(scope),
    all = structuredClone(scope)
  candidate.figures.byYear = [{ key: '2025', year: 2025, flights: 5 }]
  all.rankings.airlines = [
    { key: 'EK', count: 10 },
    { key: 'TK', count: 5 },
  ]
  candidate.rankings.rankByYear.airlines = [
    { key: 'TK:2025', entity: 'TK', year: 2025, rank: 1, count: 3 },
  ]
  expect(params('rankings:new-airline-leader', candidate, all)).toEqual({ year: '2025' })
  candidate.rankings.rankByYear.airlines[0].count = 2
  expect(params('rankings:new-airline-leader', candidate, all)).toBeNull()
  candidate.rankings.rankByYear.airlines[0].count = 3
  candidate.rankings.rankByYear.airlines.push({
    key: 'EK:2025',
    entity: 'EK',
    year: 2025,
    rank: 1,
    count: 3,
  })
  expect(params('rankings:new-airline-leader', candidate, all)).toBeNull()
})

it('keeps signed clock jumps absolute and departure times ungrouped at their thresholds', () => {
  const candidate = structuredClone(scope)
  const records = ready(candidate.records)
  const ref = { flightId: null, origin: 'TBS', destination: 'AKL', value: -300 }
  records.biggestClockJump = ref
  expect(params('records:biggest-clock-jump', candidate)).toEqual({ hours: 5 })
  records.biggestClockJump = { ...ref, value: -299 }
  expect(params('records:biggest-clock-jump', candidate)).toBeNull()
  records.latestDeparture = { ...ref, date: '2025-01-01', depMinute: 1320 }
  expect(params('records:latest-departure', candidate)).toEqual({ time: '22:00' })
  records.latestDeparture.depMinute = 1319
  expect(params('records:latest-departure', candidate)).toBeNull()
})
