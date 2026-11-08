/** Resistance past a sheet or swipe row's bounds, approaching `limit` asymptotically. */
export function rubberBand(overshoot: number, limit = 80): number {
  return (1 - 1 / ((overshoot * 0.55) / limit + 1)) * limit
}

/** A drag's value (rows, progress, px) at a pointer event's timestamp. */
export type Sample = { t: number; value: number }
const RELEASE_WINDOW_MS = 100

/** The samples a release measures its speed from: those of the last 100 ms before `t`, then `t` itself. */
export function recentSamples(samples: Sample[], t: number, value: number): Sample[] {
  return [...samples.filter((sample) => t - sample.t <= RELEASE_WINDOW_MS), { t, value }]
}

/** Value per second across the samples; 0 without two of them. */
export function velocityOf(samples: Sample[]): number {
  if (samples.length < 2) return 0
  const first = samples[0],
    last = samples[samples.length - 1]
  const seconds = (last.t - first.t) / 1000
  return seconds > 0 ? (last.value - first.value) / seconds : 0
}
