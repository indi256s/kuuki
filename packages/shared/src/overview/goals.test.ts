import { expect, it } from 'vitest'
import { goals } from './goals'
import type { Gate, OverviewScope } from './figures'

const below = (have: number, need: number): Gate<never> => ({ status: 'below', have, need })
const ready = { status: 'ready', value: {} } as Gate<never>

function scope(overrides: Partial<Omit<OverviewScope, 'goals'>> = {}, flights = 8) {
  return {
    filter: {},
    figures: {
      flights,
      distanceKm: 1000,
      countries: { value: 3, source: 'passport' },
    },
    routes: ready,
    records: ready,
    crossings: ready,
    rhythm: ready,
    clock: ready,
    fleet: ready,
    ...overrides,
  } as unknown as Omit<OverviewScope, 'goals'>
}

it('returns nothing at zero flights', () => {
  expect(goals(scope({ routes: below(0, 5), records: below(0, 3) }, 0))).toEqual([])
})

it('emits one unlock goal per locked section with the unit its gate counts', () => {
  const result = goals(
    scope({
      routes: below(2, 5),
      clock: below(1, 5),
      fleet: below(0, 5),
    }),
  )
  expect(result.filter((goal) => goal.kind === 'unlock')).toEqual([
    { id: 'unlock:routes', kind: 'unlock', section: 'routes', have: 2, need: 5, unit: 'flights' },
    { id: 'unlock:clock', kind: 'unlock', section: 'clock', have: 1, need: 5, unit: 'times' },
    {
      id: 'unlock:aircraft',
      kind: 'unlock',
      section: 'aircraft',
      have: 0,
      need: 5,
      unit: 'aircraft',
    },
  ])
})

it('orders unlocks by progress, then milestones by progress', () => {
  const result = goals(
    scope({ records: below(1, 3), crossings: below(2, 3), rhythm: below(1, 2) }, 8),
  )
  expect(result.map((goal) => goal.id)).toEqual([
    'unlock:crossings',
    'unlock:rhythm',
    'unlock:records',
    'milestone:flights:10',
  ])
  expect(result.find((goal) => goal.id === 'unlock:rhythm')).toMatchObject({ unit: 'months' })
})

it('adds the next rung of each ladder only when the filter is empty', () => {
  const base = scope({}, 60)
  base.figures.distanceKm = 50000
  base.figures.countries = { value: 12, source: 'passport' }
  expect(goals(base)).toEqual(
    [
      {
        id: 'milestone:flights:100',
        kind: 'milestone',
        metric: 'flights',
        have: 60,
        need: 100,
      },
      {
        id: 'milestone:countries:25',
        kind: 'milestone',
        metric: 'countries',
        have: 12,
        need: 25,
      },
      {
        id: 'milestone:distanceKm:384400',
        kind: 'milestone',
        metric: 'distanceKm',
        have: 50000,
        need: 384400,
        rung: 'moon',
      },
    ].sort((a, b) => b.have / b.need - a.have / a.need),
  )
  const filtered = { ...base, filter: { airlines: ['TK'] } }
  expect(goals(filtered)).toEqual([])
})

it('skips a ladder once its top rung is passed', () => {
  const base = scope({}, 1200)
  base.figures.distanceKm = 800000
  base.figures.countries = { value: 150, source: 'passport' }
  expect(goals(base)).toEqual([])
})

it('caps the list at four, keeping unlocks ahead of milestones', () => {
  const result = goals(
    scope({
      routes: below(1, 5),
      records: below(1, 3),
      crossings: below(1, 3),
      rhythm: below(1, 2),
      clock: below(1, 5),
      fleet: below(1, 5),
    }),
  )
  expect(result).toHaveLength(4)
  expect(result.every((goal) => goal.kind === 'unlock')).toBe(true)
})
