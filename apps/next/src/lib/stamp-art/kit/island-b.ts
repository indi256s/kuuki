// A low island on a flat waterline: a dark hump of fine vertical hatching under a clump of palms,
// optionally with a quay (a jetty on posts). The box bottom is the waterline; `palms` lists
// [x fraction, tree height fraction of the box, lean]. Water hatching is stopped by the hump.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, quad, rectPts, stroke, vline } from '../grid'
import { type KitModule, bool, num } from './util'
import { palm } from './palm'

export const islandB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  const hump = num(p, 'hump', 0.16) * h
  const palms = (Array.isArray(p.palms) ? p.palms : []) as [number, number, number][]
  const out: SvgNode[] = []
  // Palms first so the island body overlaps their feet. Entries are [x fraction, height, lean].
  for (const [f, th, lean] of palms) {
    const tw = th * 0.95
    out.push(
      ...palm([x + w * f - tw / 2, base - hump * 0.8 - th, tw, th], {
        lean,
        frond: 0.58,
        fronds: 9,
        seed: Math.round(rand() * 90),
      }),
    )
  }
  const topAt = (t: number) => base - hump * 2 * 2 * t * (1 - t)
  const top = quad([x, base], [x + w * 0.5, base - hump * 2], [x + w, base], 18)
  const pts: Pt[] = [...top, [x + w, base + 1.6], [x, base + 1.6]]
  out.push(...body(pts, 'line'))
  // Grass hatching on the lower flank only: the crown stays lit paper.
  for (let hx = x + 1.2; hx < x + w - 0.6; hx += 3.4) {
    const t = (hx - x) / w
    const len = (base + 1.4 - topAt(t)) * (0.22 + rand() * 0.2)
    out.push(vline('hair', hx, base + 1.4, base + 1.4 - len))
  }
  out.push(hline('bold', x - 2, x + w + 2, base + 1.6))
  if (bool(p, 'quay', false)) {
    const qx = x + w * 0.98
    const qw = num(p, 'quayW', 26)
    out.push(...body(rectPts(qx, base - 3, qw, 2), 'hair'))
    for (let i = 0; i <= 4; i++)
      out.push(vline('line', qx + (qw * i) / 4 - 0.4, base - 1, base + 4))
  }
  out.push(
    stroke('hair', [
      [x + w * 0.12, base + 4.4],
      [x + w * 0.9, base + 4.4],
    ]),
  )
  return out
}
