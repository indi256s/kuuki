// Rankings, round 5: two more objects that can carry the selected leader's code (QR, DOH, ROV–VKO) on their one live part.
import { Scene, fitBox, roundRect, type IsoFigureData, type P3, type Pt } from '../../apps/next/src/client/overview/iso/scene'
import { FIG_H, FIG_W, X, Zd, cylinder, fit, flat, flatText } from './figures'

/** Mono caps are about 0.6em wide; the largest size up to `max` at which `text` spans at most `room` units. */
const fitSize = (text: string, room: number, max: number) => Math.min(max, room / (text.length * 0.6))

// ── Rankings E: the check-in bag-tag printer; the tag it just fed out carries the leader's code.
export type TagOpts = { code?: string; count?: number }
/** count: an optional small ×N printed after the code; off by default, since it squeezes long codes and a real tag prints no such thing. */
export function bagTagPrinter(k: number, { code = 'QR', count }: TagOpts = {}) {
  const s = new Scene(k)
  const G = 2
  // The counter top.
  s.poly(flat([[-8, -4], [150, -4], [150, 60], [-8, 60]], 0), 'shadow', 'none')
  s.rbox(-6, -2, 0, 154, 60, G, 3, { top: 'front' })
  // The printer: contact shadow, a body with a rounded lid, its feed side facing +x.
  const X0 = 4, X1 = 44, Y0 = 6, Y1 = 46, H = 30
  s.poly(flat([[X0 + 1, Y0 + 1], [X1 + 3, Y0 + 1], [X1 + 3, Y1 + 2.5], [X0 + 1, Y1 + 2.5]], G), 'shadow', 'none')
  s.prism(roundRect(X0, G, X1 - X0, H, [0, 8, 3, 0]), Y0, Y1 - Y0)
  const LID = G + 19
  s.line([[X1, Y0 + 1, LID], [X1, Y1, LID], [X0 + 1, Y1, LID]], 'detail', 0.7)
  // Front: a small display, a vent and a power key.
  s.poly([[X0 + 5, Y1, G + 16.5], [X0 + 19, Y1, G + 16.5], [X0 + 19, Y1, G + 11], [X0 + 5, Y1, G + 11]], 'glass', 'line', undefined, 0.8)
  s.segs([0, 1, 2, 3].map((i) => [[X0 + 6 + i * 3.2, Y1, G + 3.5], [X0 + 6 + i * 3.2, Y1, G + 8]] as P3[]), 'detail', 0.8)
  s.poly(s.circle([X1 - 8, Y1, G + 9], X, Zd, 0, 0, 2.2, 20), 'top', 'line', undefined, 0.8)
  // Feed side: the slot under a tear bar.
  const T0 = 15, T1 = 37, SZ = G + 11
  s.poly([[X1, T0 - 2, SZ + 1.6], [X1, T1 + 2, SZ + 1.6], [X1, T1 + 2, SZ - 1.2], [X1, T0 - 2, SZ - 1.2]], 'glass', 'line', undefined, 0.8)
  s.line([[X1, T0 - 3, SZ + 3.4], [X1, T1 + 3, SZ + 3.4]], 'line', 1.4)
  // The tag: out of the slot, down onto the counter, flat, with the free end lifting where the roll curled it.
  const Z = G + 0.3, END = 140
  const bez = (t: number, a: Pt, b: Pt, c: Pt, d: Pt): Pt => {
    const u = 1 - t
    return [0, 1].map((i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i]) as unknown as Pt
  }
  const prof: Pt[] = [
    ...Array.from({ length: 13 }, (_, i) => bez(i / 12, [X1, SZ], [X1 + 9, SZ], [X1 + 9, Z], [X1 + 20, Z])),
    ...Array.from({ length: 7 }, (_, i) => bez((i + 1) / 7, [END - 10, Z], [END - 4, Z], [END - 1, Z + 0.6], [END + 1, Z + 3.2])),
  ]
  s.poly(flat([[X1 + 2, T0 + 1.5], [END, T0 + 1.5], [END, T1 + 2], [X1 + 2, T1 + 2]], G), 'shadow', 'none')
  const quads = prof.slice(1).map((q, i): P3[] => {
    const p = prof[i]
    return [[p[0], T0, p[1]], [q[0], T0, q[1]], [q[0], T1, q[1]], [p[0], T1, p[1]]]
  })
  s.group('tag', () => {
    s.glow(4, () => quads.forEach((q) => s.poly(q, 'accent', 'none')))
    quads.forEach((q) => s.poly(q, 'accent', 'accent'))
    // Print: the leader's code large, the count beside it, a barcode toward the end.
    const P0 = (u: number, v: number, z: number): P3 => [u, v, z]
    const CX = X1 + 23, BAR = END - 18
    const size = fitSize(code, BAR - 6 - CX - (count === undefined ? 0 : 14), 16)
    const mid = (CX + BAR - 6 - (count === undefined ? 0 : 14)) / 2
    flatText(s, P0, 0, code, mid, (T0 + T1) / 2, Z, { size, fill: 'on-accent', weight: 700, anchor: 'middle' })
    if (count !== undefined)
      flatText(s, P0, 0, `×${count}`, BAR - 4, (T0 + T1) / 2 + size * 0.3 - 2.6, Z, { size: 7, fill: 'on-accent', weight: 700, anchor: 'end' })
    const bars = [1.4, 0.7, 1.4, 0.7, 0.7, 1.4, 0.7]
    s.segs(bars.map((_, i) => [[BAR + i * 2.2, T0 + 3.5, Z], [BAR + i * 2.2, T1 - 3.5, Z]] as P3[]), 'on-accent', 1)
  })
  return s.done()
}

// ── Rankings F: the gate, with its lit sign above the jet-bridge door; the sign shows the leader's code.
export type GateOpts = { code?: string }
export function gateSign(k: number, { code = 'QR' }: GateOpts = {}) {
  const s = new Scene(k)
  const G = 2, W = 104, WD = 5, WH = 58
  // Floor, then the wall the jet bridge docks to.
  s.poly(flat([[-8, -6], [136, -6], [136, 64], [-8, 64]], 0), 'shadow', 'none')
  s.rbox(-6, -4, 0, 140, 66, G, 3, { top: 'front' })
  s.poly(flat([[1, WD], [W + 3, WD], [W + 3, WD + 3], [1, WD + 3]], G), 'shadow', 'none')
  s.box(0, 0, G, W, WD, WH)
  // The jet-bridge door: frame, two glass leaves, push bars.
  const F = WD, DL = 20, DR = 48, DH = G + 34
  const front = (pts: readonly Pt[], y = F): P3[] => pts.map(([x, z]) => [x, y, z])
  s.poly(front([[DL - 2.5, DH + 2.5], [DR + 2.5, DH + 2.5], [DR + 2.5, G], [DL - 2.5, G]]), 'top', 'line')
  s.poly(front([[DL, DH], [DR, DH], [DR, G], [DL, G]]), 'glass', 'line')
  s.line(front([[(DL + DR) / 2, DH], [(DL + DR) / 2, G]]), 'line', 0.8)
  s.segs([[DL + 3, (DL + DR) / 2 - 3], [(DL + DR) / 2 + 3, DR - 3]].map(([a, b]) => front([[a, G + 15], [b, G + 15]])), 'detail', 1.2)
  // Terminal glazing to the right of the door, three panes.
  const WL = 66, WR = 98, WB = G + 12, WT = G + 37
  s.poly(front([[WL, WT], [WR, WT], [WR, WB], [WL, WB]]), 'glass', 'line')
  s.segs([1, 2].map((i) => front([[WL + ((WR - WL) * i) / 3, WT], [WL + ((WR - WL) * i) / 3, WB]])), 'line', 0.8)
  // The sign above it: a housing on the wall, its lit face, the code centred.
  const SL = 6, SR = 62, SZ = G + 40, SH = 17, SD = 4
  s.box(SL, F, SZ, SR - SL, SD, SH)
  const face = front([[SL + 1.6, SZ + SH - 1.6], [SR - 1.6, SZ + SH - 1.6], [SR - 1.6, SZ + 1.6], [SL + 1.6, SZ + 1.6]], F + SD)
  s.group('sign', () => {
    s.lit(face, 4)
    const size = fitSize(code, SR - SL - 10, 12)
    s.text(code, [(SL + SR) / 2, F + SD, SZ + SH / 2 - size * 0.36], X, Zd, { size, fill: 'on-accent', weight: 700, mono: true, anchor: 'middle' })
  })
  // The podium: a desk with an overhanging top and a pass reader.
  s.poly(flat([[73, 21], [101, 21], [101, 38], [73, 38]], G), 'shadow', 'none')
  s.box(72, 20, G, 26, 15, 21)
  s.box(70, 18, G + 21, 30, 19, 2.4)
  s.box(86, 23, G + 23.4, 8, 7, 3)
  s.poly([[87, 30, G + 25.6], [93, 30, G + 25.6], [93, 30, G + 24], [87, 30, G + 24]], 'glass', 'line', undefined, 0.6)
  s.line([[74, 35, G + 15], [96, 35, G + 15]], 'detail', 0.7)
  // Queue posts and their belt.
  const post = (x: number, y: number) => {
    s.poly(flat([[x - 3, y - 3], [x + 5.5, y - 3], [x + 5.5, y + 5.5], [x - 3, y + 5.5]], G), 'shadow', 'none')
    cylinder(s, x, y, 4, G, G + 1.4)
    cylinder(s, x, y, 1.3, G + 1.4, G + 20)
  }
  post(16, 52)
  s.line([[16, 52, G + 18], [52, 52, G + 18]], 'detail', 2)
  post(52, 52)
  return s.done()
}

/** The rest pose at its fitted k and box, then the same scale and box with another code: the pick never rescales the figure. */
function variants<O>(build: (k: number, o?: O) => IsoFigureData, base: string, keys: Record<string, O>) {
  const k = Math.min(1.8, fitBox(FIG_W, FIG_H, (kk) => build(kk)))
  const rest = build(k)
  return Object.fromEntries(Object.entries(keys).map(([key, o]) => [`${base}${key}`, () => {
    const fig = build(k, o)
    return { ...fig, viewBox: rest.viewBox, width: rest.width, height: rest.height }
  }]))
}

export const figures: Record<string, () => IsoFigureData> = {
  'rankings-e-bagtag': fit((k) => bagTagPrinter(k)),
  ...variants<TagOpts>(bagTagPrinter, 'rankings-e-bagtag', { '-doh': { code: 'DOH' }, '-route': { code: 'ROV–VKO' } }),
  'rankings-f-gate': fit((k) => gateSign(k)),
  ...variants<GateOpts>(gateSign, 'rankings-f-gate', { '-doh': { code: 'DOH' }, '-route': { code: 'ROV–VKO' } }),
}
