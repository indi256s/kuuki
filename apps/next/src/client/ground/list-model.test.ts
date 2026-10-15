import { describe, expect, it } from 'vitest'
import { routeStops, sectionsOf, visibleJourneys } from './list-model'
import { baku, kars, rail, road, tbilisi, uuid } from './test-fixtures'

const TODAY = '2026-06-10'

const journeys = [
  rail({ id: 1, status: 'completed', startDate: '2025-03-01' }),
  rail({ id: 2, status: 'completed', startDate: null }),
  road({ id: 3, status: 'planned', startDate: '2026-07-01' }),
  rail({ id: 4, status: 'planned', startDate: '2026-06-10' }),
  rail({ id: 5, status: 'planned', startDate: '2026-05-01' }),
  road({ id: 6, status: 'planned', startDate: null }),
  road({ id: 7, status: 'completed', startDate: '2026-02-01' }),
  rail({ id: 8, status: 'planned', startDate: '2026-04-01' }),
]
const ids = (list: { id: string }[]) => list.map((item) => item.id)

describe('ground list ordering and grouping', () => {
  it('puts plans first (upcoming, past-dated newest first, undated), then history newest first, undated last', () => {
    const visible = visibleJourneys(journeys, null, TODAY)
    expect(ids(visible)).toEqual([
      uuid(4), // today stays among the upcoming plans
      uuid(3),
      uuid(5), // past-dated plans, newest date first
      uuid(8),
      uuid(6), // undated plan
      uuid(7), // history, newest first
      uuid(1),
      uuid(2), // undated history last
    ])
  })

  it('makes a Plans section then a History section and omits empty ones', () => {
    const sections = sectionsOf(visibleJourneys(journeys, null, TODAY), TODAY)
    expect(sections.map((section) => section.id)).toEqual(['plans', 'history'])
    expect(sectionsOf([], TODAY)).toEqual([])
    const cancelled = [rail({ id: 9, status: 'cancelled', startDate: '2026-01-01' })]
    expect(sectionsOf(cancelled, TODAY).map((section) => section.id)).toEqual(['cancelled'])
  })

  it('filters by transport without reordering', () => {
    expect(ids(visibleJourneys(journeys, 'road', TODAY))).toEqual([uuid(3), uuid(6), uuid(7)])
    expect(ids(visibleJourneys(journeys, 'rail', TODAY))).toEqual([
      uuid(4),
      uuid(5),
      uuid(8),
      uuid(1),
      uuid(2),
    ])
  })

  it('recomputes groups for a new day without touching statuses', () => {
    const tomorrow = '2026-06-11'
    const sections = sectionsOf(visibleJourneys(journeys, null, tomorrow), tomorrow)
    expect(ids(sections[0].journeys).slice(0, 2)).toEqual([uuid(3), uuid(4)])
    expect(journeys.find((journey) => journey.id === uuid(4))?.status).toBe('planned')
  })
})

describe('route schematic stops', () => {
  const shape = (journey: Parameters<typeof routeStops>[0]) =>
    routeStops(journey).map((stop) => `${stop.afterGap ? '| ' : ''}${stop.role}:${stop.place.name}`)

  it('keeps the repeated city of a round trip as its destination', () => {
    expect(shape(road({ id: 1 }, [tbilisi, kars, tbilisi]))).toEqual([
      'start:Tbilisi',
      'via:Kars',
      'end:Tbilisi',
    ])
  })

  it('never joins disjoint rail legs', () => {
    const journey = rail({ id: 2 })
    if (journey.mode !== 'rail') throw new Error('rail fixture')
    journey.legs.push({ ...journey.legs[0], from: baku, to: tbilisi })
    expect(shape(journey)).toEqual(['start:Tbilisi', 'via:Kars', '| via:Baku', 'end:Tbilisi'])
  })
})
