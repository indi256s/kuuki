import { expect, it } from 'vitest'
import { crossings } from './crossings'
import type { OverviewPayload, OverviewRow } from './model'

function row(extra: Partial<OverviewRow> = {}): OverviewRow {
  return {
    id: 1,
    weight: 3,
    date: '2025-01-01',
    state: 'logged',
    origin: 'A',
    destination: 'B',
    airline: null,
    aircraft: null,
    flightNumber: null,
    depMinute: null,
    arrMinute: null,
    distanceKm: null,
    durationMinutes: null,
    zonesOverflown: null,
    durationSource: null,
    originTz: 'UTC',
    destTz: 'UTC',
    departureUtc: null,
    suppressed: 0,
    ...extra,
  }
}

function route(a: [number, number], b: [number, number]) {
  const airports = Object.fromEntries(
    [a, b].map(([lat, lon], i) => [
      i === 0 ? 'A' : 'B',
      { lat, lon, country: null, city: null, name: '' },
    ]),
  )
  return { airports, aircraft: {}, regions: {} } satisfies OverviewPayload['refs']
}

it.each([1, -1])('counts narrow polar excursions in both directions (hemisphere %s)', (sign) => {
  const refs = route(
    [sign * 66.55621517241588, -1.512293149862321],
    [sign * 66.55621517241588, 1.512293149862321],
  )
  for (const flight of [row(), row({ origin: 'B', destination: 'A' })]) {
    expect(crossings([flight], refs)).toMatchObject({
      status: 'ready',
      value: { [sign === 1 ? 'arcticCircle' : 'antarcticCircle']: 6 },
    })
  }
})

it.each([
  [[10, -179], [10, 180], 0],
  [[10, 179], [10, 180], 0],
  [[10, 179], [10, -179], 3],
  [[-10, 180], [10, 180], 0],
  [[80, 0], [80, 180], 0],
] as const)('counts only internal antimeridian side changes: %j to %j', (a, b, dateLine) => {
  const refs = route([...a], [...b])
  for (const flight of [row(), row({ origin: 'B', destination: 'A' })]) {
    expect(crossings([flight], refs)).toMatchObject({ status: 'ready', value: { dateLine } })
  }
})

it('ignores latitude tangency, endpoint contact and coincident equator arcs', () => {
  const radians = Math.PI / 180
  const endpoint =
    Math.atan(Math.tan(66.5634 * radians) * Math.cos(1.512293149862321 * radians)) / radians
  for (const [a, b, field] of [
    [[endpoint, -1.512293149862321], [endpoint, 1.512293149862321], 'arcticCircle'],
    [[0, 0], [10, 10], 'equator'],
    [[0, -10], [0, 10], 'equator'],
  ] as const) {
    expect(crossings([row()], route([...a], [...b]))).toMatchObject({
      status: 'ready',
      value: { [field]: 0 },
    })
  }
})

it('uses the deterministic antipodal arc for geometric counts', () => {
  // The existing fallback from the north pole follows longitude 0 through the equator.
  expect(crossings([row()], route([90, 0], [-90, 0]))).toMatchObject({
    status: 'ready',
    value: { equator: 3, arcticCircle: 3, antarcticCircle: 3, dateLine: 0 },
  })
})

it('reports weighted coordinate coverage independently of the timezone gate', () => {
  expect(crossings([row()], { airports: {}, aircraft: {}, regions: {} })).toMatchObject({
    status: 'ready',
    value: { locatedFlights: 0 },
  })
  expect(
    crossings(
      [row({ weight: 5 }), row({ destination: 'missing', weight: 2 })],
      route([10, 0], [20, 10]),
    ),
  ).toMatchObject({
    status: 'ready',
    value: { locatedFlights: 5 },
  })
})
