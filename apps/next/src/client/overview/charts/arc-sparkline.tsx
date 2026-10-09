import { useId, type ReactNode } from 'react'

// Adapted from Arc Sparkline, MIT; upstream hashes in docs/research/2026-10-08-arc-source-inventory.md.
// Keep its monotone geometry; Kuuki's metric stays immediate rather than rolling digits.
function curveFor(data: number[]): [number, number][] {
  const min = Math.min(...data),
    span = Math.max(...data) - min
  const ys = data.map((value) => (span ? (value - min) / span : 0.5))
  const last = ys.length - 1,
    step = 1 / last
  const slopes = ys.slice(1).map((y, index) => (y - ys[index]) / step)
  const tangents = ys.map((_, index) =>
    index === 0 || index === last
      ? slopes[0]
      : (Math.sign(slopes[index - 1]) + Math.sign(slopes[index])) *
          Math.min(
            Math.abs(slopes[index - 1]),
            Math.abs(slopes[index]),
            Math.abs(slopes[index - 1] + slopes[index]) / 4,
          ) || 0,
  )
  if (last > 1) {
    tangents[0] = (3 * slopes[0] - tangents[1]) / 2
    tangents[last] = (3 * slopes[last - 1] - tangents[last - 1]) / 2
  }
  const samples = Math.max(1, Math.min(16, Math.round(128 / last)))
  const points: [number, number][] = []
  for (let index = 0; index < last; index++)
    for (let sample = 0; sample < samples; sample++) {
      const t = sample / samples,
        t2 = t * t,
        t3 = t2 * t
      const y =
        (2 * t3 - 3 * t2 + 1) * ys[index] +
        (t3 - 2 * t2 + t) * step * tangents[index] +
        (3 * t2 - 2 * t3) * ys[index + 1] +
        (t3 - t2) * step * tangents[index + 1]
      points.push([(index + t) * step, Math.min(1, Math.max(0, y))])
    }
  points.push([1, ys[last]])
  return points
}

/** `place` marks the hero's inline and full-width copies so CSS can show one of them. */
/** `caption` replaces the visible caption (the accessible name stays `summary`). */
export function ArcSparkline({
  values,
  labels,
  summary,
  place,
  caption,
}: {
  values: readonly number[]
  labels: readonly string[]
  summary: string
  place?: 'inline' | 'row'
  caption?: ReactNode
}) {
  const id = useId()
  const data = values.length > 1 ? [...values] : [values[0] ?? 0, values[0] ?? 0]
  const path = curveFor(data)
    .map(([x, y]) => `${(x * 150 + 5).toFixed(2)},${(5 + (1 - y) * 42).toFixed(2)}`)
    .join('L')
  return (
    <figure className="ov3-sparkline" data-place={place}>
      <svg
        width="160"
        height="52"
        viewBox="0 0 160 52"
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
        aria-describedby={id}
      >
        <desc id={id}>{labels.join('; ')}</desc>
        <path d={`M${path}L155,52L5,52Z`} fill="var(--mark-1)" opacity=".08" />
        <path
          d={`M${path}`}
          fill="none"
          stroke="var(--mark-1)"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption>{caption ?? summary}</figcaption>
    </figure>
  )
}
