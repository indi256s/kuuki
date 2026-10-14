'use client'
// Geographic city connections, not a rail/road track. Reuses the pinned atlas from the other Kuuki maps.

import { placeKey, placeLabel, type GroundPlaceSnapshot } from '@kuuki/shared/groundTravel'
import type { Locale } from '../../lib/format'
import { copy } from './copy'
import { wrappedBounds } from '../maps/geometry'

export const SKETCH_WIDTH = 320
export const SKETCH_HEIGHT = 200
const PAD = 36

export type Sketch = {
  /** Distinct plotted places, in first-visit order. */
  dots: { key: string; x: number; y: number; place: GroundPlaceSnapshot }[]
  atlas?: { x: number; y: number; scaleX: number; scaleY: number; worldWidth: number }
  /**
   * Visit order as runs of indexes into `dots`; a repeated city returns to its dot. A place without coordinates ends a
   * run, so known points are never joined across it.
   */
  segments: number[][]
  /** Visited places with no coordinates. */
  missing: GroundPlaceSnapshot[]
}

/** Equirectangular projection scaled by cos(mean latitude), fitted into the box with equal padding. */
export function sketchOf(places: readonly (GroundPlaceSnapshot | null)[]): Sketch {
  const located = places.filter(
    (place): place is GroundPlaceSnapshot =>
      place !== null && place.lat !== null && place.lon !== null,
  )
  const missingByKey = new Map<string, GroundPlaceSnapshot>()
  for (const place of places)
    if (place && (place.lat === null || place.lon === null))
      missingByKey.set(placeKey(place), place)
  if (located.length === 0) return { dots: [], segments: [], missing: [...missingByKey.values()] }
  const bounds = wrappedBounds([
    { type: 'LineString', coordinates: located.map((p) => [p.lon!, p.lat!]) },
  ])!
  const centerLon = (bounds[0][0] + bounds[1][0]) / 2
  const longitude = (lon: number) => lon + 360 * Math.round((centerLon - lon) / 360)
  const meanLat = located.reduce((sum, p) => sum + p.lat!, 0) / located.length
  const scale = Math.max(0.2, Math.cos((meanLat * Math.PI) / 180))
  const flat = located.map((p) => ({ key: placeKey(p), x: longitude(p.lon!) * scale, y: -p.lat! }))
  const xs = flat.map((p) => p.x),
    ys = flat.map((p) => p.y)
  const minX = Math.min(...xs),
    minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX,
    spanY = Math.max(...ys) - minY
  // Keep local trips in their surrounding region instead of magnifying a single city indefinitely.
  const k = Math.min(
    12,
    (SKETCH_WIDTH - 2 * PAD) / Math.max(spanX, 0.01),
    (SKETCH_HEIGHT - 2 * PAD) / Math.max(spanY, 0.01),
  )
  const project = (x: number, y: number) => ({
    x: round(SKETCH_WIDTH / 2 + (x - minX - spanX / 2) * k),
    y: round(SKETCH_HEIGHT / 2 + (y - minY - spanY / 2) * k),
  })
  const corner = project(-180 * scale, -90)
  const atlas = { ...corner, scaleX: (k * scale) / 2, scaleY: k / 2, worldWidth: 360 * scale * k }
  const index = new Map<string, number>()
  const dots: Sketch['dots'] = []
  const segments: number[][] = []
  let run: number[] = []
  let next = 0
  for (const visited of places) {
    if (!visited || visited.lat === null || visited.lon === null) {
      if (run.length > 0) segments.push(run)
      run = []
      continue
    }
    const point = flat[next++]
    let at = index.get(point.key)
    if (at === undefined) {
      at = dots.length
      index.set(point.key, at)
      dots.push({ key: point.key, ...project(point.x, point.y), place: visited })
    }
    run.push(at)
  }
  if (run.length > 0) segments.push(run)
  return { dots, segments, missing: [...missingByKey.values()], atlas }
}

const round = (value: number) => Math.round(value * 10) / 10

type CityLabel = {
  key: string
  name: string
  fullName: string
  x: number
  y: number
  width: number
  dot: Sketch['dots'][number]
}

function cityLabels(dots: Sketch['dots'], locale: Locale): CityLabel[] {
  const labels: CityLabel[] = []
  for (const dot of dots) {
    const fullName = placeLabel(dot.place, locale)
    const name = fullName.length > 20 ? fullName.slice(0, 19) + '…' : fullName
    const width = Math.min(132, name.length * 6.5 + 10)
    const candidates = [
      [dot.x + 9, dot.y - 23],
      [dot.x - width - 9, dot.y - 23],
      [dot.x + 9, dot.y + 9],
      [dot.x - width - 9, dot.y + 9],
      [dot.x - width / 2, dot.y - 33],
      [dot.x - width / 2, dot.y + 19],
      [dot.x - width / 2, dot.y - 55],
      [dot.x - width / 2, dot.y + 41],
    ]
    for (const [x, y] of candidates) {
      if (x < 4 || y < 4 || x + width > SKETCH_WIDTH - 4 || y + 18 > SKETCH_HEIGHT - 4) continue
      if (
        labels.some(
          (l) => x < l.x + l.width + 3 && x + width + 3 > l.x && y < l.y + 21 && y + 21 > l.y,
        )
      )
        continue
      if (dots.some((p) => p.x > x - 5 && p.x < x + width + 5 && p.y > y - 5 && p.y < y + 23))
        continue
      labels.push({ key: dot.key, name, fullName, x, y, width, dot })
      break
    }
  }
  return labels
}

export function RouteSketch({
  places,
  locale,
}: {
  places: readonly (GroundPlaceSnapshot | null)[]
  locale: Locale
}) {
  const t = copy[locale]
  const sketch = sketchOf(places)
  const lines = sketch.segments
    .filter((run) => run.length > 1)
    .map((run) => run.map((at) => `${sketch.dots[at].x},${sketch.dots[at].y}`).join(' '))
  const end = sketch.segments.at(-1)?.at(-1)
  // Endpoints get first claim on the limited label space in dense routes.
  const labelOrder = [
    sketch.dots[0],
    end === undefined ? undefined : sketch.dots[end],
    ...sketch.dots,
  ].filter((dot, index, all): dot is Sketch['dots'][number] => !!dot && all.indexOf(dot) === index)
  const labels = cityLabels(labelOrder, locale)
  const labelled = new Set(labels.map((label) => label.key))
  const extraCities = sketch.dots.filter((dot) => !labelled.has(dot.key))
  return (
    <figure className="gt-sketch">
      {sketch.atlas && (
        <svg
          viewBox={`0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`}
          role="img"
          aria-label={`${t.sketchLabel}: ${sketch.dots.map((d) => placeLabel(d.place, locale)).join(', ')}`}
          className="gt-sketch-svg"
        >
          {[-1, 0, 1].map((wrap) => (
            <g
              key={wrap}
              transform={`translate(${sketch.atlas!.x + wrap * sketch.atlas!.worldWidth} ${sketch.atlas!.y}) scale(${sketch.atlas!.scaleX} ${sketch.atlas!.scaleY})`}
            >
              <image
                className="gt-map-light"
                href="/maps/world-outline-110m-2.0.2-r2-light.svg"
                width="720"
                height="360"
              />
              <image
                className="gt-map-dark"
                href="/maps/world-outline-110m-2.0.2-r2-dark.svg"
                width="720"
                height="360"
              />
            </g>
          ))}
          {lines.map((points, index) => (
            <polyline key={index} points={points} className="gt-map-route" />
          ))}
          {sketch.dots.map((dot, at) => (
            <g key={dot.key}>
              {at === 0 && at === end && (
                <circle cx={dot.x} cy={dot.y} r="7" className="gt-map-dot" />
              )}
              <circle cx={dot.x} cy={dot.y} r="4" className="gt-map-dot" data-end={at === end}>
                <title>{placeLabel(dot.place, locale)}</title>
              </circle>
            </g>
          ))}
          {labels.map((label) => (
            <g key={label.key} className="gt-map-label">
              <path
                d={`M${label.dot.x},${label.dot.y}L${Math.max(label.x, Math.min(label.dot.x, label.x + label.width))},${label.y + 9}`}
              />
              <rect x={label.x} y={label.y} width={label.width} height="18" rx="4" />
              <text x={label.x + 5} y={label.y + 13}>
                {label.name}
              </text>
              <title>{label.fullName}</title>
            </g>
          ))}
        </svg>
      )}
      <figcaption>
        {sketch.atlas && t.sketchLabel}
        {extraCities.length > 0 && (
          <span>
            {t.mapOtherCities(extraCities.map((d) => placeLabel(d.place, locale)).join(', '))}
          </span>
        )}
        {sketch.missing.length > 0 && (
          <span className="gt-sketch-missing">
            {t.sketchMissing(sketch.missing.map((p) => placeLabel(p, locale)).join(', '))}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
