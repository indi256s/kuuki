export function rubberBand(overshoot: number, limit = 80): number {
  return (1 - 1 / ((overshoot * 0.55) / limit + 1)) * limit
}

export type Sample = { t: number; value: number }
const RELEASE_WINDOW_MS = 100

export function recentSamples(samples: Sample[], t: number, value: number): Sample[] {
  return [...samples.filter((sample) => t - sample.t <= RELEASE_WINDOW_MS), { t, value }]
}

export function velocityOf(samples: Sample[]): number {
  if (samples.length < 2) return 0
  const first = samples[0],
    last = samples[samples.length - 1]
  const seconds = (last.t - first.t) / 1000
  return seconds > 0 ? (last.value - first.value) / seconds : 0
}
