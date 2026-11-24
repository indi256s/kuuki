import { clipStrokeInside, clipStrokeOutside } from '../geom'
import {
  type Pt,
  type StrokeNode,
  type SvgNode,
  type ToneName,
  type Weight,
  fill,
  occlude,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, pairs } from './util'

const TONE_NAMES = ['T1', 'T2', 'T3', 'T4'] as const
const WEIGHT_NAMES = ['fine', 'hair', 'line', 'bold'] as const

const isPts = (v: unknown): v is Pt[] =>
  Array.isArray(v) &&
  v.every((a) => Array.isArray(a) && a.length === 2 && a.every((n) => typeof n === 'number'))
const objects = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    : []

export const peak: KitModule = ([x, y, w, h], p) => {
  const at = ([fx, fy]: Pt): Pt => [x + w * fx, y + h * fy]
  const sil = pairs(p, 'sil', []).map(at)
  if (sil.length < 3) return []
  const out: SvgNode[] = [occlude(sil)]

  for (const f of objects(p.faces)) {
    if (!isPts(f.poly)) continue
    const tone = TONE_NAMES.find((t) => t === f.tone) ?? 'T4'
    const gap = typeof f.gap === 'number' ? f.gap : undefined
    const angle = typeof f.angle === 'number' ? f.angle : undefined
    const cuts = Array.isArray(f.cut) ? f.cut.filter(isPts).map((c) => c.map(at)) : []
    const hatchNodes = toneFill(f.poly.map(at), tone as ToneName, {
      ...(gap ? { gap } : {}),
      ...(angle !== undefined ? { angle } : {}),
    })
    let acc: StrokeNode[] = hatchNodes
      .filter((n): n is StrokeNode => n.kind === 'stroke')
      .flatMap((n) => clipStrokeInside(n, sil))
    for (const c of cuts) acc = acc.flatMap((n) => clipStrokeOutside(n, c))
    out.push(...acc)
    for (const c of cuts)
      out.push(...clipStrokeInside(stroke('fine', c, true), sil).filter((n) => n.pts.length > 1))
  }

  for (const l of objects(p.lines)) {
    if (!isPts(l.pts)) continue
    const wt = WEIGHT_NAMES.find((n) => n === l.w) ?? 'hair'
    out.push(...clipStrokeInside(stroke(wt as Weight, l.pts.map(at)), sil))
  }
  for (const poly of Array.isArray(p.fills) ? p.fills.filter(isPts) : [])
    out.push(fill(poly.map(at)))
  if (p.outline !== false) out.push(stroke('line', sil))
  return out
}
