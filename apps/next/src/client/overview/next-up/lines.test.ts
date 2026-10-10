import { expect, it } from 'vitest'
import type { Goal } from '@kuuki/shared/overview/goals'
import { goalCopy } from './lines'

const title = (goal: { section: string }) =>
  ({ routes: 'Routes', clock: 'Clock', aircraft: 'Aircraft', rhythm: 'Rhythm' })[goal.section]!
const titleRu = (goal: { section: string }) =>
  ({ routes: 'Маршруты', clock: 'Часы', aircraft: 'Самолёты', rhythm: 'Ритм' })[goal.section]!
const unlock = (
  section: 'routes' | 'clock' | 'aircraft' | 'rhythm',
  unit: 'flights' | 'months' | 'times' | 'aircraft',
  have: number,
  need: number,
): Goal => ({ id: `unlock:${section}`, kind: 'unlock', section, have, need, unit })
const milestone = (metric: 'flights' | 'countries', have: number, need: number): Goal => ({
  id: `milestone:${metric}:${need}`,
  kind: 'milestone',
  metric,
  have,
  need,
})
const distance = (have: number, need: number, rung: 'equator' | 'moon' | 'moon_back'): Goal => ({
  id: `milestone:distanceKm:${need}`,
  kind: 'milestone',
  metric: 'distanceKm',
  have,
  need,
  rung,
})

it('words unlock goals with the missing count and the right noun', () => {
  expect(goalCopy(unlock('routes', 'flights', 3, 5), 'en', title).line).toBe(
    '2 more flights unlock Routes',
  )
  expect(goalCopy(unlock('routes', 'flights', 4, 5), 'en', title).line).toBe(
    '1 more flight unlocks Routes',
  )
  expect(goalCopy(unlock('clock', 'times', 2, 5), 'en', title).line).toBe(
    '3 more flights with departure times unlock Clock',
  )
  expect(goalCopy(unlock('aircraft', 'aircraft', 0, 5), 'en', title).line).toBe(
    '5 more flights with an aircraft unlock Aircraft',
  )
  expect(goalCopy(unlock('rhythm', 'months', 1, 2), 'en', title).line).toBe(
    '1 more month with flights unlocks Rhythm',
  )
  expect(goalCopy(unlock('routes', 'flights', 3, 5), 'en', title).label).toBe(
    'Flights: 3 of 5 needed',
  )
})

it('uses real Russian plural forms', () => {
  const line = (have: number) => goalCopy(unlock('routes', 'flights', have, 25), 'ru', titleRu).line
  expect(line(24)).toBe('Ещё 1 перелёт откроет раздел «Маршруты»')
  expect(line(22)).toBe('Ещё 3 перелёта откроют раздел «Маршруты»')
  expect(line(20)).toBe('Ещё 5 перелётов откроют раздел «Маршруты»')
  expect(line(4)).toBe('Ещё 21 перелёт откроет раздел «Маршруты»')
  expect(goalCopy(unlock('clock', 'times', 3, 5), 'ru', titleRu).line).toBe(
    'Ещё 2 перелёта со временем вылета откроют раздел «Часы»',
  )
  expect(goalCopy(unlock('aircraft', 'aircraft', 0, 5), 'ru', titleRu).line).toBe(
    'Ещё 5 перелётов с указанным самолётом откроют раздел «Самолёты»',
  )
  expect(goalCopy(unlock('routes', 'flights', 3, 5), 'ru', titleRu).label).toBe(
    'Перелётов: 3 из 5 нужных',
  )
})

it('words milestones as progress, with kilometres for distance rungs', () => {
  expect(goalCopy(milestone('flights', 7, 10), 'en', title).line).toBe('7 of 10 flights')
  expect(goalCopy(milestone('flights', 7, 10), 'ru', title).line).toBe('7 из 10 перелётов')
  expect(goalCopy(milestone('countries', 3, 5), 'en', title).line).toBe('3 of 5 countries')
  expect(goalCopy(milestone('countries', 3, 5), 'ru', title).line).toBe('3 из 5 стран')
  const km = (locale: 'en' | 'ru', rung: 'equator' | 'moon' | 'moon_back', need: number) =>
    goalCopy(distance(12345, need, rung), locale, title).line.replace(/\s/g, ' ')
  expect(km('en', 'equator', 40075)).toBe('Around the equator: 12,345 of 40,075 km')
  expect(km('en', 'moon', 384400)).toBe('To the Moon: 12,345 of 384,400 km')
  expect(km('en', 'moon_back', 768800)).toBe('To the Moon and back: 12,345 of 768,800 km')
  expect(km('ru', 'moon', 384400)).toBe('До Луны: 12 345 из 384 400 км')
})
