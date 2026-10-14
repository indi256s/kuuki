// Vignette modules: the backdrop that fills the whole window (sky, distance, ground). They are
// recipe `backdrop` layers: the box defaults to the window box, `horizonY` is injected, every
// stroke is flagged as backdrop by the renderer so a subject halo stops it short, and nothing here
// is ever outlined except the lit ridge (hair) and the one bold ground line.
import { mulberry32 } from '../hash'
import { clipStrokeOutside } from '../geom'
import {
  type Pt,
  type SvgNode,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
  type ToneName,
} from '../grid'
import { type KitModule, num, nums, pairs, str } from './util'

const hatchTone = (p: Record<string, unknown>, key: string, fallback: ToneName): ToneName =>
  str(p, key, ['T1', 'T2', 'T3', 'T4'] as const, fallback)

/** T1 sky: horizontal fine lines from the top of the box down to the horizon, opening downward. */
export const sky: KitModule = ([x, y, w], p) => {
  const horizon = num(p, 'horizonY', y + 100)
  const gap = nums(p, 'gap', [])
  const lines = toneFill(rectPts(x, y, w, horizon - y), 'T1', {
    ramp: [y, horizon],
    ...(p.weight === 'hair' ? { weight: 'hair' as const } : {}),
    ...(gap.length === 2 ? { gap: [gap[0], gap[1]] as [number, number] } : {}),
  })
  // Optional clouds as flat [x, y, width] triples: lens-shaped gaps in the hatching.
  const c = nums(p, 'clouds', [])
  let out: SvgNode[] = lines
  for (let i = 0; i + 2 < c.length; i += 3) {
    const [cx, cy, cw] = [c[i], c[i + 1], c[i + 2]]
    const lens: Pt[] = [
      ...quad([cx - cw / 2, cy], [cx, cy - 15], [cx + cw / 2, cy], 8),
      ...quad([cx + cw / 2, cy], [cx, cy + 9], [cx - cw / 2, cy], 8).slice(1),
    ]
    out = out.flatMap((n): SvgNode[] => (n.kind === 'stroke' ? clipStrokeOutside(n, lens) : [n]))
  }
  return out
}

type Ridge = { pts: Pt[]; vertices: number[] }

/** Refines coarse vertices into a ridge line with deterministic kinks that vanish at the vertices. */
function refine(coarse: Pt[], jag: number, bow: number, seed: number): Ridge {
  const rand = mulberry32(seed)
  const pts: Pt[] = [coarse[0]]
  const vertices = [0]
  for (let i = 1; i < coarse.length; i++) {
    const a = coarse[i - 1],
      b = coarse[i]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const steps = Math.max(2, Math.round(len / 7))
    for (let k = 1; k < steps; k++) {
      const t = k / steps
      const env = Math.sin(Math.PI * t)
      pts.push([
        a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * jag * env * 0.6,
        a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * 2 * jag * env + bow * env,
      ])
    }
    pts.push(b)
    vertices.push(pts.length - 1)
  }
  return { pts, vertices }
}

/**
 * Receding mountains in T2. `ridge` lists [x fraction of the box, y fraction of the box height from
 * the box top]; the ends are the edges of the box. Rising faces are lit (sparser diagonal), falling
 * faces are shaded (denser, opposite diagonal, or T4 verticals with `shade: 'T4'`). Above `snow` (a
 * fraction of each summit's height) the faces stay white. Only the ridge gets a hair outline.
 */
export const distanceMountains: KitModule = ([x, y, w, h], p) => {
  const horizon = num(p, 'horizonY', y + h * 0.7)
  const coarse = pairs(p, 'ridge', [
    [0, 0.6],
    [0.5, 0.2],
    [1, 0.6],
  ]).map(([xf, yf]): Pt => [x + w * xf, y + h * yf])
  const { pts } = refine(
    coarse,
    num(p, 'jag', 1.4),
    num(p, 'bow', 0),
    Math.round(num(p, 'seed', 7)),
  )
  const snow = num(p, 'snow', 0)
  const litGap = num(p, 'litGap', 3.4)
  const shade = str(p, 'shade', ['T2', 'T4'] as const, 'T2')
  const out: SvgNode[] = []
  out.push(
    occlude([...pts, [pts[pts.length - 1][0], horizon + 2], [pts[0][0], horizon + 2]], { halo: 2 }),
  )

  // Face boundaries: the ridge's local extremes and its ends, found on the refined line.
  const cuts = [0]
  for (let i = 1; i < pts.length - 1; i++) {
    const up = pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]
    const down = pts[i][1] > pts[i - 1][1] && pts[i][1] >= pts[i + 1][1]
    const vertexOnly = coarse.some((c) => Math.abs(c[0] - pts[i][0]) < 1e-6)
    if ((up || down) && vertexOnly) cuts.push(i)
  }
  cuts.push(pts.length - 1)
  for (let c = 0; c + 1 < cuts.length; c++) {
    const seg = pts.slice(cuts[c], cuts[c + 1] + 1)
    const rising = seg[seg.length - 1][1] < seg[0][1]
    const face: Pt[] = [...seg, [seg[seg.length - 1][0], horizon], [seg[0][0], horizon]]
    if (rising) out.push(...toneFill(face, 'T2', { angle: 58, gap: litGap }))
    else if (shade === 'T4') out.push(...toneFill(face, 'T4'))
    else out.push(...toneFill(face, 'T2'))
  }

  // Snowfields: erase the hatching around each summit down to a jagged snow line.
  if (snow > 0) {
    cuts.forEach((ci) => {
      const peak = pts[ci]
      const isPeak =
        (ci === 0 || pts[ci - 1][1] > peak[1]) &&
        (ci === pts.length - 1 || pts[ci + 1][1] >= peak[1])
      if (!isPeak || ci === 0 || ci === pts.length - 1) return
      const snowY = peak[1] + (horizon - peak[1]) * snow
      let l = ci,
        r = ci
      while (l > 0 && pts[l - 1][1] < snowY) l--
      while (r < pts.length - 1 && pts[r + 1][1] < snowY) r++
      const cap = pts.slice(l, r + 1)
      const xl = cap[0][0],
        xr = cap[cap.length - 1][0]
      const teeth = Math.max(3, Math.round((xr - xl) / 7))
      const edge: Pt[] = Array.from({ length: teeth + 1 }, (_, i) => [
        xr - ((xr - xl) * i) / teeth,
        snowY + (i % 2 ? 2.4 : -1.6),
      ])
      out.push(occlude([...cap, ...edge]))
    })
  }
  out.push(stroke('hair', pts))
  return out
}

/** A band of distant trees: scalloped top, fine vertical hatching, no outline. */
export const distanceTrees: KitModule = ([x, y, w, h], p) => {
  const horizon = num(p, 'horizonY', y + h * 0.7)
  const height = num(p, 'height', 18)
  const amp = num(p, 'amp', 3)
  // Optional slow undulation of the crown line (default: none, so older recipes are unchanged).
  const swell = num(p, 'swell', 0)
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const top: Pt[] = []
  for (let tx = x; tx <= x + w + 4; tx += 5) {
    const lift = swell ? swell * Math.sin(tx * 0.07 + 1.3) + swell * 0.5 * Math.sin(tx * 0.23) : 0
    top.push(
      [tx, horizon - height - lift + (rand() - 0.5) * 2 * amp],
      [tx + 2.5, horizon - height - lift - amp],
    )
  }
  const poly: Pt[] = [[x, horizon], ...top, [x + w + 4, horizon]]
  return [
    occlude(poly, { halo: 1.5 }),
    ...toneFill(poly, 'T4', { gap: num(p, 'gap', 2.2), weight: 'fine' }),
  ]
}

/**
 * Ground or water below the horizon: T3 horizontal hair lines, gap 3.6 at the horizon closing to
 * 2.2 at the bottom, and one bold ground line drawn last across the whole box. `water: true`
 * breaks the lines into glints.
 */
export const ground: KitModule = ([x, y, w, h], p) => {
  const horizon = num(p, 'horizonY', y + h * 0.7)
  const bottom = y + h
  const gap = nums(p, 'gap', [])
  const lines = toneFill(rectPts(x, horizon, w, bottom - horizon), hatchTone(p, 'tone', 'T3'), {
    ramp: [horizon, bottom],
    ...(gap.length === 2 ? { gap: [gap[0], gap[1]] as [number, number] } : {}),
  })
  const out: SvgNode[] = []
  if (p.water === true) {
    const rand = mulberry32(Math.round(num(p, 'seed', 5)))
    for (const l of lines) {
      if (l.kind !== 'stroke') continue
      const [a, b] = l.pts
      let cx = a[0] - rand() * 20
      while (cx < b[0]) {
        const len = 14 + rand() * 26
        const s = Math.max(a[0], cx),
          e = Math.min(b[0], cx + len)
        if (e - s > 2) out.push(hline(l.weight, s, e, a[1]))
        cx += len + 2.5 + rand() * 4
      }
    }
  } else out.push(...lines)
  if (p.line !== false) out.push({ ...hline('bold', x, x + w, horizon), late: true })
  return out
}

/** Columnar basalt cliff under a plateau: T4 verticals of staggered length, top edge in hair. */
export const basalt: KitModule = ([x, y, w, h], p) => {
  const side = str(p, 'side', ['left', 'right'] as const, 'right')
  const top = num(p, 'horizonY', y + h * 0.7)
  const bottom = y + h
  const rand = mulberry32(Math.round(num(p, 'seed', 11)))
  const reach = num(p, 'reach', 0.5) * w
  const drop = num(p, 'drop', 0.5) * (bottom - top)
  const fx = (t: number) => (side === 'right' ? x + w - t : x + t)
  // Face: the plateau runs `reach` in from the edge, then the face steps back out and down.
  const poly: Pt[] = [
    [fx(0), top],
    [fx(reach), top],
  ]
  const steps = 6
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    poly.push([fx(reach * (1 - t * 0.55) - rand() * 4), top + drop * t])
  }
  poly.push([fx(0), top + drop * 1.05])
  return [
    occlude(poly, { halo: 1.5 }),
    ...toneFill(poly, 'T4'),
    stroke('hair', [
      [fx(0), top + 0.8],
      [fx(reach), top + 0.8],
    ]),
  ]
}
