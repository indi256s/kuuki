import { BLOCK_TIME_MODEL, PRIOR_BLOCK_TIME_MODEL } from './blockTimeModel.generated'

export interface BlockTimeModel {
  intercept: number
  slopes: [number, number, number]
  jet: number
  samples: number
  rmse: number | null
  fittedAt: string | null
}

export interface BlockTimeSample { distanceKm: number; east: number; minutes: number }

// Scale kilometres to thousands for the five-term least-squares system.
function terms(distanceKm: number, east: number): number[] {
  return [1, Math.min(distanceKm, 1500) / 1000,
    Math.min(Math.max(distanceKm - 1500, 0), 2500) / 1000,
    Math.max(distanceKm - 4000, 0) / 1000, east * distanceKm / 1000]
}

export function estimateBlockMinutes(distanceKm: number, east: number, model = BLOCK_TIME_MODEL): number {
  const weights = [model.intercept, ...model.slopes.map(s => s * 1000), model.jet * 1000]
  const minutes = terms(distanceKm, east).reduce((sum, term, i) => sum + term * weights[i], 0)
  return Math.max(1, Math.min(1200, Math.round(minutes)))
}

export function fitBlockTimeModel(samples: BlockTimeSample[]): BlockTimeModel {
  if (samples.length < 30 || samples.some(s => !Number.isFinite(s.distanceKm) || !Number.isFinite(s.east) || !Number.isFinite(s.minutes))) {
    return PRIOR_BLOCK_TIME_MODEL
  }
  const bands = [0, 0, 0]
  for (const sample of samples) bands[sample.distanceKm <= 1500 ? 0 : sample.distanceKm <= 4000 ? 1 : 2]++
  if (bands.some(n => n < 5)) return PRIOR_BLOCK_TIME_MODEL

  const rows = samples.map(s => terms(s.distanceKm, s.east))
  const matrix = Array.from({ length: 5 }, (_, i) => Array.from({ length: 6 }, (_, j) =>
    rows.reduce((sum, row, k) => sum + row[i] * (j === 5 ? samples[k].minutes : row[j]), 0)))
  // Partial-pivot elimination on X'X | X'y. Unidentifiable fits retain the fixed prior.
  for (let col = 0; col < 5; col++) {
    let pivot = col
    for (let i = col + 1; i < 5; i++) if (Math.abs(matrix[i][col]) > Math.abs(matrix[pivot][col])) pivot = i
    if (Math.abs(matrix[pivot][col]) < 1e-10) return PRIOR_BLOCK_TIME_MODEL
    ;[matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]]
    const divisor = matrix[col][col]
    for (let j = col; j <= 5; j++) matrix[col][j] /= divisor
    for (let i = 0; i < 5; i++) {
      if (i === col) continue
      const factor = matrix[i][col]
      for (let j = col; j <= 5; j++) matrix[i][j] -= factor * matrix[col][j]
    }
  }
  const weights = matrix.map(row => row[5])
  if (weights.some(w => !Number.isFinite(w))) return PRIOR_BLOCK_TIME_MODEL
  const squaredError = rows.reduce((sum, row, k) =>
    sum + (row.reduce((predicted, term, i) => predicted + term * weights[i], 0) - samples[k].minutes) ** 2, 0)
  return { intercept: weights[0], slopes: [weights[1] / 1000, weights[2] / 1000, weights[3] / 1000],
    jet: weights[4] / 1000, samples: samples.length, rmse: Math.sqrt(squaredError / samples.length), fittedAt: new Date().toISOString() }
}

export function isLegacyEstimate(minutes: number, distanceKm: number): boolean {
  return [300, 500, 750, 800, 850].some(speed =>
    Math.abs(minutes - Math.round(distanceKm / speed * 60 + (distanceKm > 3000 ? 45 : 30))) <= 1)
}
