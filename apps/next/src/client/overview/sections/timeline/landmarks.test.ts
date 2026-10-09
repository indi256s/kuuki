import { expect, it } from 'vitest'
import { landmarkSummary, lapCrossings, nextLandmark, spreadLabels, withinReach } from './landmarks'

it('finds the first point at or past each lap, several at once for a big jump', () => {
  const crossings = lapCrossings([{ x: 1, y: 30_000 }, { x: 2, y: 40_075 }, { x: 3, y: 90_000 }])
  expect(crossings.map(row => [row.lap, row.x])).toEqual([[1, 2], [2, 3]])
  expect(lapCrossings([{ x: 1, y: 100_000 }]).map(row => row.lap)).toEqual([1, 2])
  expect(lapCrossings([{ x: 1, y: 40_074 }])).toEqual([])
})
it('picks the nearest landmark above the total and keeps it within reach of the scale', () => {
  expect(nextLandmark(193_965)).toMatchObject({ kind: 'lap', laps: 5 })
  expect(nextLandmark(380_000)).toMatchObject({ kind: 'moon' })
  expect(nextLandmark(765_000)).toMatchObject({ kind: 'moonBack' })
  expect(withinReach(193_965, nextLandmark(193_965)!)).toBe(true)
  expect(withinReach(10_000, nextLandmark(10_000)!)).toBe(false)
  expect(nextLandmark(0)).toBeNull()
})
it('summarises laps and Moon progress without rounding up to arrival', () => {
  expect(landmarkSummary(193_965).moon).toEqual({ kind: 'moon', percent: 50 })
  expect(landmarkSummary(384_399).moon?.percent).toBe(99)
  expect(landmarkSummary(400_000).moon?.kind).toBe('moonBack')
  expect(landmarkSummary(800_000).moon).toBeNull()
})
it('drops labels that collide in both directions and keeps ones separated by either', () => {
  expect(spreadLabels([{ x: 0, y: 100 }, { x: 20, y: 105 }, { x: 60, y: 100 }, { x: 62, y: 80 }], 48, 14)).toEqual([true, false, true, true])
})
