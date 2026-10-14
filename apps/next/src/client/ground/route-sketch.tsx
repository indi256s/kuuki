'use client'
// A schematic of the route: cities as dots joined by straight lines in visit order. It is not a map and never a way to
// pick countries; places without coordinates are named below it instead of being placed at (0, 0).

import { placeKey, placeLabel, type GroundPlaceSnapshot } from '@kuuki/shared/groundTravel'
import type { Locale } from '../../lib/format'
import { copy } from './copy'

export const SKETCH_WIDTH = 320
export const SKETCH_HEIGHT = 140
const PAD = 14

export type Sketch = {
  /** Distinct plotted places, in first-visit order. */
  dots: { key: string; x: number; y: number }[]
  /** Visit order as indexes into `dots`; a repeated city returns to its dot. */
  path: number[]
  /** Visited places with no coordinates. */
  missing: GroundPlaceSnapshot[]
}

/** Equirectangular projection scaled by cos(mean latitude), fitted into the box with equal padding. */
export function sketchOf(places: readonly GroundPlaceSnapshot[]): Sketch {
  const located = places.filter((place) => place.lat !== null && place.lon !== null)
  const missingByKey = new Map<string, GroundPlaceSnapshot>()
  for (const place of places)
    if (place.lat === null || place.lon === null) missingByKey.set(placeKey(place), place)
  if (located.length === 0) return { dots: [], path: [], missing: [...missingByKey.values()] }
  const meanLat = located.reduce((sum, place) => sum + place.lat!, 0) / located.length
  const scale = Math.cos((meanLat * Math.PI) / 180)
  const flat = located.map((place) => ({
    key: placeKey(place),
    x: place.lon! * scale,
    y: -place.lat!,
  }))
  const xs = flat.map((point) => point.x)
  const ys = flat.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX
  const spanY = Math.max(...ys) - minY
  const room = { w: SKETCH_WIDTH - 2 * PAD, h: SKETCH_HEIGHT - 2 * PAD }
  const factor = Math.min(
    spanX > 0 ? room.w / spanX : Infinity,
    spanY > 0 ? room.h / spanY : Infinity,
  )
  const k = Number.isFinite(factor) ? factor : 0
  const place = (x: number, y: number) => ({
    x: round(
      PAD + (spanX > 0 ? (x - minX) * k : room.w / 2) + (spanX > 0 ? (room.w - spanX * k) / 2 : 0),
    ),
    y: round(
      PAD + (spanY > 0 ? (y - minY) * k : room.h / 2) + (spanY > 0 ? (room.h - spanY * k) / 2 : 0),
    ),
  })
  const index = new Map<string, number>()
  const dots: Sketch['dots'] = []
  const path: number[] = []
  for (const point of flat) {
    let at = index.get(point.key)
    if (at === undefined) {
      at = dots.length
      index.set(point.key, at)
      dots.push({ key: point.key, ...place(point.x, point.y) })
    }
    path.push(at)
  }
  return { dots, path, missing: [...missingByKey.values()] }
}

const round = (value: number) => Math.round(value * 10) / 10

export function RouteSketch({
  places,
  locale,
}: {
  places: readonly GroundPlaceSnapshot[]
  locale: Locale
}) {
  const t = copy[locale]
  const sketch = sketchOf(places)
  const points = sketch.path.map((at) => `${sketch.dots[at].x},${sketch.dots[at].y}`).join(' ')
  return (
    <figure className="gt-sketch">
      {sketch.dots.length > 0 && (
        <svg
          viewBox={`0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`}
          role="img"
          aria-label={t.sketchLabel}
          className="gt-sketch-svg"
        >
          {sketch.path.length > 1 && (
            <polyline
              points={points}
              fill="none"
              stroke="var(--map-route)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {sketch.dots.map((dot) => (
            <circle
              key={dot.key}
              cx={dot.x}
              cy={dot.y}
              r="4"
              fill="var(--surface)"
              stroke="var(--map-route)"
              strokeWidth="2"
            />
          ))}
        </svg>
      )}
      <figcaption>
        {t.sketchLabel}
        {sketch.missing.length > 0 && (
          <span className="gt-sketch-missing">
            {t.sketchMissing(sketch.missing.map((place) => placeLabel(place, locale)).join(', '))}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
