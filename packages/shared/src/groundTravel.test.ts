import { expect, it } from 'vitest'
import {
  compareJourneys,
  journeyMetrics,
  parsePlaceSnapshot,
  scheduleMinutes,
  type GroundPlaceSnapshot,
  type RoadPointInput,
} from './groundTravel'

const place = (id: string, lat: number | null, lon: number | null): GroundPlaceSnapshot => ({
  source: 'geonames',
  id,
  name: id,
  nameRu: null,
  nameEn: null,
  countryCode: 'GE',
  region: null,
  lat,
  lon,
  timezone: null,
  catalogVersion: 'test',
})
const point = (id: string, p: GroundPlaceSnapshot): RoadPointInput => ({
  id,
  place: p,
  arrivalDate: null,
  departureDate: null,
  nights: null,
  note: null,
})

it('counts a return trip twice in distance but once in unique cities, and refuses a partial sum', () => {
  const tbilisi = place('611717', 41.69143, 44.83412)
  const kars = place('743952', 40.59825, 43.08548)
  const roundTrip = journeyMetrics({
    mode: 'road',
    title: null,
    note: null,
    startDate: null,
    endDate: null,
    points: [point('a', tbilisi), point('b', kars), point('c', tbilisi)],
  })
  expect(roundTrip.uniqueCities).toBe(2)
  expect(roundTrip.distanceCoverage).toEqual({ known: 2, total: 2 })
  expect(roundTrip.distanceKm).toBeGreaterThan(350)

  const partial = journeyMetrics({
    mode: 'road',
    title: null,
    note: null,
    startDate: null,
    endDate: null,
    points: [point('a', tbilisi), point('b', kars), point('c', place('1', null, null))],
  })
  expect(partial.distanceKm).toBeNull()
  expect(partial.distanceCoverage).toEqual({ known: 1, total: 2 })
})

it('derives schedule minutes only from dated local times in known zones', () => {
  const leg = {
    departureDate: '2026-03-01',
    departureTime: '22:00',
    arrivalDate: '2026-03-02',
    arrivalTime: '08:30',
    fromTimezone: 'Asia/Tbilisi',
    toTimezone: 'Asia/Yerevan',
  }
  expect(scheduleMinutes(leg)).toBe(630)
  expect(scheduleMinutes({ ...leg, toTimezone: null })).toBeNull()
  expect(scheduleMinutes({ ...leg, arrivalDate: null })).toBeNull()
})

it('orders upcoming plans, past-dated plans, undated plans, then history with undated last', () => {
  const j = (id: string, status: 'planned' | 'completed', startDate: string | null) => ({
    id,
    status,
    startDate,
    createdAt: '2026-01-01T00:00:00Z',
  })
  const rows = [
    j('h-undated', 'completed', null),
    j('h-old', 'completed', '2020-01-01'),
    j('p-undated', 'planned', null),
    j('p-past', 'planned', '2026-09-01'),
    j('p-today', 'planned', '2026-10-13'),
    j('p-later', 'planned', '2026-12-01'),
    j('h-new', 'completed', '2026-05-01'),
  ]
  expect(rows.sort(compareJourneys('2026-10-13')).map((row) => row.id)).toEqual([
    'p-today',
    'p-later',
    'p-past',
    'p-undated',
    'h-new',
    'h-old',
    'h-undated',
  ])
})

it('rejects malformed or half-located snapshots', () => {
  expect(parsePlaceSnapshot({ ...place('1', 1, 2) })).not.toBeNull()
  expect(parsePlaceSnapshot({ ...place('1', 1, null) })).toBeNull()
  expect(parsePlaceSnapshot({ ...place('abc', null, null) })).toBeNull()
  expect(parsePlaceSnapshot({ ...place('1', null, null), countryCode: 'ge' })).toBeNull()
})
