// A closed reef ring seen at a low angle (Chagos-type): foam-edged outer reef, a sandy reef flat
// carrying a chain of palm islets, a pale lagoon with a dark deep-water patch. Neutral nature only.
// The box is the ring's bounding box; the ocean outside belongs to the backdrop.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'
import { palm } from './palm'

export const reefRingB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 11)))
  const cx = x + w / 2,
    cy = y + h / 2
  const rx = w / 2,
    ry = h / 2
  const bandX = num(p, 'band', 8),
    bandY = bandX * (ry / rx) * 1.15
  const out: SvgNode[] = []
  const E = (th: number, ax: number, ay: number, wob = 0): Pt => [
    cx + Math.cos(th) * (ax + wob),
    cy + Math.sin(th) * (ay + wob * 0.4),
  ]
  const outer: Pt[] = Array.from({ length: 96 }, (_, i) =>
    E((i / 96) * Math.PI * 2, rx, ry, Math.sin(i * 1.7) * 0.9),
  )
  const inner: Pt[] = Array.from({ length: 80 }, (_, i) =>
    E((i / 80) * Math.PI * 2, rx - bandX, ry - bandY, Math.sin(i * 1.1) * 0.6),
  )
  out.push(occlude(outer, { halo: 3 }))
  // Reef flat: fine horizontal strokes in the band, split around the lagoon.
  const span = (ax: number, ay: number, yy: number): number | null => {
    const t = (yy - cy) / ay
    return Math.abs(t) >= 1 ? null : ax * Math.sqrt(1 - t * t)
  }
  for (let yy = cy - ry + 1.4; yy < cy + ry - 0.6; yy += 2.3) {
    const o = span(rx - 0.8, ry - 0.5, yy)
    if (o === null) continue
    const i = span(rx - bandX, ry - bandY, yy)
    if (i === null) out.push(hline('fine', cx - o, cx + o, yy))
    else {
      out.push(hline('fine', cx - o, cx - i - 0.8, yy), hline('fine', cx + i + 0.8, cx + o, yy))
    }
  }
  // Lagoon: sparse water lines, dark deep patch left of centre.
  for (let yy = cy - ry + bandY + 2; yy < cy + ry - bandY - 1; yy += 3.6) {
    const i = span(rx - bandX - 1.4, ry - bandY - 0.6, yy)
    if (i !== null) out.push(hline('fine', cx - i, cx + i, yy))
  }
  for (let yy = cy - 3; yy < cy + 4; yy += 1.9) {
    const t = (yy - cy) / 4.6
    if (Math.abs(t) < 1) {
      const hx = rx * 0.26 * Math.sqrt(1 - t * t)
      out.push(hline('hair', cx - rx * 0.18 - hx, cx - rx * 0.18 + hx, yy + 1))
    }
  }
  out.push(stroke('hair', inner, true), stroke('line', outer, true))
  // Surf: broken foam arcs just outside the reef, heavier on the near side.
  for (let k = 0; k < 14; k++) {
    const th = 0.15 + k * 0.44 + rand() * 0.2
    const near = Math.sin(th) > 0
    const run: Pt[] = Array.from({ length: 6 }, (_, i) =>
      E(th + i * 0.045, rx + 4.5 + (near ? 1 : 0), ry + 2.4),
    )
    out.push(stroke('hair', run))
  }
  // Islets with palms on the reef flat.
  const islets = [-2.45, -1.95, -1.4, -0.85, -0.3, 0.25, 2.35, 1.2]
  for (const th of islets) {
    const px = cx + Math.cos(th) * (rx - bandX / 2),
      py = cy + Math.sin(th) * (ry - bandY / 2)
    const blob: Pt[] = Array.from({ length: 14 }, (_, i): Pt => [
      px + Math.cos((i / 14) * 6.283) * (5 + rand() * 3.4),
      py + Math.sin((i / 14) * 6.283) * 1.8,
    ])
    out.push(occlude(blob, { halo: 0.8 }), stroke('hair', blob, true))
    out.push(hline('fine', px - 3, px + 5, py + 0.4))
    if (rand() < 0.62) {
      const lean = Math.cos(th) * 0.5
      out.push(
        ...palm([px - 11, py - 22 - rand() * 4, 22, 23 + rand() * 4], {
          lean,
          seed: Math.round(rand() * 40),
          frond: 0.55,
          fronds: 6,
        }),
      )
    }
  }
  return out
}
