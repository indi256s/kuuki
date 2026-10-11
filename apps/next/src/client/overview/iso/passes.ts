import { Scene, type P3, type Pt } from './scene'

// A boarding pass in plan: L long (x), B wide (y), T thick; the stub is the last STUB units, past a perforation.
const L = 112,
  B = 44,
  T = 1.6,
  STUB = 30
/** At most this many passes show; more repeats only top the stack up to it. */
export const MAX_PASSES = 8
/** How far the top pass slides out on hover, in iso units along its length. */
const SLIDE = 14
// Each pass under the top one lies a little askew: a turn in degrees and a shift in plan, fixed so the stack never reshuffles.
const SKEW: readonly [number, number, number][] = [
  [-3, -2, 1],
  [2.5, 1.5, -1],
  [-1.5, -1, 2],
  [3, 2, 0],
  [-2.5, 0, -2],
  [1.5, -2, 1],
  [-1, 1, -1],
]

/**
 * Routes: a stack of boarding passes, one per flight on the top route (up to MAX_PASSES). The top pass has a lit stub; at section size it reads `route` (for example "ROV ⇄ VKO").
 * Parts: `top-pass` (carries --slide-x/--slide-y; slides out along its length on hover).
 */
export function passStack(count: number, route: string, k = 1) {
  const s = new Scene(k)
  const n = Math.max(1, Math.min(MAX_PASSES, count))
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
  const card = (deg: number, dx: number, dy: number, z: number) => {
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
    })
    s.poly(
      corners.map(([u, v]) => at(u, v)),
      'top',
    )
    return at
  }
  for (let i = 0; i < n - 1; i++) {
    const [deg, dx, dy] = SKEW[(n - 2 - i) % SKEW.length]
    const at = card(deg, dx, dy, (i + 1) * T)
    // The stub's lower edge peeks out on the passes underneath.
    s.segs([[at(L - STUB, 1), at(L - STUB, B - 1)]], 'detail', 0.7)
  }

  const [sx, sy] = s.vector(SLIDE, 0, 0)
  s.group(
    'top-pass',
    () => {
      const z = n * T
      const at = card(0, 0, 0, z)
      const U: P3 = [1, 0, 0],
        V: P3 = [0, 1, 0]
      // The stub, lit, past a perforated tear line.
      s.lit([at(L - STUB, 0), at(L, 0), at(L, B), at(L - STUB, B)], 3.5)
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
      s.segs(bars, 'on-accent', 0.8)
      s.segs(thick, 'on-accent', 1.6)
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
