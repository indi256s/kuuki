export interface LatLon { lat: number; lon: number }

export const EARTH_RADIUS_KM = 6371
const RAD = Math.PI / 180

function longitude(degrees: number): number {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180
  return wrapped === -180 ? 180 : wrapped
}

export function greatCircleKm(a: LatLon, b: LatLon): number {
  const h = Math.sin((b.lat - a.lat) * RAD / 2) ** 2
    + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin((b.lon - a.lon) * RAD / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

function vector(p: LatLon): number[] {
  const lat = p.lat * RAD, lon = p.lon * RAD
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
}

/** Shortest spherical arc, including endpoints. Antipodes use a deterministic perpendicular. */
export function greatCirclePoints(a: LatLon, b: LatLon, maxStepKm = 50): LatLon[] {
  if (!Number.isFinite(maxStepKm) || maxStepKm <= 0) throw new RangeError('maxStepKm must be positive and finite')
  const km = greatCircleKm(a, b), n = Math.max(1, Math.ceil(km / maxStepKm))
  const start = vector(a), end = vector(b)
  const dot = Math.min(1, Math.max(-1, start.reduce((sum, v, i) => sum + v * end[i], 0)))
  let tangent = end.map((v, i) => v - dot * start[i])
  let norm = Math.hypot(...tangent)
  const angle = Math.atan2(norm, dot)
  if (norm < 1e-12) {
    const axis = Math.abs(start[0]) < 0.9 ? 0 : 1
    tangent = start.map((v, i) => (i === axis ? 1 : 0) - start[axis] * v)
    norm = Math.hypot(...tangent)
  }
  tangent = tangent.map(v => v / norm)
  return Array.from({ length: n + 1 }, (_, i) => {
    if (i === 0) return { lat: a.lat, lon: longitude(a.lon) }
    if (i === n) return { lat: b.lat, lon: longitude(b.lon) }
    const theta = angle * i / n
    const p = start.map((v, j) => v * Math.cos(theta) + tangent[j] * Math.sin(theta))
    return { lat: Math.atan2(p[2], Math.hypot(p[0], p[1])) / RAD, lon: longitude(Math.atan2(p[1], p[0]) / RAD) }
  })
}

export function eastwardShare(a: LatLon, b: LatLon): number {
  const km = greatCircleKm(a, b)
  if (km === 0) return 0
  const points = greatCirclePoints(a, b)
  let east = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], next = points[i]
    east += EARTH_RADIUS_KM * longitude(next.lon - prev.lon) * RAD * Math.cos((prev.lat + next.lat) * RAD / 2)
  }
  return Math.min(1, Math.max(-1, east / km))
}
