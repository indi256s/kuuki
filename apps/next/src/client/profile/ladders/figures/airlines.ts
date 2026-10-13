import { Scene, hull, roundRect, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import { cylX, cylY, cylZ } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

/**
 * Airlines: the patchwork tail fin on a tail stand.
 * Rung 1 paints one livery band across the fin, rung 2 repaints it messily (primer over the old band, a second band with an unfinished edge), rung 3 is a quilt of mismatched patches with a ladder, an open paint tin and a roller left at its foot (nobody in sight).
 * Lit: the newest livery band, the repaint's band, or the newest patch.
 */

/** A point on the fin face, in fin coordinates: x along the fuselage, z up. */
type Fp = readonly [number, number]

/** Fin thickness (y from 0 to FIN_T), the fuselage axis height and the fin root height. */
const FIN_T = 5,
  CY = FIN_T / 2,
  ZR = 48,
  ZT = 150,
  /** Fuselage axis height. */
  CZ = 30
/** The fin outline, counter-clockwise in (x, z): leading edge, root, trailing edge and tip. */
const FIN: Fp[] = [
  [0, ZR],
  [100, ZR],
  [112, ZT],
  [64, ZT],
]
const HINGE: [Fp, Fp] = [
  [72, ZR],
  [92, ZT],
]
const at = ([x, z]: Fp): P3 => [x, FIN_T, z]

const cross = (a: Fp, b: Fp, c: Fp) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

/** Sutherland-Hodgman: `subject` cut by a convex counter-clockwise `clip`. */
function clipPoly(subject: readonly Fp[], clip: readonly Fp[]): Fp[] {
  let out: Fp[] = [...subject]
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i],
      b = clip[(i + 1) % clip.length],
      input = out
    out = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length]
      const sp = cross(a, b, p),
        sq = cross(a, b, q)
      if (sp >= 0) out.push(p)
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq)
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
      }
    }
  }
  return out
}

/** The part of segment a-b inside a convex counter-clockwise polygon, or null. */
function clipSeg(a: Fp, b: Fp, poly: readonly Fp[]): [Fp, Fp] | null {
  let t0 = 0,
    t1 = 1
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i],
      d = poly[(i + 1) % poly.length]
    const n = cross(c, d, a),
      m = cross(c, d, b)
    if (n < 0 && m < 0) return null
    if (n < 0) t0 = Math.max(t0, n / (n - m))
    else if (m < 0) t1 = Math.min(t1, n / (n - m))
  }
  if (t0 >= t1) return null
  const l = (t: number): Fp => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
  return [l(t0), l(t1)]
}

/** A band running across the fin, rising `m` per unit of x, centred on z = zc at x = 50. */
const band = (zc: number, m: number, th: number, x0 = -20, x1 = 120): Fp[] => {
  const z = (x: number, off: number) => zc + m * (x - 50) + off
  return [
    [x0, z(x0, -th / 2)],
    [x1, z(x1, -th / 2)],
    [x1, z(x1, th / 2)],
    [x0, z(x0, th / 2)],
  ]
}

const centroid = (p: readonly Fp[]): Fp => [
  p.reduce((a, q) => a + q[0], 0) / p.length,
  p.reduce((a, q) => a + q[1], 0) / p.length,
]

/** Bounds of a ring of (y, z) points: a boxy ellipse, so the stub reads as a fuselage and not a pipe. */
function ring(cy: number, cz: number, ry: number, rz: number, n = 20, p = 2.8): Pt[] {
  const e = 2 / p
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n,
      c = Math.cos(a),
      sn = Math.sin(a)
    return [cy + ry * Math.sign(c) * Math.abs(c) ** e, cz + rz * Math.sign(sn) * Math.abs(sn) ** e]
  })
}

export const airlines: LadderFigureDef = {
  id: 'airlines',
  rungs: 3,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const face = (pts: readonly Fp[], fill: Paint, stroke: Paint = 'crease', w = 0.8) =>
      s.poly(pts.map(at), fill, stroke, undefined, w)
    const finLine = (pts: readonly Fp[], stroke: Paint = 'crease', w = 0.8, dash?: string) =>
      s.line(pts.map(at), stroke, w, dash)
    /** Parallel lines at `deg` (from the x axis, in the fin plane) across a region, each ending on its edge. */
    const hatch = (region: readonly Fp[], deg: number, gap: number, stroke: Paint, w = 0.6) => {
      const a = (deg * Math.PI) / 180,
        dx = Math.cos(a),
        dz = Math.sin(a),
        nx = -dz,
        nz = dx
      const ds = region.map(([x, z]) => x * nx + z * nz)
      const lo = Math.ceil(Math.min(...ds) / gap),
        hi = Math.floor(Math.max(...ds) / gap)
      const segs: P3[][] = []
      for (let i = lo; i <= hi; i++) {
        const c: Fp = [nx * i * gap, nz * i * gap]
        const seg = clipSeg(
          [c[0] - dx * 300, c[1] - dz * 300],
          [c[0] + dx * 300, c[1] + dz * 300],
          region,
        )
        if (seg) segs.push(seg.map(at))
      }
      if (segs.length) s.segs(segs, stroke, w)
    }

    // Ground contact: one soft shadow under the stand, the fuselage stub and the rung-3 clutter.
    s.poly(
      roundRect(-18, -18, 150, 44, 12).map(([x, y]): P3 => [x, y, 0]),
      'shadow',
      'none',
    )

    // Tail stand: a rail on the floor and two saddles that cradle the stub.
    const saddles = hero ? [-4, 70] : [40]
    if (hero) s.rbox(-12, -5, 0, 98, 15, 3, 2, { top: 'top' })
    for (const sx of saddles) {
      s.rbox(sx - 6, -9, hero ? 3 : 0, 12, 23, hero ? 12 : 15, 2, { top: 'top' })
      if (hero) {
        s.poly(
          roundRect(sx - 3, -6, 6, 17, 1.5).map(([x, y]): P3 => [x, y, 15]),
          'detail',
          'crease',
        )
        for (const y of [-6, 14])
          s.poly(s.circle([sx, y, 3], [1, 0, 0], [0, 1, 0], 0, 0, 0.9, 8), 'detail', 'crease')
      }
    }

    // The rear fuselage stub: lofted from a boxy ring that tapers to the tail cone.
    const big = ring(CY, CZ, 17, 15),
      cone = ring(CY, 36, 6, 7)
    const sections: { x: number; ring: Pt[] }[] = hero
      ? [
          { x: -24, ring: big },
          { x: 24, ring: big },
          { x: 84, ring: big },
          { x: 134, ring: cone },
        ]
      : [
          { x: 0, ring: big },
          { x: 92, ring: big },
          { x: 122, ring: cone },
        ]
    for (let i = 0; i + 1 < sections.length; i++) {
      const A = sections[i],
        B = sections[i + 1],
        n = A.ring.length
      const p = (sec: typeof A, j: number): P3 => [sec.x, sec.ring[j % n][0], sec.ring[j % n][1]]
      const tone: (Paint | null)[] = []
      for (let j = 0; j < n; j++) {
        const a = p(A, j),
          b = p(A, j + 1),
          c = p(B, j)
        const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
          e2 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
        let nrm = [
          e1[1] * e2[2] - e1[2] * e2[1],
          e1[2] * e2[0] - e1[0] * e2[2],
          e1[0] * e2[1] - e1[1] * e2[0],
        ]
        const mid = [
          (a[0] + b[0] + c[0]) / 3,
          (a[1] + b[1]) / 2 - CY,
          (a[2] + b[2] + c[2]) / 3 - CZ,
        ]
        if (nrm[1] * mid[1] + nrm[2] * mid[2] < 0) nrm = nrm.map((v) => -v)
        const len = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1
        tone.push(
          nrm[0] + nrm[1] + nrm[2] <= 1e-6 * len ? null : nrm[2] / len > 0.55 ? 'top' : 'front',
        )
      }
      const start = tone.findIndex((t) => t === null)
      let run: number[] = [],
        cur: Paint | null = null
      const flush = () => {
        if (run.length && cur) {
          const first = run[0],
            last = run[run.length - 1]
          const fwd = Array.from({ length: last - first + 2 }, (_, q) => p(A, first + q))
          const back = Array.from({ length: last - first + 2 }, (_, q) => p(B, last + 1 - q))
          s.poly([...fwd, ...back], cur, hero ? 'crease' : 'none')
        }
        run = []
      }
      for (let q = 1; q <= n; q++) {
        const j = start + q
        const t = tone[j % n]
        if (t !== cur) {
          flush()
          cur = t
        }
        if (t) run.push(j)
      }
      flush()
      s.poly2(
        hull([...A.ring.map((_, j) => s.P(...p(A, j))), ...B.ring.map((_, j) => s.P(...p(B, j)))]),
        'none',
        'line',
      )
    }
    const tip = sections[sections.length - 1]
    s.poly(
      tip.ring.map(([y, z]): P3 => [tip.x, y, z]),
      'side',
      'line',
    )
    // Tail cone: the exhaust port of the APU.
    s.poly(
      s.circle([tip.x + 0.1, CY, 36], [0, 1, 0], [0, 0, -1], 0, 0, 2.8, 14),
      'detail',
      'crease',
    )
    if (hero) {
      // Fuselage details: a belt line along the near shoulder and rows of rivets under it.
      const belt: P3[] = [],
        rv: P3[][] = []
      const shoulder = big[3]
      for (const x of [-24, 84]) belt.push([x, shoulder[0], shoulder[1]])
      s.line(belt, 'crease', 0.8)
      for (let x = -18; x <= 80; x += 8)
        rv.push([
          [x, shoulder[0] + 0.1, shoulder[1] - 3],
          [x + 0.6, shoulder[0] + 0.1, shoulder[1] - 3],
        ])
      s.segs(rv, 'detail', 1)
    }

    // Root fairing: the fin stands on this, a little proud of the fuselage top.
    s.rbox(-2, -3.5, ZR - 5, 108, FIN_T + 7, 5, 2.2, { top: 'top' })

    // The fin: a thin slab on its fairing. Its near face is the canvas for the livery.
    s.prism(FIN, 0, FIN_T, { top: 'top', side: 'side', front: 'front' })

    // Livery bands and patches draw clipped to the fin.
    const clipFin = (poly: readonly Fp[]) => clipPoly(poly, FIN)
    const tape = (x0: number, x1: number, zf: (x: number, o: number) => number, o: number) =>
      face(
        [
          [x0, zf(x0, o - 1.1)],
          [x1, zf(x1, o - 1.1)],
          [x1, zf(x1, o + 1.1)],
          [x0, zf(x0, o + 1.1)],
        ],
        'land',
        'line',
        0.6,
      )

    if (rung === 1) {
      // One livery band with its pinstripe, shapes only.
      face(clipFin(band(88 + 21, 0.24, 5)), 'ink', hero ? 'crease' : 'none')
      const b = clipFin(band(88, 0.24, 26))
      s.group('lit', () => {
        s.lit(b.map(at), 4)
        if (hero) hatch(b, 62, 5, 'on-accent', 0.5)
      })
    } else if (rung === 2) {
      // The first livery, still visible.
      face(clipFin(band(109, 0.24, 5)), 'ink', hero ? 'crease' : 'none')
      face(clipFin(band(88, 0.24, 26)), 'muted', hero ? 'crease' : 'none')
      // Primer slapped over its left half: ragged edge on the right, old paint peeking above.
      const primer: Fp[] = [
        [-10, 44],
        [54, 44],
        [56, 52],
        [50, 58],
        [55, 66],
        [50, 72],
        [52, 78],
        [48, 86],
        [-10, 81],
      ]
      const overpaint = clipFin(primer)
      face(overpaint, hero ? 'top' : 'front', 'line', hero ? 0.9 : 1)
      if (hero) hatch(overpaint, 24, 4.2, 'crease', 0.5)
      // The second livery: a band running the other way, stopped short with an unfinished edge.
      const z = (x: number, off: number) => 106 - 0.18 * (x - 50) + off
      const xe = 82
      const second: Fp[] = [
        [-20, z(-20, -9)],
        [xe, z(xe, -9)],
        [xe + 6, z(xe, -3)],
        [xe - 2, z(xe, 1)],
        [xe + 5, z(xe, 5)],
        [xe - 1, z(xe, 9)],
        [-20, z(-20, 9)],
      ]
      if (hero) tape(30, 76, z, -10.5)
      s.group('lit', () => {
        s.lit(clipFin(second).map(at), 4)
        // Runs of wet paint under the unfinished edge.
        for (const dx of hero ? [-11, -5, 1] : [-6]) {
          const x = xe + dx,
            y0 = z(x, -9)
          face(
            [
              [x - 1.5, y0 + 0.5],
              [x + 1.5, y0 + 0.5],
              [x + 0.9, y0 - 6],
              [x, y0 - 9],
              [x - 0.9, y0 - 6],
            ],
            'accent',
            'accent',
          )
        }
      })
    } else {
      // The quilt: rows of mismatched cells, brick-offset, each row cut at its own slant.
      const zs = [ZR - 4, 66, 82, 98, 116, ZT + 4],
        slant = [0, 0.06, -0.05, 0.07, -0.04, 0]
      const cuts = [
        [-10, 26, 52, 78, 120],
        [-10, 34, 60, 88, 120],
        [-10, 42, 70, 120],
        [-10, 52, 80, 120],
        [-10, 74, 120],
      ]
      const zAt = (r: number, x: number) => zs[r] + slant[r] * (x - 50)
      type Kind = { tint: Paint; mark?: Paint; pat?: 'stripes' | 'stripes-up' | 'dots' | 'chevron' }
      const kinds: Kind[] = [
        { tint: 'front', pat: 'stripes' },
        { tint: 'muted' },
        { tint: 'land', pat: 'dots', mark: 'ink' },
        { tint: 'front', pat: 'chevron', mark: 'muted' },
        { tint: 'top' },
        { tint: 'land', pat: 'stripes-up' },
        { tint: 'ink' },
        { tint: 'land', pat: 'chevron', mark: 'ink' },
        { tint: 'muted', pat: 'dots', mark: 'top' },
      ]
      let n = 0
      for (let r = 0; r < cuts.length; r++)
        for (let c = 0; c + 1 < cuts[r].length; c++, n++) {
          if (r === 3 && c === 1) continue // the newest patch is lit, below
          const x0 = cuts[r][c],
            x1 = cuts[r][c + 1]
          const cell = clipFin([
            [x0, zAt(r, x0)],
            [x1, zAt(r, x1)],
            [x1, zAt(r + 1, x1)],
            [x0, zAt(r + 1, x0)],
          ])
          if (cell.length < 3) continue
          const kind = kinds[(n * 5 + r * 2) % kinds.length]
          const mid = centroid(cell)
          const tint: Paint = hero
            ? kind.tint
            : kind.tint === 'muted' || kind.tint === 'ink'
              ? 'ink'
              : kind.tint === 'land'
                ? 'muted'
                : 'front'
          face(cell, tint, hero ? 'crease' : 'none', 0.9)
          if (kind.pat === 'stripes' || kind.pat === 'stripes-up')
            hatch(
              cell,
              kind.pat === 'stripes' ? 52 : -38,
              hero ? 3.6 : 7,
              hero ? 'crease' : 'ink',
              hero ? 0.6 : 1.4,
            )
          else if (kind.pat === 'chevron') {
            const w = 9,
              h = 7,
              t = 3.4
            const chev: Fp[] = [
              [mid[0] - w, mid[1] - h / 2],
              [mid[0], mid[1] + h / 2],
              [mid[0] + w, mid[1] - h / 2],
              [mid[0] + w, mid[1] - h / 2 - t],
              [mid[0], mid[1] + h / 2 - t],
              [mid[0] - w, mid[1] - h / 2 - t],
            ]
            const cut = clipPoly(chev, cell)
            if (cut.length >= 3) face(cut, kind.mark ?? 'ink', 'none')
          } else if (kind.pat === 'dots' && hero) {
            for (let u = -3; u <= 3; u++)
              for (let v = -3; v <= 3; v++) {
                const cx = mid[0] + u * 5.6 + (Math.abs(v) % 2) * 2.8,
                  cz = mid[1] + v * 5.2
                const dot: Fp[] = Array.from({ length: 8 }, (_, q): Fp => [
                  cx + 1.5 * Math.cos((q * Math.PI) / 4),
                  cz + 1.5 * Math.sin((q * Math.PI) / 4),
                ])
                if (
                  dot.every((pt) =>
                    cell.every((e, i) => cross(e, cell[(i + 1) % cell.length], pt) > 1.2),
                  )
                )
                  face(dot, kind.mark ?? 'ink', 'none')
              }
          }
          // Stitching just inside the seam.
          if (hero) {
            const inner = cell.map((pt): Fp => [
              mid[0] + (pt[0] - mid[0]) * 0.88,
              mid[1] + (pt[1] - mid[1]) * 0.88,
            ])
            s.line([...inner, inner[0]].map(at), 'detail', 0.6, '1.6 1.6')
          }
        }
      // The newest patch, the one the ladder reaches.
      s.group('lit', () => {
        const x0 = 52,
          x1 = 80
        const cell = clipFin([
          [x0, zAt(3, x0)],
          [x1, zAt(3, x1)],
          [x1, zAt(4, x1)],
          [x0, zAt(4, x0)],
        ])
        s.lit(cell.map(at), 4)
        const mid = centroid(cell)
        for (const dz of hero ? [0, -5] : [0]) {
          const chev: Fp[] = [
            [mid[0] - 10, mid[1] - 3 + dz],
            [mid[0], mid[1] + 4 + dz],
            [mid[0] + 10, mid[1] - 3 + dz],
            [mid[0] + 10, mid[1] - 5.6 + dz],
            [mid[0], mid[1] + 1.4 + dz],
            [mid[0] - 10, mid[1] - 5.6 + dz],
          ]
          face(clipPoly(chev, cell), 'on-accent', 'none')
        }
      })
    }

    // Fin hardware over the livery: leading-edge strip, rudder hinge, wicks and the tail light.
    const strip = clipPoly(
      [
        [-6, ZR - 2],
        [6, ZR - 2],
        [70, ZT + 2],
        [58, ZT + 2],
      ],
      FIN,
    )
    face(strip, 'top', hero ? 'crease' : 'line', 0.8)
    finLine(HINGE, 'line', hero ? 0.8 : 1.1)
    if (hero) {
      finLine(
        [
          [HINGE[0][0] + 2.4, ZR],
          [HINGE[1][0] + 2.4, ZT],
        ],
        'crease',
        0.6,
      )
      // Hinge covers and rivets.
      for (const t of [0.1, 0.36, 0.62, 0.88]) {
        const x = HINGE[0][0] + t * (HINGE[1][0] - HINGE[0][0]),
          z = ZR + t * (ZT - ZR)
        face(
          [
            [x - 1.6, z - 2.4],
            [x + 4, z - 2.4],
            [x + 4, z + 2.4],
            [x - 1.6, z + 2.4],
          ],
          'top',
          'crease',
          0.7,
        )
      }
      const rivets: P3[][] = []
      for (let t = 0.05; t < 1; t += 0.075) {
        const z = ZR + t * (ZT - ZR),
          x = 64 * t + 3
        rivets.push([at([x, z]), at([x + 0.5, z])])
      }
      s.segs(rivets, 'detail', 1)
    }
    // Fin outline again over the livery so the silhouette stays crisp.
    s.poly(FIN.map(at), 'none', 'line', undefined, hero ? 1 : 1.3)
    // Static wicks off the trailing edge near the tip, and the tail light on the tip.
    if (hero) {
      const wicks: P3[][] = []
      for (const t of [0.76, 0.88, 1]) {
        const z = ZR + t * (ZT - ZR),
          x = 100 + t * 12
        wicks.push([
          [x, FIN_T / 2, z],
          [x + 7, FIN_T / 2, z + 1.5],
        ])
      }
      s.segs(wicks, 'line', 0.9)
    }
    s.box(105, 0.8, ZT, 7, 3.4, 3, { top: 'top', front: 'detail', side: 'side' })

    if (rung === 3) {
      // The ladder leans on the fin face above the fuselage; nobody is on it.
      const LX = hero ? 46 : 40,
        LW = hero ? 15 : 12,
        foot: Fp = [58, 0],
        top: Fp = [6.5, 92]
      const dir = [top[0] - foot[0], top[1] - foot[1]],
        len = Math.hypot(dir[0], dir[1]),
        perp = [-dir[1] / len, dir[0] / len]
      const lp = (t: number, x: number): P3 => [x, foot[0] + dir[0] * t, foot[1] + dir[1] * t]
      const bar = (a: P3, b: P3, w: number, d: number, fill: Paint) => {
        const pts: P3[] = []
        for (const e of [a, b])
          for (const sx of [-w / 2, w / 2])
            for (const sd of [-d / 2, d / 2])
              pts.push([e[0] + sx, e[1] + perp[0] * sd, e[2] + perp[1] * sd])
        s.poly2(hull(s.pp(pts)), fill, 'line')
      }
      const rz = 4.4
      if (hero) {
        s.poly(
          roundRect(8, 58, 40, 30, 8).map(([x, y]): P3 => [x, y, 0]),
          'shadow',
          'none',
        )
        // Roller: sleeve and wire cage lying on the floor, a streak of paint behind it.
        s.poly(
          [
            [2, 66.5, 0.1],
            [16, 66.5, 0.1],
            [16, 69.5, 0.1],
            [2, 69.5, 0.1],
          ],
          'muted',
          'crease',
          undefined,
          0.6,
        )
        cylX(s, 16, 68, rz, rz, 22, { body: 'front', face: 'side' }, 20)
        const rings: P3[][] = []
        for (const x of [20, 25, 30, 35]) {
          const arc: P3[] = []
          for (let q = 0; q <= 8; q++) {
            const a = -Math.PI / 2 + (Math.PI * q) / 8
            arc.push([x, 68 + rz * Math.cos(a), rz + rz * Math.sin(a)])
          }
          rings.push(arc)
        }
        s.segs(rings, 'crease', 0.6)
        s.line(
          [
            [38, 68, rz],
            [42, 68, rz],
            [42, 76, 2],
            [12, 76, 2],
            [12, 68, rz],
            [16, 68, rz],
          ],
          'line',
          1,
        )
        cylY(s, 27, 76, 2.4, 2.2, 14, { body: 'top', face: 'side' }, 14)
      }

      // Ladder: back rail, rungs, near rail, rubber feet.
      const rw = hero ? 2.4 : 3.2
      bar(lp(0, LX), lp(1, LX), rw, rw, 'top')
      const rungs = hero ? 8 : 4
      for (let i = 1; i <= rungs; i++) {
        const t = (i - 0.5) / (rungs + 0.4)
        bar(lp(t, LX), lp(t, LX + LW), 0, hero ? 2 : 3.2, 'front')
      }
      bar(lp(0, LX + LW), lp(1, LX + LW), rw, rw, 'top')
      for (const x of [LX, LX + LW])
        s.rbox(x - 1.8, foot[0] - 2.8, 0, 3.6, 5.6, 1.6, 0.6, { top: 'side' })

      // Paint tin: lid off, paint wet at the rim, a drip down the front; the lid on the floor beside it.
      const cx = hero ? 104 : 76,
        cy = hero ? 62 : 62,
        r = hero ? 9.4 : 12,
        th = hero ? 13 : 17,
        seg = hero ? 28 : 14
      if (hero)
        s.poly(
          roundRect(86, 46, 52, 44, 10).map(([x, y]): P3 => [x, y, 0]),
          'shadow',
          'none',
        )
      cylZ(s, cx, cy, 0, r, th, { body: 'front', top: 'top' }, seg)
      cylZ(s, cx, cy, th, r + 0.7, 1.2, { body: 'top', top: 'top' }, seg)
      s.poly(
        s.circle([cx, cy, th + 1.2], [1, 0, 0], [0, 1, 0], 0, 0, r - 1.6, seg),
        'ink',
        hero ? 'crease' : 'none',
        undefined,
        0.8,
      )
      if (hero) {
        s.poly(
          s.circle([cx - 1.2, cy - 1.2, 14.25], [1, 0, 0], [0, 1, 0], 0, 0, 3.2, 12),
          'muted',
          'none',
        )
        // Drip down the near side: leaves the lip, ends in a bead.
        const dr = r * 0.7071,
          q = 0.7071
        const dp = (t: number, h: number): P3 => [cx + dr + 0.05 - t * q, cy + dr + 0.05 + t * q, h]
        s.poly(
          [
            [-1.5, 14.2],
            [1.5, 14.2],
            [1.2, 8],
            [0.6, 5.4],
            [-0.6, 5.4],
            [-1.2, 8],
          ].map(([t, h]) => dp(t, h)),
          'ink',
          'crease',
          undefined,
          0.6,
        )
        // Bail: a wire arc hinged on the two ears.
        const bail: P3[] = []
        for (let i = 0; i <= 14; i++) {
          const a = (Math.PI * i) / 14
          bail.push([
            cx + (r + 0.7) * Math.cos(a) * q,
            cy - (r + 0.7) * Math.cos(a) * q,
            12 + 9 * Math.sin(a),
          ])
        }
        s.line(bail, 'line', 0.9)
        // Lid on the floor, paint ring inside it, and a puddle where the tin was set down.
        cylZ(s, 126, 78, 0, r + 0.9, 1.5, { body: 'top', top: 'top' }, seg)
        s.poly(
          s.circle([126, 78, 1.5], [1, 0, 0], [0, 1, 0], 0, 0, r - 1.4, seg),
          'none',
          'crease',
          undefined,
          0.7,
        )
        s.poly(
          s.circle([cx + 4, cy + 12, 0.1], [1, 0, 0], [0, 1, 0], 0, 0, 4.5, 14),
          'muted',
          'crease',
          undefined,
          0.6,
        )
      }
    }

    return s.done()
  },
}
