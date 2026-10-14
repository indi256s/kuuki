// Dzanga Bai: forest elephants in a jungle clearing. A dark rainforest wall (hatched masses over
// a solid root shadow) closes the back, two T1 pools lie in the clearing, and three elephants with
// T4 bodies and paper tusks stand in front. The box bottom is the clearing floor.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hatch, occlude, quad, stroke, toneFill } from '../grid'
import { canopyNodes } from './mass-b'
import { type KitModule, num } from './util'

/** One elephant in side view facing right; (x, base) is the rear foot, w the body length. */
export function elephant(x: number, base: number, w: number, flip: boolean): SvgNode[] {
  const k = w / 1
  const hgt = 0.7 * k
  const X = (u: number) => (flip ? x + (1 - u) * k : x + u * k)
  const P = (u: number, v: number): Pt => [X(u), base - hgt + v * hgt]
  const outline: Pt[] = [
    P(0.03, 0.34),
    ...quad(P(0.03, 0.34), P(0.04, 0.12), P(0.2, 0.1), 5),
    ...quad(P(0.2, 0.1), P(0.34, 0.08), P(0.5, 0.16), 5).slice(1),
    ...quad(P(0.5, 0.16), P(0.56, 0.02), P(0.68, 0.0), 5).slice(1),
    ...quad(P(0.68, 0.0), P(0.8, 0.0), P(0.83, 0.2), 5).slice(1),
    P(0.84, 0.36),
    ...quad(P(0.84, 0.36), P(0.9, 0.58), P(0.88, 0.88), 6).slice(1),
    P(0.84, 0.94),
    P(0.81, 0.86),
    ...quad(P(0.81, 0.86), P(0.82, 0.62), P(0.77, 0.48), 5).slice(1),
    P(0.72, 0.5),
    P(0.72, 0.8),
    P(0.7, 1),
    P(0.58, 1),
    P(0.58, 0.76),
    P(0.46, 0.76),
    P(0.38, 0.77),
    P(0.36, 1),
    P(0.22, 1),
    P(0.17, 0.8),
    P(0.07, 0.6),
  ]
  const out: SvgNode[] = [occlude(outline, { halo: 1.4 })]
  // T4 body: vertical hatching, kept lighter on the back so the form reads.
  out.push(
    ...toneFill(outline, 'T4', {
      angle: 90,
      gap: Math.max(1.8, 2.3 - w / 90),
      weight: 'fine',
      inset: 0.2,
    }),
  )
  out.push(stroke(w > 40 ? 'line' : 'hair', outline, true))
  // Ear flap: a paper wedge behind the eye, outlined.
  const ear: Pt[] = [
    P(0.52, 0.2),
    P(0.64, 0.12),
    P(0.74, 0.22),
    P(0.7, 0.5),
    P(0.6, 0.6),
    P(0.52, 0.42),
  ]
  out.push(occlude(ear, { halo: 0 }), stroke('hair', ear, true))
  // Paper tusk curving forward from the mouth.
  const t0 = P(0.77, 0.46)
  const tusk: Pt[] = [
    t0,
    ...quad(t0, P(0.95, 0.52), P(1.0, 0.36), 5).slice(1),
    ...quad(P(1.0, 0.36), P(0.93, 0.6), P(0.77, 0.56), 5).slice(1),
  ]
  out.push(occlude(tusk, { halo: 0.2 }), stroke('hair', tusk, true))
  return out
}

export const dzangaBaiB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const out: SvgNode[] = []
  // Rainforest wall: hatched masses over a solid root shadow at the clearing edge.
  const wallBase = y + h * 0.5
  const wallTop = y
  out.push(
    ...canopyNodes(x, x + w, wallBase, (wallBase - wallTop) * 0.5, rand, {
      crowns: Math.round(w / 11),
      thr: 0.3,
    }),
  )
  out.push(
    ...canopyNodes(x + w * 0.1, x + w * 0.86, wallBase, wallBase - wallTop, rand, {
      crowns: 7,
      thr: 0.3,
    }),
  )
  const shadow: Pt[] = [
    [x, wallBase - 1],
    ...Array.from({ length: 24 }, (_, i): Pt => [
      x + (w * i) / 23,
      wallBase - 3 + (rand() - 0.5) * 3,
    ]),
    [x + w, wallBase - 1],
    [x + w, wallBase + 2],
    [x, wallBase + 2],
  ]
  out.push(fill(shadow))
  // Two T1 pools in the clearing.
  const pool = (cx: number, cy: number, pw: number): SvgNode[] => {
    const lens: Pt[] = [
      ...quad([cx - pw / 2, cy], [cx, cy - 3.2], [cx + pw / 2, cy], 8),
      ...quad([cx + pw / 2, cy], [cx, cy + 3.2], [cx - pw / 2, cy], 8).slice(1),
    ]
    return [occlude(lens, { halo: 0.4 }), ...hatch(lens, 'h', 1.8, 'fine', 0.4)]
  }
  out.push(...pool(x + w * 0.2, y + h * 0.6, 20), ...pool(x + w * 0.86, y + h * 0.6, 20))
  // Elephants, far to near: cow, then the bull.
  out.push(...elephant(x + w * 0.0, base - h * 0.06, w * 0.38, true))
  out.push(...elephant(x + w * 0.34, base, w * 0.62, false))
  return out
}
