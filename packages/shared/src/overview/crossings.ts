import { coordinates, greatCirclePoints, type LatLon } from '../geo'
import type { Gate } from './figures'
import type { OverviewPayload, OverviewRow } from './model'
import { absoluteClockShiftMinutes } from './records'

export interface Crossings {
  zonesOverflown: number; clockShiftHours: number; equator: number; dateLine: number
  arcticCircle: number; antarcticCircle: number; eastboundShare: number
}
type PathCrossings = Pick<Crossings, 'equator' | 'dateLine' | 'arcticCircle' | 'antarcticCircle'>

function latitudeCrossings(points: LatLon[], latitude: number): number {
  let previous = 0, count = 0
  for (const point of points) {
    const sign = Math.sign(point.lat - latitude)
    if (!sign) continue
    if (previous && sign !== previous) count++
    previous = sign
  }
  return count
}

export function crossings(rows: OverviewRow[], refs: OverviewPayload['refs']): Gate<Crossings> {
  const have = rows.reduce((sum, row) => sum + (row.originTz && row.destTz ? row.weight : 0), 0)
  if (have < 3) return { status: 'below', have, need: 3 }
  const value: Crossings = { zonesOverflown: 0, clockShiftHours: 0, equator: 0, dateLine: 0,
    arcticCircle: 0, antarcticCircle: 0, eastboundShare: 0 }
  const paths = new Map<string, PathCrossings>()
  let east = 0, located = 0
  for (const row of rows) {
    const zones = row.zonesOverflown, shift = absoluteClockShiftMinutes(row)
    if (zones !== null && Number.isFinite(zones) && zones >= 0) value.zonesOverflown += zones
    if (shift !== null && Number.isFinite(shift) && shift >= 0) value.clockShiftHours += shift / 60
    const a = coordinates(refs.airports[row.origin]), b = coordinates(refs.airports[row.destination])
    if (!a || !b) continue
    located += row.weight
    if (((b.lon - a.lon + 540) % 360) - 180 > 0) east += row.weight
    const key = `${row.origin}-${row.destination}`
    let path = paths.get(key)
    if (!path) {
      const points = greatCirclePoints(a, b, 50)
      path = { equator: latitudeCrossings(points, 0), arcticCircle: latitudeCrossings(points, 66.5634),
        antarcticCircle: latitudeCrossings(points, -66.5634),
        dateLine: points.slice(1).filter((point, i) => Math.abs(point.lon - points[i].lon) > 180).length }
      paths.set(key, path)
    }
    value.equator += path.equator * row.weight
    value.dateLine += path.dateLine * row.weight
    value.arcticCircle += path.arcticCircle * row.weight
    value.antarcticCircle += path.antarcticCircle * row.weight
  }
  value.eastboundShare = located ? east / located : 0
  return { status: 'ready', value }
}
