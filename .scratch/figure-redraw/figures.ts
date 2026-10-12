// Redraw studies: two ideas each for Rhythm, Rankings, Crossings and Makers, on the app's iso kernel, fitted to the 300×160 figure stage.
import { Scene, fitBox, hull, roundRect, type IsoFigureData, type P3, type Paint, type Pt } from '../../apps/next/src/client/overview/iso/scene'

export const FIG_W = 300, FIG_H = 160
export const fit = (build: (k: number) => IsoFigureData) => () => build(Math.min(1.8, fitBox(FIG_W, FIG_H, build)))
export const MONTHS = [6, 2, 11, 6, 3, 2, 5, 0, 5, 6, 4, 7]
export const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export const X: P3 = [1, 0, 0], Y: P3 = [0, 1, 0], Zd: P3 = [0, 0, -1]
export const rad = (d: number) => (d * Math.PI) / 180

/** Plan rectangle turned by `deg` about (cx, cy); returns a plan → 3D mapper at height z. */
export function turned(cx: number, cy: number, deg: number) {
  const c = Math.cos(rad(deg)), q = Math.sin(rad(deg))
  return (u: number, v: number, z: number): P3 => [cx + u * c - v * q, cy + u * q + v * c, z]
}
/** Box turned in plan: visible walls (outward normal toward the viewer) then the top. */
export function obox(s: Scene, cx: number, cy: number, z: number, w: number, d: number, h: number, deg: number, f: { top?: Paint; front?: Paint; side?: Paint; stroke?: Paint } = {}) {
  const at = turned(cx, cy, deg)
  const c: Pt[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
  c.forEach(([u0, v0], i) => {
    const [u1, v1] = c[(i + 1) % 4]
    const p0 = at(u0, v0, z), p1 = at(u1, v1, z)
    const nx = p1[1] - p0[1], ny = p0[0] - p1[0]
    if (nx + ny <= 1e-6) return
    s.poly([at(u0, v0, z + h), at(u1, v1, z + h), p1, p0], nx > ny ? (f.side ?? 'side') : (f.front ?? 'front'), f.stroke)
  })
  s.poly(c.map(([u, v]) => at(u, v, z + h)), f.top ?? 'top', f.stroke)
  return at
}
/** Upright disc wall + top, centre (x, y), radius r, from z0 to z1. */
export function cylinder(s: Scene, x: number, y: number, r: number, z0: number, z1: number, f: { top?: Paint; wall?: Paint } = {}) {
  const a = s.circle([x, y, z0], X, Y, 0, 0, r, 48), b = s.circle([x, y, z1], X, Y, 0, 0, r, 48)
  s.poly2(hull(s.pp([...a, ...b])), f.wall ?? 'front', 'line')
  s.poly(b, f.top ?? 'top', 'line')
}
/** Plan polygon at height z. */
export const flat = (pts: readonly Pt[], z: number): P3[] => pts.map(([x, y]) => [x, y, z])
/** Text lying on a plan rectangle turned by deg, centred at (u, v) of that rectangle. */
export function flatText(s: Scene, at: (u: number, v: number, z: number) => P3, deg: number, text: string, u: number, v: number, z: number, o: { size: number; fill?: Paint; weight?: number; mono?: boolean; anchor?: 'start' | 'middle' | 'end' }) {
  const c = Math.cos(rad(deg)), q = Math.sin(rad(deg))
  s.text(text, at(u, v + o.size * 0.36, z), [c, q, 0], [-q, c, 0], { size: o.size, fill: o.fill ?? 'ink', weight: o.weight ?? 600, mono: o.mono ?? true, anchor: o.anchor ?? 'middle' })
}

// ── Rhythm A: an open passport, one stamp per busy month; March's is the coral one.
function passport(k: number) {
  const s = new Scene(k)
  s.poly(flat([[-6, -6], [130, -6], [130, 94], [-6, 94]], 0), 'shadow', 'none')
  s.rbox(-3, -3, 0, 128, 92, 2.5, 4, { top: 'side', wall: 'side', side: 'side' })
  s.rbox(0, 0, 2.5, 60, 86, 2.5, 2)
  s.rbox(62, 0, 2.5, 60, 86, 2.5, 2)
  const Z = 5
  s.line([[61, 1, Z - 0.5], [61, 85, Z - 0.5]], 'detail')
  // Page print: the faint security lines a passport page carries.
  for (const v of [16, 30, 44, 58, 72]) {
    s.line([[5, v, Z], [55, v, Z]], 'detail', 0.6, '1 2.5')
    s.line([[67, v, Z], [117, v, Z]], 'detail', 0.6, '1 2.5')
  }
  const P0 = (u: number, v: number, z: number): P3 => [u, v, z]
  flatText(s, P0, 0, 'VISAS', 30, 8, Z, { size: 5, fill: 'muted', weight: 600 })
  flatText(s, P0, 0, '14', 92, 8, Z, { size: 5, fill: 'muted', weight: 600 })
  // Ink stamps for other months: outlines only.
  const ring = (cx: number, cy: number, r: number, label: string) => {
    s.poly(s.circle([cx, cy, Z], X, Y, 0, 0, r, 40), 'none', 'line', 0.7)
    s.poly(s.circle([cx, cy, Z], X, Y, 0, 0, r - 2.2, 40), 'none', 'line', 0.4)
    flatText(s, P0, 0, label, cx, cy, Z, { size: 6, fill: 'muted' })
  }
  const rect = (cx: number, cy: number, w: number, h: number, deg: number, label: string) => {
    const at = turned(cx, cy, deg)
    s.poly([at(-w / 2, -h / 2, Z), at(w / 2, -h / 2, Z), at(w / 2, h / 2, Z), at(-w / 2, h / 2, Z)], 'none', 'line', 0.7)
    flatText(s, at, deg, label, 0, 0, Z, { size: 6, fill: 'muted' })
  }
  ring(18, 30, 11, 'JAN')
  rect(40, 62, 30, 16, 9, 'DEC')
  ring(100, 70, 10, 'OCT')
  rect(16, 66, 22, 13, -6, 'APR')
  // March: a filled coral stamp with the month and its count.
  const at = turned(88, 34, -7)
  s.poly([at(-21, -14, Z), at(21, -14, Z), at(21, 14, Z), at(-21, 14, Z)], 'accent', 'accent')
  s.poly([at(-18.5, -11.5, Z), at(18.5, -11.5, Z), at(18.5, 11.5, Z), at(-18.5, 11.5, Z)], 'none', 'on-accent', 0.8)
  flatText(s, at, -7, 'MAR', 0, -2.5, Z, { size: 11, fill: 'on-accent', weight: 700 })
  flatText(s, at, -7, '11 FLIGHTS', 0, 6.5, Z, { size: 4.6, fill: 'on-accent', weight: 600 })
  return s.done()
}

// ── Rhythm B: a baggage carousel; twelve bags in month order, sized by flights. March is the coral one, August an empty slot.
function carousel(k: number) {
  const s = new Scene(k)
  const L = 184, R = 36, BW = 21
  const stad = (r: number): Pt[] => roundRect(R - r, R - r, L - 2 * (R - r), 2 * r, r, 14)
  s.poly(flat(stad(R + 5).map(([x, y]) => [x, y + 3] as Pt), 0), 'shadow', 'none')
  s.rbox(0, 0, 0, L, 2 * R, 7, R - 0.01, { top: 'top' })
  // Belt slats: radial seams across the belt, then the island.
  const along = (r: number, t: number): [number, number, number] => {
    const straight = L - 2 * R, per = 2 * straight + 2 * Math.PI * r
    let d = (((t % 1) + 1) % 1) * per
    if (d < straight) return [R + d, R + r, 0]
    d -= straight
    if (d < Math.PI * r) { const a = Math.PI / 2 - d / r; return [L - R + r * Math.cos(a), R + r * Math.sin(a), a - Math.PI / 2] }
    d -= Math.PI * r
    if (d < straight) return [L - R - d, R - r, Math.PI]
    d -= straight
    const a = -Math.PI / 2 - d / r
    return [R + r * Math.cos(a), R + r * Math.sin(a), a - Math.PI / 2]
  }
  const seams: P3[][] = []
  for (let i = 0; i < 44; i++) {
    const t = i / 44
    const [x0, y0] = along(R - 1, t), [x1, y1] = along(R - BW + 1, t)
    seams.push([[x0, y0, 7], [x1, y1, 7]])
  }
  s.segs(seams, 'detail', 0.6)
  s.poly(flat(stad(R - BW), 7), 'side', 'line')
  s.poly(flat(stad(R - BW - 4), 7.01), 'front', 'detail', 0.8)
  // Bags start at the near straight, January at the left, and run clockwise.
  const bags = MONTHS.map((n, i) => {
    const [x, y, a] = along(R - BW / 2, 0.06 + i / 12)
    return { n, i, x, y, a }
  }).sort((p, q) => p.x + p.y - (q.x + q.y))
  for (const b of bags) {
    if (!b.n) continue
    const w = 10 + b.n * 1.15, d = 8 + b.n * 0.55, h = 3 + b.n * 0.9
    const deg = (b.a * 180) / Math.PI
    const hot = b.i === 2
    const at = obox(s, b.x, b.y, 7, w, d, h, deg, hot ? { top: 'accent', front: 'accent-side', side: 'accent-side', stroke: 'line' } : {})
    s.line([at(-w * 0.2, 0, 7 + h), at(-w * 0.2, 0, 7 + h + 1.6), at(w * 0.2, 0, 7 + h + 1.6), at(w * 0.2, 0, 7 + h)], hot ? 'on-accent' : 'line', 0.9)
    if (hot) flatText(s, at, deg, 'MAR', 0, d * 0.24, 7 + h, { size: 6, fill: 'on-accent', weight: 700 })
  }
  return s.done()
}

// ── Rankings A: airline tail fins on a display rail, height by flights; the tie leaders stand equal and Pegasus is lit.
export const AIRLINES = [{ code: 'PC', n: 4 }, { code: 'QR', n: 4 }, { code: '3F', n: 3 }, { code: 'SU', n: 2 }, { code: 'TK', n: 1 }]
function tails(k: number) {
  const s = new Scene(k)
  const GAP = 40, D = 6
  s.poly(flat([[-8, -6], [AIRLINES.length * GAP + 8, -6], [AIRLINES.length * GAP + 8, 22], [-8, 22]], 0), 'shadow', 'none')
  s.rbox(-4, 0, 0, AIRLINES.length * GAP + 4, 16, 5, 2)
  AIRLINES.forEach(({ code, n }, i) => {
    const x0 = i * GAP, H = 18 + n * 13, hot = i === 0
    const prof: Pt[] = [[x0, 5], [x0 + 36, 5], [x0 + 38, 5 + H], [x0 + 26, 5 + H]]
    s.prism(prof, 6, D, hot ? { front: 'accent', top: 'accent-side', side: 'accent-side' } : {})
    // Rudder hinge and the airline code, printed on the fin's near face.
    const y = 6 + D
    s.line([[x0 + 31, y, 5], [x0 + 32, y, 5 + H * 0.92]], hot ? 'on-accent' : 'detail', 0.7)
    s.text(code, [x0 + 14 + H * 0.1, y, 5 + H * 0.36], X, Zd, { size: 11, fill: hot ? 'on-accent' : 'ink', weight: 700, mono: true, anchor: 'middle' })
  })
  return s.done()
}

// ── Rankings B: airsick bags, crimped at the top, each printed with its airline; the leaders' bags are the tallest and Pegasus's is coral.
function sickBags(k: number) {
  const s = new Scene(k)
  const top3 = AIRLINES.slice(0, 3), GAP = 34, W = 26, D = 14
  s.poly(flat([[-6, -4], [top3.length * GAP + 2, -4], [top3.length * GAP + 2, D + 8], [-6, D + 8]], 0), 'shadow', 'none')
  ;[...top3].reverse().forEach(({ code, n }, j) => {
    const i = top3.length - 1 - j, hot = i === 0
    const x0 = i * GAP, H = 30 + n * 9
    s.box(x0, 0, 0, W, D, H, hot ? { front: 'accent', side: 'accent-side', top: 'accent-side' } : {})
    // Folded lip: a thinner strip on top, its edge crimped.
    s.box(x0, D * 0.35, H, W, D * 0.3, 7, hot ? { front: 'accent', side: 'accent-side', top: 'accent-side' } : {})
    const crimp: P3[] = []
    for (let q = 0; q <= 13; q++) crimp.push([x0 + (W * q) / 13, D * 0.65, H + 7 - (q % 2) * 1.6])
    s.line(crimp, hot ? 'on-accent' : 'line', 0.7)
    s.line([[x0 + 2, D, H - 4], [x0 + W - 2, D, H - 4]], hot ? 'on-accent' : 'detail', 0.6, '1.5 1.5')
    const ink: Paint = hot ? 'on-accent' : 'ink'
    s.text(code, [x0 + W / 2, D, H * 0.55], X, Zd, { size: 10, fill: ink, weight: 700, mono: true, anchor: 'middle' })
    s.text(`${n} FLIGHTS`, [x0 + W / 2, D, H * 0.55 - 7], X, Zd, { size: 3.6, fill: hot ? 'on-accent' : 'muted', weight: 600, mono: true, anchor: 'middle' })
    s.text('FOR MOTION', [x0 + W / 2, D, 9], X, Zd, { size: 2.9, fill: hot ? 'on-accent' : 'muted', weight: 500, mono: true, anchor: 'middle' })
    s.text('SICKNESS', [x0 + W / 2, D, 5.4], X, Zd, { size: 2.9, fill: hot ? 'on-accent' : 'muted', weight: 500, mono: true, anchor: 'middle' })
  })
  return s.done()
}

// ── Crossings A: a world-time dial lying flat; 24 hourly offsets round the bezel, the 7 reached ones in coral, forward and back arcs inside.
export const REACHED = new Set([0, 1, 2, 3, 4, 5, 9])
function worldDial(k: number) {
  const s = new Scene(k)
  const O = 60, Rr = 58, T = 7
  s.poly(s.circle([O + 4, O + 5, 0], X, Y, 0, 0, Rr + 4, 48), 'shadow', 'none')
  cylinder(s, O, O, Rr, 0, T, { wall: 'side' })
  const ang = (o: number) => rad((o / 24) * 360 - 135)
  const pt = (r: number, a: number, z = T): P3 => [O + r * Math.cos(a), O + r * Math.sin(a), z]
  for (let o = -11; o <= 12; o++) {
    const a0 = ang(o - 0.5) + 0.02, a1 = ang(o + 0.5) - 0.02
    const arc = (r: number) => Array.from({ length: 5 }, (_, j) => pt(r, a0 + ((a1 - a0) * j) / 4))
    const hot = REACHED.has(o)
    s.poly([...arc(Rr - 2), ...arc(Rr - 13).reverse()], hot ? 'accent' : 'ghost', hot ? 'accent' : 'detail', undefined, 0.6)
  }
  s.poly(s.circle([O, O, T], X, Y, 0, 0, Rr - 15, 48), 'glass', 'line')
  for (const o of [-6, 0, 6, 12]) {
    const [x, y] = pt(Rr - 22, ang(o))
    s.text(o > 0 ? `+${o}` : String(o), [x, y + 2, T], X, Y, { size: 6, fill: 'muted', weight: 600, mono: true, anchor: 'middle' })
  }
  // Forward arc (coral, clockwise) and back arc (ghost), as far as the hours shifted.
  const sweep = (r: number, from: number, to: number, paint: Paint) =>
    s.line(Array.from({ length: 33 }, (_, j) => pt(r, from + ((to - from) * j) / 32)), paint, 2.2)
  sweep(Rr - 30, ang(0), ang(0) + rad((39 / 82) * 300), 'accent')
  sweep(Rr - 34, ang(0), ang(0) - rad((43 / 82) * 300), 'line')
  cylinder(s, O, O, 4, T, T + 2.5)
  s.text('+39 h', [O + 9, O - 4, T], X, Y, { size: 5.5, fill: 'accent', weight: 700, mono: true, anchor: 'start' })
  s.text('−43 h', [O - 10, O + 8, T], X, Y, { size: 5.5, fill: 'muted', weight: 700, mono: true, anchor: 'start' })
  return s.done()
}

// ── Crossings B: a hotel "Do not disturb" hanger on a door lever; the hours shifted are the fine print.
function doorHanger(k: number) {
  const s = new Scene(k)
  const DW = 92, DH = 124, DT = 5
  // Door leaf, seen from its edge side, with a frame strip.
  s.poly(flat([[-8, DT], [DW + 10, DT], [DW + 10, DT + 26], [-8, DT + 26]], 0), 'shadow', 'none')
  s.box(0, 0, 0, DW, DT, DH, { front: 'front', side: 'side', top: 'top' })
  s.box(DW, -2, 0, 5, DT + 4, DH + 4, { front: 'side', side: 'side', top: 'top' })
  for (const [u0, z0, u1, z1] of [[10, 70, 80, 112], [10, 10, 80, 60]] as const)
    s.poly([[u0, DT, z1], [u1, DT, z1], [u1, DT, z0], [u0, DT, z0]], 'none', 'detail', 0.8)
  // Lever rosette and lever.
  const hx = 66, hz = 80
  s.poly(s.circle([hx, DT, hz], X, Zd, 0, 0, 4, 28), 'top', 'line')
  s.box(hx - 16, DT + 1, hz - 1.4, 16, 5, 2.8, { front: 'top', side: 'top', top: 'top' })
  // The hanger hangs from the lever, nearly flat against the door, its top a ring round the lever.
  const y = DT + 3.5
  const W = 42, H = 84, top = hz + 7
  const card: P3[] = [[hx - 5 - W / 2, y, top], [hx - 5 + W / 2, y, top], [hx - 5 + W / 2, y, top - H], [hx - 5 - W / 2, y, top - H]]
  s.poly(card, 'accent', 'accent')
  s.poly(s.circle([hx - 5, y, hz], X, Zd, 0, 0, 5.2, 28), 'front', 'on-accent', 0.8)
  s.poly(s.circle([hx - 8.5, y, hz - 1.5], X, Zd, 0, 0, 2.2, 20), 'top', 'line')
  const tx = hx - 5
  s.text('DO NOT', [tx, y, hz - 18], X, Zd, { size: 9, fill: 'on-accent', weight: 700, mono: true, anchor: 'middle' })
  s.text('DISTURB', [tx, y, hz - 29], X, Zd, { size: 9, fill: 'on-accent', weight: 700, mono: true, anchor: 'middle' })
  s.line([[tx - 13, y, hz - 38], [tx + 13, y, hz - 38]], 'on-accent', 0.7)
  s.text('CLOCKS SHIFTED', [tx, y, hz - 47], X, Zd, { size: 4.4, fill: 'on-accent', weight: 600, mono: true, anchor: 'middle' })
  s.text('+39 h  −43 h', [tx, y, hz - 56], X, Zd, { size: 5.6, fill: 'on-accent', weight: 700, mono: true, anchor: 'middle' })
  return s.done()
}

// ── Makers A: the seat-pocket safety card, AIRBUS on the cover strip, a Boeing card tucked behind it.
function safetyCard(k: number) {
  const s = new Scene(k)
  const W = 62, Lc = 100, Z = 1.6
  s.poly(flat([[-12, -10], [W + 30, -10], [W + 30, Lc + 6], [-12, Lc + 6]], 0), 'shadow', 'none')
  const card = (cx: number, cy: number, deg: number, z: number, maker: string, hot: boolean) => {
    const at = obox(s, cx, cy, z, W, Lc, Z, deg)
    const strip = (v0: number, v1: number) => [at(-W / 2, v0, z + Z), at(W / 2, v0, z + Z), at(W / 2, v1, z + Z), at(-W / 2, v1, z + Z)]
    s.poly(strip(-Lc / 2, -Lc / 2 + 17), hot ? 'accent' : 'ghost', hot ? 'accent' : 'line')
    flatText(s, at, deg, maker, -W / 2 + 5, -Lc / 2 + 8.5, z + Z, { size: 8, fill: hot ? 'on-accent' : 'muted', weight: 700, anchor: 'start' })
    return at
  }
  card(W / 2 + 40, Lc / 2 - 26, -18, 0, 'BOEING', false)
  const deg = 4, at = card(W / 2, Lc / 2, deg, Z, 'AIRBUS', true), z = 2 * Z
  flatText(s, at, deg, 'SAFETY ON BOARD', -W / 2 + 5, -Lc / 2 + 23, z, { size: 3.6, fill: 'muted', weight: 600, anchor: 'start' })
  // A top-view twinjet and the exit plan: the card's real job.
  const plane: Pt[] = [[0, -22], [2.6, -17], [2.6, -5], [21, 4], [21, 7], [2.6, 3], [2.6, 14], [8, 18.5], [8, 20.5], [0, 18], [-8, 20.5], [-8, 18.5], [-2.6, 14], [-2.6, 3], [-21, 7], [-21, 4], [-2.6, -5], [-2.6, -17]]
  s.poly(plane.map(([u, v]) => at(u, v + 8, z)), 'top', 'line', undefined, 0.8)
  for (const [u, v] of [[-4.5, -9], [4.5, -9], [-4.5, 9], [4.5, 9]] as const) {
    s.line([at(u, v + 8, z), at(u * 2.6, v + 8, z)], 'accent', 1.1)
    s.poly([at(u * 2.6, v + 6.8, z), at(u * 2.6 + Math.sign(u) * 2.4, v + 8, z), at(u * 2.6, v + 9.2, z)], 'accent', 'accent')
  }
  for (let r = 0; r < 3; r++) s.poly([at(-W / 2 + 5 + r * 18, Lc / 2 - 13, z), at(-W / 2 + 19 + r * 18, Lc / 2 - 13, z), at(-W / 2 + 19 + r * 18, Lc / 2 - 5, z), at(-W / 2 + 5 + r * 18, Lc / 2 - 5, z)], 'none', 'detail', undefined, 0.7)
  return s.done()
}

// ── Makers B: a cabin seat block where every seat is a tenth of flights: six Airbus seats in coral, three Boeing, one other.
function seats(k: number) {
  const s = new Scene(k)
  const SW = 17, GAP = 1.5, AISLE = 10, ROW = 30
  const makers: ('airbus' | 'boeing' | 'other')[] = ['airbus', 'airbus', 'airbus', 'airbus', 'airbus', 'airbus', 'boeing', 'boeing', 'boeing', 'other']
  const xs = [0, 1, 2, 3, 4].map((i) => i * (SW + GAP) + (i >= 3 ? AISLE : 0))
  const span = xs[4] + SW
  s.poly(flat([[-5, -4], [span + 5, -4], [span + 5, 2 * ROW + 2], [-5, 2 * ROW + 2]], 0), 'shadow', 'none')
  // Seats face +y, toward the viewer; the back row first, and within a row from the far end.
  for (const row of [0, 1])
    for (const i of [0, 1, 2, 3, 4]) {
      const m = makers[(1 - row) * 5 + i]
      const y0 = row * ROW, x0 = xs[i]
      const f: { top?: Paint; front?: Paint; side?: Paint } =
        m === 'airbus' ? { top: 'accent', front: 'accent', side: 'accent-side' } : m === 'other' ? { top: 'glass', front: 'glass', side: 'glass' } : {}
      s.box(x0 + SW / 2 - 2, y0 + 10, 0, 4, 4, 8, { front: 'side', side: 'side', top: 'side' })
      s.box(x0, y0, 8, SW, 5, 26, f)
      s.box(x0 + 1, y0 + 5, 8, SW - 2, 15, 5, f)
      s.box(x0 + SW - 1.2, y0 + 4, 13, 1.6, 15, 2, {})
      if (m === 'airbus') s.poly([[x0 + 3, y0 + 5, 29], [x0 + SW - 3, y0 + 5, 29], [x0 + SW - 3, y0 + 5, 24], [x0 + 3, y0 + 5, 24]], 'accent-plate', 'none')
    }
  return s.done()
}

export const figures: Record<string, () => IsoFigureData> = {
  'rhythm-a-passport': fit(passport),
  'rhythm-b-carousel': fit(carousel),
  'rankings-a-tails': fit(tails),
  'rankings-b-sickbags': fit(sickBags),
  'crossings-a-dial': fit(worldDial),
  'crossings-b-hanger': fit(doorHanger),
  'makers-a-safety-card': fit(safetyCard),
  'makers-b-seats': fit(seats),
}
