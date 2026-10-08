import { expect, it } from 'vitest'
import { buildTimeline, createReplaySchedule, monthAt, monthCandidates, replayDurationMs, yearTicks } from './replay'
import type { ReplayItem } from '@kuuki/shared/overview/next'
const item = (date: string, key = date, flightId: number | null = 1): ReplayItem => ({ date, key, flightId, origin: 'DOH', destination: 'AKL', weight: 1 })
it('duration clamps and follows the specified logarithm', () => {
  expect(replayDurationMs(1)).toBe(12000)
  expect(Math.round(replayDurationMs(69))).toBe(Math.round(10000 + 12000 * Math.log2(6.9)))
  expect(replayDurationMs(100000)).toBe(120000)
})
it('calendar-linear dates include leap days and UTC years 0–99, rejecting invalid dates', () => {
  const timeline = buildTimeline([item('2019-01-01'), item('2019-07-01'), item('2019-12-31'), item('2019-02-30')], 36500)
  expect(timeline.map(item => item.startMs)).toEqual([0, 18100, 36400])
  expect(monthAt(timeline, 18100, 36500)).toBe('2019-07')
  const early = buildTimeline([item('0099-01-01'), item('0099-12-31')], 36500)
  expect(early[1].startMs).toBe(36400)
  expect(monthCandidates(early, 36500)).toHaveLength(12)
  expect(yearTicks(early, 36500)).toEqual([{ year: '0099', month: '0099-01', startMs: 0 }])
  const leap = buildTimeline([item('2020-01-01'), item('2020-03-01')], 9100)
  expect(leap[1].startMs).toBe(6000)
})
it('aggregate routes batch by month and preserve keys, null identities and weights', () => {
  const a = { ...item('2019-01', 'aggregate:4', null), weight: 99 }, b = item('2019-01', 'aggregate:8', null)
  const timeline = buildTimeline([a, b, item('2019-02', 'aggregate:9', null)], 59000)
  expect(timeline.map(item => Math.round(item.startMs))).toEqual([0, 0, 31000])
  expect(timeline[0]).toMatchObject({ key: 'aggregate:4', flightId: null, weight: 99 })
})
it('cap includes loop tails; skipped launches stay arc-only; arcs clear at restart; seek retires planes', () => {
  const timeline = buildTimeline(Array.from({ length: 13 }, (_, index) => item('2019-01-31', `flight:${index}`, index)), 12000)
  const schedule = createReplaySchedule(timeline, 12000)
  const launch = timeline[0].startMs
  const rejected = timeline[12].key
  expect(schedule.advance(launch).planes).toHaveLength(12)
  expect(schedule.advance(launch + 200).planes.map(plane => plane.item.key)).not.toContain(rejected)
  const restarted = schedule.advance(12000)
  expect(restarted.arcs.size).toBe(0)
  expect(restarted.planes).toHaveLength(12)
  expect(schedule.advance(launch + 4001).planes).toHaveLength(0)
  schedule.seek(0)
  expect(schedule.advance(0).planes).toHaveLength(0)
  const mixed = [{ ...timeline[0], startMs: 0 }, ...timeline.slice(1)]
  const tails = createReplaySchedule(mixed, 12000)
  tails.advance(launch)
  expect(tails.advance(12000).planes).toHaveLength(12)
  expect(tails.advance(12000).arcs.has(mixed[0].key)).toBe(true)
})
