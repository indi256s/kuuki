// One parametric waterfall for every falls stamp. Falling water is bare paper with a few fine
// vertical lines in its shaded third, the lip is a bold edge, and the rock on either side is wet
// T4 so the white reads. Spray is a ragged T1 horizontal-hatch fade (never puffs), the pool is the
// T3 ground with paper foam ticks. Rock is lit strata with T4 on the shaded side only.
//
// Params: `profile` (ribbon, curtain, horseshoe, two-step, cleft, cascade), `lipY` and `drop` as
// fractions of the box height, `width` (ribbon/cleft, fraction of box width or units), `mist`
// (fraction of box height), `seed`. The box bottom is the foot of the falls (the horizon).
import { mulberry32 } from '../hash'
import {
  type Box,
  type Pt,
  type SvgNode,
  fill,
  hline,
  occlude,
  quad,
  stroke,
  toneFill,
} from '../grid'
import { canopyNodes, plumeNodes } from './mass-b'
import { type RockOpts, rockMass as rockMassBase } from './rock-b'
import { type KitModule, type Params, num, str } from './util'

type Rand = () => number
/** rockMass with the recipe's fracture-hatch gap applied (lit rock density). */
const withRock =
  (p: Params) =>
  (poly: Pt[], rand: Rand, o: RockOpts = {}) =>
    rockMassBase(poly, rand, { fracture: num(p, 'fracture', 4.8), ...o })
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]

/** A falling sheet between a top polyline (the lip) and a bottom polyline, both left to right. */
function sheet(
  top0: Pt[],
  bot: Pt[],
  rand: Rand,
  o: { wet?: number; streaks?: number; rag?: number } = {},
) {
  const out: SvgNode[] = []
  const rag = o.rag ?? 0.8
  const top: Pt[] = top0.map(([px, py], i): Pt => [
    px,
    py + (i > 0 && i < top0.length - 1 ? (rand() - 0.5) * 1.4 : 0),
  ])
  const tl = top[0],
    tr = top[top.length - 1],
    bl = bot[0],
    br = bot[bot.length - 1]
  const edge = (a: Pt, b: Pt): Pt[] => {
    const e: Pt[] = []
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7))
    for (let k = 1; k < n; k++) {
      const q = lerpPt(a, b, k / n)
      e.push([q[0] + (rand() - 0.5) * 2 * rag, q[1]])
    }
    return e
  }
  const poly: Pt[] = [...top, ...edge(tr, br), ...[...bot].reverse(), ...edge(bl, tl)]
  const wet = o.wet ?? 0
  if (wet > 0) {
    out.push(
      ...toneFill([[tl[0] - wet, tl[1]], tl, bl, [bl[0] - wet, bl[1]]], 'T4', { gap: 2.2 }),
      ...toneFill([tr, [tr[0] + wet, tr[1]], [br[0] + wet, br[1]], br], 'T4', { gap: 2.2 }),
    )
  }
  out.push(occlude(poly, { halo: 1 }))
  const width = Math.hypot(tr[0] - tl[0], tr[1] - tl[1])
  const streaks = o.streaks ?? 1
  for (let f = 0.2; f < 0.97; f += 2.6 / width) {
    if (rand() > streaks * (0.3 + 0.7 * f)) continue
    const t = lerpPt(tl, tr, f),
      b = lerpPt(bl, br, f)
    const s0 = 0.06 + rand() * 0.4,
      s1 = s0 + 0.28 + rand() * 0.4
    out.push(stroke('fine', [lerpPt(t, b, s0), lerpPt(t, b, Math.min(0.97, s1))]))
  }
  out.push(stroke('bold', top))
  return out
}

/** Edges of a stream of varying half-width along a path; `a` is the lower-left side. */
function streamEdges(path: (t: number) => Pt, halfW: (t: number) => number, n = 14) {
  const a: Pt[] = [],
    b: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const c = path(t)
    const c1 = path(Math.max(0, t - 0.02)),
      c2 = path(Math.min(1, t + 0.02))
    const dx = c2[0] - c1[0],
      dy = c2[1] - c1[1]
    const len = Math.hypot(dx, dy) || 1
    // (-dy, dx) points to the right of travel on a y-down screen when travelling down: screen left.
    const nx = -dy / len,
      ny = dx / len
    const hw = halfW(t)
    a.push([c[0] + nx * hw, c[1] + ny * hw])
    b.push([c[0] - nx * hw, c[1] - ny * hw])
  }
  return { a, b }
}

/** Draws a stream between two edge polylines: wet T4 flanks, paper body, shaded streaks, bold lip. */
function stream(a: Pt[], b: Pt[], rand: Rand, o: { wet?: number; marks?: number } = {}): SvgNode[] {
  const out: SvgNode[] = []
  const n = a.length - 1
  const wet = o.wet ?? 4.5
  if (wet > 0) {
    const band = (edge: Pt[], dir: number): Pt[] => [
      ...edge,
      ...[...edge].reverse().map(([ex, ey]): Pt => [ex + dir * wet, ey]),
    ]
    out.push(
      ...toneFill(band(a, -1), 'T4', { gap: 2.2 }),
      ...toneFill(band(b, 1), 'T4', { gap: 2.2 }),
    )
  }
  out.push(occlude([...a, ...[...b].reverse()], { halo: 1 }))
  const marks = o.marks ?? 7
  for (let k = 0; k < marks; k++) {
    const f = 0.58 + (0.36 * k) / Math.max(1, marks - 1)
    const s0 = Math.round((0.08 + rand() * 0.45) * n)
    const s1 = Math.min(n - 1, s0 + Math.round((0.25 + rand() * 0.3) * n))
    const seg: Pt[] = []
    for (let i = s0; i <= s1; i++) seg.push(lerpPt(a[i], b[i], f))
    if (seg.length > 1) out.push(stroke('fine', seg))
  }
  out.push(stroke('bold', [a[0], b[0]]))
  return out
}

/** Spray: horizontal fine rows widest at the foot, a ragged top, thinning upward. */
function mist(x0: number, x1: number, base: number, h: number, rand: Rand): SvgNode[] {
  if (h < 2) return []
  const w = x1 - x0
  const n = Math.max(6, Math.round(w / 2.5))
  const ph = rand() * 6
  const top: number[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const env = Math.sin(Math.PI * u) ** 0.5
    top.push(
      base -
        h * (0.38 + 0.62 * env) * (0.72 + 0.28 * (0.5 + 0.5 * Math.sin(u * 15 + ph))) -
        rand() * 1.4,
    )
  }
  const poly: Pt[] = [
    [x0, base + 1.2],
    ...top.map((y, i): Pt => [x0 + (w * i) / n, y]),
    [x1, base + 1.2],
  ]
  const out: SvgNode[] = [occlude(poly, { halo: 1.2 })]
  const minTop = Math.min(...top)
  const topAt = (x: number) => top[Math.max(0, Math.min(n, Math.round(((x - x0) / w) * n)))]
  for (let k = 0, y = base - 0.8; y > minTop; k++, y -= (k < 4 ? 1.9 : 2.2) + k * 0.2) {
    let start = -1
    const wt = k < 4 ? 'hair' : 'fine'
    for (let x = x0; x <= x1 + 0.5; x += 1) {
      const on = x <= x1 && topAt(x) <= y && rand() > 0.04 * k
      if (on && start < 0) start = x
      if (!on && start >= 0) {
        if (x - start > 2) out.push(hline(wt, start, x, y))
        start = -1
      }
    }
  }
  return out
}

/** Paper foam lenses cut into the pool hatching at a fall's foot. */
function foam(cx: number, half: number, y: number, rand: Rand): SvgNode[] {
  const out: SvgNode[] = []
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 3; k++) {
      const len = 5 + rand() * 6
      const px = cx + (rand() - 0.5) * 2 * half
      const py = y + 2.6 + row * 3.4
      out.push(
        occlude(
          [
            ...quad([px - len / 2, py], [px, py - 1.4], [px + len / 2, py], 4),
            ...quad([px + len / 2, py], [px, py + 1.4], [px - len / 2, py], 4).slice(1),
          ],
          { halo: 0.4 },
        ),
      )
    }
  }
  return out
}

/** Canopy chunks along a ridge so the forest follows a sloping skyline. */
function canopyOn(ridge: Pt[], h: number, rand: Rand, from = 0, to = Infinity): SvgNode[] {
  const out: SvgNode[] = []
  const x0 = Math.max(from, ridge[0][0]),
    x1 = Math.min(to, ridge[ridge.length - 1][0])
  const n = Math.max(1, Math.round((x1 - x0) / 24))
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n,
      b = x0 + ((x1 - x0) * (i + 1)) / n
    const ys = ridge.filter((q) => q[0] >= a - 1 && q[0] <= b + 1).map((q) => q[1])
    if (!ys.length) continue
    out.push(...canopyNodes(a, b, Math.max(...ys) + 1.5, h, rand))
  }
  return out
}

function ridgeLine(
  x0: number,
  x1: number,
  yAt: (x: number) => number,
  rand: Rand,
  jit = 0.7,
): Pt[] {
  const out: Pt[] = []
  const n = Math.max(2, Math.round((x1 - x0) / 5))
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n)
    out.push([x, yAt(x) + (i === 0 || i === n ? 0 : (rand() - 0.5) * 2 * jit)])
  }
  return out
}

// ---- profiles ---------------------------------------------------------------------------------

function curtain([x, y, w, h]: Box, p: Params, rand: Rand, horseshoe: boolean): SvgNode[] {
  const rockMass = withRock(p)
  const out: SvgNode[] = []
  const n = Math.max(1, Math.round(num(p, 'channels', horseshoe ? 6 : 3)))
  const lipV = num(p, 'lipY', 0.28)
  const dropV = num(p, 'drop', 0.55)
  const bow = num(p, 'bow', horseshoe ? 9 : 0)
  const footBow = num(p, 'footBow', bow * 0.6)
  const bw = num(p, 'buttress', 5)
  const ribLen = num(p, 'ribLen', 1)
  const endW = num(p, 'ends', 0.06) * w
  const endTall = num(p, 'endTall', 6)
  const ledge = num(p, 'ledge', 5)
  const canopyH = num(p, 'canopy', 0)
  const islets = num(p, 'islets', 0)
  const spread = num(p, 'spread', 0.5) * bw
  const mistH = num(p, 'mist', 0.15) * h
  const lipJit = num(p, 'lipJit', 2.2)
  const recess = num(p, 'recess', 0)
  const wallOn = num(p, 'wall', 1) > 0
  const bu = (xx: number) => ((2 * (xx - x)) / w - 1) ** 2
  const lipAt = (xx: number) => y + lipV * h + bow * bu(xx)
  const footAt = (xx: number) => y + (lipV + dropV) * h + footBow * bu(xx)
  const x0 = x + endW,
    x1 = x + w - endW
  const wts = Array.isArray(p.weights) ? (p.weights as number[]) : null
  const weights = Array.from({ length: n }, (_, i) => wts?.[i] ?? 0.45 + rand() * 1.1)
  const sum = weights.reduce((a, b) => a + b, 0)
  const chTotal = x1 - x0 - bw * (n - 1)
  const chans: [number, number][] = []
  const bts: [number, number][] = []
  let cx = x0
  for (let i = 0; i < n; i++) {
    const b = cx + (chTotal * weights[i]) / sum
    chans.push([cx, b])
    cx = b
    if (i < n - 1) {
      bts.push([cx, cx + bw])
      cx += bw
    }
  }
  const sprayCfg = Array.isArray(p.spray) ? (p.spray as number[]) : null
  const sprayX: [number, number] | null = sprayCfg
    ? [x + w * (sprayCfg[0] - sprayCfg[1] / 2), x + w * (sprayCfg[0] + sprayCfg[1] / 2)]
    : null
  // End walls: tall rock that steps down toward the falls (the amphitheatre when the walls are wide).
  const walls: { poly: Pt[]; ridge: Pt[]; shade: number }[] = []
  const rimL = lipAt(x0) - ledge
  const rimR = lipAt(x1) - ledge
  if (endW > 2) {
    const rl = ridgeLine(
      x,
      x0,
      (xx) => lerp(rimL - endTall, rimL, ((xx - x) / (x0 - x)) ** 1.5),
      rand,
    )
    const rr = ridgeLine(
      x1,
      x + w,
      (xx) => lerp(rimR, rimR - endTall, ((xx - x1) / (x + w - x1)) ** 0.7),
      rand,
    )
    const bot = y + h
    walls.push({ ridge: rl, poly: [...rl, [x0, bot], [x, bot]], shade: 0.72 })
    walls.push({ ridge: rr, poly: [...rr, [x + w, bot], [x1, bot]], shade: 0.8 })
  }
  for (const wl of walls)
    out.push(...rockMass(wl.poly, rand, { ridge: wl.ridge, shade: wl.shade, angle: -58 }))
  // The dark rock face behind the water: the sheets are cut out of it, so the white reads.
  const chJit = chans.map(() => [(rand() - 0.5) * 2 * lipJit, (rand() - 0.5) * 2 * lipJit] as const)
  if (wallOn) {
    const wa = recess > 0 ? chans[0][0] - recess : x0
    const wb = recess > 0 ? chans[n - 1][1] + recess : x1
    const wTop = ridgeLine(wa, wb, (xx) => lipAt(xx) - ledge, rand, 0.4)
    const wBot = ridgeLine(wb, wa, (xx) => footAt(xx) - 1, rand, 0.4)
    const wp: Pt[] = [...wTop, ...wBot]
    out.push(occlude(wp), ...toneFill(wp, 'T4', { gap: 2.1 }))
  }
  // Rim ledge above the lips.
  const ledgeRidge = ridgeLine(x0, x1, (xx) => lipAt(xx) - ledge, rand, 0.6)
  const ledgePoly: Pt[] = [...ledgeRidge, ...ridgeLine(x1, x0, lipAt, rand, 0)]
  out.push(...rockMass(ledgePoly, rand, { ridge: ledgeRidge, shade: 0.75, strata: true }))
  // Buttresses between the sheets.
  bts.forEach(([a, b], i) => {
    if (wallOn && islets <= 0) return
    void i
    const botY = lipAt((a + b) / 2) + ribLen * (footAt((a + b) / 2) - lipAt((a + b) / 2))
    const mx = (a + b) / 2
    // Teeth: rock hanging from the rim, tapering to a point (ribLen < 1) or running to the foot.
    const poly: Pt[] =
      ribLen < 1 || p.taper !== undefined
        ? [
            [a - 1, lipAt(a) - ledge],
            [b + 1, lipAt(b) - ledge],
            [mx + num(p, 'taper', 2.4) / 2, botY],
            [mx - num(p, 'taper', 2.4) / 2, botY],
          ]
        : [
            [a, lipAt(a) - ledge],
            [b, lipAt(b) - ledge],
            [b + 1.2, footAt(b)],
            [a - 1.2, footAt(a)],
          ]
    if (!wallOn)
      out.push(
        ...rockMass(poly, rand, {
          shade: 0,
          darkGap: num(p, 'toothGap', 2),
          keep: true,
          slant: 0,
          smooth: true,
        }),
      )
    if (islets > 0) {
      const top = lipAt((a + b) / 2) - ledge
      out.push(...canopyNodes(a - 3, b + 3, top + 1, islets, rand, { crowns: 1 }))
    }
  })
  // Forest on the rim and on the end walls.
  if (canopyH > 0) {
    const pieces: Pt[][] = [
      ledgeRidge,
      ...(num(p, 'wallCanopy', 1) > 0 ? walls.map((wl) => wl.ridge) : []),
    ]
    for (const r of pieces) {
      if (!sprayX) out.push(...canopyOn(r, canopyH, rand))
      else {
        out.push(...canopyOn(r, canopyH, rand, -Infinity, sprayX[0] - 3))
        out.push(...canopyOn(r, canopyH, rand, sprayX[1] + 3))
      }
    }
  }
  // The sheets.
  chans.forEach(([a, b], ci) => {
    const top: Pt[] = []
    const bot: Pt[] = []
    for (let k = 0; k <= 4; k++) {
      const xx = lerp(a, b, k / 4)
      top.push([xx, lipAt(xx) + chJit[ci][0]])
      bot.push([
        Math.min(x + w - 2, Math.max(x + 2, lerp(a - spread, b + spread, k / 4))),
        footAt(xx) + chJit[ci][1],
      ])
    }
    out.push(...sheet(top, bot, rand, { wet: n === 1 ? 6 : 0 }))
  })
  // Foot: spray and foam.
  for (const [a, b] of chans) {
    const m = (a + b) / 2
    out.push(...mist(a - 2.5, b + 2.5, footAt(m) + 0.5, mistH, rand))
    out.push(...foam(m, (b - a) / 2, footAt(m), rand))
  }
  // A dark pool band closes the foot of each sheet.
  chans.forEach(([a, b], ci) => {
    const fy = footAt((a + b) / 2) + chJit[ci][1]
    for (let k = 0; k < 3; k++)
      out.push(
        hline(
          'hair',
          Math.max(x + 2, a - spread),
          Math.min(x + w - 2, b + spread),
          fy + 1.4 + k * 1.9,
        ),
      )
  })
  // A T5 gorge cut in front of the foot hides the plunge (Victoria Falls).
  const gorge = num(p, 'gorge', 0)
  if (gorge > 0) {
    const gy = footAt(x + w / 2)
    const poly: Pt[] = [[x, gy - 1]]
    for (let xx = x; xx <= x + w + 0.1; xx += 4)
      poly.push([xx, gy - 0.5 + (rand() - 0.5) * 2.2 + (xx % 8 < 4 ? 0 : 1)])
    poly.push([x + w, gy + gorge], [x, gy + gorge + 1])
    out.push(occlude(poly, { halo: 1 }), fill(poly))
  }
  if (sprayX) {
    const base = lipAt((sprayX[0] + sprayX[1]) / 2) - ledge - 1
    out.push(...plumeNodes(sprayX[0], sprayX[1], base, (sprayCfg?.[2] ?? 0.3) * h, rand))
  }
  return out
}

function ribbon([x, y, w, h]: Box, p: Params, rand: Rand): SvgNode[] {
  const rockMass = withRock(p)
  const out: SvgNode[] = []
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const wid = num(p, 'width', 0.08) * w
  const lipV = num(p, 'lipY', 0.15)
  const dropV = num(p, 'drop', 0.45)
  const axis = num(p, 'axis', 0.66)
  const uv: [number, number][] = [
    [0.03, 1],
    [0.07, 0.8],
    [0.1, 0.52],
    [0.12, 0.3],
    [0.15, 0.18],
    [0.2, 0.135],
    [0.3, 0.12],
    [0.45, 0.13],
    [0.6, 0.11],
    [0.75, 0.125],
    [0.88, 0.12],
    [0.93, 0.17],
    [0.95, 0.3],
    [0.965, 0.62],
    [0.99, 1],
  ]
  const pts: Pt[] = uv.map(([u, v], i) => [
    X(0.28 + 0.66 * u),
    Y(v) + (i === 0 || i === uv.length - 1 ? 0 : (rand() - 0.5) * 1.2),
  ])
  const ridge = pts.slice(1, -1)
  out.push(...rockMass(pts, rand, { ridge, shade: 0.5, slant: 0.1, cracks: 5 }))
  // Scrub on the summit rim.
  out.push(...canopyNodes(X(0.42), X(0.9), Y(0.13), num(p, 'scrub', 5), rand))
  const cx = X(axis)
  const yTop = Y(lipV),
    yBot = Y(lipV + dropV)
  const sway = (rand() - 0.5) * 3
  const e = streamEdges(
    (t) => [cx + sway * t, lerp(yTop, yBot, t)],
    (t) => (wid / 2) * (1 - 0.72 * Math.sin(Math.PI * Math.min(1, t * 0.9)) + 0.45 * t * t),
    12,
  )
  out.push(...stream(e.a, e.b, rand, { wet: 0, marks: 3 }))
  const mBase = Y(lipV + dropV + 0.12)
  out.push(
    ...plumeNodes(
      cx - wid * 1.5 + sway,
      cx + wid * 1.5 + sway,
      mBase,
      num(p, 'mist', 0.16) * h,
      rand,
      { lobes: 4 },
    ),
  )
  // Forest apron at the foot of the talus.
  out.push(...canopyNodes(X(0.3), X(0.98), y + h, num(p, 'apron', 9), rand))
  return out
}

function cleft([x, y, w, h]: Box, p: Params, rand: Rand): SvgNode[] {
  const rockMass = withRock(p)
  const out: SvgNode[] = []
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const gap = num(p, 'width', 7)
  const gx = X(num(p, 'axis', 0.36))
  const gTop = Y(num(p, 'lipY', 0.3))
  const reach = num(p, 'reach', 0.32) * w
  const foot = Y(num(p, 'drop', 0.6) + num(p, 'lipY', 0.3))
  const center = (t: number): Pt => [
    gx + reach * t,
    gTop + (foot - gTop) * (0.22 * t + 0.78 * t * t),
  ]
  const halfW = (t: number) => gap / 2 + 11 * t
  const N = 14
  const { a: lower, b: upper } = streamEdges(center, halfW, N)
  // Rock above and right of the jet.
  const ridgeU = ridgeLine(
    gx + gap / 2 + 1,
    X(1),
    (xx) => lerp(Y(0.2), Y(0.3), ((xx - gx) / (X(1) - gx)) ** 1.2),
    rand,
  )
  const upperPoly: Pt[] = [
    ...ridgeU,
    [X(1), y + h],
    [upper[N][0] + 6, y + h],
    ...[...upper].reverse(),
  ]
  out.push(...rockMass(upperPoly, rand, { ridge: ridgeU, shade: 0.55, cracks: 3, slant: 0.2 }))
  // Rock below and left of the jet.
  const ridgeL = ridgeLine(
    x,
    gx - gap / 2 - 1,
    (xx) => lerp(Y(0.42), Y(0.22), ((xx - x) / (gx - x)) ** 0.8),
    rand,
  )
  const lowerPoly: Pt[] = [...ridgeL, ...lower, [lower[N][0] - 2, y + h], [x, y + h]]
  out.push(...rockMass(lowerPoly, rand, { ridge: ridgeL, shade: 0.72, cracks: 3, slant: 0.2 }))
  if (num(p, 'canopy', 8) > 0) {
    out.push(...canopyOn(ridgeL, num(p, 'canopy', 8), rand))
    out.push(...canopyOn(ridgeU, num(p, 'canopy', 8), rand, gx + 14))
  }
  out.push(...stream(lower, upper, rand, { wet: 4.5, marks: 8 }))
  // Spray where the jet lands.
  const fc = center(1)
  out.push(
    ...plumeNodes(fc[0] - 17, fc[0] + 19, foot + 1, num(p, 'mist', 0.34) * h, rand, { lobes: 5 }),
  )
  out.push(...foam(fc[0], 12, foot, rand))
  return out
}

function cascade([x, y, w, h]: Box, p: Params, rand: Rand): SvgNode[] {
  const rockMass = withRock(p)
  const out: SvgNode[] = []
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const steps = Math.max(2, Math.round(num(p, 'steps', 4)))
  const lip0 = num(p, 'lipY', 0.34)
  const stepV = num(p, 'drop', 0.6) / steps
  const edgeTop = num(p, 'edgeTop', 0.22),
    edgeBot = num(p, 'edgeBot', 0.07)
  const edgeAt = (v: number) => lerp(edgeTop, edgeBot, (v - lip0) / (lip0 + stepV * steps - lip0))
  const canopyH = num(p, 'canopy', 10)
  // Banks: lit left bank, dark right bank, both slanting outward toward the foot.
  const vFoot = lip0 + stepV * steps
  const bankL: Pt[] = [
    ...ridgeLine(x, X(edgeTop), (xx) => lerp(Y(0.3), Y(0.2), (xx - x) / (X(edgeTop) - x)), rand),
    [X(edgeAt(vFoot)), Y(vFoot)],
    [X(edgeBot - 0.02), y + h],
    [x, y + h],
  ]
  const ridgeL = bankL.slice(0, -3)
  out.push(...rockMass(bankL, rand, { ridge: ridgeL, shade: 0.55, cracks: 2 }))
  const bankR: Pt[] = [
    ...ridgeLine(
      X(1 - edgeTop),
      x + w,
      (xx) => lerp(Y(0.22), Y(0.3), (xx - X(1 - edgeTop)) / (x + w - X(1 - edgeTop))),
      rand,
    ),
    [x + w, y + h],
    [X(1 - edgeBot + 0.02), y + h],
    [X(1 - edgeAt(vFoot)), Y(vFoot)],
  ]
  const ridgeR = bankR.slice(0, -3)
  out.push(...rockMass(bankR, rand, { ridge: ridgeR, shade: 0.1, cracks: 2 }))
  if (canopyH > 0) out.push(...canopyOn(ridgeL, canopyH, rand), ...canopyOn(ridgeR, canopyH, rand))
  // Tiers.
  for (let i = 0; i < steps; i++) {
    const v0 = lip0 + stepV * i,
      v1 = lip0 + stepV * (i + 1)
    const a0 = X(edgeAt(v0)),
      b0 = X(1 - edgeAt(v0))
    const a1 = X(edgeAt(v1)),
      b1 = X(1 - edgeAt(v1))
    const top: Pt[] = [],
      bot: Pt[] = []
    for (let k = 0; k <= 10; k++) {
      const u = k / 10
      top.push([lerp(a0, b0, u), Y(v0) + 1.4 * Math.sin(u * 9 + i * 2) + (rand() - 0.5)])
      bot.push([lerp(a1, b1, u), Y(v1) - 1.2 + 1.2 * Math.sin(u * 7 + i)])
    }
    out.push(...sheet(top, bot, rand, { wet: 3, streaks: 0.75 }))
    // Dark rock humps standing on the next lip.
    if (i < steps - 1) {
      const humps = 2 + Math.round(rand())
      for (let k = 0; k < humps; k++) {
        const hx = lerp(a1, b1, (k + 0.5 + (rand() - 0.5) * 0.5) / humps)
        const hw = 5 + rand() * 4,
          hh = 3.2 + rand() * 2.6
        const yy = Y(v1) + 0.5
        const poly: Pt[] = [
          [hx - hw / 2, yy + 2],
          [hx - hw / 3, yy - hh * 0.8],
          [hx, yy - hh],
          [hx + hw / 3, yy - hh * 0.7],
          [hx + hw / 2, yy + 2],
        ]
        out.push(
          occlude(poly, { halo: 0.6 }),
          ...toneFill(poly, 'T4', { gap: 1.8 }),
          stroke('hair', poly.slice(0, 5)),
        )
      }
    }
  }
  const mid = x + w / 2
  const baseY = Y(vFoot)
  out.push(...mist(mid - 18, mid + 18, baseY + 0.5, num(p, 'mist', 0.1) * h, rand))
  out.push(...foam(mid, 18, baseY, rand))
  return out
}

function twoStep([x, y, w, h]: Box, p: Params, rand: Rand): SvgNode[] {
  const rockMass = withRock(p)
  const out: SvgNode[] = []
  const X = (u: number) => x + w * u
  const Y = (v: number) => y + h * v
  const lip1 = num(p, 'lipY', 0.24)
  const step1 = num(p, 'step', 0.2)
  const slope = num(p, 'slope', 0.13)
  const lowV = lip1 + step1 + slope * 0.9
  const footV = num(p, 'drop', 0.62) + lip1
  // Upper step: a stream sliding diagonally down the basalt ledge; lower step: an upright sheet.
  const pathU = (t: number): Pt => [
    lerp(X(0.62), X(0.34), t),
    lerp(Y(lip1), Y(lowV - 0.02), t) + 3 * Math.sin(t * 3),
  ]
  const eU = streamEdges(pathU, (t) => 7 + 3 * t, 10)
  const loTop: Pt[] = [
    [X(0.3), Y(lowV)],
    [X(0.64), Y(lowV)],
  ]
  const loBot: Pt[] = [
    [X(0.26), Y(footV)],
    [X(0.68), Y(footV)],
  ]
  const bankLRidge = ridgeLine(
    x,
    X(0.3),
    (xx) => lerp(Y(0.36), Y(lip1 + 0.08), ((xx - x) / (X(0.3) - x)) ** 0.8),
    rand,
    1,
  )
  out.push(
    ...rockMass(
      [...bankLRidge, ...eU.a.slice(7), [X(0.3), Y(lowV)], [X(0.3), y + h], [x, y + h]],
      rand,
      { ridge: bankLRidge, shade: 0.7, cracks: 3 },
    ),
  )
  const bankRRidge = ridgeLine(
    X(0.5),
    x + w,
    (xx) => lerp(Y(lip1 - 0.1), Y(0.3), ((xx - X(0.5)) / (x + w - X(0.5))) ** 1.4),
    rand,
    1,
  )
  out.push(
    ...rockMass(
      [
        ...bankRRidge,
        [x + w, y + h],
        [X(0.64), y + h],
        [X(0.64), Y(lowV)],
        ...[...eU.b].reverse().slice(0, 7),
      ],
      rand,
      { ridge: bankRRidge, shade: num(p, 'shadeR', 0.8), cracks: 3 },
    ),
  )
  out.push(...stream(eU.a, eU.b, rand, { wet: 3.5, marks: 5 }))
  out.push(...sheet(loTop, loBot, rand, { wet: 3.5 }))
  // The crevice: a T5 slot at right angles to the lower fall.
  const cTop = Y(footV)
  const slot: Pt[] = [[X(0.3), cTop - 0.5]]
  for (let xx = X(0.3); xx <= X(0.96); xx += 4) slot.push([xx, cTop - 0.5 + (rand() - 0.5) * 1.6])
  slot.push([X(0.96), cTop + 7], [X(0.3), cTop + 8])
  out.push(occlude(slot, { halo: 1 }), fill(slot))
  out.push(...mist(X(0.3), X(0.68), cTop + 0.5, num(p, 'mist', 0.3) * h, rand))
  return out
}

export const waterfallB: KitModule = (box, p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 7)))
  const profile = str(
    p,
    'profile',
    ['ribbon', 'curtain', 'horseshoe', 'two-step', 'cleft', 'cascade'] as const,
    'curtain',
  )
  if (profile === 'ribbon') return ribbon(box, p, rand)
  if (profile === 'cleft') return cleft(box, p, rand)
  if (profile === 'cascade') return cascade(box, p, rand)
  if (profile === 'two-step') return twoStep(box, p, rand)
  return curtain(box, p, rand, profile === 'horseshoe')
}
