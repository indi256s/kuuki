// Adapted from flightcn's generateArcGeometry, pinned at 5c9061ef36bb2cd3cfa9f11f6463419944566a9d.
import greatCircle from '@turf/great-circle'
import type { ProjectedRoute } from './types'

export type RouteGeometry = { type: 'LineString'; coordinates: [number, number][] } |
  { type: 'MultiLineString'; coordinates: [number, number][][] }

function valid(point: [number, number] | null): point is [number, number] {
  return !!point && Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
}

export function routeGeometry(route: ProjectedRoute): RouteGeometry | null {
  const { from, to } = route
  if (!valid(from) || !valid(to)) return null
  const lon1 = from[0] * Math.PI / 180, lon2 = to[0] * Math.PI / 180
  const lat1 = from[1] * Math.PI / 180, lat2 = to[1] * Math.PI / 180
  const dot = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2)
  // A coincident route is a point; antipodes have no unique great circle.
  if (dot > 0.99999999 || dot < -0.99999999) return null
  try {
    const geometry = greatCircle(from, to, { npoints: 64 }).geometry
    if (geometry.type === 'MultiLineString') {
      const segments = geometry.coordinates.map(line => line.map(([lon, lat]) => [lon, lat] as [number, number]))
      for (let i = 1; i < segments.length; i++) {
        const a = segments[i - 1].at(-1), b = segments[i][0]
        if (!a || !b || Math.abs(a[0] - b[0]) <= 180) continue
        const seam = a[0] > 0 ? 180 : -180
        const unwrapped = b[0] + (seam > 0 ? 360 : -360)
        const fraction = (seam - a[0]) / (unwrapped - a[0])
        const latitude = a[1] + fraction * (b[1] - a[1])
        if (a[0] !== seam) segments[i - 1].push([seam, latitude])
        if (b[0] !== -seam) segments[i].unshift([-seam, latitude])
      }
      return { type: 'MultiLineString', coordinates: segments }
    }
    return { type: 'LineString', coordinates: geometry.coordinates as [number, number][] }
  } catch {
    // Do not draw a misleading straight segment for undefined geometry.
    return null
  }
}

export function wrappedBounds(geometries: RouteGeometry[]): [[number, number], [number, number]] | null {
  const points = geometries.flatMap(g => g.type === 'LineString' ? g.coordinates : g.coordinates.flat())
  if (!points.length) return null
  const longitudes = points.map(p => ((p[0] % 360) + 360) % 360)
  const sorted = [...longitudes].sort((a, b) => a - b)
  let largestGap = -1, start = 0
  for (let i = 0; i < sorted.length; i++) {
    const gap = (sorted[(i + 1) % sorted.length] + (i === sorted.length - 1 ? 360 : 0)) - sorted[i]
    if (gap > largestGap) { largestGap = gap; start = sorted[(i + 1) % sorted.length] }
  }
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (let i = 0; i < points.length; i++) {
    const longitude = longitudes[i] < start ? longitudes[i] + 360 : longitudes[i]
    minLon = Math.min(minLon, longitude)
    maxLon = Math.max(maxLon, longitude)
    minLat = Math.min(minLat, points[i][1])
    maxLat = Math.max(maxLat, points[i][1])
  }
  const offset = (minLon + maxLon) / 2 > 180 ? -360 : 0
  return [[minLon + offset, minLat], [maxLon + offset, maxLat]]
}
