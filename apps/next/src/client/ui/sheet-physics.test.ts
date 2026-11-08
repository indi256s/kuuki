import { expect, it } from 'vitest'
import { recentSamples, velocityOf } from './sheet-physics'

it('a drag held still before release has no speed left to coast on', () => {
  // Two units in 50 ms, then the finger rests for a second before letting go.
  const samples = [
    { t: 0, value: 0 },
    { t: 50, value: 2 },
  ]
  expect(velocityOf(recentSamples(samples, 1050, 2))).toBe(0)
  // Released mid-flick, the speed is kept.
  expect(velocityOf(recentSamples(samples, 60, 2.4))).toBeGreaterThan(30)
})
