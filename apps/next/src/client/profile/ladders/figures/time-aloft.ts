import { Scene, hull, roundRect, type P3, type Paint, type Pt } from '../../../overview/iso/scene'
import { X, Y, cylX, rrOn, shadowRect } from '../../../overview/iso/solids'
import type { LadderFigureDef } from './types'

type Tone = { top: Paint; wall: Paint; side: Paint }
const PLAIN: Tone = { top: 'top', wall: 'front', side: 'side' }
const LIT: Tone = { top: 'accent-plate', wall: 'accent', side: 'accent-side' }

// Tray table: 140 × 88 slab at z 0..6. The tray stands on it (rim top z 10, floor z 7.2); the cup ring is at the right.
const TW = 140,
  TD = 88,
  TH = 6,
  FZ = 7.2,
  RIM = 10
const RING: Pt = [122, 42],
  RING_DEPTH = 2.4
// The main compartment (right of the divider), where the big item of each rung sits.
const MC: Pt = [69.5, 42.5]

const rect = (x0: number, y0: number, x1: number, y1: number, z: number): P3[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
]

/**
 * Time aloft: the in-flight meal tray. The tray and its tray-table edge are the same at every rung; only what stands on it changes.
 * Rungs: pretzel bag, sandwich box, hot meal with a foil lid, a full tray, a birthday cake.
 * Lit: the new item (the cake's icing, candles and flames on the top rung). At rung 4 the lit group holds the whole drawn-in-order tray contents so the older hot meal keeps its place in depth.
 */
export const timeAloft: LadderFigureDef = {
  id: 'time-aloft',
  rungs: 5,
  build(k, { rung, lod }) {
    const s = new Scene(k)
    const hero = lod === 'hero'
    const n = hero ? 24 : 16
    // At 56px the object needs bulk, so the thumb stands its items taller.
    const H = hero ? 1 : 1.4

    const bx = (x: number, y: number, z: number, w: number, d: number, h: number, t: Tone) =>
      s.box(x, y, z, w, d, h, { top: t.top, front: t.wall, side: t.side })
    const rb = (
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      h: number,
      r: number,
      t: Tone,
    ) => s.rbox(x, y, z, w, d, h, r, { top: t.top, wall: t.wall, side: t.side })
    /** Round part (axis z) with a radius change, shaded on its x-facing side. Returns the top rim. */
    const frustum = (
      cx: number,
      cy: number,
      z: number,
      r0: number,
      r1: number,
      h: number,
      t: Tone,
      seg = n,
    ) => {
      const bot = s.circle([cx, cy, z], X, Y, 0, 0, r0, seg),
        top = s.circle([cx, cy, z + h], X, Y, 0, 0, r1, seg)
      const botP = s.pp(bot),
        topP = s.pp(top)
      const outline = hull([...botP, ...topP])
      s.poly2(outline, t.wall, 'none')
      const run: number[] = []
      for (let i = 0; i < seg; i++) {
        const a = ((i / seg) * 360 + 180) % 360
        if (a >= 135 && a <= 225) run.push(i)
      }
      // The x-facing run is contiguous modulo the loop; i = 0 is angle 0 (x axis), so wrap the negative half.
      const facing: number[] = []
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * 360
        if (a <= 45 || a >= 315) facing.push(i)
      }
      const ordered = [...facing.filter((i) => i >= seg / 2), ...facing.filter((i) => i < seg / 2)]
      s.poly2(
        [...ordered.map((i) => topP[i]), ...[...ordered].reverse().map((i) => botP[i])],
        t.side,
        'none',
      )
      s.poly2(outline, 'none', 'line')
      s.poly(top, t.top, 'line')
      return top
    }
    /** The visible half of a ring round an upright part. */
    const ring = (cx: number, cy: number, r: number, z: number, stroke: Paint = 'crease') => {
      const pts: P3[] = []
      for (let i = 0; i <= 12; i++) {
        const a = ((-45 + (180 * i) / 12) * Math.PI) / 180
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z])
      }
      s.line(pts, stroke, 0.8)
    }
    const glowOver = (pts: P3[], blur = 3.5) => s.glow(blur, () => s.poly(pts, 'accent', 'none'))
    const upRect = (x: number, y: number, z: number, w: number, h: number) =>
      [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y, z],
        [x, y, z],
      ] as P3[]

    // ---- the table -------------------------------------------------------------------------
    shadowRect(s, 0, -8, TW, TD + 8, 7)

    // Hinge arm stubs and their barrel, behind the slab.
    for (const x of hero ? [24, 106] : []) {
      bx(x, -12, 1.4, 10, 14, 4.4, PLAIN)
      bx(x + 1.4, -12, 5.8, 7.2, 3, 1, PLAIN)
      if (hero)
        for (const dx of [2.5, 7.5]) {
          const dot = s.circle([x + dx, -4, 5.8], X, Y, 0, 0, 0.5, 8)
          s.poly(dot, 'detail', 'line')
        }
    }
    if (hero) {
      cylX(s, 22, -12, 4.6, 2.8, 14, { body: 'front', face: 'side' }, 20)
      cylX(s, 104, -12, 4.6, 2.8, 14, { body: 'front', face: 'side' }, 20)
    }

    s.rbox(0, 0, 0, TW, TD, TH, 5, { top: 'top', wall: 'front', side: 'side' })
    // Rolled edge line round the front and right sides, ending where the corners turn away.
    const edge: P3[] = []
    const arc = (cx: number, cy: number, a0: number, a1: number) => {
      for (let i = 0; i <= 4; i++) {
        const a = ((a0 + ((a1 - a0) * i) / 4) * Math.PI) / 180
        edge.push([cx + 5 * Math.cos(a), cy + 5 * Math.sin(a), 2.8])
      }
    }
    arc(TW - 5, 5, -45, 0)
    arc(TW - 5, TD - 5, 0, 90)
    arc(5, TD - 5, 90, 135)
    if (hero) s.line(edge, 'crease', 0.8)
    // Inset border on the top face.
    if (hero) s.poly(rrOn(s, [0, 0, TH], X, Y, 2.4, 2.4, TW - 4.8, TD - 4.8, 3), 'none', 'crease')

    // Cup ring: a recess whose far wall shows as a dark crescent.
    {
      const [rx, ry] = RING
      s.poly(s.circle([rx, ry, TH], X, Y, 0, 0, 11, n), 'glass', 'line')
      const shift = RING_DEPTH
      s.poly(s.circle([rx + shift, ry + shift, TH], X, Y, 0, 0, 7.2, n), 'front', 'crease')
      if (hero) s.poly(s.circle([rx + shift, ry + shift, TH], X, Y, 0, 0, 4.4, n), 'none', 'detail')
      s.poly(s.circle([rx, ry, TH], X, Y, 0, 0, 11, n), 'none', 'line')
    }

    // Latch tab on the front edge, with its slot on the slab.
    bx(62, TD, 1.4, 16, 3.4, 3.8, PLAIN)
    if (hero) s.poly(rect(64, 81.2, 76, 84.4, TH), 'glass', 'crease')
    if (hero)
      s.line(
        [
          [64.6, TD + 3.4, 3.4],
          [76.4, TD + 3.4, 3.4],
        ],
        'crease',
        0.7,
      )

    // ---- the tray --------------------------------------------------------------------------
    const TX = 8,
      TY = 12,
      TWD = 94,
      TDP = 64,
      WALL = 2.2
    const ix0 = TX + WALL,
      iy0 = TY + WALL
    // Visible floor stops where the near rim hides it: 2.8 of depth shifts it 2.8 in plan.
    const fx1 = TX + TWD - WALL - (RIM - FZ),
      fy1 = TY + TDP - WALL - (RIM - FZ)
    s.rbox(TX, TY, TH, TWD, TDP, RIM - TH, 5, { top: 'top', wall: 'front', side: 'side' })
    s.poly(
      rrOn(s, [0, 0, RIM], X, Y, ix0, iy0, TWD - 2 * WALL, TDP - 2 * WALL, 3),
      'none',
      'crease',
    )
    s.poly(
      [
        [ix0, iy0, RIM],
        [fx1, iy0, RIM],
        [fx1, iy0, FZ],
        [ix0, iy0, FZ],
      ],
      'front',
      'crease',
    )
    s.poly(
      [
        [ix0, iy0, RIM],
        [ix0, fy1, RIM],
        [ix0, fy1, FZ],
        [ix0, iy0, FZ],
      ],
      'side',
      'crease',
    )
    s.poly(rrOn(s, [0, 0, FZ], X, Y, ix0, iy0, fx1 - ix0, fy1 - iy0, 2.5), 'top', 'crease')
    // Compartment walls: a long divider and a short one splitting the left column.
    bx(39, iy0, FZ, 1.8, fy1 - iy0, 2.6, PLAIN)
    if (hero) bx(ix0, 43, FZ, 39 - ix0, 1.8, 2.6, PLAIN)

    // ---- what is on the tray ---------------------------------------------------------------
    const napkin = (x: number, y: number, t: Tone = PLAIN) => {
      if (!hero) return
      bx(x, y, FZ, 22, 20, 1.2, t)
      // The folded-over corner and the fold lines.
      s.poly(
        [
          [x + 22, y + 20, FZ + 1.2],
          [x + 12, y + 20, FZ + 1.2],
          [x + 22, y + 10, FZ + 1.2],
        ],
        'front',
        'crease',
      )
      if (hero) {
        s.line(
          [
            [x, y + 10, FZ + 1.2],
            [x + 22, y + 10, FZ + 1.2],
          ],
          'crease',
          0.7,
        )
        s.line(
          [
            [x + 11, y, FZ + 1.2],
            [x + 11, y + 20, FZ + 1.2],
          ],
          'crease',
          0.7,
        )
      }
    }
    const sachets = () => {
      if (!hero) return
      bx(14, 56, FZ, 12, 7, 0.9, PLAIN)
      bx(16, 64, FZ, 12, 6, 0.9, PLAIN)
      if (hero) {
        s.line(
          [
            [15.5, 56, FZ + 0.9],
            [15.5, 63, FZ + 0.9],
          ],
          'crease',
          0.7,
        )
        s.line(
          [
            [24.5, 56, FZ + 0.9],
            [24.5, 63, FZ + 0.9],
          ],
          'crease',
          0.7,
        )
      }
    }

    const bag = (t: Tone) => {
      const bw = 28,
        bl = 34,
        bh = 10 * H,
        x0 = MC[0] - bw / 2,
        y0 = MC[1] - bl / 2,
        fin = 3.6
      const fz = FZ + bh / 2 - 1.1
      // Back crimp, the pillow, the near crimp.
      bx(x0 + 1.5, y0 - fin, fz, bw - 3, fin, 2.2, t)
      s.prism(roundRect(x0, FZ, bw, bh, 4.6), y0, bl, { top: t.top, side: t.side, front: t.wall })
      bx(x0 + 1.5, y0 + bl, fz, bw - 3, fin, 2.2, t)
      if (hero) {
        const ticks: P3[][] = []
        for (let x = x0 + 3; x <= x0 + bw - 3; x += 1.7) {
          ticks.push([
            [x, y0 + bl + fin, fz],
            [x, y0 + bl + fin, fz + 2.2],
          ])
          ticks.push([
            [x, y0 + bl, fz + 2.2],
            [x, y0 + bl + fin, fz + 2.2],
          ])
        }
        s.segs(ticks, 'crease', 0.6)
        // A printed label with a pretzel knot on the flat of the bag.
        const top = FZ + bh
        s.poly(rect(x0 + 6, y0 + 8, x0 + bw - 6, y0 + bl - 8, top), 'none', 'crease')
        const at = s.on([0, 0, top], X, Y)
        s.poly(s.circle([0, 0, top], X, Y, MC[0] - 3, MC[1], 3.6, 16), 'none', 'detail')
        s.poly(s.circle([0, 0, top], X, Y, MC[0] + 3, MC[1], 3.6, 16), 'none', 'detail')
        s.line(
          [at(MC[0] - 2, MC[1] + 3.4), at(MC[0] + 2, MC[1] + 6.8), at(MC[0] + 4, MC[1] + 3.4)],
          'detail',
          0.8,
        )
      }
    }

    const sandwich = (t: Tone) => {
      const w = 42,
        d = 34,
        x0 = MC[0] - w / 2,
        y0 = MC[1] - d / 2
      bx(x0, y0, FZ, w, d, 9.5 * H, t)
      bx(x0 - 0.7, y0 - 0.7, FZ + 9.5 * H, w + 1.4, d + 1.4, 3, t)
      const zt = FZ + 9.5 * H + 3
      // The triangular window with the sandwich behind it.
      const tri = (i: number): P3[] => [
        [x0 + 7 + i, y0 + 6 + i, zt],
        [x0 + w - 7 - 2 * i, y0 + 6 + i, zt],
        [x0 + 7 + i, y0 + d - 8 - 2 * i, zt],
      ]
      s.poly(tri(0), 'glass', 'crease')
      s.poly(tri(1.8), 'top', 'crease')
      if (hero) {
        const [a, b, c] = tri(1.8)
        const lines: P3[][] = []
        for (const f of [0.3, 0.55, 0.8])
          lines.push([
            [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, zt],
            [a[0] + (b[0] - a[0]) * (1 - f), a[1] + (b[1] - a[1]) * (1 - f), zt],
          ])
        s.segs(lines, 'crease', 0.7)
      } else {
        const [a, , c] = tri(1.8)
        s.line(
          [
            [a[0], (a[1] + c[1]) / 2, zt],
            [(a[0] + tri(1.8)[1][0]) / 2, a[1], zt],
          ],
          'crease',
          0.8,
        )
      }
      // The folded lid flap at the front, and the tuck tab.
      s.line(
        [
          [x0 - 0.7, y0 + d - 7, zt],
          [x0 + w + 0.7, y0 + d - 7, zt],
        ],
        'crease',
        0.8,
      )
      if (hero) {
        s.poly(upRect(MC[0] - 5, y0 + d + 0.7, FZ + 8, 10, 3.6), 'top', 'crease')
        s.line(
          [
            [MC[0] - 7, y0 + d + 0.7, FZ + 10.8],
            [MC[0] + 7, y0 + d + 0.7, FZ + 10.8],
          ],
          'crease',
          0.7,
        )
        // Barcode sticker on the carton front.
        s.poly(upRect(x0 + 5, y0 + d, FZ + 2.4, 12, 4.4), 'top', 'crease')
        const bars: P3[][] = []
        for (let x = x0 + 6.4; x < x0 + 16.6; x += 1.5)
          bars.push([
            [x, y0 + d, FZ + 3],
            [x, y0 + d, FZ + 5.6],
          ])
        s.segs(bars, 'detail', 0.6)
      }
    }

    const cx0 = 46,
      cy0 = 17,
      cw = 48,
      cd = 30
    const casserole = (t: Tone) => {
      rb(cx0, cy0, FZ, cw, cd, 8.5 * H, 2.5, t)
      // Crimped flange, then the foil lid pressed into it.
      rb(cx0 - 1.3, cy0 - 1.3, FZ + 7.4 * H, cw + 2.6, cd + 2.6, 1.4, 3, t)
      if (hero) {
        const ticks: P3[][] = []
        for (let x = cx0 + 2; x <= cx0 + cw - 1; x += 2.2)
          ticks.push([
            [x, cy0 + cd + 1.3, FZ + 7.4],
            [x, cy0 + cd + 1.3, FZ + 8.8],
          ])
        for (let y = cy0 + 2; y <= cy0 + cd - 1; y += 2.2)
          ticks.push([
            [cx0 + cw + 1.3, y, FZ + 7.4],
            [cx0 + cw + 1.3, y, FZ + 8.8],
          ])
        s.segs(ticks, 'crease', 0.6)
      }
      const zl = FZ + 7.4 * H + 1.4
      s.poly(rrOn(s, [0, 0, zl], X, Y, cx0 + 1, cy0 + 1, cw - 2, cd - 2, 2), t.top, 'crease')
      if (hero) {
        s.poly(rrOn(s, [0, 0, zl], X, Y, cx0 + 4, cy0 + 4, cw - 8, cd - 8, 2), 'none', 'crease')
        // Meal sticker.
        s.poly(rect(cx0 + 9, cy0 + 8, cx0 + 25, cy0 + 18, zl), 'top', 'crease')
        s.segs(
          [
            [
              [cx0 + 11, cy0 + 11, zl],
              [cx0 + 23, cy0 + 11, zl],
            ],
            [
              [cx0 + 11, cy0 + 14, zl],
              [cx0 + 19, cy0 + 14, zl],
            ],
          ],
          'detail',
          0.7,
        )
      }
      // Pull tab on the front-right corner, folded out of the lid.
      s.poly(
        [
          [cx0 + cw - 14, cy0 + cd + 1.3, zl - 0.6],
          [cx0 + cw - 4, cy0 + cd + 1.3, zl - 0.6],
          [cx0 + cw - 4, cy0 + cd + 4.6, zl - 0.6],
          [cx0 + cw - 14, cy0 + cd + 4.6, zl - 0.6],
        ],
        t.top,
        'line',
      )
      if (hero)
        s.poly(
          s.circle([0, 0, zl - 0.6], X, Y, cx0 + cw - 9, cy0 + cd + 2.95, 1, 8),
          'glass',
          'crease',
        )
    }
    const cutlery = (t: Tone) => {
      const x = 46,
        y = 53,
        w = 28,
        d = 11,
        h = 3.8
      rb(x, y, FZ, w, d, h, 2.2, t)
      const zt = FZ + h
      // The paper seal band round the pack.
      s.poly(rect(x + 11, y, x + 15, y + d, zt), 'side', 'crease')
      s.poly(upRect(x + 11, y + d, FZ, 4, h), 'side', 'crease')
      if (hero) {
        s.segs(
          [
            [
              [x + 3, y + 3, zt],
              [x + 9, y + 3, zt],
            ],
            [
              [x + 3, y + d - 3, zt],
              [x + 9, y + d - 3, zt],
            ],
            [
              [x + 17, y + 3, zt],
              [x + 25, y + 3, zt],
            ],
            [
              [x + 17, y + d - 3, zt],
              [x + 25, y + d - 3, zt],
            ],
          ],
          'detail',
          0.7,
        )
      }
    }

    const salad = (t: Tone) => {
      const cx = 24.5,
        cy = 28.5
      frustum(cx, cy, FZ, 8, 11.5, 6.5, t)
      const zt = FZ + 6.5
      s.poly(s.circle([cx, cy, zt], X, Y, 0, 0, 10.2, n), 'glass', 'crease')
      const blobs: [number, number, number][] = [
        [-3.2, -2.4, 4.4],
        [3.2, -3, 4],
        [-4, 3, 4],
        [3.6, 3.4, 4.2],
        [0, 0.4, 4.6],
      ]
      for (const [dx, dy, r] of blobs)
        s.poly(s.circle([cx + dx, cy + dy, zt + 1.4], X, Y, 0, 0, r, 12), 'top', 'crease')
      if (hero) {
        s.poly(s.circle([cx - 1, cy + 5, zt + 2.6], X, Y, 0, 0, 1.5, 8), 'detail', 'line')
        s.poly(s.circle([cx + 5, cy - 1, zt + 2.4], X, Y, 0, 0, 1.3, 8), 'detail', 'line')
      }
    }
    const dessert = (t: Tone) => {
      const cx = 24.5,
        cy = 58
      frustum(cx, cy, FZ, 6.2, 8, 7.4, t)
      const zt = FZ + 7.4
      s.poly(s.circle([cx, cy, zt], X, Y, 0, 0, 7.4, n), 'top', 'crease')
      if (hero) s.poly(s.circle([cx, cy, zt], X, Y, 0, 0, 4.6, n), 'none', 'detail')
      // Peel tab out of the foil lid.
      s.poly(
        [
          [28.6, 65.2, zt],
          [31.7, 62.1, zt],
          [34, 64.4, zt],
          [30.9, 67.5, zt],
        ],
        'front',
        'line',
      )
    }
    const roll = (t: Tone) => {
      const x = 76,
        y = 54.5
      rb(x, y, FZ, 20, 11, 5.5, 5.2, t)
      rb(x + 1.2, y + 1.1, FZ + 5.5, 17.6, 8.8, 2.2, 4.2, t)
      const zt = FZ + 7.7
      for (const dx of [5, 9.2, 13.4])
        s.poly(
          [
            [x + dx, y + 2.6, zt],
            [x + dx + 1.2, y + 2.6, zt],
            [x + dx + 3, y + 8.4, zt],
            [x + dx + 1.8, y + 8.4, zt],
          ],
          'shade',
          'none',
        )
    }
    const cup = (t: Tone) => {
      const [rx, ry] = RING
      const z = TH - RING_DEPTH
      frustum(rx, ry, z, 6.4, 8.4, 15, t)
      const zt = z + 15
      s.poly(s.circle([rx, ry, zt], X, Y, 0, 0, 7.4, n), 'glass', 'crease')
      if (hero) {
        ring(rx, ry, 7.6, z + 11, 'crease')
        ring(rx, ry, 6.9, z + 4, 'crease')
      }
      // Rim lip.
      s.poly(s.circle([rx, ry, zt], X, Y, 0, 0, 8.4, n), 'none', 'line')
    }

    const cake = () => {
      const [cx, cy] = MC
      const z0 = FZ,
        zb = z0 + 1.2,
        zc = zb + 13 * H,
        zi = zc + 1.2,
        R = 22
      // Cake board, then the sponge.
      frustum(cx, cy, z0, 26, 26, 1.2, PLAIN)
      frustum(cx, cy, zb, R, R, 13 * H, PLAIN)
      ring(cx, cy, R, zb + 6.4, 'crease')
      if (hero) {
        ring(cx, cy, R, zb + 7.6, 'crease')
        const band: P3[] = [],
          back: P3[] = []
        for (let i = 0; i <= 14; i++) {
          const a = ((-45 + (180 * i) / 14) * Math.PI) / 180
          band.push([cx + R * Math.cos(a), cy + R * Math.sin(a), zb + 7.6])
          back.push([cx + R * Math.cos(a), cy + R * Math.sin(a), zb + 6.4])
        }
        s.poly([...band, ...back.reverse()], 'detail', 'none')
      }
      s.group('lit', () => {
        // Icing: the top, then the drip edge running down the near half.
        const rim = R + 0.4
        const drip: P3[] = [],
          lower: P3[] = []
        const steps = 28
        for (let i = 0; i <= steps; i++) {
          const a = ((-45 + (180 * i) / steps) * Math.PI) / 180
          const depth = 2.2 + 4.4 * Math.pow(Math.abs(Math.sin(i * 0.78)), 1.6)
          drip.push([cx + rim * Math.cos(a), cy + rim * Math.sin(a), zi])
          lower.push([cx + rim * Math.cos(a), cy + rim * Math.sin(a), zi - depth])
        }
        const topDisc = s.circle([cx, cy, zi], X, Y, 0, 0, rim, n + 8)
        glowOver(topDisc, 4)
        s.poly([...drip, ...lower.reverse()], 'accent-side', 'line')
        s.poly(topDisc, 'accent', 'line')
        if (hero) {
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * 2 * Math.PI
            s.poly(
              s.circle([cx + 17.2 * Math.cos(a), cy + 17.2 * Math.sin(a), zi], X, Y, 0, 0, 1.7, 8),
              'accent-plate',
              'crease',
            )
          }
        }
        // Candles, back to front, then their flames.
        const spots: Pt[] = [-100, -30, 40, 110, 180].map((deg) => {
          const a = (deg * Math.PI) / 180
          return [cx + 9.5 * Math.cos(a), cy + 9.5 * Math.sin(a)]
        })
        spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
        const ch = hero ? 10 : 13,
          cr = hero ? 1.5 : 2.3,
          fs = hero ? 1 : 1.9
        for (const [px, py] of spots) {
          frustum(px, py, zi, cr, cr, ch, PLAIN, hero ? 12 : 8)
          if (hero) {
            ring(px, py, cr, zi + 3.2)
            ring(px, py, cr, zi + 6.4)
          }
          s.line(
            [
              [px, py, zi + ch],
              [px, py, zi + ch + 1.4],
            ],
            'line',
            0.8,
          )
        }
        for (const [px, py] of spots) {
          const zf = zi + ch + 1.2
          const flame: P3[] = (
            [
              [0, 0],
              [1.6, 1.4],
              [1.9, 3.2],
              [1, 5],
              [0, 7.6],
              [-1, 5],
              [-1.9, 3.2],
              [-1.6, 1.4],
            ] as Pt[]
          ).map(([u, v]) => [px + u * fs, py, zf + v * fs])
          glowOver(flame, 3)
          s.poly(flame, 'accent', 'line')
          if (hero)
            s.poly(
              [
                [0, 0.8],
                [0.8, 1.8],
                [0.7, 3.2],
                [0, 4.2],
                [-0.7, 3.2],
                [-0.8, 1.8],
              ].map(([u, v]) => [px + u * fs, py, zf + v * fs] as P3),
              'accent-plate',
              'none',
            )
        }
      })
    }

    /** Draws the new item inside the one lit group, the others around it in their own tones. */
    const lit = (draw: () => void) => s.group('lit', draw)
    const litTop = (pts: P3[]) => glowOver(pts)
    const mainFoot = (w: number, d: number, z: number): P3[] =>
      rect(MC[0] - w / 2, MC[1] - d / 2, MC[0] + w / 2, MC[1] + d / 2, z)

    if (rung === 1) {
      napkin(13, 18)
      sachets()
      lit(() => {
        litTop(mainFoot(28, 40, FZ + 10))
        bag(LIT)
      })
    } else if (rung === 2) {
      napkin(13, 18)
      sachets()
      lit(() => {
        litTop(mainFoot(43, 35, FZ + 12.5))
        sandwich(LIT)
      })
    } else if (rung === 3) {
      napkin(13, 18)
      sachets()
      lit(() => {
        litTop(rect(cx0, cy0, cx0 + cw, cy0 + cd, FZ + 9))
        casserole(LIT)
        cutlery(LIT)
      })
    } else if (rung === 4) {
      // The older hot meal sits between the new items in depth, so it is drawn inside the same group in plain tones.
      lit(() => {
        salad(LIT)
        dessert(LIT)
        casserole(PLAIN)
        cutlery(PLAIN)
        roll(LIT)
        cup(LIT)
      })
    } else {
      napkin(13, 18)
      sachets()
      cake()
    }
    return s.done()
  },
}
