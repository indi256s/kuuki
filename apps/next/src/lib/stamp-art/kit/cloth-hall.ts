// Cloth hall (lane C): a long low Renaissance hall with an open ground arcade, a window band, a
// tall attic parapet of blind arches and four corner turrets (Sukiennice, PL). Base at the bottom.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  hline,
  occlude,
  rectPts,
  stroke,
} from '../grid'
import { type KitModule, num } from './util'
import { archPts } from './windows'

export const clothHall: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const base = y + h
  const atticH = h * num(p, 'attic', 0.3)
  const arcadeH = h * num(p, 'arcade', 0.38)
  const x0 = x + 8
  const x1 = x + w - 8
  const wallTop = y + atticH
  // body
  out.push(...body(rectPts(x0, wallTop, x1 - x0, base - wallTop), 'line'))
  out.push(hline('bold', x0 - 2, x1 + 2, base))
  // attic parapet: blind arches with finials
  out.push(...body(rectPts(x0 - 1, y + 3, x1 - x0 + 2, atticH - 3), 'line'))
  out.push(hline('bold', x0 - 2, x1 + 2, wallTop))
  const na = Math.round(num(p, 'blind', 10))
  const ap = (x1 - x0) / na
  for (let i = 0; i < na; i++) {
    const ax = x0 + i * ap + ap * 0.2
    out.push(fill(archPts(ax, y + 7, ap * 0.6, atticH - 10)))
    const f: Pt[] = [
      [ax + ap * 0.15, y + 3],
      [ax + ap * 0.3, y - 1.5],
      [ax + ap * 0.45, y + 3],
    ]
    out.push(fill(f))
  }
  // window band
  const bandY = wallTop + (base - wallTop - arcadeH) * 0.2
  const nw = Math.round(num(p, 'windows', 9))
  const wp = (x1 - x0) / nw
  for (let i = 0; i < nw; i++) out.push(fill(archPts(x0 + i * wp + wp * 0.3, bandY, wp * 0.34, 6)))
  // ground arcade
  const arcTop = base - arcadeH
  out.push(hline('line', x0, x1, arcTop - 2))
  const nb = Math.round(num(p, 'bays', 9))
  const bp = (x1 - x0) / nb
  for (let i = 0; i < nb; i++) {
    const bx = x0 + i * bp + bp * 0.2
    const pts = archPts(bx, arcTop, bp * 0.6, arcadeH)
    out.push(occlude(pts), stroke('line', pts))
    out.push(...hatchPoly(pts, { angle: 90, gap: 3.6, weight: 'hair', inset: 0.6 }))
  }
  // corner turrets
  for (const cx of [x0 + 5, x1 - 5]) {
    const tTop = y - h * 0.12
    out.push(...body(rectPts(cx - 5, tTop, 10, wallTop - tTop + 1), 'line'))
    out.push(fill(rectPts(cx - 1, tTop + 4, 2, 4)))
    const cap: Pt[] = [
      [cx - 6.4, tTop],
      [cx, tTop - 10],
      [cx + 6.4, tTop],
    ]
    out.push(occlude(cap), fill(cap))
  }
  return out
}
