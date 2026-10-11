import { Scene, type P3, type Pt } from './scene'

// A boarding pass in plan: L long (x), B wide (y), T thick; the stub is the last STUB units, past a perforation.
const L = 112,
  B = 44,
  T = 2.4,
  STUB = 30
/** Passes in the stack; the repeat share of them carry a red stub. */
export const PASSES = 8
/** How far the top pass slides out on hover, in iso units along its length. */
const SLIDE = 14
// Passes under the top one fan out past its stub end, FAN further each, so every stub shows as a step; each also lies a little askew (a turn in degrees and a sideways shift), fixed so the stack never reshuffles.
const FAN = 3.4
const SKEW: readonly [number, number][] = [
  [-1.5, 1],
  [1.2, -1],
  [-0.8, 1.5],
  [1.5, 0],
  [-1.2, -1.5],
  [0.8, 1],
  [-0.5, -1],
]

/**
 * Routes: a stack of PASSES boarding passes. `repeatShare` of them (rounded, from the top down) are repeats: their stub is red, which shows on each pass's edge; the rest are plain new routes. At section size the top pass reads `route` (for example "ROV ↔ VKO").
 * Parts: `top-pass` (carries --slide-x/--slide-y; slides out along its length on hover).
 */
export function passStack(repeatShare: number, route: string, k = 1) {
  const s = new Scene(k)
  const n = PASSES,
    repeats = Math.max(0, Math.min(n, Math.round(repeatShare * n)))
  const isRepeat = (i: number) => i >= n - repeats
  // Contact shadow, a little larger than the stack.
  s.poly(
    [
      [-4, -4, 0],
      [L + 4, -4, 0],
      [L + 4, B + 5, 0],
      [-4, B + 5, 0],
    ],
    'shadow',
    'none',
  )
  const centre: Pt = [L / 2, B / 2]
  /** A pass turned by `deg` about its centre and shifted by (dx, dy), its top at z; returns its plan → 3D mapper. */
  const card = (deg: number, dx: number, dy: number, z: number, repeat: boolean) => {
    const a = (deg * Math.PI) / 180,
      c = Math.cos(a),
      q = Math.sin(a)
    const at = (u: number, v: number, h = z): P3 => {
      const x = u - centre[0],
        y = v - centre[1]
      return [centre[0] + dx + x * c - y * q, centre[1] + dy + x * q + y * c, h]
    }
    const corners: Pt[] = [
      [0, 0],
      [L, 0],
      [L, B],
      [0, B],
    ]
    // Edges facing the viewer (outward normal with nx + ny > 0): the x-facing ones in shade.
    corners.forEach(([u0, v0], i) => {
      const [u1, v1] = corners[(i + 1) % 4]
      const p0 = at(u0, v0),
        p1 = at(u1, v1)
      const nx = p1[1] - p0[1],
        ny = p0[0] - p1[0]
      if (nx + ny <= 0) return
      s.poly([p0, p1, at(u1, v1, z - T), at(u0, v0, z - T)], nx > ny ? 'side' : 'front')
      // A repeat's stub is red right through, so its edge shows red where the stub runs.
      if (!repeat) return
      const from = Math.max(Math.min(u0, u1), L - STUB),
        to = Math.max(u0, u1)
      if (to <= from) return
      const e = (u: number, h: number) =>
        at(u, v0 === v1 ? v0 : v0 + ((u - u0) / (u1 - u0 || 1)) * (v1 - v0), h)
      s.poly([e(from, z), e(to, z), e(to, z - T), e(from, z - T)], 'accent-side', 'line')
    })
    s.poly(
      corners.map(([u, v]) => at(u, v)),
      'top',
    )
    return at
  }
  for (let i = 0; i < n - 1; i++) {
    const depth = n - 1 - i,
      [deg, dy] = SKEW[(depth - 1) % SKEW.length]
    const dx = depth * FAN
    const repeat = isRepeat(i)
    const at = card(deg, dx, dy, (i + 1) * T, repeat)
    if (repeat) s.poly([at(L - STUB, 0), at(L, 0), at(L, B), at(L - STUB, B)], 'accent', 'line')
    else s.segs([[at(L - STUB, 1), at(L - STUB, B - 1)]], 'detail', 0.7)
  }

  const [sx, sy] = s.vector(SLIDE, 0, 0)
  s.group(
    'top-pass',
    () => {
      const z = n * T
      const repeat = isRepeat(n - 1)
      const at = card(0, 0, 0, z, repeat)
      const U: P3 = [1, 0, 0],
        V: P3 = [0, 1, 0]
      // The stub past a perforated tear line: lit when the top route is a repeat.
      const stub = [at(L - STUB, 0), at(L, 0), at(L, B), at(L - STUB, B)]
      if (repeat) s.lit(stub, 3.5)
      const holes: P3[][] = []
      for (let v = 3; v < B - 1; v += 4) holes.push(s.circle(at(L - STUB, v), U, V, 0, 0, 0.6, 6))
      for (const hole of holes) s.poly(hole, 'line', 'none')
      // A barcode on the stub, bars of two widths.
      const bars: P3[][] = [],
        thick: P3[][] = []
      for (let i = 0; i < 9; i++) {
        const v = 8 + i * 3.3
        ;(i % 3 === 1 ? thick : bars).push([at(L - 9, v), at(L - 4, v)])
      }
      s.segs(bars, repeat ? 'on-accent' : 'line', 0.8)
      s.segs(thick, repeat ? 'on-accent' : 'line', 1.6)
      // The body: a plane glyph, the route or printed rules, and a seat box.
      const glyph: Pt[] = [
        [4, 0],
        [1, 0.8],
        [0.2, 4.2],
        [-0.9, 4.2],
        [-0.4, 0.9],
        [-3, 0.9],
        [-3.8, 2.2],
        [-4.4, 2.2],
        [-4, 0],
        [-4.4, -2.2],
        [-3.8, -2.2],
        [-3, -0.9],
        [-0.4, -0.9],
        [-0.9, -4.2],
        [0.2, -4.2],
        [1, -0.8],
      ]
      s.poly(
        glyph.map(([u, v]) => at(12 + u * 1.3, 10 + v * 1.3)),
        'ink',
        'ink',
      )
      if (k >= 0.9 && route)
        s.text(route, at(22, 13.5), U, V, { size: 8, weight: 700, mono: true, fill: 'ink' })
      else s.segs([[at(22, 10), at(58, 10)]], 'line', 1.6)
      s.segs(
        [
          [at(8, 24), at(40, 24)],
          [at(8, 30), at(32, 30)],
          [at(48, 24), at(70, 24)],
        ],
        'detail',
        1.2,
      )
      s.poly([at(8, 34), at(28, 34), at(28, 40), at(8, 40)], 'none', 'detail', undefined, 0.8)
      s.poly([at(48, 34), at(76, 34), at(76, 40), at(48, 40)], 'none', 'detail', undefined, 0.8)
      s.include([at(L + SLIDE, 0), at(L + SLIDE, B)])
    },
    { vars: { '--slide-x': `${sx}px`, '--slide-y': `${sy}px` } },
  )
  return s.done()
}
