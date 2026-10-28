/** Resistance past a sheet or swipe row's bounds, approaching `limit` asymptotically. */
export function rubberBand(overshoot: number, limit = 80): number {
  return (1 - 1 / ((overshoot * 0.55) / limit + 1)) * limit
}
