import { expect, it } from 'vitest'
import { ridgeProfile } from './helpers'
it('normalizes dense peaks to one and rejects unavailable durations', () => {
  const profile = ridgeProfile([90, 95, 100, 110, 120, 130, 140, 150])
  expect(Math.max(...profile.map(point => point.height))).toBe(1)
  expect(profile[0].x).toBeCloseTo(30)
  expect(profile.at(-1)!.x).toBeCloseTo(1020)
  expect(ridgeProfile([0, -1, NaN, Infinity]).every(point => point.height === 0)).toBe(true)
})
it('retains separate sparse spikes and bounded heights for coincident flights', () => {
  const profile = ridgeProfile([60, 180, 540], 1024)
  const peaks = profile.filter((point, i) => i > 0 && i < profile.length - 1 && point.height > profile[i - 1].height && point.height > profile[i + 1].height)
  expect(peaks).toHaveLength(3)
  expect(peaks.every(point => Math.abs(point.height - 0.4) < 0.001)).toBe(true)
  expect(ridgeProfile(Array(7).fill(90)).every(point => point.height <= 1)).toBe(true)
})
