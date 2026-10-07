import { describe, expect, it } from 'vitest'
import { estimateBlockMinutes, fitBlockTimeModel, isLegacyEstimate } from './blockTime'
import { PRIOR_BLOCK_TIME_MODEL } from './blockTimeModel.generated'

const coefficients = { intercept: 25, slopes: [0.08, 0.072, 0.07], jet: -0.004 }
const samples = Array.from({ length: 200 }, (_, i) => {
  const distanceKm = 100 + (i * 173) % 14500
  const east = Math.sin(i * 1.23)
  const minutes = 25 + 0.08 * Math.min(distanceKm, 1500)
    + 0.072 * Math.min(Math.max(distanceKm - 1500, 0), 2500)
    + 0.07 * Math.max(distanceKm - 4000, 0) - 0.004 * east * distanceKm
  return { distanceKm, east, minutes }
})

describe('block time calibration', () => {
  it('prior reproduces the old default', () => {
    expect(estimateBlockMinutes(1000, 0, PRIOR_BLOCK_TIME_MODEL)).toBe(105)
    expect(PRIOR_BLOCK_TIME_MODEL).toEqual({ intercept: 30, slopes: [0.075, 0.075, 0.075], jet: 0, samples: 0, rmse: null, fittedAt: null })
  })

  it('monotonic in distance with the prior', () => {
    let previous = estimateBlockMinutes(0, 0, PRIOR_BLOCK_TIME_MODEL)
    for (let d = 100; d <= 15000; d += 100) {
      const minutes = estimateBlockMinutes(d, 0, PRIOR_BLOCK_TIME_MODEL)
      expect(minutes).toBeGreaterThanOrEqual(previous)
      previous = minutes
    }
  })

  it('fit recovers known coefficients and reports residual error', () => {
    const model = fitBlockTimeModel(samples)
    expect(model.intercept).toBeCloseTo(coefficients.intercept, 6)
    model.slopes.forEach((slope, i) => expect(slope).toBeCloseTo(coefficients.slopes[i], 6))
    expect(model.jet).toBeCloseTo(coefficients.jet, 6)
    expect(model.samples).toBe(200)
    expect(model.rmse).toBeLessThan(1e-6)
    expect(Number.isFinite(Date.parse(model.fittedAt!))).toBe(true)
    const noisy = fitBlockTimeModel(samples.flatMap(s => [
      { ...s, minutes: s.minutes - 7 }, { ...s, minutes: s.minutes + 7 },
    ]))
    expect(noisy.rmse).toBeCloseTo(7, 8)
  })

  it('fit falls back to prior on thin data, sparse bands or an unidentified jet term', () => {
    expect(fitBlockTimeModel(samples.slice(0, 29))).toEqual(PRIOR_BLOCK_TIME_MODEL)
    expect(fitBlockTimeModel(samples.filter(s => s.distanceKm < 4000))).toEqual(PRIOR_BLOCK_TIME_MODEL)
    expect(fitBlockTimeModel(samples.map(s => ({ ...s, east: 0 })))).toEqual(PRIOR_BLOCK_TIME_MODEL)
  })

  it('evaluates each band and signed jet effect before rounding and clamping', () => {
    const model = { ...PRIOR_BLOCK_TIME_MODEL, ...coefficients, slopes: [0.08, 0.072, 0.07] as [number, number, number] }
    expect(estimateBlockMinutes(5000, 1, model)).toBe(375)
    expect(estimateBlockMinutes(5000, -1, model)).toBe(415)
    expect(estimateBlockMinutes(0, 0, { ...model, intercept: -10 })).toBe(1)
    expect(estimateBlockMinutes(20000, 0, model)).toBe(1200)
  })

  it('legacy detector recognizes each old speed and the long-haul allowance', () => {
    for (const distance of [2000, 3000, 4000]) {
      for (const speed of [300, 500, 750, 800, 850]) {
        const legacy = Math.round(distance / speed * 60 + (distance > 3000 ? 45 : 30))
        expect(isLegacyEstimate(legacy, distance)).toBe(true)
        expect(isLegacyEstimate(legacy + 1, distance)).toBe(true)
      }
    }
    expect(isLegacyEstimate(137, 2000)).toBe(false)
  })
})
