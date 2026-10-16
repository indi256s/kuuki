import { expect, it } from 'vitest'
import { createReplaySchedule, fitYearTicks, monthAt, PLANE_MS, type TimelineItem } from './replay'

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

it('keeps year labels from overlapping on the replay scrubber', () => {
  // Nov 2017 to Feb 2026: the first tick sits two months before 2018, the last a month before the end.
  const months = 100
  const ticks = [{ year: '2017', at: 0 }].concat(
    Array.from({ length: 9 }, (_, index) => ({
      year: String(2018 + index),
      at: (2 + index * 12) / (months - 1),
    })),
  )
  const label = 30,
    gap = 12
  for (const width of [0, 120, 284, 600]) {
    const kept = fitYearTicks(ticks, width, label, gap)
    expect(kept[0]!.year).toBe('2017')
    const spans = kept.map((tick, index) => {
      const x = tick.at * width
      return index === 0
        ? [x, x + label]
        : index === kept.length - 1
          ? [x - label, x]
          : [x - label / 2, x + label / 2]
    })
    for (let index = 1; index < spans.length; index++)
      expect(spans[index]![0]! - spans[index - 1]![1]!).toBeGreaterThanOrEqual(
        width ? gap : -Infinity,
      )
  }
  expect(fitYearTicks(ticks, 284, label, gap).map((tick) => tick.year)).toEqual([
    '2017',
    '2020',
    '2022',
    '2024',
    '2026',
  ])
})
