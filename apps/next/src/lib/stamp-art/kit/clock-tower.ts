// Belfry of Bruges (Markt, BE), lane C: a square lower tower rising out of the low gabled hall, an
// octagonal lantern on top (tall openings, corner turrets), the clock face on the tower below the
// lantern, and low stepped Markt gables flanking both sides. Lit left, T4 on the right fifth of the
// tower and the gables. The box bottom is the street; the box top is above the lantern's crown.
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

const circle = (cx: number, cy: number, r: number, n = 20): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  })

const shade = (x: number, y: number, w: number, h: number): SvgNode[] =>
  hatchPoly(rectPts(x, y, w, h), { angle: 90, gap: 2.4, weight: 'hair' })

/** A Markt house: a wall with a stepped gable of `steps` ledges, windows in two rows. */
function house(x0: number, x1: number, base: number, wallH: number, steps: number): SvgNode[] {
  const out: SvgNode[] = []
  const cx = (x0 + x1) / 2
  const rise = 4.6
  const pts: Pt[] = [
    [x0, base],
    [x0, base - wallH],
  ]
  const right: Pt[] = [
    [x1, base - wallH],
    [x1, base],
  ]
  let half = (x1 - x0) / 2 - 3
  for (let i = 0; i < steps; i++) {
    const yb = base - wallH - i * rise
    pts.push([cx - half - 3 + (i === 0 ? 3 : 0), yb], [cx - half, yb], [cx - half, yb - rise])
    right.unshift([cx + half, yb - rise], [cx + half, yb], [cx + half + 3 - (i === 0 ? 3 : 0), yb])
    half -= 4
  }
  const apex = base - wallH - steps * rise
  pts.push([cx - Math.max(half, 1.5) - 0, apex], [cx + Math.max(half, 1.5), apex])
  out.push(...body([...pts, ...right], 'line'))
  out.push(...shade(x1 - (x1 - x0) * 0.28, base - wallH, (x1 - x0) * 0.28, wallH))
  const cols = 2
  for (let c = 0; c < cols; c++) {
    const wx = x0 + 4.4 + c * ((x1 - x0 - 12) / (cols - 0.4))
    out.push(
      fill(rectPts(wx, base - wallH + 4, 3.6, 5.4)),
      fill(rectPts(wx, base - 12.4, 3.6, 5.4)),
    )
  }
  out.push(hline('bold', x0, x1, base - wallH))
  return out
}

export const belfry: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const tw = num(p, 'tower', 28)

  // Flanking Markt gables, behind the hall.
  out.push(...house(x, x + w * 0.27, base, 29, 3))
  out.push(...house(x + w * 0.73, x + w, base, 26, 3))

  // The low hall: a long wall with a row of arched ground-floor openings and a gabled roof line.
  const hx0 = x + w * 0.2
  const hx1 = x + w * 0.8
  const hallH = 23
  const hall: Pt[] = [
    [hx0, base],
    [hx0, base - hallH],
    [hx0 + 4, base - hallH - 5],
    [hx1 - 4, base - hallH - 5],
    [hx1, base - hallH],
    [hx1, base],
  ]
  out.push(...body(hall, 'line'))
  out.push(...shade(hx1 - 14, base - hallH - 5, 14, hallH + 5))
  for (let ax = hx0 + 5; ax < hx1 - 6; ax += 7.4) {
    if (Math.abs(ax + 1.8 - cx) < tw / 2 + 2) continue
    out.push(
      fill([
        [ax, base],
        [ax, base - 7],
        [ax + 1.8, base - 9.2],
        [ax + 3.6, base - 7],
        [ax + 3.6, base],
      ]),
    )
    out.push(fill(rectPts(ax, base - 19, 3.6, 6)))
  }
  out.push(hline('bold', hx0, hx1, base - hallH))

  // Square tower: two plain stages with lancet slits, a bold string course, the clock on the
  // upper stage, and a parapet with a turret on each corner.
  const tx0 = cx - tw / 2
  const tx1 = cx + tw / 2
  const towerH = h * 0.78
  const towerTop = base - towerH
  out.push(...body(rectPts(tx0, towerTop, tw, towerH), 'line'))
  out.push(...shade(tx1 - tw * 0.22, towerTop, tw * 0.22, towerH))
  out.push(hline('bold', tx0 - 1.4, tx1 + 1.4, towerTop))
  out.push(hline('bold', tx0, tx1, base - hallH - 5))
  out.push(hline('hair', tx0, tx1, base - 41))
  for (const sy of [base - 36, base - 51]) {
    out.push(
      fill([
        [cx - 6.5 - 1.4, sy + 7],
        [cx - 6.5 - 1.4, sy + 2],
        [cx - 6.5, sy],
        [cx - 6.5 + 1.4, sy + 2],
        [cx - 6.5 + 1.4, sy + 7],
      ]),
    )
  }
  out.push(fill(rectPts(cx + 5, base - 51, 2.4, 7)))
  // Clock: a ring with hands, on the middle of the upper stage, under the lantern.
  const cy = towerTop + 8
  out.push(
    occlude(circle(cx - 0.5, cy, 6.2), { halo: 0 }),
    stroke('line', circle(cx - 0.5, cy, 5.8), true),
  )
  out.push(
    stroke('hair', [
      [cx - 0.5, cy],
      [cx - 0.5, cy - 3.6],
    ]),
    stroke('hair', [
      [cx - 0.5, cy],
      [cx + 2.2, cy + 1.2],
    ]),
  )
  // Corner turrets: a slim shaft with a pointed cap.
  for (const tcx of [tx0 + 1.6, tx1 - 1.6]) {
    const cap: Pt[] = [
      [tcx - 2.2, towerTop - 1],
      [tcx - 2.2, towerTop - 5],
      [tcx, towerTop - 9.5],
      [tcx + 2.2, towerTop - 5],
      [tcx + 2.2, towerTop - 1],
    ]
    out.push(...body(cap, 'hair'), fill(cap.slice(1, 4)))
  }

  // Octagonal lantern: narrower than the tower, three tall openings, a spire.
  const lw = tw * 0.72
  const lx0 = cx - lw / 2
  const lTop = towerTop - 14
  const lant: Pt[] = [
    [lx0, towerTop - 1],
    [lx0, lTop + 2],
    [lx0 + 1.6, lTop],
    [cx + lw / 2 - 1.6, lTop],
    [cx + lw / 2, lTop + 2],
    [cx + lw / 2, towerTop - 1],
  ]
  out.push(...body(lant, 'line'))
  out.push(...shade(cx + lw * 0.2, lTop, lw * 0.3, 14))
  for (const dx of [-0.26, 0, 0.26]) {
    const ox = cx + lw * dx
    out.push(
      fill([
        [ox - 1.3, towerTop - 3],
        [ox - 1.3, lTop + 5],
        [ox, lTop + 3],
        [ox + 1.3, lTop + 5],
        [ox + 1.3, towerTop - 3],
      ]),
    )
  }
  // The wooden spire is gone; the present lantern ends in an open stone crown.
  for (let i = 0; i < 4; i++) {
    const px = lx0 + (i * lw) / 3
    out.push(...body(rectPts(px - 1.3, lTop - 3, 2.6, 3), 'hair'))
  }
  out.push(hline('bold', lx0 - 1, cx + lw / 2 + 1, lTop))
  return out
}
