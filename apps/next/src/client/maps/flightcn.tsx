'use client'

// Copyright (c) 2026 Yen Cheng Lin — MIT; complete notice: licenses/flightcn.LICENSE.
// Adapted controlled marker closure from https://raw.githubusercontent.com/ridemountainpig/flightcn/5c9061ef36bb2cd3cfa9f11f6463419944566a9d/src/registry/flight.tsx
import { Marker, type Map as LibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'
import { greatCircleKm } from '@kuuki/shared/geo'
import { bearing, routeGeometry, type RouteGeometry } from './geometry'
import { useMap } from './mapcn'

export function unwrapArcCoordinates(geometry: RouteGeometry): [number, number][] {
  if (geometry.type === 'LineString') {
    return geometry.coordinates
  }

  // Unwrap longitudes to ensure continuity across the antimeridian.
  // Without unwrapping, linear interpolation between segments ending at ~180°
  // and starting at ~-180° would incorrectly traverse through 0°.
  const result: [number, number][] = []
  for (const segment of geometry.coordinates) {
    for (const coord of segment) {
      if (result.length === 0) {
        result.push([coord[0], coord[1]])
        continue
      }

      const prev = result[result.length - 1]
      let lng = coord[0]
      while (lng - prev[0] > 180) lng -= 360
      while (lng - prev[0] < -180) lng += 360
      result.push([lng, coord[1]])
    }
  }

  return result
}

const cumulativeArcLengths = new WeakMap<[number, number][], number[]>()

function getCumulativeArcLengths(coords: [number, number][]): number[] {
  let lengths = cumulativeArcLengths.get(coords)
  if (!lengths) {
    lengths = new Array<number>(coords.length).fill(0)
    for (let i = 1; i < coords.length; i += 1) {
      lengths[i] =
        lengths[i - 1] +
        greatCircleKm(
          { lon: coords[i - 1][0], lat: coords[i - 1][1] },
          { lon: coords[i][0], lat: coords[i][1] },
        )
    }
    cumulativeArcLengths.set(coords, lengths)
  }
  return lengths
}

/**
 * Interpolate a position along coordinates at progress t (0-1).
 * Parameterized by arc length so the aircraft moves at constant speed even
 * when vertices are unevenly spaced — the antimeridian seam points inserted
 * by generateArcGeometry create zero- and half-length segments that would
 * otherwise make index-based interpolation visibly stall mid-flight.
 */
export function interpolatePosition(coords: [number, number][], t: number): [number, number] {
  if (coords.length === 0) return [0, 0]
  if (t <= 0) return coords[0]
  if (t >= 1) return coords[coords.length - 1]

  const cumulative = getCumulativeArcLengths(coords)
  const total = cumulative[cumulative.length - 1]

  // Degenerate path (all points identical) — fall back to index spacing.
  if (total <= Number.EPSILON) {
    const exactIndex = t * (coords.length - 1)
    const i = Math.min(Math.floor(exactIndex), coords.length - 2)
    const frac = exactIndex - i
    const a = coords[i]
    const b = coords[i + 1]
    return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]
  }

  const target = t * total
  // Binary search for the first vertex at or beyond the target distance.
  // Because cumulative[low - 1] < target <= cumulative[low], the segment
  // span is always positive — zero-length segments are skipped naturally.
  let low = 1
  let high = coords.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (cumulative[mid] < target) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  const i = low - 1
  const span = cumulative[low] - cumulative[i]
  const frac = span > 0 ? (target - cumulative[i]) / span : 0
  const a = coords[i]
  const b = coords[low]
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]
}

/** Normalize longitude into the canonical [-180, 180] range for MapLibre and turf APIs. */
function normalizeLongitude(lng: number): number {
  let normalized = ((((lng + 180) % 360) + 360) % 360) - 180
  if (normalized === -180 && lng > 0) {
    normalized = 180
  }
  return normalized
}

/** Normalize a coordinate tuple before passing it to MapLibre or turf calculations. */
function normalizeLngLat(coord: [number, number]): [number, number] {
  return [normalizeLongitude(coord[0]), coord[1]]
}

/**
 * Calculate airplane rotation (degrees CW from screen-up, 0-360).
 * Prefer screen-space tangent so the icon follows the visible arc under globe
 * and other non-linear projections; fall back to geographic bearing.
 */
function calculateMarkerRotation(
  map: LibreMap | null,
  from: [number, number],
  to: [number, number],
): number {
  const normalizedFrom = normalizeLngLat(from)
  const normalizedTo = normalizeLngLat(to)

  // Unwrap `to` relative to `from` so the pair stays continuous across the
  // antimeridian — projecting independently normalized points puts them in
  // different world copies and momentarily flips the computed heading.
  let continuousToLng = normalizedTo[0]
  while (continuousToLng - normalizedFrom[0] > 180) continuousToLng -= 360
  while (continuousToLng - normalizedFrom[0] < -180) continuousToLng += 360
  const continuousTo: [number, number] = [continuousToLng, normalizedTo[1]]

  if (map) {
    try {
      const fromPoint = map.project(normalizedFrom)
      const toPoint = map.project(continuousTo)
      const dx = toPoint.x - fromPoint.x
      const dy = toPoint.y - fromPoint.y

      if (Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)) {
        const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI
        return ((degrees % 360) + 360) % 360
      }
    } catch {
      // Fall back to geographic bearing when projection data is unavailable.
    }
  }

  const b = bearing(normalizedFrom, normalizedTo)
  return ((b % 360) + 360) % 360
}

/** One externally controlled marker; camera moves refresh heading even while paused. */
export function FlightPlane({
  from,
  to,
  progress,
  getProgress,
  subscribe,
}: {
  from: [number, number]
  to: [number, number]
  progress: number
  getProgress?: () => number
  subscribe?: (listener: () => void) => () => void
}) {
  const { map, ready } = useMap()
  const current = useRef(progress)
  useEffect(() => {
    current.current = progress
  }, [progress])
  const [fromLon, fromLat] = from,
    [toLon, toLat] = to
  const path = useMemo(() => {
    const geometry = routeGeometry({ from: [fromLon, fromLat], to: [toLon, toLat] })
    return geometry ? unwrapArcCoordinates(geometry) : null
  }, [fromLon, fromLat, toLon, toLat])
  const refresh = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!map || !ready || !path || path.length < 2) return
    const element = document.createElement('div')
    element.className = 'globe-plane'
    element.setAttribute('aria-hidden', 'true')
    element.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/></svg>'
    // Screen tangent is viewport-relative; map alignment would subtract bearing twice.
    const marker = new Marker({
      element,
      anchor: 'center',
      rotationAlignment: 'viewport',
      pitchAlignment: 'viewport',
      opacityWhenCovered: 0,
    })
      .setLngLat(normalizeLngLat(path[0]))
      .addTo(map)
    const update = () => {
      const t = Math.max(0, Math.min(1, getProgress?.() ?? current.current))
      const position = interpolatePosition(path, t)
      const next = interpolatePosition(path, Math.min(1, t + 0.005))
      const previous = interpolatePosition(path, Math.max(0, t - 0.005))
      marker.setLngLat(normalizeLngLat(position))
      marker.setRotation(
        position[0] !== next[0] || position[1] !== next[1]
          ? calculateMarkerRotation(map, position, next)
          : calculateMarkerRotation(map, previous, position),
      )
    }
    update()
    map.on('move', update)
    map.on('projectiontransition', update)
    const unsubscribe = subscribe?.(update)
    refresh.current = update
    return () => {
      unsubscribe?.()
      map.off('move', update)
      map.off('projectiontransition', update)
      refresh.current = null
      marker.remove()
    }
  }, [map, ready, path, getProgress, subscribe])
  useEffect(() => {
    refresh.current?.()
  }, [progress])
  return null
}
