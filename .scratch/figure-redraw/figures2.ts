// Redraw studies, round 2: two more ideas each for Rhythm, Rankings, Crossings and Aircraft.
import { Scene, hull, roundRect, type IsoFigureData, type P3, type Paint, type Pt } from '../../apps/next/src/client/overview/iso/scene'
import { AIRLINES, MON, MONTHS, REACHED, X, Y, Zd, fit, flat, flatText } from './figures'

export const Zu: P3 = [0, 0, 1]
const MON1 = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/** The part of a convex (x, z) outline at or above z = cut (Sutherland–Hodgman against one edge). */
export function above(pts: readonly Pt[], cut: number): Pt[] {
  const out: Pt[] = []
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const pin = p[1] >= cut, qin = q[1] >= cut
    if (pin) out.push(p)
    if (pin !== qin) {
      const t = (cut - p[1]) / (q[1] - p[1])
      out.push([p[0] + t * (q[0] - p[0]), cut])
    }
  })
  return out
}

// ── Rhythm C: a cabin wall of twelve windows, one per month; each shade is raised as far as that month's flights. March is wide open and lit.
function shades(k: number) {
  const s = new Scene(k)
  const PITCH = 18, L = 12 * PITCH + 8, H = 44, T = 5
  s.poly(flat([[-4, T], [L + 6, T], [L + 6, T + 14], [-4, T + 14]], 0), 'shadow', 'none')
  s.box(0, 0, 0, L, T, H)
  const onF = (pts: readonly Pt[], y = T): P3[] => pts.map(([x, z]) => [x, y, z])
  const max = Math.max(...MONTHS)
  MONTHS.forEach((n, i) => {
    const x = 6 + i * PITCH, w = 13, z0 = 14, h = 23, hot = i === 2
    s.poly(onF(roundRect(x - 1.8, z0 - 1.8, w + 3.6, h + 3.6, 7.2)), 'top', 'line')
    const win = roundRect(x, z0, w, h, 5.8)
    s.poly(onF(win), hot ? 'accent' : 'glass', 'line')
    const cut = z0 + (h * n) / max
    const shade = above(win, cut)
    if (shade.length > 2) s.poly(onF(shade), 'detail', 'line', undefined, 0.8)
    if (n < max) s.line([[x + w / 2 - 2, T, cut + 1.5], [x + w / 2 + 2, T, cut + 1.5]], 'line', 1.2)
    s.text(MON1[i], [x + w / 2, T, 4.5], X, Zd, { size: 6.5, fill: hot ? 'accent' : 'muted', weight: 700, mono: true, anchor: 'middle' })
  })
  return s.done()
}

// ── Rhythm D: the passport-control date stamper; its month band reads MAR, and its last impression sits beside it.
export type StampOpts = { month?: number; flights?: number; press?: number; ink?: number; printed?: [number, number] }
/** month: band index into MON; press: how far the head is pushed down; ink: impression opacity (0 lifts it);
 *  printed: the impression's month and count when it still shows an earlier stamp. */
export function stamper(k: number, { month = 2, flights = 11, press = 0, ink = 0.9, printed = [month, flights] }: StampOpts = {}) {
  const s = new Scene(k)
  s.poly(flat([[-6, -4], [108, -4], [108, 60], [-6, 60]], 0), 'shadow', 'none')
  s.rbox(-2, -2, 0, 106, 58, 0.6, 1.5)
  const Z = 0.6
  // Impression: coral ink, double frame.
  const P0 = (u: number, v: number, z: number): P3 => [u, v, z]
  const frame = (w: number, d: number) => s.poly(flat([[76 - w, 26 - d], [76 + w, 26 - d], [76 + w, 26 + d], [76 - w, 26 + d]], Z), 'none', 'accent', undefined, ink)
  if (ink > 0) {
    frame(20, 13)
    frame(17.5, 10.5)
    flatText(s, P0, 0, MON[printed[0]], 76, 23.5, Z, { size: 11, fill: 'accent', weight: 700 })
    flatText(s, P0, 0, `${printed[1]} FLIGHTS`, 76, 32, Z, { size: 4.4, fill: 'accent', weight: 600 })
  }
  // The stamper: base, far arm, band housing, near arm, crossbar, knob.
  s.box(4, 10, Z, 36, 28, 5)
  // Pressing pushes the head (housing, arms' tops, crossbar, knob) down; the base stays on the paper.
  const H = Z - press, near = (m: number) => MON[(m + 12) % 12]
  s.box(4, 20, Z + 5, 3, 8, 34 - press)
  s.box(10, 14, H + 5 + press, 24, 20, 21 - press)
  const F = 34
  s.poly([[12, F, H + 25], [32, F, H + 25], [32, F, H + 7.5 + press], [12, F, H + 7.5 + press]], 'glass', 'line')
  s.text(near(month - 1), [22, F, H + 21.6], X, Zd, { size: 4.6, fill: 'muted', weight: 700, mono: true, anchor: 'middle' })
  s.poly([[12.8, F, H + 19.2], [31.2, F, H + 19.2], [31.2, F, H + 13], [12.8, F, H + 13]], 'accent', 'accent')
  s.text(near(month), [22, F, H + 14.3], X, Zd, { size: 6.4, fill: 'on-accent', weight: 700, mono: true, anchor: 'middle' })
  if (press < 1) s.text(near(month + 1), [22, F, H + 8.6], X, Zd, { size: 4.6, fill: 'muted', weight: 700, mono: true, anchor: 'middle' })
  s.box(37, 20, Z + 5, 3, 8, 34 - press)
  s.box(4, 20, H + 39, 36, 8, 3)
  const knob = (r: number, z0: number, z1: number) => {
    const a = s.circle([22, 24, z0], X, Y, 0, 0, r, 40), b = s.circle([22, 24, z1], X, Y, 0, 0, r, 40)
    s.poly2(hull(s.pp([...a, ...b])), 'front', 'line')
    s.poly(b, 'top', 'line')
  }
  knob(2.6, H + 42, H + 48)
  knob(8, H + 48, H + 55)
  return s.done()
}

// ── Rankings C: frequent-flyer cards standing in a wallet, stepped by flights; Pegasus is the coral card, Qatar level with it behind.
function wallet(k: number) {
  const s = new Scene(k)
  const order = [AIRLINES[1], AIRLINES[0], AIRLINES[2], AIRLINES[3], AIRLINES[4]]
  const CW = 54, PD = 14, PH = 24, STEP = 14, W = 8 + 4 * STEP + CW
  s.poly(flat([[-4, -3], [W + 4, -3], [W + 4, PD + 6], [-4, PD + 6]], 0), 'shadow', 'none')
  s.box(0, 0, 0, W, 1.6, PH, { front: 'side' })
  s.box(0, 0, 0, 1.6, PD, PH, { front: 'side' })
  order.forEach(({ code, n }, i) => {
    const hot = code === 'PC'
    const x = 4 + i * STEP, y = 2.4 + i * 2.2, H = PH + 4 + n * 9
    s.box(x, y, 0, CW, 0.8, H, hot ? { front: 'accent', side: 'accent-side', top: 'accent' } : {})
    const yf = y + 0.8, ink: Paint = hot ? 'on-accent' : 'ink'
    s.text(code, [x + 2.6, yf, H - 7.5], X, Zd, { size: 7, fill: ink, weight: 700, mono: true })
    s.poly([[x + CW - 13, yf, H - 3], [x + CW - 4, yf, H - 3], [x + CW - 4, yf, H - 9.5], [x + CW - 13, yf, H - 9.5]], hot ? 'accent-plate' : 'detail', 'none')
    s.text(`${n} FLIGHTS`, [x + 2.6, yf, H - 12.5], X, Zd, { size: 3.4, fill: hot ? 'on-accent' : 'muted', weight: 600, mono: true })
  })
  s.box(W - 1.6, 0, 0, 1.6, PD, PH)
  s.box(0, PD - 1.6, 0, W, 1.6, PH)
  s.line([[3, PD, PH - 2.5], [W - 3, PD, PH - 2.5]], 'detail', 0.8, '2 1.6')
  s.text('KUUKI · MILES', [W / 2, PD, PH * 0.45], X, Zd, { size: 4, fill: 'muted', weight: 600, mono: true, anchor: 'middle' })
  return s.done()
}

// ── Rankings D: the drinks trolley tray, one paper cup per flight on each airline's stack; Pegasus's stack is coral.
function cups(k: number) {
  const s = new Scene(k)
  const GAP = 22, RB = 5.6, RT = 8.4, CH = 13, STEP = 3.6, Z0 = 2
  const span = (AIRLINES.length - 1) * GAP
  s.poly(flat([[-14, -12], [span + 16, -12], [span + 16, 16], [-14, 16]], 0), 'shadow', 'none')
  s.rbox(-12, -12, 0, span + 24, 24, Z0, 3)
  const ring = (cx: number, r: number, z: number) => s.circle([cx, 0, z], X, Y, 0, 0, r, 44)
  AIRLINES.forEach(({ code, n }, i) => {
    const cx = i * GAP, hot = i === 0
    const wall: Paint = hot ? 'accent' : 'front'
    s.poly2(hull(s.pp([...ring(cx, RB, Z0), ...ring(cx, RT, Z0 + CH)])), wall, 'line')
    const v = Math.SQRT1_2
    s.text(code, [cx + 6.4 * v, 6.4 * v, Z0 + CH * 0.36], [v, -v, 0], Zd, { size: 5.6, fill: hot ? 'on-accent' : 'ink', weight: 700, mono: true, anchor: 'middle' })
    for (let c = 1; c < n; c++) {
      const zl = Z0 + (c - 1) * STEP + CH, rl = RT - ((RT - RB) * STEP) / CH
      s.poly2(hull(s.pp([...ring(cx, rl, zl), ...ring(cx, RT, zl + STEP)])), wall, 'line')
      // The cup below keeps its lip in front of the one rising out of it.
      s.line(ring(cx, RT, zl).filter(([x, y]) => x - cx + y > -2), 'line', 1)
    }
    const top = Z0 + (n - 1) * STEP + CH
    s.poly(ring(cx, RT, top), hot ? 'accent-plate' : 'top', 'line')
    s.poly(ring(cx, RT - 1.3, top), 'glass', hot ? 'accent' : 'detail', undefined, 0.8)
  })
  return s.done()
}

// ── Crossings C: the hotel reception's world clocks; the farthest reached offset (ICN, +9) is the coral face.
function wallClocks(k: number) {
  const s = new Scene(k)
  const CITIES = [
    { code: 'UTC', off: '±0', h: 6, m: 41 },
    { code: 'VKO', off: '+3', h: 9, m: 41 },
    { code: 'TBS', off: '+4', h: 10, m: 41 },
    { code: 'ICN', off: '+9', h: 15, m: 41, hot: true },
  ]
  const PITCH = 42, R = 16, L = CITIES.length * PITCH + 8, H = 60, T = 4, CZ = 38
  s.poly(flat([[-4, T], [L + 6, T], [L + 6, T + 14], [-4, T + 14]], 0), 'shadow', 'none')
  s.box(0, 0, 0, L, T, H)
  CITIES.forEach(({ code, off, h, m, hot }, i) => {
    const cx = 4 + PITCH / 2 + i * PITCH
    const a = s.circle([cx, T, CZ], X, Zu, 0, 0, R, 48), b = s.circle([cx, T + 3, CZ], X, Zu, 0, 0, R, 48)
    s.poly2(hull(s.pp([...a, ...b])), 'side', 'line')
    const y = T + 3
    s.poly(b, hot ? 'accent' : 'top', 'line')
    const at = (r: number, th: number): P3 => [cx + r * Math.sin(th), y, CZ + r * Math.cos(th)]
    const ticks: P3[][] = []
    for (let q = 0; q < 12; q++) ticks.push([at(R - 1.6, (q / 12) * 2 * Math.PI), at(R - (q % 3 ? 3 : 4.4), (q / 12) * 2 * Math.PI)])
    s.segs(ticks, hot ? 'on-accent' : 'detail', 0.9)
    const hand: Paint = hot ? 'on-accent' : 'ink'
    s.line([at(0, 0), at(7.5, (((h % 12) + m / 60) / 12) * 2 * Math.PI)], hand, 1.8)
    s.line([at(0, 0), at(12, (m / 60) * 2 * Math.PI)], hand, 1.1)
    s.poly(s.circle([cx, y, CZ], X, Zu, 0, 0, 1.4, 16), hot ? 'on-accent' : 'ink', 'none')
    s.text(code, [cx, T, 12.5], X, Zd, { size: 7.5, fill: hot ? 'accent' : 'ink', weight: 700, mono: true, anchor: 'middle' })
    s.text(`${off} h`, [cx, T, 5.5], X, Zd, { size: 4.6, fill: hot ? 'accent' : 'muted', weight: 600, mono: true, anchor: 'middle' })
  })
  return s.done()
}

// ── Crossings D: a time-zone slide rule, −11 to +12; the offsets you reached are punched through in coral, the cursor spans the range.
function slideRule(k: number) {
  const s = new Scene(k)
  const CELL = 8, L = 24 * CELL + 16, D = 34, Z = 3
  s.poly(flat([[-5, -4], [L + 5, -4], [L + 5, D + 6], [-5, D + 6]], 0), 'shadow', 'none')
  s.rbox(0, 0, 0, L, D, Z, 2.5)
  const P0 = (u: number, v: number, z: number): P3 => [u, v, z]
  const xo = (o: number) => 8 + (o + 11) * CELL
  for (let o = -11; o <= 12; o++) {
    const x = xo(o), hot = REACHED.has(o)
    s.poly(flat([[x + 1, 7], [x + CELL - 1, 7], [x + CELL - 1, 14], [x + 1, 14]], Z), hot ? 'accent' : 'glass', hot ? 'accent' : 'detail', undefined, 0.7)
    s.line([[x, 3, Z], [x, o % 3 ? 5 : 6, Z]], 'detail', 0.8)
  }
  for (const o of [-9, -6, -3, 0, 3, 6, 9, 12]) flatText(s, P0, 0, o > 0 ? `+${o}` : String(o), xo(o) + CELL / 2, 19.5, Z, { size: 5, fill: o >= 0 && o <= 9 ? 'ink' : 'muted', weight: 600 })
  flatText(s, P0, 0, '← 43 h back', xo(-11), 28, Z, { size: 5, fill: 'muted', weight: 600, anchor: 'start' })
  flatText(s, P0, 0, '39 h forward →', xo(12) + CELL, 28, Z, { size: 5, fill: 'accent', weight: 700, anchor: 'end' })
  // Cursor: a clear sleeve over the reached span, its frame bars standing proud of the rule.
  const x0 = xo(0) - 1.5, x1 = xo(9) + CELL + 1.5
  const SD = 23
  s.box(x0 - 2, -2, Z, 2, SD, 2.2, { top: 'top' })
  s.poly(flat([[x0, -2], [x1, -2], [x1, SD - 2], [x0, SD - 2]], Z + 2.2), 'none', 'line', undefined, 0.8)
  s.box(x1, -2, Z, 2, SD, 2.2, { top: 'top' })
  return s.done()
}

// ── Aircraft C: a seat-belt buckle, its lift latch engraved with the selected maker.
function buckle(k: number) {
  const s = new Scene(k)
  s.poly(flat([[-48, 4], [106, 4], [106, 34], [-48, 34]], 0), 'shadow', 'none')
  const strap = (x: number, y: number, w: number, d: number) => {
    s.box(x, y, 0, w, d, 1.2, { top: 'side', front: 'side', side: 'side' })
    s.line([[x + 1, y + 1.8, 1.2], [x + w - 1, y + 1.8, 1.2]], 'detail', 0.7, '1.6 1.4')
    s.line([[x + 1, y + d - 1.8, 1.2], [x + w - 1, y + d - 1.8, 1.2]], 'detail', 0.7, '1.6 1.4')
  }
  strap(-46, 8, 50, 16)
  // Box-X stitching where the webbing is sewn back on itself.
  const bx = [[-20, 10.5], [-6, 10.5], [-6, 21.5], [-20, 21.5]] as const
  s.poly(flat(bx, 1.2), 'none', 'detail', undefined, 0.7)
  s.segs([[[-20, 10.5, 1.2], [-6, 21.5, 1.2]], [[-6, 10.5, 1.2], [-20, 21.5, 1.2]]], 'detail', 0.7)
  strap(58, 9, 46, 14)
  s.box(44, 10, 0.4, 18, 12, 1.4)
  s.poly(flat([[51, 13], [57, 13], [57, 19], [51, 19]], 1.8), 'glass', 'line', undefined, 0.8)
  s.rbox(0, 2, 0, 48, 28, 5, 5)
  s.rbox(6, 7, 5, 36, 18, 1.6, 4, { top: 'accent', wall: 'accent-side', side: 'accent-side', stroke: 'line' })
  const P0 = (u: number, v: number, z: number): P3 => [u, v, z]
  flatText(s, P0, 0, 'AIRBUS', 24, 13.8, 6.6, { size: 7.5, fill: 'on-accent', weight: 700 })
  flatText(s, P0, 0, '59% OF FLIGHTS', 24, 20.6, 6.6, { size: 3.6, fill: 'on-accent', weight: 600 })
  return s.done()
}

// ── Aircraft D: three arched hangars, floor area by share of flights; Airbus's doors are coral.
function hangars(k: number) {
  const s = new Scene(k)
  const SHEDS = [
    { key: 'AIRBUS', x0: 0, w: 60, d: 62, h: 30, hot: true },
    { key: 'BOEING', x0: 68, w: 44, d: 46, h: 22 },
    { key: 'OTHER', x0: 120, w: 24, d: 26, h: 13 },
  ]
  const FY = 66, G = 2
  s.poly(flat([[-12, 0], [160, 0], [160, 94], [-12, 94]], 0), 'shadow', 'none')
  s.rbox(-10, 0, 0, 168, 92, G, 3, { top: 'front' })
  s.line([[-6, 82, G], [154, 82, G]], 'detail', 1, '4 3')
  for (const { key, x0, w, d, h, hot } of SHEDS) {
    const wall = h * 0.28, y0 = FY - d
    const arc: Pt[] = Array.from({ length: 19 }, (_, j) => {
      const a = (j / 18) * Math.PI
      return [x0 + w / 2 + (w / 2) * Math.cos(a), G + wall + (h - wall) * Math.sin(a)]
    })
    s.prism([[x0 + w, G], ...arc, [x0, G]], y0, d)
    for (let yy = y0 + 8; yy < FY - 3; yy += 9)
      s.line(arc.filter((_, j) => j <= 11).map(([x, z]) => [x, yy, z] as P3), 'detail', 0.6)
    const dz = G + wall + (h - wall) * 0.5
    const door: P3[] = [[x0 + w * 0.14, FY, dz], [x0 + w * 0.86, FY, dz], [x0 + w * 0.86, FY, G], [x0 + w * 0.14, FY, G]]
    s.poly(door, hot ? 'accent' : 'glass', hot ? 'accent' : 'line')
    s.line([[x0 + w * 0.5, FY, G], [x0 + w * 0.5, FY, G + (dz - G) * 0.22]], hot ? 'on-accent' : 'detail', 0.7)
    s.line([[x0 + w * 0.5, FY, G + (dz - G) * 0.62], [x0 + w * 0.5, FY, dz]], hot ? 'on-accent' : 'detail', 0.7)
    s.text(key, [x0 + w / 2, FY, G + (dz - G) * 0.42], X, Zd, { size: Math.max(4, w / 7.5), fill: hot ? 'on-accent' : 'ink', weight: 700, mono: true, anchor: 'middle' })
  }
  return s.done()
}

export const figures: Record<string, () => IsoFigureData> = {
  'rhythm-c-shades': fit(shades),
  'rhythm-d-stamper': fit((k) => stamper(k)),
  'rankings-c-wallet': fit(wallet),
  'rankings-d-cups': fit(cups),
  'crossings-c-clocks': fit(wallClocks),
  'crossings-d-rule': fit(slideRule),
  'makers-c-buckle': fit(buckle),
  'makers-d-hangars': fit(hangars),
}
