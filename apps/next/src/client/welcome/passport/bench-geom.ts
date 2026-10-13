// The passport bench's geometry: shared by the generator (scripts/generate-passport-bench.mjs, which draws the static
// figure) and the live layer (bench-live.ts, which redraws the swinging leaf and the pressing plungers). Units are
// world units on the bench; the passport's spine is x = 0 and its right (visa) page lies on +x.
// Node runs this file directly with type stripping, so it uses explicit extensions and erasable TypeScript only.
import {
  cameraOf,
  cylinder,
  depthOf,
  iso,
  lineSvg,
  pathOf,
  roundedPlan,
  solidSvg,
  type Plan,
  type Projection,
  type Vec3,
} from './iso-kit.generated.js'

/** One page is W × D; HS is each half's thickness, TC the board's, OVER the board's overhang past the pages. */
export const PP = {
  W: 92,
  D: 124,
  HS: 3.6,
  TC: 0.9,
  OVER: 1.5,
  /** Visa-page slots, filled column by column so a batch of up to three shares one bridge stop. */
  COLS: [26, 52, 78],
  ROWS: [20, 50, 80],
  STAMP_R: 10.5,
  /** The entry stamp's die on the visa page: centre and size. */
  ENTRY: { x: 46, y: 109, w: 40, h: 20 },
  /** Bridge: beam bottom, head geometry (foot rest height, bushing) and its parking spot over the ink pad. */
  BEAM_Z: 20,
  BEAM_H: 4,
  FOOT_REST: 8,
  BUSH_Z: 15,
  PARK: 140,
  /** Cross-slide travel of the beam along y, so overflow stamps can land off the three rows. */
  SLIDE: 15,
  TURNS: [-9, 6, -4, 8, -6, 3, -11, 7, -3],
  STROKE: 8 - 3.6,
  HEADS: [20, 50, 80, 109],
} as const

/** The front cover's board and the data page's block, in the open pose (left of the spine). */
export const BOARD_L: Plan = {
  x: -PP.W - PP.OVER,
  y: -PP.OVER,
  w: PP.W + PP.OVER,
  d: PP.D + 2 * PP.OVER,
  r: 3.2,
}
export const PAGES_L: Plan = { x: -PP.W, y: 0, w: PP.W, d: PP.D, r: 2.4 }
export const PAGE_SEAMS = [1.7, 2.6]

export const viewOf = (P: Projection): Vec3 => {
  const { sinA, cosA, sinE, cosE } = cameraOf(P)
  return [cosA * cosE, sinA * cosE, sinE]
}

/** Rotates an open-pose point about the hinge (x = 0, z = HS, along y). a = θ − π: −π closed, 0 open. */
export function turn([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a),
    s = Math.sin(a),
    dz = z - PP.HS
  return [x * c - dz * s, y, PP.HS + x * s + dz * c]
}
export function turnVec([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a),
    s = Math.sin(a)
  return [x * c - z * s, y, x * s + z * c]
}

type Pt = [number, number]
function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1])
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = [],
    upper: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop()
    lower.push(p)
  }
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * A rounded slab given in the open pose (plan in x–y, z0..z1), turned by `a` about the hinge. It keeps the kit's solid
 * anatomy (paper fill, four side shades by facing, the big face as top, creases where the big face meets visible sides,
 * the hull as outline), so a board that swings over shades like any slab. `seams` are page lines on the visible sides.
 */
export function leafSlab(
  plan: Plan,
  z0: number,
  z1: number,
  a: number,
  P: Projection,
  { steps = 4, seams = [] as readonly number[] } = {},
) {
  const V = viewOf(P)
  const { sinA, cosA } = cameraOf(P)
  const ring = roundedPlan(plan, steps)
  const n = ring.length
  const cx = plan.x + plan.w / 2,
    cy = plan.y + plan.d / 2
  const lowF = ring.map(([x, y]) => iso(turn([x, y, z0], a), P))
  const highF = ring.map(([x, y]) => iso(turn([x, y, z1], a), P))
  const dot = (v: Vec3) => v[0] * V[0] + v[1] * V[1] + v[2] * V[2]
  const upSeen = dot(turnVec([0, 0, 1], a)) > 0
  const big = upSeen ? highF : lowF
  const parts: string[] = []
  const sideSeen: boolean[] = []
  for (let i = 0; i < n; i++) {
    const [ax, ay] = ring[i],
      [bx, by] = ring[(i + 1) % n]
    let nx = by - ay,
      ny = -(bx - ax)
    const mx = (ax + bx) / 2 - cx,
      my = (ay + by) / 2 - cy
    if (nx * mx + ny * my < 0) {
      nx = -nx
      ny = -ny
    }
    const len = Math.hypot(nx, ny) || 1
    const nr = turnVec([nx / len, ny / len, 0], a)
    const seen = dot(nr) > 1e-6
    sideSeen.push(seen)
    if (!seen || z1 - z0 <= 0) continue
    const lit = (nr[0] * -sinA + nr[1] * cosA + 1) / 2
    const shade = Math.min(3, Math.max(0, Math.floor(lit * 4)))
    parts.push(
      `<path class="iso-shade" data-shade="${shade}" d="${pathOf([lowF[i], lowF[(i + 1) % n], highF[(i + 1) % n], highF[i]], true)}"/>`,
    )
  }
  const runs = (flat: Pt[]) => {
    const out: Pt[][] = []
    const start = sideSeen.findIndex((s, i) => s && !sideSeen[(i + n - 1) % n])
    if (start < 0) return sideSeen.every(Boolean) ? pathOf(flat, true) : ''
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n
      if (sideSeen[i] && !sideSeen[(i + n - 1) % n]) out.push([flat[i]])
      if (sideSeen[i]) out[out.length - 1].push(flat[(i + 1) % n])
    }
    return out.map((run) => pathOf(run)).join('')
  }
  const crease = runs(big)
  const seamPaths = seams
    .map((z) => runs(ring.map(([x, y]) => iso(turn([x, y, z], a), P))))
    .join('')
  const fill = pathOf(hull([...lowF, ...highF]), true)
  return {
    fill,
    base:
      `<path class="iso-fill" d="${fill}"/>${parts.join('')}<path class="iso-top" d="${pathOf(big, true)}"/>` +
      (seamPaths ? `<path class="iso-line" data-tone="faint" d="${seamPaths}"/>` : '') +
      (crease ? `<path class="iso-line iso-crease" data-tone="faint" d="${crease}"/>` : ''),
    outline: fill,
    upSeen,
  }
}

/** The affine matrix that maps a plane's local (u, v) to the screen, for printed art drawn in that plane. */
export function planeMatrix(o: Vec3, u: Vec3, v: Vec3, P: Projection) {
  const O = iso(o, P)
  const U = iso([o[0] + u[0], o[1] + u[1], o[2] + u[2]], P)
  const Vv = iso([o[0] + v[0], o[1] + v[1], o[2] + v[2]], P)
  const r = (n: number) => Math.round(n * 1000) / 1000
  return `matrix(${r(U[0] - O[0])} ${r(U[1] - O[1])} ${r(Vv[0] - O[0])} ${r(Vv[1] - O[1])} ${r(O[0])} ${r(O[1])})`
}

/** The open leaf's data page (u from its outer edge, v from its top) and the front cover (u from the spine), at turn a. */
export function leafPlanes(a: number, P: Projection) {
  const page = planeMatrix(turn([-PP.W, 0, PP.HS], a), turnVec([1, 0, 0], a), [0, 1, 0], P)
  const cover = planeMatrix(turn([0, -PP.OVER, 0], a), turnVec([-1, 0, 0], a), [0, 1, 0], P)
  const V = viewOf(P)
  const up = turnVec([0, 0, 1], a)
  const pageSide = up[0] * V[0] + up[1] * V[1] + up[2] * V[2]
  return { page, cover, pageSide }
}

/** A vertical coil spring around (cx, cy) from z0 down to z1, split into the halves behind and in front of its rod. */
export function vcoil(
  cx: number,
  cy: number,
  r: number,
  z0: number,
  z1: number,
  turns: number,
  P: Projection,
  perTurn = 18,
) {
  const count = Math.max(2, Math.round(turns * perTurn))
  const back: string[] = [],
    front: string[] = []
  let run: Pt[] = [],
    near: boolean | null = null
  for (let i = 0; i <= count; i++) {
    const share = i / count
    const angle = share * turns * Math.PI * 2 + 0.6
    const nx = Math.cos(angle),
      ny = Math.sin(angle)
    const point = iso([cx + r * nx, cy + r * ny, z0 + (z1 - z0) * share], P)
    const facing = depthOf([nx, ny, 0], P) > 0
    if (near === null) near = facing
    if (facing !== near) {
      run.push(point)
      ;(near ? front : back).push(pathOf(run))
      run = [point]
      near = facing
      continue
    }
    run.push(point)
  }
  if (run.length > 1) (near ? front : back).push(pathOf(run))
  return { back: back.join(''), front: front.join('') }
}

/** A head's plunger at foot height f (bridge-local, x = 0): coil behind, rod, coil in front, all rebuilt as it presses. */
export function plungerSvg(y: number, f: number, P: Projection) {
  const top = f + 5
  const rod = cylinder(0, y, 1.1, top, PP.BUSH_Z - top, P, 16)
  const c = vcoil(0, y, 2.3, PP.BUSH_Z, top, 2.5, P)
  return (
    lineSvg(c.back, { tone: 'lo' }) +
    solidSvg(rod, { tone: 'mid', crease: 'none' }) +
    lineSvg(c.front, { tone: 'mid' })
  )
}

const hash = (n: number, k: number) => {
  const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/**
 * Where stamp i lands. The first nine fill the 3 × 3 grid column by column. After that, every three stamps share one
 * bridge stop at a deterministic x (anywhere a head can reach without leaning over the gutter) and cross-slide offset,
 * one per head row, each with its own small turn, so a well-used page fills up rather than piling onto nine spots.
 * Returns the bridge stop (x, slide), the head (row) and the impression's centre and turn.
 */
export function slotOf(i: number) {
  if (i < 9) {
    const c = Math.floor(i / 3),
      r = i % 3
    return {
      stop: c,
      x: PP.COLS[c],
      slide: 0,
      head: r,
      cx: PP.COLS[c],
      cy: PP.ROWS[r],
      rot: PP.TURNS[i],
    }
  }
  const g = Math.floor((i - 9) / 3),
    r = (i - 9) % 3
  // Golden-ratio steps spread the stops along the rails; the slide alternates sides and
  // reaches into the gaps between rows, so overflow lands between the first nine, not on them.
  const x = PP.COLS[0] + (PP.COLS[2] - PP.COLS[0]) * ((0.31 + g * 0.618034) % 1)
  const slide = (g % 2 ? 1 : -1) * (9 + 6 * hash(g + 1, 2))
  return {
    stop: 3 + g,
    x,
    slide,
    head: r,
    cx: x,
    cy: PP.ROWS[r] + slide,
    rot: (hash(i, 3) - 0.5) * 30,
  }
}

const INK_NAMES = ['shu', 'ai', 'matcha', 'asagi', 'sakura']
const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** One country impression in visa-page coordinates: a double ring, two chord bars, the code and the date. */
export function impressionSvg(i: number, code: string, date: string) {
  const { cx, cy, rot } = slotOf(i)
  const R = PP.STAMP_R - 0.4,
    r2 = R - 1.8,
    bar = 3.4,
    half = Math.sqrt(r2 * r2 - bar * bar)
  const f = (n: number) => Math.round(n * 100) / 100
  const chord = (y: number) => `M${f(cx - half)} ${f(y)}L${f(cx + half)} ${f(y)}`
  return (
    `<g class="pp-imp" data-slot="${i}" opacity="0" transform="rotate(${f(rot)} ${f(cx)} ${f(cy)})" style="--ink:var(--swatch-${INK_NAMES[i % 5]})">` +
    `<circle class="pp-imp-paper" cx="${f(cx)}" cy="${f(cy)}" r="${f(R + 0.3)}"/>` +
    `<circle class="pp-ink-line" cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" style="stroke-width:1.1"/>` +
    `<circle class="pp-ink-line" cx="${f(cx)}" cy="${f(cy)}" r="${f(r2)}"/>` +
    `<path class="iso-line pp-ink-line" data-tone="lo" d="${chord(cy - bar)}${chord(cy + bar)}"/>` +
    `<text class="pp-imp-code" x="${f(cx)}" y="${f(cy + 1.95)}" text-anchor="middle">${escape(code)}</text>` +
    `<text class="pp-imp-small" x="${f(cx)}" y="${f(cy - 4.7)}" text-anchor="middle">KUUKI</text>` +
    `<text class="pp-imp-small" x="${f(cx)}" y="${f(cy + 6.3)}" text-anchor="middle">${escape(date)}</text>` +
    `</g>`
  )
}
