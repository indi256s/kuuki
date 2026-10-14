// Colonial hill forts, drawn in perspective. A tier is a battered (about 70 degree) rampart whose
// plan has one salient: the left face is lit paper, the right face T4, they meet at a vertical
// edge and both recede, so the wall reads as massing rather than a bar. Tops are lit parapet strips.
// `garitaA` is a sentry box on corbels. Shared by Cartagena (CO, san-felipe-a) and Brimstone Hill
// (KN, brimstone-a); each module places its own tiers.
import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke, toneFill } from '../grid'

/** A small sentry box on a corbel: lit shaft with a slit, shaded side, pointed cap. */
export function garitaA(cx: number, base: number, s = 1): SvgNode[] {
  const hw = 2.6 * s
  const top = base - 5.6 * s
  const cap: Pt[] = [
    [cx - hw - 0.8 * s, top],
    [cx, top - 3.6 * s],
    [cx + hw + 0.8 * s, top],
  ]
  return [
    ...body(
      [
        [cx - hw * 0.6, base + 1.6 * s],
        [cx - hw, base],
        [cx + hw, base],
        [cx + hw * 0.6, base + 1.6 * s],
      ],
      'hair',
    ),
    ...body(rectPts(cx - hw, top, hw * 2, base - top), 'hair'),
    fill(rectPts(cx - hw * 0.5, top + 1.4 * s, hw * 0.7, 2.2 * s)),
    occlude(cap),
    fill(cap),
  ]
}

export type Tier = {
  /** Left and right ends at the foot. */
  x0: number
  x1: number
  /** Foot and top y of the wall face. */
  yb: number
  yt: number
  /** Salient position as a fraction of the width. */
  salient: number
  /** Horizontal batter: how far each end leans in over the wall's height. */
  batter?: number
  /** How much the receding ends rise at the foot and fall at the top. */
  recede?: number
  /** Parapet strip height above the wall top. */
  cap?: number
  /** Garitas on the salient and the left end. */
  garitas?: boolean
}

/** One rampart tier. Returns nodes and the top y at the salient (where a garita sits). */
export function tier(t: Tier): { nodes: SvgNode[]; saX: number; saTop: number; footY: number } {
  const batter = t.batter ?? (t.yb - t.yt) * 0.36
  const rec = t.recede ?? 2.6
  const cap = t.cap ?? 3
  const w = t.x1 - t.x0
  const xs = t.x0 + w * t.salient
  // Face outline, foot first: left end, salient, right end. Ends lean in toward the top.
  const L: Pt[] = [
    [t.x0, t.yb - rec],
    [xs, t.yb],
    [t.x1, t.yb - rec],
  ]
  const U: Pt[] = [
    [t.x1 - batter, t.yt + rec * 0.6],
    [xs, t.yt],
    [t.x0 + batter, t.yt + rec * 0.6],
  ]
  const face: Pt[] = [...L, ...U]
  const shade: Pt[] = [L[1], L[2], U[0], U[1]]
  // Parapet: the lit top strip, a thin slab above the wall edge.
  const parapet: Pt[] = [
    [t.x0 + batter, t.yt + rec * 0.6],
    [xs, t.yt],
    [t.x1 - batter, t.yt + rec * 0.6],
    [t.x1 - batter - 1, t.yt + rec * 0.6 - cap],
    [xs, t.yt - cap],
    [t.x0 + batter + 1, t.yt + rec * 0.6 - cap],
  ]
  const nodes: SvgNode[] = [...body(face, 'line')]
  nodes.push(...toneFill(shade, 'T4', { gap: 2.2 }))
  // Lit curtain: two or three masonry courses, thinning toward the top.
  const n = 3
  for (let i = 1; i <= n; i++) {
    const f = i / (n + 1)
    const a: Pt = [
      t.x0 + (xs - t.x0) * 0.08 + batter * (1 - f) * 0.0,
      L[0][1] + (U[2][1] - L[0][1]) * f,
    ]
    const b: Pt = [xs - 1.2, L[1][1] + (U[1][1] - L[1][1]) * f]
    nodes.push(stroke('fine', [a, b]))
  }
  nodes.push(...body(parapet, 'line'))
  nodes.push(stroke('bold', L))
  return { nodes, saX: xs, saTop: t.yt - cap, footY: t.yb }
}
