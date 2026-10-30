// Builds every lane airliner: the pinned kit's camera at each type's own scale, the model, the levelled and placed SVG.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { airliner, type AircraftGeometry } from './airliner'
import { loadKit } from './kit'
import { serialize, type Box } from './svg'
import type { Camera, Pt, V3 } from './surface'

const DATA = 'packages/data/src/aircraft-geometry'
export const AIR_TYPES = [
  'A319',
  'A320',
  'A20N',
  'A321',
  'A21N',
  'A332',
  'A333',
  'A359',
  'A35K',
  'A388',
  'B733',
  'B738',
  'B38M',
  'B763',
  'B788',
  'B77W',
  'E170',
  'E195',
  'SU95',
  'DH8B',
]
const REFERENCE = 'A21N'
/** The reference's drawn length (nose to tail end on screen) in viewBox units: CSS px at --lane-unit 112. */
export const AIR_UNIT = 112
/** Lengths blend true scale and equal weight: drawn length ∝ length^MASS, as before. */
const MASS = 0.55
/** Build precision: the kit's pixel tolerances (facets, curve error) hold at this zoom of the final art. */
const ZOOM = 4

export type AirDrawn = {
  key: string
  title: string
  body: string
  box: Box
  /** The near main wheels' contact line below the centreline, in viewBox units. */
  gear: number
  /** The upper beacon, placed. */
  beacon: Pt
  /** Measured length and span, m. */
  length: number
  span: number
}

/** The lane camera's across-the-lane direction after levelling, as a CSS skewX angle (deg) for ground markings. */
export async function airSkew() {
  const kit = await loadKit()
  const lev = (p: V3) => {
    const [x, y] = kit.k.iso(p, kit.P) as Pt
    return [x, y - kit.slope * x]
  }
  const [o, y] = [lev([0, 0, 0]), lev([0, 1, 0])]
  return (Math.atan2(y[0] - o[0], y[1] - o[1]) * 180) / Math.PI
}

export async function buildAir(only?: string[]) {
  const kit = await loadKit()
  const records = new Map<string, AircraftGeometry>()
  for (const file of readdirSync(DATA).filter((f) => f.endsWith('.json')))
    for (const rec of JSON.parse(readFileSync(join(DATA, file), 'utf8')) as AircraftGeometry[])
      records.set(rec.icao, rec)
  const lenOf = (r: AircraftGeometry) => r.fuselage.end ?? r.dims.length
  const refLen = lenOf(records.get(REFERENCE)!)
  const sinA = Math.sin((kit.P.azimuth * Math.PI) / 180)
  const out: AirDrawn[] = []
  for (const key of [...AIR_TYPES, 'GENERIC']) {
    if (only && !only.includes(key)) continue
    const rec = records.get(key === 'GENERIC' ? 'A320' : key)
    if (!rec) throw new Error(`no geometry for ${key}`)
    const L = lenOf(rec)
    // Screen units per metre along the lane, so the drawn length is UNIT · (L / Lref)^MASS.
    const s = (AIR_UNIT * Math.pow(L / refLen, MASS)) / (L * sinA)
    const P = { ...kit.P, scale: (s * ZOOM) / Math.sqrt(1.6) }
    const cam: Camera = { ...kit.cam, project: (p: V3) => kit.k.iso(p, P) as Pt }
    const built = airliner(rec, cam, { G: kit.G, P })
    // The nose tip (height never moves screen x) to x = 0; the centreline on the ground, levelled, to y = 0, so the
    // nose wheel stands on the lane's centre line and the main wheels straddle it.
    const [ox, oy] = cam.project([0, 0, 0])
    const slope = kit.slope
    const place = ([x, y]: Pt): Pt => [(x - ox) / ZOOM, (y - slope * x - (oy - slope * ox)) / ZOOM]
    const { body, box } = serialize(built.items, place, 1)
    out.push({
      key,
      title: key === 'GENERIC' ? 'An airliner' : rec.name,
      body,
      box,
      gear: place(cam.project([0, built.groundY, 0]))[1],
      beacon: place(cam.project(built.beacon)),
      length: rec.dims.length,
      span: rec.dims.span,
    })
  }
  return out
}
