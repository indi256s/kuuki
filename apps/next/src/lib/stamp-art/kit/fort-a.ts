import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke, toneFill } from '../grid'

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
  x0: number
  x1: number
  yb: number
  yt: number
  salient: number
  batter?: number
  recede?: number
  cap?: number
  garitas?: boolean
}

export function tier(t: Tier): { nodes: SvgNode[]; saX: number; saTop: number; footY: number } {
  const batter = t.batter ?? (t.yb - t.yt) * 0.36
  const rec = t.recede ?? 2.6
  const cap = t.cap ?? 3
  const w = t.x1 - t.x0
  const xs = t.x0 + w * t.salient
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
