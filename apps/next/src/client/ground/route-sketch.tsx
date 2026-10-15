'use client'
// Geographic city connections, not a rail/road track. Reuses the pinned atlas from the other Kuuki maps. The detail
// sheet draws the full map with numbered stop marks and labels; a list card draws a small unlabelled one. Both use one
// projection and one stop-mark rule, so the sheet's route list, its map and the card agree on start, stops and end.

import {
  placeKey,
  placeLabel,
  railRouteRuns,
  type GroundJourneyDto,
  type GroundPlaceSnapshot,
} from '@kuuki/shared/groundTravel'
import type { Locale } from '../../lib/format'
import { copy } from './copy'
import { wrappedBounds } from '../maps/geometry'

/** The box a sketch is fitted into. `fill` is the share of the padded box the route may span; `minSpanDeg` keeps a
 * short trip in its region instead of magnifying one city. */
export type SketchFrame = {
  width: number
  height: number
  pad: number
  fill: number
  minSpanDeg: number
}

export const SKETCH_WIDTH = 400
export const SKETCH_HEIGHT = 232
const SHEET_FRAME: SketchFrame = {
  width: SKETCH_WIDTH,
  height: SKETCH_HEIGHT,
  pad: 28,
  fill: 0.62,
  minSpanDeg: 3.5,
}
const CARD_FRAME: SketchFrame = { width: 260, height: 130, pad: 14, fill: 0.75, minSpanDeg: 4 }

export type Sketch = {
  width: number
  height: number
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

/** Equirectangular projection scaled by cos(mean latitude), centred in the frame. */
export function sketchOf(
  places: readonly (GroundPlaceSnapshot | null)[],
  frame: SketchFrame = SHEET_FRAME,
): Sketch {
  const { width, height, pad, fill, minSpanDeg } = frame
  const located = places.filter(
    (place): place is GroundPlaceSnapshot =>
      place !== null && place.lat !== null && place.lon !== null,
  )
  const missingByKey = new Map<string, GroundPlaceSnapshot>()
  for (const place of places)
    if (place && (place.lat === null || place.lon === null))
      missingByKey.set(placeKey(place), place)
  const missing = [...missingByKey.values()]
  if (located.length === 0) return { width, height, dots: [], segments: [], missing }
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
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys)
  const k = Math.min(
    ((width - 2 * pad) * fill) / Math.max(maxX - minX, minSpanDeg * scale, 0.01),
    ((height - 2 * pad) * fill) / Math.max(maxY - minY, minSpanDeg, 0.01),
  )
  const midX = (minX + maxX) / 2,
    midY = (minY + maxY) / 2
  const project = (x: number, y: number) => ({
    x: round(width / 2 + (x - midX) * k),
    y: round(height / 2 + (y - midY) * k),
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
  return { width, height, dots, segments, missing, atlas }
}

const round = (value: number) => Math.round(value * 10) / 10

export type StopMark = { number: number; role: 'start' | 'via' | 'end' }

/** Number (first-visit order) and role of every plotted place, keyed by `placeKey`. The last visited place is the end. */
export function stopMarks(sketch: Sketch): Map<string, StopMark> {
  const end = sketch.segments.at(-1)?.at(-1)
  return new Map(
    sketch.dots.map((dot, at) => [
      dot.key,
      { number: at + 1, role: at === end ? 'end' : at === 0 ? 'start' : 'via' },
    ]),
  )
}

/**
 * The pinned world outlines, drawn only for the copies that reach the frame (a date-line route needs two). Borders
 * scale with the drawing, so a zoomed-in map takes the fine-stroke variant instead of a thick band.
 */
function Atlas({ sketch }: { sketch: Sketch }) {
  const atlas = sketch.atlas!
  const variant = atlas.scaleY > 3 ? 'r2-fine' : 'r2'
  return [-1, 0, 1]
    .filter((wrap) => {
      const left = atlas.x + wrap * atlas.worldWidth
      return left < sketch.width && left + atlas.worldWidth > 0
    })
    .map((wrap) => (
      <g
        key={wrap}
        transform={`translate(${atlas.x + wrap * atlas.worldWidth} ${atlas.y}) scale(${atlas.scaleX} ${atlas.scaleY})`}
      >
        <image
          className="gt-map-light"
          href={`/maps/world-outline-110m-2.0.2-${variant}-light.svg`}
          width="720"
          height="360"
        />
        <image
          className="gt-map-dark"
          href={`/maps/world-outline-110m-2.0.2-${variant}-dark.svg`}
          width="720"
          height="360"
        />
      </g>
    ))
}

function routeLines(sketch: Sketch) {
  return sketch.segments
    .filter((run) => run.length > 1)
    .map((run) => run.map((at) => sketch.dots[at]))
}

/** One chevron at the middle of each connection long enough to carry it, pointing the way of travel. */
function arrows(sketch: Sketch, minLength: number) {
  const marks: { key: string; x: number; y: number; angle: number }[] = []
  for (const line of routeLines(sketch))
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i]
      if (Math.hypot(b.x - a.x, b.y - a.y) < minLength) continue
      marks.push({
        key: `${marks.length}`,
        x: round((a.x + b.x) / 2),
        y: round((a.y + b.y) / 2),
        angle: round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI),
      })
    }
  return marks
}

const PIN = 9
const LABEL_HEIGHT = 16

type CityLabel = { key: string; name: string; fullName: string; x: number; y: number }

/** Places each name beside its pin where it fits inside the frame and clear of other names and pins. */
function cityLabels(sketch: Sketch, order: Sketch['dots'], locale: Locale): CityLabel[] {
  const placed: (CityLabel & { width: number })[] = []
  const gap = PIN + 4
  for (const dot of order) {
    const fullName = placeLabel(dot.place, locale)
    const name = fullName.length > 22 ? fullName.slice(0, 21) + '…' : fullName
    const width = Math.min(150, name.length * 6.6 + 2)
    const candidates = [
      [dot.x + gap, dot.y - LABEL_HEIGHT / 2],
      [dot.x - gap - width, dot.y - LABEL_HEIGHT / 2],
      [dot.x - width / 2, dot.y - gap - LABEL_HEIGHT],
      [dot.x - width / 2, dot.y + gap],
      [dot.x + PIN, dot.y - PIN - LABEL_HEIGHT],
      [dot.x + PIN, dot.y + PIN],
      [dot.x - PIN - width, dot.y - PIN - LABEL_HEIGHT],
      [dot.x - PIN - width, dot.y + PIN],
    ]
    for (const [x, y] of candidates) {
      if (x < 6 || y < 6 || x + width > sketch.width - 6 || y + LABEL_HEIGHT > sketch.height - 6)
        continue
      if (
        placed.some(
          (l) =>
            x < l.x + l.width + 4 &&
            x + width + 4 > l.x &&
            y < l.y + LABEL_HEIGHT + 2 &&
            y + LABEL_HEIGHT + 2 > l.y,
        )
      )
        continue
      const clear = PIN + 1
      if (
        sketch.dots.some(
          (p) =>
            p.x > x - clear &&
            p.x < x + width + clear &&
            p.y > y - clear &&
            p.y < y + LABEL_HEIGHT + clear,
        )
      )
        continue
      placed.push({ key: dot.key, name, fullName, x: round(x), y: round(y), width })
      break
    }
  }
  return placed
}

/** The detail sheet's map. Pins carry the same numbers as the route list beneath it. */
export function RouteSketch({ sketch, locale }: { sketch: Sketch; locale: Locale }) {
  const t = copy[locale]
  const marks = stopMarks(sketch)
  const end = sketch.segments.at(-1)?.at(-1)
  // Endpoints get first claim on the limited label space in dense routes.
  const labelOrder = [
    sketch.dots[0],
    end === undefined ? undefined : sketch.dots[end],
    ...sketch.dots,
  ].filter((dot, index, all): dot is Sketch['dots'][number] => !!dot && all.indexOf(dot) === index)
  const labels = cityLabels(sketch, labelOrder, locale)
  const labelled = new Set(labels.map((label) => label.key))
  const extraCities = sketch.dots.filter((dot) => !labelled.has(dot.key))
  // A pin that would cover an earlier one shrinks to a dot; its number stays in the route list.
  const compact = new Set(
    sketch.dots
      .filter((dot, at) =>
        sketch.dots.slice(0, at).some((p) => Math.hypot(p.x - dot.x, p.y - dot.y) < PIN * 2),
      )
      .map((dot) => dot.key),
  )
  return (
    <figure className="gt-sketch">
      {sketch.atlas && (
        <svg
          viewBox={`0 0 ${sketch.width} ${sketch.height}`}
          role="img"
          aria-label={`${t.sketchLabel}: ${sketch.dots.map((d) => placeLabel(d.place, locale)).join(', ')}`}
          className="gt-sketch-svg"
        >
          <Atlas sketch={sketch} />
          {routeLines(sketch).map((line, index) => (
            <polyline
              key={index}
              points={line.map((dot) => `${dot.x},${dot.y}`).join(' ')}
              className="gt-map-route"
            />
          ))}
          {arrows(sketch, 44).map((arrow) => (
            <path
              key={arrow.key}
              d="M-3.5,-3.5L0.5,0L-3.5,3.5"
              className="gt-map-arrow"
              transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
            />
          ))}
          {sketch.dots.map((dot) => {
            const mark = marks.get(dot.key)!
            const small = compact.has(dot.key)
            return (
              <g key={dot.key} className="gt-map-pin" data-role={mark.role}>
                <circle cx={dot.x} cy={dot.y} r={small ? 4 : mark.role === 'via' ? PIN - 2 : PIN}>
                  <title>{placeLabel(dot.place, locale)}</title>
                </circle>
                {!small && (
                  <text x={dot.x} y={dot.y} aria-hidden="true">
                    {mark.number}
                  </text>
                )}
              </g>
            )
          })}
          {labels.map((label) => (
            <text
              key={label.key}
              className="gt-map-label"
              x={label.x}
              y={label.y + LABEL_HEIGHT / 2}
            >
              {label.name}
              <title>{label.fullName}</title>
            </text>
          ))}
        </svg>
      )}
      <figcaption>
        {sketch.atlas && <span>{t.sketchLabel}</span>}
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

/**
 * A list card's map: the same projection in a small frame, no labels or numbers. Decorative, since the card's link
 * already names the route; nothing renders when no stop has coordinates.
 */
export function RouteMiniMap({ places }: { places: readonly (GroundPlaceSnapshot | null)[] }) {
  const sketch = sketchOf(places, CARD_FRAME)
  if (!sketch.atlas) return null
  const marks = stopMarks(sketch)
  return (
    <svg
      viewBox={`0 0 ${sketch.width} ${sketch.height}`}
      aria-hidden="true"
      focusable="false"
      className="gt-card-map"
    >
      <Atlas sketch={sketch} />
      {routeLines(sketch).map((line, index) => (
        <polyline
          key={index}
          points={line.map((dot) => `${dot.x},${dot.y}`).join(' ')}
          className="gt-map-route"
        />
      ))}
      {sketch.dots.map((dot) => (
        <circle
          key={dot.key}
          cx={dot.x}
          cy={dot.y}
          r={marks.get(dot.key)!.role === 'via' ? 2.5 : 3.5}
          className="gt-map-dot"
          data-role={marks.get(dot.key)!.role}
        />
      ))}
    </svg>
  )
}

/** The places a journey visits in order; disjoint rail runs are separated by null so the map leaves a gap. */
export function journeyPlaces(journey: GroundJourneyDto): (GroundPlaceSnapshot | null)[] {
  return journey.mode === 'rail'
    ? railRouteRuns(journey.legs).flatMap((run, index) => (index === 0 ? run : [null, ...run]))
    : journey.points.map((point) => point.place)
}
