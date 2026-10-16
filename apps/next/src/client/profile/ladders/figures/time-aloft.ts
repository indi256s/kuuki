import {
  hull,
  roundRect,
  Scene,
  visibleRun,
  type P3,
  type Paint,
  type Pt,
} from '../../../overview/iso/scene'
import { X, Y, cylX, rrOn, shadowRect } from '../../../overview/iso/solids'
import {
  circleOn,
  frameAlong,
  lathe,
  spline,
  tube,
  unit,
  VIEW,
  type Body,
  hash,
  clipTo,
} from './parts'
import type { LadderFigureDef } from './types'

const Z: P3 = [0, 0, 1]
/** The ground direction that runs straight across the screen, for flames that face the viewer. */
const SX: P3 = unit([1, -1, 0])

// Seatback tray table: 140 × 88 slab, top at z 6. The cup ring is a recess at the right.
const TW = 140,
  TD = 88,
  TH = 6
const RING: Pt = [122, 42]
// Moulded meal tray on the table: outer footprint, the rolled lip's top, the deck inside the lip, and the floor of the compartment wells.
const TX = 6,
  TY = 8,
  TWD = 98,
  TDP = 72,
  LZ = 10.8,
  DZ = 9.6,
  FZ = 7.4,
  LIP = 2.6
type Rect = readonly [number, number, number, number]
/** Compartment wells: the main dish, the back-left (napkin, then salad), the left (dessert) and the long front well (cutlery, roll, butter, sachets). */
const WA: Rect = [44, 13.5, 98, 58],
  WB: Rect = [12, 13.5, 40, 35],
  WC: Rect = [12, 39, 40, 58],
  WD: Rect = [12, 62, 98, 74]
/** Centre of the main well. */
const MC: Pt = [71, 36]

type Ink = { line: Paint; crease: Paint }
const PLAIN: Ink = { line: 'line', crease: 'crease' }
const LIT: Ink = { line: 'accent', crease: 'accent-side' }

/** Points every `step` along a polyline in plan, ends included. */
function stepAlong(run: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [run[0]]
  let carry = 0
  for (let i = 0; i < run.length - 1; i++) {
    const [ax, ay] = run[i],
      [bx, by] = run[i + 1]
    const l = Math.hypot(bx - ax, by - ay)
    let d = step - carry
    while (d <= l) {
      out.push([ax + ((bx - ax) * d) / l, ay + ((by - ay) * d) / l])
      d += step
    }
    carry = l - (d - step)
  }
  return out
}

/** Fixed pseudo-random in [0, 1). */

/**
 * Time aloft: the in-flight meal tray on a seatback tray table. The table, the moulded tray with its rolled lip and compartment wells, the folded napkin or cutlery roll and the cup in the table's ring stay; the main well levels up.
 * Rungs: a crinkled pretzel bag, a wedge sandwich pack, a foil-lidded hot meal with its cutlery roll, the full tray (salad, roll, butter) with a dessert pot, and a two-tier birthday cake with candles in place of the hot meal.
 * Lit: the new item only, as an accent outline with a light wash (the cake's flames are solid accent).
 */
export const timeAloft: LadderFigureDef = {
  id: 'time-aloft',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const n = hero ? 40 : 18
    // At 56px the object needs bulk, so the thumb stands its items taller.
    const H = hero ? 1 : 1.35

    /** A light accent wash over the screen hull of a lit part. */
    const wash = (pts: readonly P3[], op = 0.22) => {
      const back = new Map<string, P3>()
      const scr = pts.map((p) => {
        const q = s.project(p)
        back.set(`${q[0]},${q[1]}`, p)
        return q
      })
      s.poly(
        hull(scr).map((q) => back.get(`${q[0]},${q[1]}`)!),
        'accent',
        'none',
        undefined,
        undefined,
        op,
      )
    }
    const ringsOf = (b: Body, t0: number, t1: number, steps = 6, m = 24): P3[] => {
      const out: P3[] = []
      for (let i = 0; i <= steps; i++)
        for (let j = 0; j < m; j++) out.push(b.at(t0 + ((t1 - t0) * i) / steps, (j / m) * 360))
      return out
    }
    const rect = (x0: number, y0: number, x1: number, y1: number, z: number): P3[] => [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ]
    /** A flat round blob facing the viewer (a piped bead, a cherry tomato). */
    const bead = (c: P3, r: number, fill: Paint = 'top', stroke: Paint = 'crease') =>
      s.poly(circleOn(c, VIEW, r, 10), fill, stroke, undefined, 0.5)

    /**
     * A recess sunk `depth` into a surface at `z` with a convex plan: its far walls (the y-facing run in `front`, the rest `side`), the floor it shows, and its edge.
     * Returns the opening, for clipping what stands in it.
     */
    const well = (plan: readonly Pt[], z: number, depth: number, floor: Paint = 'top'): P3[] => {
      const top = plan.map(([a, b]): P3 => [a, b, z]),
        open = s.pp(top),
        low = s.pp(plan.map(([a, b]): P3 => [a, b, z - depth]))
      s.poly2(open, 'side', 'none')
      const m = plan.length
      const front = plan.map(([x0, y0], i) => {
        const [x1, y1] = plan[(i + 1) % m]
        // Inward normal (-dy, dx); the wall shows when it faces the viewer.
        const nx = y0 - y1,
          ny = x1 - x0
        return nx + ny > 1e-6 && ny > nx
      })
      for (let i = 0; i < m; i++) {
        if (!front[i] || front[(i + m - 1) % m]) continue
        const run = [i]
        while (front[run[run.length - 1] % m] && run.length <= m) run.push(run[run.length - 1] + 1)
        const idx = run.map((j) => j % m)
        const strip = clipTo(
          [...idx.map((j) => open[j]), ...[...idx].reverse().map((j) => low[j])],
          open,
        )
        if (strip.length > 2) s.poly2(strip, 'front', 'none')
      }
      const fl = clipTo(low, open)
      // The floor's edge only on the hero: at 56px the opening's outline says enough.
      if (fl.length > 2) s.poly2(fl, floor, hero ? 'crease' : 'none', 0.5)
      s.poly2(open, 'none', 'crease', 0.8)
      return top
    }
    /** Draws what stands in a well, clipped by the well's near edge. */
    const inWell = (open: readonly P3[], draw: () => void) =>
      s.group('in-well', draw, {
        clip: [...open, ...open.map(([a, b, c]): P3 => [a, b, c + 400])],
      })

    // ---- the table -------------------------------------------------------------------------
    shadowRect(s, 0, -8, TW, TD + 8, 7)

    // Hinge arm stubs and their barrel, behind the slab.
    if (hero) {
      for (const x of [24, 106]) {
        s.box(x, -12, 1.4, 10, 14, 4.4)
        s.box(x + 1.4, -12, 5.8, 7.2, 3, 1)
        for (const dx of [2.5, 7.5]) {
          s.poly(s.circle([x + dx, -4, 5.8], X, Y, 0, 0, 0.9, 10), 'none', 'crease', undefined, 0.5)
          s.poly(s.circle([x + dx, -4, 5.8], X, Y, 0, 0, 0.45, 8), 'line', 'none')
        }
      }
      cylX(s, 22, -12, 4.6, 2.8, 14, { body: 'front', face: 'side' }, 20)
      cylX(s, 104, -12, 4.6, 2.8, 14, { body: 'front', face: 'side' }, 20)
    }

    s.rbox(0, 0, 0, TW, TD, TH, 5, { top: 'top', wall: 'front', side: 'side' })
    if (hero) {
      // Rolled edge seam round the visible sides, ending on the silhouette corners.
      s.line(
        visibleRun(roundRect(0, 0, TW, TD, 5)).map(([a, b]): P3 => [a, b, TH - 2.4]),
        'crease',
        0.6,
      )
      s.poly(
        rrOn(s, [0, 0, TH], X, Y, 2.4, 2.4, TW - 4.8, TD - 4.8, 3),
        'none',
        'crease',
        undefined,
        0.6,
      )
    }

    // Latch tab on the front edge, with its slot on the slab.
    s.box(62, TD, 1.4, 16, 3.4, 3.8)
    if (hero) {
      s.poly(rrOn(s, [0, 0, TH], X, Y, 64, 81.4, 12, 3, 1.4), 'shade', 'crease', undefined, 0.6)
      s.line(
        [
          [62, TD + 3.4, 3.3],
          [78, TD + 3.4, 3.3],
        ],
        'crease',
        0.6,
      )
    }

    // Cup ring: a round recess in the slab.
    const ringOpen = well(
      s.circle([RING[0], RING[1], 0], X, Y, 0, 0, 8.8, n).map(([a, b]): Pt => [a, b]),
      TH,
      2.4,
    )
    if (hero)
      s.poly(
        s.circle([RING[0], RING[1], TH], X, Y, 0, 0, 10.4, n),
        'none',
        'crease',
        undefined,
        0.5,
      )

    // ---- the tray --------------------------------------------------------------------------
    // A shallow foot, the moulded body up to the lip, the lip's roll seam, the deck inside the lip.
    s.rbox(TX + 2, TY + 2, TH, TWD - 4, TDP - 4, 0.8, 5, {
      top: 'side',
      wall: 'side',
      side: 'side',
    })
    s.rbox(TX, TY, TH + 0.8, TWD, TDP, LZ - TH - 0.8, 7, {
      top: 'top',
      wall: 'front',
      side: 'side',
    })
    if (hero)
      s.line(
        visibleRun(roundRect(TX, TY, TWD, TDP, 7)).map(([a, b]): P3 => [a, b, LZ - 1.6]),
        'crease',
        0.6,
      )
    well(roundRect(TX + LIP, TY + LIP, TWD - 2 * LIP, TDP - 2 * LIP, 4.4), LZ, LZ - DZ)
    const wellOf = ([x0, y0, x1, y1]: Rect) =>
      well(roundRect(x0, y0, x1 - x0, y1 - y0, 3.6), DZ, DZ - FZ)
    const openB = wellOf(WB),
      openC = wellOf(WC),
      openA = wellOf(WA),
      openD = wellOf(WD)

    // ---- what is on the tray ---------------------------------------------------------------

    /** Folded napkin: two layers, the top fold turned back at the near corner, fold lines edge to edge. */
    const napkin = () => {
      const x = 15,
        y = 16.5,
        w = 22,
        d = 16
      s.box(x, y, FZ, w, d, 0.9)
      s.box(x + 0.6, y + 0.6, FZ + 0.9, w - 1.2, d - 1.2, 0.7)
      const z = FZ + 1.6
      // Turned-back corner: the fold line and the flap lying on the top layer.
      s.poly(
        [
          [x + w - 0.6, y + d - 9, z],
          [x + w - 9.6, y + d - 0.6, z],
          [x + w - 9.6, y + d - 9, z + 0.25],
        ],
        'front',
        'crease',
        undefined,
        0.6,
      )
      if (hero) {
        s.line(
          [
            [x + 0.6, y + d / 2, z],
            [x + w - 0.6, y + d / 2, z],
          ],
          'crease',
          0.5,
        )
        s.line(
          [
            [x + w / 2, y + 0.6, z],
            [x + w / 2, y + d / 2, z],
          ],
          'crease',
          0.5,
        )
      }
    }

    /** Salt and pepper sachets at the right end of the front well, one dropped across the other, crimped at both ends. */
    const sachets = () => {
      for (const [x, y, z] of [
        [83.5, 63.2, FZ],
        [84.6, 64.4, FZ + 0.7],
      ] as const) {
        s.box(x, y, z, 8.5, 4.2, 0.7)
        if (hero)
          s.segs(
            [0.6, 1.2, 7.3, 7.9].map((dx): P3[] => [
              [x + dx, y, z + 0.7],
              [x + dx, y + 4.2, z + 0.7],
            ]),
            'crease',
            0.4,
          )
      }
    }

    /** The pretzel bag: a pillow pouch with crimped end seals, crinkles gathered at the seals, and a printed pretzel. */
    const pretzels = (ink: Ink) => {
      const L = 30,
        y0 = MC[1] - L / 2,
        cx = MC[0],
        W = 13.6,
        fin = 3.6,
        zf = FZ
      const rows = spline([
        [0, W, 0],
        [3, W - 0.6, 3.4 * H],
        [L / 2, W - 1.2, 5.2 * H],
        [L - 3, W - 0.6, 3.4 * H],
        [L, W, 0],
      ])
      const F = frameAlong([cx, y0, zf + 0.4], Y)
      const finAt = (ya: number) => {
        s.box(cx - W, ya, zf, 2 * W, fin, 0.8, { stroke: ink.line })
        if (hero) {
          const ticks: P3[][] = []
          for (let x = cx - W + 1; x <= cx + W - 0.9; x += 1.4)
            ticks.push([
              [x, ya, zf + 0.8],
              [x, ya + fin, zf + 0.8],
            ])
          s.segs(ticks, ink.crease, 0.4)
        }
        // Each piece takes its own wash, so the hollows between the fins and the pillow stay clear.
        if (ink === LIT)
          wash(
            rect(cx - W, ya, cx + W, ya + fin, zf).flatMap((p): P3[] => [
              p,
              [p[0], p[1], zf + 0.8],
            ]),
          )
      }
      finAt(y0 - fin)
      const body = lathe(
        s,
        F,
        (t) => {
          const [r, rz] = rows(t)
          return { r, rz: Math.max(0.05, rz), lift: Math.max(0.05, rz) }
        },
        0,
        L,
        {
          steps: hero ? 20 : 8,
          ring: hero ? 36 : 18,
          shade: hero,
          caps: false,
          line: ink.line,
          crease: ink.crease,
        },
      )
      if (ink === LIT) wash(ringsOf(body, 0, L, 8))
      finAt(y0 + L)
      if (hero) {
        // Crinkles where the film gathers into each seal.
        for (const [a, b, sg] of [
          [0.4, 6, 1],
          [L - 0.4, L - 6, -1],
        ] as const)
          for (const [d0, dd] of [
            [104, 8],
            [126, -6],
            [150, 10],
            [176, -8],
            [198, 6],
          ] as const) {
            const pts: P3[] = []
            for (let i = 0; i <= 6; i++) {
              const f = i / 6
              pts.push(body.at(a + (b - a) * f * (0.7 + 0.3 * hash(d0 + sg)), d0 + dd * f, 0.02))
            }
            s.line(pts, ink.crease, 0.45)
          }
        // Printed panel and the pretzel on it.
        body.patch(
          [
            [L * 0.3, 100],
            [L * 0.7, 100],
            [L * 0.7, 168],
            [L * 0.3, 168],
          ],
          'top',
          'crease',
          0.5,
        )
        const knot: P3[] = []
        for (let i = 0; i <= 40; i++) {
          const t = (i / 40) * 2 * Math.PI
          const hx = Math.sin(t) ** 3,
            hy =
              (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17
          knot.push(body.at(L / 2 + hx * 3.4, 134 + hy * 20, 0.03))
        }
        s.line(knot, 'detail', 0.9)
        for (const hx of [-1.3, 1.3]) {
          const hole: P3[] = []
          for (let i = 0; i <= 16; i++) {
            const t = (i / 16) * 2 * Math.PI
            hole.push(body.at(L / 2 + hx + 0.8 * Math.cos(t), 138 + 6 * Math.sin(t), 0.03))
          }
          s.line(hole, 'detail', 0.7)
        }
      }
    }

    /** The wedge sandwich pack: a card triangle standing on its back, a window on the slope showing both halves' cut faces. */
    const sandwich = (ink: Ink) => {
      const B = 28,
        Hs = 20 * H,
        D = 16,
        x0 = 57,
        ys = 28,
        z0 = FZ
      const prof: Pt[] = [
        [x0, z0],
        [x0 + B, z0],
        [x0, z0 + Hs],
      ]
      s.prism(prof, ys, D, { top: 'top', side: 'side', front: 'front', stroke: ink.line })
      const slope = (a: number, y: number): P3 => [x0 + B * (1 - a), y, z0 + Hs * a]
      const band = (
        a0: number,
        a1: number,
        y0: number,
        y1: number,
        fill: Paint,
        stroke: Paint = 'none',
      ) =>
        s.poly(
          [slope(a0, y0), slope(a1, y0), slope(a1, y1), slope(a0, y1)],
          fill,
          stroke,
          undefined,
          0.5,
        )
      // Window, then the two cut faces: bread, filling, bread across each half.
      band(0.1, 0.86, ys + 2, ys + D - 2, 'glass', ink.crease)
      const halves: [number, number][] = [
        [ys + 2.6, ys + D / 2 - 0.5],
        [ys + D / 2 + 0.5, ys + D - 2.6],
      ]
      for (const [h0, h1] of halves) {
        const t = h1 - h0
        band(0.14, 0.82, h0, h1, 'top', 'crease')
        // Filling with a ragged lettuce edge.
        const fa: P3[] = [],
          fb: P3[] = []
        for (let i = 0; i <= 14; i++) {
          const a = 0.16 + (0.64 * i) / 14
          const wob = hero ? 0.35 * Math.sin(i * 2.1 + h0) : 0
          fa.push(slope(a, h0 + t * 0.34 + wob))
          fb.push(slope(a, h0 + t * 0.66 - wob * 0.6))
        }
        s.poly([...fa, ...fb.reverse()], 'side', 'crease', undefined, 0.5)
        if (hero) {
          // Crust at both ends of the cut.
          band(0.14, 0.17, h0, h1, 'front', 'none')
          band(0.79, 0.82, h0, h1, 'front', 'none')
        }
      }
      if (hero) {
        // Tear strip along the apex, edge to edge.
        s.line([slope(0.93, ys), slope(0.93, ys + D)], 'crease', 0.5)
        s.line([slope(0.96, ys), slope(0.96, ys + D)], 'crease', 0.5)
        // On the near end: the glued flap seam, the label with its rule lines, a barcode.
        const yE = ys + D
        s.line(
          [
            [x0, yE, z0 + 1.4],
            [x0 + B - 1.4 * (B / Hs), yE, z0 + 1.4],
          ],
          'crease',
          0.5,
        )
        s.poly(
          [
            [x0 + 2.5, yE, z0 + 12 * H],
            [x0 + 10, yE, z0 + 12 * H],
            [x0 + 10, yE, z0 + 5],
            [x0 + 2.5, yE, z0 + 5],
          ],
          'top',
          'crease',
          undefined,
          0.5,
        )
        s.segs(
          [
            [3.6, 10.6 * H],
            [3.6, 9.2 * H],
            [3.6, 7.8 * H],
          ].map(([dx, dz], i): P3[] => [
            [x0 + dx, yE, z0 + dz],
            [x0 + dx + (i === 2 ? 3.4 : 5.2), yE, z0 + dz],
          ]),
          'detail',
          0.5,
        )
        const bars: P3[][] = []
        for (let x = x0 + 12; x < x0 + 17.5; x += 0.9 + 0.5 * hash(x))
          bars.push([
            [x, yE, z0 + 2.6],
            [x, yE, z0 + 5.4],
          ])
        s.segs(bars, 'detail', 0.45)
      }
      return [...prof.map(([a, b]): P3 => [a, ys, b]), ...prof.map(([a, b]): P3 => [a, ys + D, b])]
    }

    /** The hot meal: a foil casserole with flared, pleated walls, a crimped flange, a card lid with a label and one corner peeled up. */
    const casserole = (ink: Ink) => {
      const w = 40,
        d = 30,
        x = MC[0] - w / 2,
        y = MC[1] - d / 2,
        z = FZ,
        h = 7 * H,
        g = 2.2,
        r = 3
      const fb = roundRect(x + g, y + g, w - 2 * g, d - 2 * g, r),
        ft = roundRect(x, y, w, d, r + g)
      const B = fb.map(([a, b]) => s.P(a, b, z)),
        T = ft.map(([a, b]) => s.P(a, b, z + h))
      const outline = hull([...B, ...T])
      s.poly2(outline, 'front', 'none')
      const m = ft.length
      const vis = ft.map(([x0, y0], i) => {
        const [x1, y1] = ft[(i + 1) % m]
        const nx = y1 - y0,
          ny = x0 - x1
        return { see: nx + ny > 1e-6, side: nx > ny }
      })
      const side: number[] = []
      vis.forEach((v, i) => v.see && v.side && side.push(i))
      if (side.length) {
        const run = [...side, (side[side.length - 1] + 1) % m]
        s.poly2([...run.map((i) => T[i]), ...[...run].reverse().map((i) => B[i])], 'side', 'none')
      }
      s.poly2(outline, 'none', ink.line)
      // Pleats where the foil gathers round each visible corner, from the base to the flange.
      if (hero) {
        const pl: P3[][] = []
        fb.forEach(([a, b], i) => {
          const c = i % 7
          if (c === 0 || c === 6 || !vis[i].see || !vis[(i + m - 1) % m].see) return
          const [ta, tb] = ft[i]
          pl.push([
            [a, b, z],
            [a + (ta - a) * 0.9, b + (tb - b) * 0.9, z + h - 0.9],
          ])
        })
        s.segs(pl, ink.crease, 0.45)
      }
      // Flange, crimped round its visible edge.
      const zf = z + h - 0.9
      s.rbox(x - 1.2, y - 1.2, zf, w + 2.4, d + 2.4, 0.9, r + g + 1.2, {
        top: 'top',
        wall: 'front',
        side: 'side',
        stroke: ink.line,
      })
      if (hero)
        s.segs(
          stepAlong(visibleRun(roundRect(x - 1.2, y - 1.2, w + 2.4, d + 2.4, r + g + 1.2)), 1.5)
            .slice(1, -1)
            .map(([a, b]): P3[] => [
              [a, b, zf],
              [a, b, zf + 0.9],
            ]),
          ink.crease,
          0.4,
        )
      // The lid, its embossed border, the label, the peeled corner.
      const zl = zf + 0.9
      s.poly(
        rrOn(s, [0, 0, zl], X, Y, x - 0.4, y - 0.4, w + 0.8, d + 0.8, r + g + 0.4),
        'top',
        ink.crease,
        undefined,
        0.6,
      )
      if (hero) {
        s.poly(
          rrOn(s, [0, 0, zl], X, Y, x + 2.4, y + 2.4, w - 4.8, d - 4.8, r),
          'none',
          'crease',
          undefined,
          0.5,
        )
        s.poly(rect(x + 7, y + 7, x + 23, y + 17, zl), 'front', 'crease', undefined, 0.5)
        s.segs(
          [
            [9.5, 16],
            [12, 13],
            [14.5, 15],
          ].map(([dy, len]): P3[] => [
            [x + 9, y + dy, zl],
            [x + 9 + len * 0.75, y + dy, zl],
          ]),
          'detail',
          0.6,
        )
      }
      // Peeled corner: the hot food it uncovers, then the flap folded up off it.
      const ca: P3 = [x + w - 9, y + d + 0.4, zl],
        cb: P3 = [x + w + 0.4, y + d - 8, zl],
        tip: P3 = [x + w - 5.5, y + d - 5, zl + 4.2 * H]
      s.poly([ca, cb, [x + w - 1.6, y + d - 1.6, zl]], 'shade', ink.crease, undefined, 0.5)
      s.poly([ca, cb, tip], 'front', ink.line, undefined, 0.8)
      return [
        ...roundRect(x - 1.2, y - 1.2, w + 2.4, d + 2.4, r + g + 1.2).map(([a, b]): P3 => [
          a,
          b,
          zl,
        ]),
        ...fb.map(([a, b]): P3 => [a, b, z]),
        tip,
      ]
    }

    /** Cutlery rolled in a napkin with a paper band; the handles show at the near end. */
    const cutlery = () => {
      const y = 68,
        r = 3.1,
        zc = FZ + 3,
        x0 = 15,
        x1 = 48
      const roll = (a: number, b: number, rr: number) =>
        lathe(s, frameAlong([a, y, zc], X), () => ({ r: rr, rz: rr * 0.95 }), 0, b - a, {
          steps: 1,
          ring: hero ? 28 : 16,
          shade: hero,
        })
      const A = roll(x0, 28, r)
      if (hero) A.along(100, 0, 28 - x0)
      const band = roll(28, 34, r + 0.35)
      if (hero) band.seam(3)
      const Bd = roll(34, x1, r)
      if (hero) Bd.along(100, 0, x1 - 34)
      // The rolled end: a spiral of napkin, then the handles of knife, fork and spoon.
      if (hero) {
        const sp: P3[] = []
        for (let i = 0; i <= 60; i++) {
          const a = (i / 60) * 5 * Math.PI,
            rr = 0.5 + (r - 0.7) * (i / 60)
          sp.push([x1, y + rr * Math.cos(a), zc + rr * 0.95 * Math.sin(a)])
        }
        s.line(sp, 'crease', 0.45)
      }
      // The spoon's handle end, the one piece of cutlery that shows.
      s.rbox(x1 - 0.4, y - 1.1, zc - 0.3, 3.2, 2.2, 0.6, 1)
    }

    /** Bread roll: an ovoid loaf with three scores across its crown. */
    const breadRoll = () => {
      const L = 13,
        R = 5.2,
        x0 = 55.5,
        y = 68
      const b = lathe(
        s,
        frameAlong([x0, y, FZ], X),
        (t) => {
          const e = (t - L / 2) / (L / 2)
          // A superellipse, so the ends are blunt like a baked roll's, not pointed.
          const r = R * Math.max(0, 1 - Math.abs(e) ** 2.6) ** (1 / 2.6) * (1 - 0.06 * e)
          return { r, rz: r * 0.78, lift: r * 0.78 }
        },
        0,
        L,
        { steps: hero ? 16 : 6, ring: hero ? 28 : 16, shade: hero, caps: false },
      )
      if (hero)
        for (const t of [3.6, 6.5, 9.4])
          b.patch(
            [
              [t - 1.1, 52],
              [t - 0.5, 52],
              [t + 1.1, 116],
              [t + 0.5, 116],
            ],
            'shade',
            'crease',
            0.4,
          )
    }

    /** Butter pat in its foil, folded like an envelope on top. */
    const butter = () => {
      const x = 72.5,
        y = 65.4,
        w = 8.6,
        d = 5.6,
        h = 1.8
      s.box(x, y, FZ, w, d, h)
      if (hero) {
        const z = FZ + h
        s.segs(
          [
            [
              [x, y + d / 2, z],
              [x + w, y + d / 2, z],
            ],
            [
              [x, y, z],
              [x + 2.6, y + d / 2, z],
            ],
            [
              [x, y + d, z],
              [x + 2.6, y + d / 2, z],
            ],
            [
              [x + w, y, z],
              [x + w - 2.6, y + d / 2, z],
            ],
            [
              [x + w, y + d, z],
              [x + w - 2.6, y + d / 2, z],
            ],
          ],
          'crease',
          0.4,
        )
      }
    }

    /** Salad in a round bowl: leaves heaped above the rim, two cherry tomatoes, cucumber slices. */
    const salad = () => {
      const cx = 26,
        cy = 24.2,
        F = frameAlong([cx, cy, FZ], Z)
      const prof = spline([
        [0, 6.2],
        [0.6, 6.6],
        [4.6, 8.9],
        [5.1, 9.6],
        [5.5, 9.4],
      ])
      lathe(s, F, (t) => ({ r: prof(t)[0] }), 0, 5.5, {
        steps: hero ? 10 : 4,
        ring: n,
        shade: hero,
        caps: false,
      })
      const zt = FZ + 5.5
      s.poly(s.circle([cx, cy, zt], X, Y, 0, 0, 8.7, n), 'side', 'crease', undefined, 0.6)
      type Leaf = [number, number, number, number, Paint]
      const leaves: Leaf[] = [
        [-3, -2.6, 3.4, 1.1, 'front'],
        [2.4, -3.4, 3.2, 1, 'top'],
        [-4.4, 1.6, 3, 0.9, 'top'],
        [0.2, 0, 3.8, 1.8, 'top'],
        [4, 0.8, 3.2, 1.1, 'front'],
        [-1.4, 3.8, 3.2, 1.2, 'front'],
        [3, 4.2, 2.8, 0.9, 'top'],
      ]
      const pieces: [number, () => void][] = leaves.map(([dx, dy, r, lift, fill], i) => [
        dx + dy,
        () => {
          const c: P3 = [cx + dx, cy + dy, zt + lift]
          // A ruffled lettuce leaf.
          const m = hero ? 30 : 12
          const leaf = Array.from({ length: m }, (_, j): P3 => {
            const a = (j / m) * 2 * Math.PI,
              rr = r * (1 + (hero ? 0.14 : 0.06) * Math.sin(7 * a + i * 1.7))
            return [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a), c[2]]
          })
          s.poly(leaf, fill, 'crease', undefined, 0.5)
          if (hero) {
            const a = 0.6 + i * 1.3
            s.line(
              [
                [c[0] - r * 0.8 * Math.cos(a), c[1] - r * 0.8 * Math.sin(a), c[2]],
                [c[0] + r * 0.8 * Math.cos(a), c[1] + r * 0.8 * Math.sin(a), c[2]],
              ],
              'crease',
              0.4,
            )
          }
        },
      ])
      if (hero) {
        for (const [dx, dy] of [
          [-3.4, -0.6],
          [2.2, 2.6],
        ] as const)
          pieces.push([
            dx + dy + 0.1,
            () => {
              const c: P3 = [cx + dx, cy + dy, zt + 2.8]
              bead(c, 1.6, 'side', 'line')
              bead([c[0] - 0.3, c[1] - 0.3, c[2] + 0.6], 0.45, 'top', 'none')
            },
          ])
        pieces.push([
          -1.9,
          () => {
            const c: P3 = [cx + 0.6, cy - 2.6, zt + 2.6]
            s.poly(s.circle(c, X, Y, 0, 0, 1.7, 14), 'top', 'crease', undefined, 0.5)
            s.poly(s.circle(c, X, Y, 0, 0, 0.9, 12), 'none', 'detail', undefined, 0.4)
          },
        ])
      }
      pieces.sort((a, b) => a[0] - b[0]).forEach(([, draw]) => draw())
    }

    /** Dessert pot with a foil lid and its peel tab. Returns the points for a wash. */
    const dessert = (ink: Ink) => {
      const cx = 26,
        cy = 48.5,
        F = frameAlong([cx, cy, FZ], Z),
        h = 6.6 * H
      const prof = spline([
        [0, 5],
        [0.5, 5.3],
        [h - 0.9, 6.4],
        [h - 0.5, 7],
        [h, 7],
      ])
      const b = lathe(s, F, (t) => ({ r: prof(t)[0] }), 0, h, {
        steps: hero ? 10 : 4,
        ring: n,
        shade: hero,
        line: ink.line,
        crease: ink.crease,
      })
      if (hero) {
        b.seam(1.4)
        s.poly(s.circle([cx, cy, FZ + h], X, Y, 0, 0, 4.4, n), 'none', 'crease', undefined, 0.5)
        s.poly(s.circle([cx, cy, FZ + h], X, Y, 0, 0, 1.2, 12), 'none', 'detail', undefined, 0.5)
      }
      // Peel tab, folded out over the rim towards the viewer.
      const a = Math.PI / 4,
        u: P3 = [Math.cos(a), Math.sin(a), 0],
        v: P3 = [-Math.sin(a), Math.cos(a), 0]
      const at = (rr: number, side: number, dz = 0): P3 => [
        cx + u[0] * rr + v[0] * side,
        cy + u[1] * rr + v[1] * side,
        FZ + h + dz,
      ]
      s.poly(
        [at(6.2, -1.6), at(9.2, -1.2, -0.6), at(9.2, 1.2, -0.6), at(6.2, 1.6)],
        'top',
        ink.line,
        undefined,
        0.6,
      )
      return [...ringsOf(b, 0, h, 3), at(9.2, -1.2, -0.6), at(9.2, 1.2, -0.6)]
    }

    /** A plastic cup in the table's ring, with a rolled rim and water inside. */
    const cup = () => {
      const [cx, cy] = RING,
        z0 = TH - 2.4,
        h = 14 * H
      const prof = spline([
        [0, 5],
        [0.8, 5.3],
        [h - 1.6, 6.9],
        [h - 0.6, 7.6],
        [h, 7.4],
      ])
      const b = lathe(s, frameAlong([cx, cy, z0], Z), (t) => ({ r: prof(t)[0] }), 0, h, {
        steps: hero ? 14 : 5,
        ring: n,
        shade: hero,
        caps: false,
      })
      if (hero) {
        b.seam(1.4)
        b.seam(h - 3.4)
      }
      const rim = s.pp(s.circle([cx, cy, z0 + h], X, Y, 0, 0, 7, n))
      s.poly2(rim, 'side', 'crease', 0.6)
      const water = clipTo(s.pp(s.circle([cx, cy, z0 + h - 3.6], X, Y, 0, 0, 6.6, n)), rim)
      if (water.length > 2) s.poly2(water, 'top', 'crease', 0.5)
    }

    /** The birthday cake: two iced tiers on a board, drips, piped beads, five candles. Returns nothing; drawn whole in the lit group. */
    const cake = () => {
      const [cx, cy] = MC
      const zb = FZ,
        z0 = zb + 0.8,
        R1 = 15.5,
        h1 = 9.5 * H,
        R2 = 9.6,
        h2 = 7.5 * H,
        z1 = z0 + h1,
        z2 = z1 + h2
      // Board.
      lathe(s, frameAlong([cx, cy, zb], Z), () => ({ r: 19 }), 0, 0.8, { steps: 1, ring: n })
      if (hero)
        s.poly(s.circle([cx, cy, z0], X, Y, 0, 0, 17.8, n), 'none', 'crease', undefined, 0.5)

      const fillet = (R: number, h: number, f: number) => (t: number) => ({
        r: t < h - f ? R : R - f + Math.sqrt(Math.max(0, f * f - (t - (h - f)) ** 2)),
      })
      const tier = (z: number, R: number, h: number) => {
        const f = Math.min(1.4, h * 0.2)
        const b = lathe(s, frameAlong([cx, cy, z], Z), fillet(R, h, f), 0, h, {
          steps: hero ? 22 : 6,
          ring: n,
          shade: hero,
          line: 'accent',
          crease: 'accent-side',
        })
        // Icing drips down the visible side, stroked only along their lower edge.
        if (hero) {
          const t0 = h - f,
            lim = b.limbs(t0)
          if (lim) {
            const [lo, hi] = lim
            const top: P3[] = [],
              drip: P3[] = []
            const steps = Math.ceil((hi - lo) / 2.5)
            for (let i = 0; i <= steps; i++) {
              const deg = lo + ((hi - lo) * i) / steps
              const bump = Math.abs(Math.sin(((deg - lo) * Math.PI) / (R > 12 ? 15 : 20)))
              const len =
                (0.6 + 2.8 * bump ** 3 * (0.6 + 0.4 * hash(Math.round(deg / 15)))) * (h / 9.5)
              top.push(b.at(t0 + 0.2, deg, 0.04))
              drip.push(b.at(Math.max(0.6, t0 - len), deg, 0.04))
            }
            s.poly([...top, ...[...drip].reverse()], 'top', 'none')
            s.line(drip, 'crease', 0.5)
          }
        }
        wash(ringsOf(b, 0, h, 4), 0.2)
        return b
      }
      tier(z0, R1, h1)
      // Shell border round the foot of the bottom tier, only the half in front of it.
      if (hero)
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * 2 * Math.PI
          if (Math.cos(a) + Math.sin(a) < 0.25) continue
          bead([cx + (R1 + 0.5) * Math.cos(a), cy + (R1 + 0.5) * Math.sin(a), z0 + 0.9], 1.05)
        }
      // Beads round the bottom tier's top edge: those behind the top tier first.
      const ringBeads = (R: number, z: number, count: number, front: boolean) => {
        if (!hero) return
        const list: P3[] = []
        for (let i = 0; i < count; i++) {
          const a = (i / count) * 2 * Math.PI
          if (Math.cos(a) + Math.sin(a) >= 0 === front)
            list.push([cx + R * Math.cos(a), cy + R * Math.sin(a), z])
        }
        list.sort((p, q) => p[0] + p[1] - (q[0] + q[1])).forEach((c) => bead(c, 1.1))
      }
      ringBeads(R1 - 1.6, z1 + 0.7, 30, false)
      tier(z1, R2, h2)
      ringBeads(R1 - 1.6, z1 + 0.7, 30, true)

      // Candles and the top tier's beads, back to front together.
      const items: [number, () => void][] = []
      if (hero)
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * 2 * Math.PI
          const c: P3 = [cx + (R2 - 1.3) * Math.cos(a), cy + (R2 - 1.3) * Math.sin(a), z2 + 0.6]
          items.push([c[0] + c[1], () => bead(c, 0.95)])
        }
      const ch = hero ? 7 : 9,
        cr = hero ? 0.75 : 1.2,
        fs = hero ? 1 : 1.8
      const flames: P3[] = []
      for (let i = 0; i < 5; i++) {
        const a = ((18 + 72 * i) * Math.PI) / 180
        const px = cx + 5.2 * Math.cos(a),
          py = cy + 5.2 * Math.sin(a)
        flames.push([px, py, z2 + ch])
        items.push([
          px + py,
          () => {
            const c = tube(s, [px, py, z2], [px, py, z2 + ch], cr, {
              shade: hero,
              ring: hero ? 14 : 10,
              line: 'accent',
              crease: 'accent-side',
            })
            if (hero) for (const t of [1.6, 3.4, 5.2]) c.seam(t, 'accent-side', 0.5)
            s.line(
              [
                [px, py, z2 + ch],
                [px, py, z2 + ch + 1.1],
              ],
              'line',
              0.6,
            )
          },
        ])
      }
      items.sort((p, q) => p[0] - q[0]).forEach(([, draw]) => draw())
      // Flames last: small, solid accent, glowing.
      flames.sort((p, q) => p[0] + p[1] - (q[0] + q[1]))
      for (const [px, py, pz] of flames) {
        const zf = pz + 0.8
        const shape = (pts: readonly (readonly [number, number])[]) =>
          pts.map(([u, v]): P3 => [px + SX[0] * u * fs, py + SX[1] * u * fs, zf + v * fs])
        const outer = shape([
          [0, 0],
          [1.1, 0.7],
          [1.4, 2],
          [0.8, 3.5],
          [0, 5.4],
          [-0.8, 3.5],
          [-1.4, 2],
          [-1.1, 0.7],
        ])
        s.glow(2.4, () => s.poly(outer, 'accent', 'none'))
        s.poly(outer, 'accent', 'accent-side', undefined, 0.5)
        if (hero)
          s.poly(
            shape([
              [0, 0.5],
              [0.55, 1.3],
              [0.5, 2.4],
              [0, 3.2],
              [-0.5, 2.4],
              [-0.55, 1.3],
            ]),
            'accent-plate',
            'none',
          )
      }
    }

    // ---- placing the contents --------------------------------------------------------------
    const lit = (draw: () => void) => s.group('lit', draw)

    // Back-left well: the folded napkin until the hot meal (it becomes the cutlery roll), then the salad.
    inWell(openB, () => {
      if (rung <= 2) napkin()
      else if (rung >= 4) salad()
    })
    inWell(openC, () => {
      if (rung === 4) lit(() => wash(dessert(LIT), 0.24))
      else if (rung === 5) dessert(PLAIN)
    })
    inWell(openA, () => {
      if (rung === 1) lit(() => pretzels(LIT))
      else if (rung === 2) lit(() => wash(sandwich(LIT)))
      else if (rung === 3) lit(() => wash(casserole(LIT)))
      else if (rung === 4) casserole(PLAIN)
      else lit(cake)
    })
    inWell(openD, () => {
      if (rung >= 3) cutlery()
      if (rung >= 4) {
        breadRoll()
        butter()
      }
      sachets()
    })
    inWell(ringOpen, cup)
    return s.done()
  },
}
