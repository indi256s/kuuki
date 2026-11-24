export type Vec3 = readonly [number, number, number]
export type Projection = {
  origin: readonly [number, number]
  scale: number
  azimuth: number
  elevation: number
}

export const SOCK = {
  Z: 150,
  R0: 16,
  R1: 7,
  LENGTH: 110,
  BANDS: 5,
  ARM: 8,
  STEPS: 28,
} as const

export const KNOTS_PER_BAND = 3
export const FULL_KNOTS = SOCK.BANDS * KNOTS_PER_BAND

const UNIT = Math.sqrt(1.6)
const RAD = Math.PI / 180

export function projector(P: Projection) {
  const a = P.azimuth * RAD
  const e = P.elevation * RAD
  const sinA = Math.sin(a)
  const cosA = Math.cos(a)
  const sinE = Math.sin(e)
  const cosE = Math.cos(e)
  const k = P.scale * UNIT
  return {
    at: ([x, y, z]: Vec3): [number, number] => [
      P.origin[0] + (x * sinA - y * cosA) * k,
      P.origin[1] + ((x * cosA + y * sinA) * sinE - z * cosE) * k,
    ],
    depth: ([x, y, z]: Vec3) => (x * cosA + y * sinA) * cosE + z * sinE,
    view: [cosA * cosE, sinA * cosE, sinE] as Vec3,
  }
}

export type Wind = { knots: number; heading: number; time: number }

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

export const fillOf = (knots: number, band: number) =>
  smooth((knots - band * KNOTS_PER_BAND) / KNOTS_PER_BAND)

type Ring = { c: Vec3; n: Vec3; r: number }

const add = (a: Vec3, b: Vec3, s = 1): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export function ringsOf({ knots, heading, time }: Wind): Ring[] {
  const step = SOCK.LENGTH / SOCK.BANDS
  const rings: Ring[] = []
  const h0 = heading * RAD
  const throat: Vec3 = [Math.cos(h0) * SOCK.ARM, Math.sin(h0) * SOCK.ARM, SOCK.Z]
  rings.push({ c: throat, n: [Math.cos(h0), Math.sin(h0), 0], r: SOCK.R0 })
  let c = throat
  const dirs: Vec3[] = []
  for (let band = 0; band < SOCK.BANDS; band++) {
    const fill = fillOf(knots, band)
    const yaw = (heading + 4 * band * Math.sin(time * 1.3 - band * 0.6) * fill) * RAD
    const pitch = (82 * (1 - fill) + 3 + 1.2 * fill * Math.sin(time * 7 + band * 1.7)) * RAD
    const dir: Vec3 = [
      Math.cos(yaw) * Math.cos(pitch),
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
    ]
    dirs.push(dir)
    c = add(c, dir, step)
    const taper = SOCK.R0 + ((SOCK.R1 - SOCK.R0) * (band + 1)) / SOCK.BANDS
    rings.push({ c, n: dir, r: taper * (0.34 + 0.66 * fill) })
  }
  for (let i = 1; i < SOCK.BANDS; i++)
    rings[i] = { ...rings[i]!, n: norm(add(dirs[i - 1]!, dirs[i]!)) }
  return rings
}

function circle(ring: Ring) {
  const helper: Vec3 = Math.abs(ring.n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]
  const u = norm(cross(ring.n, helper))
  const v = norm(cross(ring.n, u))
  const out: { p: Vec3; radial: Vec3 }[] = []
  for (let s = 0; s < SOCK.STEPS; s++) {
    const t = (s / SOCK.STEPS) * Math.PI * 2
    const radial = add(add([0, 0, 0], u, Math.cos(t)), v, Math.sin(t))
    out.push({ p: add(ring.c, radial, ring.r), radial })
  }
  return out
}

const fx = (n: number) => (Math.round(n * 10) / 10).toString()
const pathOf = (points: readonly (readonly [number, number])[], closed: boolean) =>
  points.length
    ? `M${points.map(([x, y]) => `${fx(x)} ${fx(y)}`).join('L')}${closed ? 'Z' : ''}`
    : ''

function hull(points: [number, number][]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const turn = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: [number, number][] = []
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && turn(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function frontArc(
  points: { p: Vec3; radial: Vec3 }[],
  view: Vec3,
  at: (p: Vec3) => [number, number],
) {
  const seen = points.map(({ radial }) => dot(radial, view) > 0)
  const start = seen.findIndex((on, i) => on && !seen[(i - 1 + seen.length) % seen.length])
  if (start < 0) return ''
  const run: [number, number][] = []
  for (let i = 0; i < points.length; i++) {
    const j = (start + i) % points.length
    if (!seen[j]) break
    run.push(at(points[j]!.p))
  }
  return pathOf(run, false)
}

export type BandDraw = {
  band: number
  depth: number
  d: string
  light: readonly [number, number, number, number]
  seam: string
}

export type Pose = {
  bands: BandDraw[]
  hoop: string
  arms: readonly [string, string]
}

export function poseOf(wind: Wind, P: Projection): Pose {
  const { at, depth, view } = projector(P)
  const rings = ringsOf(wind)
  const circles = rings.map(circle)
  const bands: BandDraw[] = []
  for (let band = 0; band < SOCK.BANDS; band++) {
    const pts = [...circles[band]!, ...circles[band + 1]!].map(({ p }) => at(p))
    const outline = hull(pts)
    let top = outline[0]!
    let bottom = outline[0]!
    for (const p of outline) {
      if (p[1] < top[1]) top = p
      if (p[1] > bottom[1]) bottom = p
    }
    const mid = add(rings[band]!.c, rings[band + 1]!.c)
    bands.push({
      band,
      depth: depth([mid[0] / 2, mid[1] / 2, mid[2] / 2]),
      d: pathOf(outline, true),
      light: [top[0], top[1], bottom[0], bottom[1]],
      seam: band < SOCK.BANDS - 1 ? frontArc(circles[band + 1]!, view, at) : '',
    })
  }
  bands.sort((a, b) => a.depth - b.depth)
  const hoop = rings[0]!
  const top: Vec3 = [hoop.c[0], hoop.c[1], hoop.c[2] + hoop.r]
  const low: Vec3 = [hoop.c[0], hoop.c[1], hoop.c[2] - hoop.r]
  const h = Math.atan2(hoop.n[1], hoop.n[0])
  const collar = (z: number): Vec3 => [Math.cos(h) * 4.6, Math.sin(h) * 4.6, z]
  return {
    bands,
    hoop: frontArc(circles[0]!, view, at),
    arms: [
      pathOf([at(collar(top[2])), at(top)], false),
      pathOf([at(collar(low[2])), at(low)], false),
    ],
  }
}

export function windAt(seconds: number, still: boolean): Wind {
  if (still) return { knots: FULL_KNOTS + 1.5, heading: 0, time: 0 }
  const build = 1 - Math.exp(-seconds / 0.9)
  const gust = 1.6 * Math.sin(seconds * 0.9) + 0.9 * Math.sin(seconds * 2.3 + 1)
  return {
    knots: 1.5 + (FULL_KNOTS + 1.8 - 1.5 + gust) * build,
    heading: (7 * Math.sin(seconds * 0.7) + 3 * Math.sin(seconds * 1.9 + 0.4)) * build,
    time: seconds,
  }
}
