// Matapa Chasm seen down the slot (lane A, `-a` until consolidated), one-point perspective. Part
// `walls` is a backdrop: two coral walls in T4 whose verticals break at every ledge, T5 undercuts
// biting into each face, lit end faces in front with strata, a narrow lit gap of sea and sky at the
// end and a T1 pool in the foreground. Part `rocks` is the subject: stepping rocks across the pool.
// Everything is laid out on the window box; the vanishing point sits at the centre of the gap.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  hatchPoly,
  occlude,
  quad,
  rectPts,
  stroke,
} from '../grid'
import { type KitModule, num, str } from './util'

export const chasmA: KitModule = ([x, y, w, h], p) => {
  const part = str(p, 'part', ['walls', 'rocks'] as const, 'walls')
  const cx = x + w / 2
  const vy = y + h * num(p, 'vanish', 0.45)
  const near = w * num(p, 'near', 0.5) // distance of the near wall edge from the centre line
  const k = num(p, 'far', 0.25) // far edge scale
  const nearTop = y - 2
  const nearBot = y + h * 0.97
  const out: SvgNode[] = []
  const farY = (yn: number, u: number) => vy + (yn - vy) * (1 - (1 - k) * u)
  const farX = (side: -1 | 1, u: number) => cx + side * near * (1 - (1 - k) * u)
  const gapTop = farY(nearTop, 1)
  const gapBot = farY(nearBot, 1)
  const gx0 = cx - near * k
  const gx1 = cx + near * k

  if (part === 'rocks') {
    const rocks = (p.rocks as [number, number, number, number][] | undefined) ?? [
      [cx + 2, gapBot + 9, 7, 3],
      [cx - 12, gapBot + 19, 10, 4],
      [cx + 14, gapBot + 29, 12, 5],
      [cx - 10, gapBot + 38, 14, 6],
    ]
    for (const [rx, ry, a, b] of rocks) {
      const dome = quad([rx - a, ry], [rx, ry - b * 2], [rx + a, ry], 12)
      out.push(...body([...dome, [rx + a, ry + 1.2], [rx - a, ry + 1.2]], 'line'))
      out.push(hline('fine', rx - a * 0.55, rx + a * 0.15, ry - b * 0.35))
      out.push(hline('hair', rx - a - 2, rx + a + 3, ry + 3.2))
    }
    return out
  }

  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  // The gap: lit sky above, sea below the horizon, drawn inside a paper window.
  const gap = rectPts(gx0, gapTop, gx1 - gx0, gapBot - gapTop)
  out.push(occlude(gap))
  const horizon = gapTop + (gapBot - gapTop) * 0.55
  out.push(
    ...hatchPoly(rectPts(gx0, horizon, gx1 - gx0, gapBot - horizon), {
      angle: 0,
      gap: [2.4, 2.0],
      weight: 'hair',
    }),
  )
  out.push(hline('line', gx0, gx1, horizon))

  // Pool: horizontal lines closing toward the viewer, inside the floor trapezoid.
  const floor: Pt[] = [
    [gx0, gapBot],
    [gx1, gapBot],
    [cx + near, nearBot],
    [x + w, y + h],
    [x, y + h],
    [cx - near, nearBot],
  ]
  out.push(occlude(floor))
  out.push(...hatchPoly(floor, { angle: 0, gap: [4.2, 2.6], weight: 'fine' }))

  // Walls: inner faces (T4 with ledge breaks, undercut pockets) and lit end faces. The near edge
  // leans in toward the top and wobbles, so the slot narrows and the faces are not flat ruled cards.
  const span = nearBot - nearTop
  const lean = near * 0.2
  const wob = (side: number, t: number) =>
    Math.sin(t * 9 + (side < 0 ? 0.6 : 2.4)) * near * 0.035 + Math.sin(t * 23 + side) * near * 0.012
  const xn = (side: number, yn: number) => {
    const t = (yn - nearTop) / span
    return near - lean * Math.pow(1 - t, 1.6) + wob(side, t)
  }
  const ledges = Array.from({ length: 9 }, (_, i) => (i + 1) / 10 + (rand() - 0.5) * 0.05)
  const stagger = Array.from({ length: 10 }, () => (rand() - 0.5) * 0.07)
  for (const side of [-1, 1] as const) {
    const P = (u: number, yn: number): Pt => [
      cx + side * xn(side, yn) * (1 - (1 - k) * u),
      farY(yn, u),
    ]
    const ys = Array.from({ length: 17 }, (_, i) => nearTop + (span * i) / 16)
    const face: Pt[] = [...ys.map((yn) => P(0, yn)), ...ys.map((yn) => P(1, yn)).reverse()]
    out.push(occlude(face))
    const cols = hatchPoly(face, { angle: 90, gap: 2.4, weight: 'hair', phase: 0.3 })
    for (const c of cols) {
      const px = c.pts[0][0]
      const u = Math.min(1, Math.max(0, (1 - Math.abs(px - cx) / near) / (1 - k)))
      const [ya, yb] = [c.pts[0][1], c.pts[1][1]]
      const cuts = ledges
        .map((t) => farY(nearTop + span * (t + stagger[Math.min(9, Math.floor(u * 10))]), u))
        .filter((c2) => c2 > ya + 2 && c2 < yb - 2)
      const marks = [ya, ...cuts, yb]
      for (let i = 0; i + 1 < marks.length; i++) {
        const a = marks[i] + (i === 0 ? 0 : 1.1)
        const b = marks[i + 1] - (i + 2 === marks.length ? 0 : 1.1)
        if (b - a > 1.4)
          out.push(
            stroke('hair', [
              [px, a],
              [px, b],
            ]),
          )
      }
    }
    // Undercut pockets: dark lenses under a ledge, tapering into the distance.
    for (const [f0, u0, u1] of [
      [0.22, 0.1, 0.85],
      [0.58, 0.0, 0.7],
    ]) {
      const y0 = nearTop + span * f0
      const y1 = y0 + 11
      const pocket: Pt[] = [
        P(u0, y0),
        P((u0 + u1) / 2, y0 - 0.8),
        P(u1, y0 + 0.6),
        P((u0 + u1) / 2, y1),
      ]
      out.push(occlude(pocket), fill(pocket))
    }
    const edgeTop = ys.map((yn) => P(0, yn))
    out.push(stroke('line', edgeTop))
    out.push(
      stroke('line', [P(0, nearTop), P(1, nearTop)]),
      stroke('line', [P(0, nearBot), P(1, nearBot)]),
    )
    out.push(stroke('line', [P(1, nearTop), P(1, nearBot)]))
    // Lit end face: paper with broken strata.
    const nx = (yn: number) => cx + side * xn(side, yn)
    const ex = side < 0 ? x - 4 : x + w + 4
    const end: Pt[] = [[ex, nearTop], ...ys.map((yn): Pt => [nx(yn), yn]), [ex, nearBot + 2]]
    if (Math.abs(nx(nearTop) - ex) < 6) {
      out.push(stroke('bold', edgeTop))
      continue
    }
    out.push(occlude(end))
    for (let yy = y + 8; yy < nearBot - 3; yy += 8 + rand() * 3) {
      const [lo, hi] = side < 0 ? [x, nx(yy)] : [nx(yy), x + w]
      let px = lo + 1 + rand() * 4
      while (px < hi - 2) {
        const len = 4 + rand() * 9
        out.push(
          stroke('fine', [
            [px, yy],
            [Math.min(hi - 1.5, px + len), yy + rand() * 1.2],
          ]),
        )
        px += len + 3 + rand() * 6
      }
    }
    out.push(stroke('bold', edgeTop))
  }
  out.push(
    stroke('hair', [
      [gx0, gapBot],
      [gx1, gapBot],
    ]),
  )
  return out
}
