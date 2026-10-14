// A long low lattice-steel river bridge on masonry piers (Pont Faidherbe): a shallow-arched
// Warren truss, a taller swing span at the middle on a wider pier with a small cabin, and a bold
// deck line. The box bottom is the waterline.
import { type Pt, type SvgNode, body, fill, hline, occlude, rectPts, stroke } from '../grid'
import { type KitModule, num } from './util'

export const trussBridgeB: KitModule = ([x, y, w, h], p) => {
  const spans = Math.max(3, Math.round(num(p, 'spans', 7)))
  const mid = Math.floor(spans / 2)
  const water = y + h
  const deck = y + h * 0.7
  const trussH = h * 0.34
  const pw = w / spans
  const out: SvgNode[] = []
  // Piers.
  for (let i = 0; i <= spans; i++) {
    const px = x + pw * i
    const pierW = i === mid || i === mid + 1 ? 7 : 4.4
    const left = i === 0 ? px : px - pierW / 2
    out.push(
      ...body(
        [
          [left, deck],
          [left + pierW, deck],
          [left + pierW + 1, water],
          [left - 1, water],
        ],
        'line',
      ),
    )
  }
  // Trusses, one per span; the swing span stands taller.
  for (let s = 0; s < spans; s++) {
    const sx = x + pw * s
    const swing = p.boxTruss === true ? false : s === mid
    const hh = trussH * (swing ? 1.45 : 1)
    const sag = p.boxTruss === true ? 0 : swing ? 0 : 3.2
    const topAt = (t: number) => deck - hh + (swing ? 0 : sag * (2 * t - 1) ** 2) - (swing ? 0 : 0)
    const topPts: Pt[] = []
    for (let k = 0; k <= 8; k++) topPts.push([sx + (pw * k) / 8, topAt(k / 8)])
    const poly: Pt[] = [...topPts, [sx + pw, deck], [sx, deck]]
    out.push(occlude(poly, { halo: 1.6 }))
    out.push(stroke('line', topPts))
    // Warren zigzag between the chords, plus uprights at the panel points.
    const panels = swing ? 4 : 2
    for (let k = 0; k < panels; k++) {
      const t0 = k / panels,
        t1 = (k + 1) / panels
      const up = k % 2 === 0
      const a: Pt = up ? [sx + pw * t0, deck] : [sx + pw * t0, topAt(t0)]
      const b: Pt = up ? [sx + pw * t1, topAt(t1)] : [sx + pw * t1, deck]
      out.push(stroke('hair', [a, b]))
      if (p.boxTruss === true)
        out.push(
          stroke('hair', [
            [a[0], up ? topAt(t0) : deck],
            [b[0], up ? deck : topAt(t1)],
          ]),
        )
    }
    if (swing) {
      const cw = pw * 0.34
      out.push(...body(rectPts(sx + pw / 2 - cw / 2, deck - hh - 7, cw, 7), 'line'))
      out.push(fill(rectPts(sx + pw / 2 - cw / 2 + 2, deck - hh - 5, cw - 4, 2.4)))
    }
  }
  out.push(...body(rectPts(x - 1, deck, w + 2, 2.2), 'line'))
  out.push(hline('bold', x - 2, x + w + 2, deck + 2.2))
  if (p.boxTruss === true)
    return out.map((n) => ({
      ...n,
      pts: n.pts.map(([px, py]): Pt => [
        px,
        deck + (py - deck) * (1 - (0.45 * (px - x)) / w) - (5 * (px - x)) / w,
      ]),
    }))
  return out
}
