import { expect, it } from 'vitest'
import { createReplaySchedule, monthAt, PLANE_MS, type TimelineItem } from './replay'

it('skips idle playback gaps and loop boundaries only after planes finish, while seeking keeps calendar time', () => {
  const timeline: TimelineItem[] = [
    {
      key: 'first',
      flightId: 1,
      origin: 'AAA',
      destination: 'BBB',
      date: '2019-01-01',
      month: '2019-01',
      weight: 1,
      startMs: 1000,
    },
    {
      key: 'last',
      flightId: 2,
      origin: 'BBB',
      destination: 'CCC',
      date: '2025-01-01',
      month: '2025-01',
      weight: 1,
      startMs: 20000,
    },
  ]
  const schedule = createReplaySchedule(timeline, 30000)
  const first = schedule.advance(0, true)
  expect(first.absoluteMs).toBe(1000)
  expect(first.planes.map((plane) => plane.item.key)).toEqual(['first'])
  const flying = schedule.advance(1000 + PLANE_MS - 1, true)
  expect(flying.absoluteMs).toBe(4999)
  expect(flying.planes).toHaveLength(1)
  const next = schedule.advance(1000 + PLANE_MS, true)
  expect(next.absoluteMs).toBe(20000)
  expect(next.planes.map((plane) => plane.item.key)).toEqual(['last'])
  expect([...next.arcs]).toEqual(['first', 'last'])
  const loop = schedule.advance(20000 + PLANE_MS, true)
  expect(loop.absoluteMs).toBe(31000)
  expect(loop.planes.map((plane) => plane.item.key)).toEqual(['first'])
  expect([...loop.arcs]).toEqual(['first'])
  schedule.seek(15000)
  const sought = schedule.advance(15000)
  expect(sought.absoluteMs).toBe(15000)
  expect(sought.planes).toHaveLength(0)
  expect(monthAt(timeline, sought.timeMs, 30000)).toBe('2022-01')
  expect(schedule.advance(15001, true).absoluteMs).toBe(20000)
})
