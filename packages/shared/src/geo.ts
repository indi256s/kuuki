export interface LatLon {
  lat: number
  lon: number
}

export function coordinates(
  point: { lat: number | null; lon: number | null } | undefined,
): LatLon | null {
  const lat = point?.lat,
    lon = point?.lon
  return lat != null &&
    lon != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
    ? { lat, lon }
    : null
}

export const EARTH_RADIUS_KM = 6371
const RAD = Math.PI / 180

function longitude(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

export function greatCircleKm(a: LatLon, b: LatLon): number {
  const h =
    Math.sin(((b.lat - a.lat) * RAD) / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(((b.lon - a.lon) * RAD) / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}

function vector(p: LatLon): number[] {
  const lat = p.lat * RAD,
    lon = p.lon * RAD
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]
}

function greatCircleArc(a: LatLon, b: LatLon) {
  const start = vector(a),
    end = vector(b)
  const dot = Math.min(
    1,
    Math.max(
      -1,
      start.reduce((sum, v, i) => sum + v * end[i], 0),
    ),
  )
  let tangent = end.map((v, i) => v - dot * start[i])
  let norm = Math.hypot(...tangent)
  const angle = Math.atan2(norm, dot)
  if (norm < 1e-12) {
    const axis = Math.abs(start[0]) < 0.9 ? 0 : 1
    tangent = start.map((v, i) => (i === axis ? 1 : 0) - start[axis] * v)
    norm = Math.hypot(...tangent)
  }
  tangent = tangent.map((v) => v / norm)
  return { start, tangent, angle }
}

/** Shortest spherical arc, including endpoints. Antipodes use a deterministic perpendicular. */
export function greatCirclePoints(a: LatLon, b: LatLon, maxStepKm = 50): LatLon[] {
  if (!Number.isFinite(maxStepKm) || maxStepKm <= 0)
    throw new RangeError('maxStepKm must be positive and finite')
  const km = greatCircleKm(a, b),
    n = Math.max(1, Math.ceil(km / maxStepKm))
  const { start, tangent, angle } = greatCircleArc(a, b)
  return Array.from({ length: n + 1 }, (_, i) => {
    if (i === 0) return { lat: a.lat, lon: longitude(a.lon) }
    if (i === n) return { lat: b.lat, lon: longitude(b.lon) }
    const theta = (angle * i) / n
    const p = start.map((v, j) => v * Math.cos(theta) + tangent[j] * Math.sin(theta))
    return {
      lat: Math.atan2(p[2], Math.hypot(p[0], p[1])) / RAD,
      lon: longitude(Math.atan2(p[1], p[0]) / RAD),
    }
  })
}

/** Internal side changes on the same arc as greatCirclePoints; boundary contact is excluded. */
export function greatCircleCrossings(a: LatLon, b: LatLon) {
  const { start, tangent, angle } = greatCircleArc(a, b)
  // Suppress floating-point boundary noise, including indeterminate longitude at a pole.
  const epsilon = 1e-12
  const extrema: number[] = []
  const phase = Math.atan2(tangent[2], start[2])
  for (let k = -1; k <= 1; k++) {
    const theta = phase + k * Math.PI
    if (theta > 0 && theta < angle) extrema.push(theta)
  }
  const heights = [
    start[2],
    ...extrema.map((theta) => start[2] * Math.cos(theta) + tangent[2] * Math.sin(theta)),
    Math.sin(b.lat * RAD),
  ]
  function latitudeCrossings(latitude: number): number {
    const boundary = Math.sin(latitude * RAD)
    let previous = 0,
      count = 0
    for (const height of heights) {
      const delta = height - boundary
      const sign = Math.abs(delta) <= epsilon ? 0 : Math.sign(delta)
      if (!sign) continue
      if (previous && sign !== previous) count++
      previous = sign
    }
    return count
  }
  let dateLine = 0
  if (Math.hypot(start[1], tangent[1]) > epsilon) {
    const phase = Math.atan2(-start[1], tangent[1])
    for (let k = -1; k <= 1; k++) {
      const theta = phase + k * Math.PI
      if (theta <= epsilon || theta >= angle - epsilon) continue
      const x = start[0] * Math.cos(theta) + tangent[0] * Math.sin(theta)
      if (x < -epsilon) dateLine++
    }
  }
  return {
    equator: latitudeCrossings(0),
    arcticCircle: latitudeCrossings(66.5634),
    antarcticCircle: latitudeCrossings(-66.5634),
    dateLine,
  }
}

export function eastwardShare(a: LatLon, b: LatLon): number {
  const km = greatCircleKm(a, b)
  if (km === 0) return 0
  const points = greatCirclePoints(a, b)
  let east = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1],
      next = points[i]
    east +=
      EARTH_RADIUS_KM *
      longitude(next.lon - prev.lon) *
      RAD *
      Math.cos(((prev.lat + next.lat) * RAD) / 2)
  }
  return Math.min(1, Math.max(-1, east / km))
}
