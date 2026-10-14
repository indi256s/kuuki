// Castle family (lane C): a crenellated curtain wall following a sloping top line, square and
// round towers standing on it, an arched gate, a hatched hillside below and optional red roofs
// peeping over the wall. Used for the Alhambra (ES) and Dubrovnik's walls (HR).
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  occlude,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, bool, num, pairs } from './util'
import { archPts, lerpLine } from './windows'

type Tower = { fx: number; w: number; up: number; round: boolean; cap: string }

const parseTowers = (raw: unknown): Tower[] =>
  Array.isArray(raw)
    ? raw.map((t) => {
        const a = t as [number, number, number, number, string]
        return { fx: a[0], w: a[1], up: a[2], round: a[3] === 1, cap: a[4] ?? 'battle' }
      })
    : []

export const castle: KitModule = ([x, y, w, h], p) => {
  const top = pairs(p, 'top', [
    [0, 0.5],
    [1, 0.5],
  ]).map(([fx, fy]): Pt => [x + fx * w, y + fy * h])
  const wallH = num(p, 'wallH', 9)
  const towers = parseTowers(p.towers)
  const out: SvgNode[] = []
  const x0 = x + num(p, 'from', 0) * w
  const x1 = x + num(p, 'to', 1) * w
  const topAt = (px: number) => lerpLine(top, px)
  // hillside under the wall
  if (bool(p, 'hill', true)) {
    const slope: Pt[] = [...top.map(([px, py]): Pt => [px, py + wallH]), [x + w, y + h], [x, y + h]]
    out.push(
      occlude(slope),
      ...hatchPoly(slope, {
        angle: num(p, 'hillAngle', -62),
        gap: num(p, 'hillGap', 2.6),
        weight: 'hair',
      }),
    )
  }
  // roofs behind the wall
  const roofs = num(p, 'roofs', 0)
  if (roofs > 0) {
    const rand = mulberry32(Math.round(num(p, 'seed', 5)))
    let rx = x0 + 6
    while (rx < x1 - 12) {
      const rw = 8 + rand() * 5
      const base = topAt(rx + rw / 2) - 1
      const rh = roofs * (0.6 + rand() * 0.6)
      const pts: Pt[] = [
        [rx, base],
        [rx + 2, base - rh],
        [rx + rw - 2, base - rh],
        [rx + rw, base],
      ]
      out.push(occlude([...pts, [rx + rw, base + wallH], [rx, base + wallH]]), fill(pts))
      rx += rw + 0.8
    }
  }
  // wall: lit band with a merlon top edge
  const period = 5
  const mh = 2.2
  const edge: Pt[] = []
  for (let px = x0; px < x1; px += period) {
    const e = Math.min(px + period * 0.6, x1)
    edge.push([px, topAt(px)], [px, topAt(px) - mh], [e, topAt(e) - mh], [e, topAt(e)])
  }
  edge.push([x1, topAt(x1)])
  const bottom: Pt[] = [
    [x1, topAt(x1) + wallH],
    [x0, topAt(x0) + wallH],
  ]
  out.push(...body([...edge, ...bottom], 'line'))
  const shadeFrom = num(p, 'shadeFrom', 0.72)
  const sx = x0 + (x1 - x0) * shadeFrom
  const shade: Pt[] = [
    [sx, topAt(sx)],
    [x1, topAt(x1)],
    [x1, topAt(x1) + wallH],
    [sx, topAt(sx) + wallH],
  ]
  out.push(...toneFill(shade, 'T4', { inset: 0.3 }))
  out.push(
    stroke('hair', [
      [x0, topAt(x0) + 2.4],
      [x1, topAt(x1) + 2.4],
    ]),
  )
  // towers
  for (const t of towers) {
    const tx = x + t.fx * w - t.w / 2
    const yTop = topAt(tx + t.w / 2) - t.up
    const yBot = topAt(tx + t.w / 2) + wallH
    out.push(...body(rectPts(tx, yTop, t.w, yBot - yTop), 'line'))
    out.push(
      ...toneFill(
        rectPts(
          tx + t.w * (t.round ? 0.62 : 0.74),
          yTop + 1,
          t.w * (t.round ? 0.38 : 0.26),
          yBot - yTop - 1,
        ),
        'T4',
        { inset: 0.3 },
      ),
    )
    out.push(
      stroke('hair', [
        [tx, yTop + 3],
        [tx + t.w, yTop + 3],
      ]),
    )
    if (t.cap === 'cone') {
      const cap: Pt[] = [
        [tx - 1.4, yTop],
        [tx + t.w / 2, yTop - t.w * num(p, 'capH', 1.05)],
        [tx + t.w + 1.4, yTop],
      ]
      out.push(occlude(cap), fill(cap))
    } else if (t.cap === 'hip') {
      const cap: Pt[] = [
        [tx - 1.2, yTop],
        [tx + 2, yTop - t.w * 0.6],
        [tx + t.w - 2, yTop - t.w * 0.6],
        [tx + t.w + 1.2, yTop],
      ]
      out.push(occlude(cap), fill(cap))
    } else {
      const mw = t.w / 5
      for (let i = 0; i < 3; i++)
        out.push(...body(rectPts(tx + i * mw * 2, yTop - 2.4, mw, 2.4), 'hair'))
    }
    out.push(fill(rectPts(tx + t.w * (t.round ? 0.28 : 0.35), yTop + 7, 2, 5)))
    if (yBot - yTop > 30)
      out.push(fill(rectPts(tx + t.w * (t.round ? 0.28 : 0.35), yTop + 18, 2, 5)))
  }
  // gate
  if (typeof p.gate === 'number') {
    const gx = x + p.gate * w
    const gh = wallH * 0.95
    out.push(fill(archPts(gx - 3, topAt(gx) + wallH - gh, 6, gh)))
  }
  return out
}
