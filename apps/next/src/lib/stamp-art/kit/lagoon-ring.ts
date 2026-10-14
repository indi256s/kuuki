// Lagoon ring seen from above (Kiritimati). Two parts of one picture: `part: 'sea'` is a backdrop
// layer that hatches the window (dense open ocean outside the ring, a few fine ripples in the
// lagoon); `part: 'land'` is the subject, a lit ring of land with a single pass, islets in the
// lagoon and black palm tufts along the rim. Geometry is absolute (cx, cy, rx, ry in grid units)
// so both parts agree.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

/** A palm seen from above: a small solid star of narrow fronds. */
export function tuft(cx: number, cy: number, r: number, rand: () => number): SvgNode[] {
  const out: SvgNode[] = []
  const n = 7
  const a0 = rand() * Math.PI
  for (let i = 0; i < n; i++) {
    const a = a0 + (i * Math.PI * 2) / n
    const len = r * (0.85 + rand() * 0.3)
    const [dx, dy] = [Math.cos(a), Math.sin(a)]
    out.push(
      fill([
        [cx - dy * 0.8, cy + dx * 0.8],
        [cx + dx * len, cy + dy * len],
        [cx + dy * 0.8, cy - dx * 0.8],
      ]),
    )
  }
  return out
}

/** Irregular closed ring outline: a wobbling ellipse. */
function wobble(cx: number, cy: number, rx: number, ry: number, rand: () => number, n = 56): Pt[] {
  const ph = [rand() * 6, rand() * 6, rand() * 6]
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const k =
      1 +
      0.06 * Math.sin(3 * a + ph[0]) +
      0.04 * Math.sin(5 * a + ph[1]) +
      0.025 * Math.sin(9 * a + ph[2])
    return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)] as Pt
  })
}

export const lagoonRing: KitModule = ([x, y, w, h], p) => {
  const cx = num(p, 'cx', 100)
  const cy = num(p, 'cy', 100)
  const rx = num(p, 'rx', 66)
  const ry = num(p, 'ry', 40)
  const band = num(p, 'band', 11)
  const passAt = num(p, 'pass', 0.12) // fraction of the turn, from east, clockwise on screen
  const passW = num(p, 'passW', 0.05)
  const seed = Math.round(num(p, 'seed', 7))
  const rand = mulberry32(seed)
  const outer = wobble(cx, cy, rx, ry, rand)
  const rand2 = mulberry32(seed)
  const inner = wobble(cx, cy, rx - band, ry - band * 0.8, rand2).map(
    ([px, py], i) => [px + Math.sin(i * 0.9) * 0.8, py] as Pt,
  )
  const out: SvgNode[] = []
  if (p.part === 'sea') {
    const win: Pt[] = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]
    out.push(...toneFill(win, 'T3', { gap: [2.3, 1.9], ramp: [y, y + h] }))
    return out
  }
  // Land ring: split into a lit band with a pass. Pass cut as a gap in both outlines.
  const cut = (pts: Pt[]): Pt[][] => {
    const n = pts.length
    const a = Math.round(passAt * n)
    const g = Math.max(2, Math.round(passW * n))
    const rest = [...pts.slice(a + g), ...pts.slice(0, a)]
    return [rest]
  }
  out.push(occlude(outer))
  out.push(...toneFill(inner, 'T1', { gap: 5, weight: 'fine', inset: 3 }))
  for (const seg of cut(outer)) out.push(stroke('line', seg))
  for (const seg of cut(inner)) out.push(stroke('hair', seg))
  // Pass: short cross strokes at the cut ends so the ring reads as open.
  const n = outer.length
  const a = Math.round(passAt * n)
  const g = Math.max(2, Math.round(passW * n))
  for (const i of [a % n, (a + g) % n]) {
    out.push(stroke('line', [outer[i], inner[i]]))
  }
  // Lagoon islets.
  for (const [fx, fy, r] of [
    [-0.3, 0.1, 4.5],
    [0.22, -0.18, 3.6],
    [0.04, 0.22, 3],
  ]) {
    const isl = wobble(cx + rx * fx, cy + ry * fy, r * 1.6, r, rand, 14)
    out.push(...[occlude(isl, { halo: 1.5 }), stroke('hair', isl, true)])
  }
  // Palm tufts along the band, skipping the pass.
  const m = 20
  for (let i = 0; i < m; i++) {
    const idx = Math.round((i / m) * n) % n
    if (idx > a - 2 && idx < a + g + 2) continue
    const [ox, oy] = outer[idx]
    const [ix, iy] = inner[idx]
    const t = 0.38 + rand() * 0.24
    out.push(...tuft(ox + (ix - ox) * t, oy + (iy - oy) * t, 4 + rand() * 1.6, rand))
  }
  return out
}
