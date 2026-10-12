// Redraw studies, round 3: loyalty-card refinements for Rankings, one new idea and two refinements for Crossings.
import { Scene, hull, roundRect, type IsoFigureData, type P3, type Paint, type Pt } from '../../apps/next/src/client/overview/iso/scene'
import { AIRLINES, REACHED, X, Y, Zd, fit, flat, flatText } from './figures'
import { Zu, above } from './figures2'

const rad = (d: number) => (d * Math.PI) / 180
const sgn = (o: number) => (o > 0 ? `+${o}` : o === 0 ? '0' : `−${-o}`)
/** Back to front: Qatar behind Pegasus at the same height, so the tie shows, then the rest by rank. */
const ORDER = [AIRLINES[1], AIRLINES[0], AIRLINES[2], AIRLINES[3], AIRLINES[4]]

/** An open-topped wallet pocket: the back and left walls go under the cards, the right wall and front panel over them. */
function pocket(s: Scene, W: number, PD: number, PH: number, cards: () => void) {
  s.poly(flat([[-4, -3], [W + 4, -3], [W + 4, PD + 6], [-4, PD + 6]], 0), 'shadow', 'none')
  s.box(0, 0, 0, W, 1.6, PH, { front: 'side' })
  s.box(0, 0, 0, 1.6, PD, PH, { front: 'side' })
  cards()
  s.box(W - 1.6, 0, 0, 1.6, PD, PH)
  s.box(0, PD - 1.6, 0, W, 1.6, PH)
  s.line([[3, PD, PH - 2.5], [W - 3, PD, PH - 2.5]], 'detail', 0.8, '2 1.6')
  s.line([[3, PD, 2.5], [W - 3, PD, 2.5]], 'detail', 0.8, '2 1.6')
  s.text('KUUKI · MILES', [W / 2, PD, PH * 0.42], X, Zd, { size: 4.2, fill: 'muted', weight: 600, mono: true, anchor: 'middle' })
}

// ── Rankings C2: the stepped wallet, opened up: wider steps so every card shows its code and count, a brand band on each card.
function walletSteps(k: number) {
  const s = new Scene(k)
  const CW = 58, PD = 16, PH = 20, STEP = 28, W = 8 + 4 * STEP + CW
  pocket(s, W, PD, PH, () =>
    ORDER.forEach(({ code, n }, i) => {
      const hot = code === 'PC'
      const x = 4 + i * STEP, y = 2.6 + i * 2.4, H = PH + 8 + n * 10, yf = y + 1
      s.box(x, y, 0, CW, 1, H, hot ? { front: 'accent', side: 'accent-side', top: 'accent' } : {})
      s.poly([[x, yf, H], [x + CW, yf, H], [x + CW, yf, H - 4.5], [x, yf, H - 4.5]], hot ? 'accent-side' : 'detail', 'none')
      s.text(code, [x + 2.6, yf, H - 12], X, Zd, { size: 8, fill: hot ? 'on-accent' : 'ink', weight: 700, mono: true })
      s.text(`${n} FLIGHTS`, [x + 2.6, yf, H - 17.5], X, Zd, { size: 3.6, fill: hot ? 'on-accent' : 'muted', weight: 600, mono: true })
    }),
  )
  return s.done()
}

// ── Rankings C3: the same cards fanned out of the pocket like a hand, pulled out as far as their flights.
function walletFan(k: number) {
  const s = new Scene(k)
  const CW = 34, PD = 16, PH = 22, W = 124, PX = W / 2 - 4, PZ = -16
  const ANG = [-44, -22, 0, 22, 44]
  pocket(s, W, PD, PH, () =>
    ORDER.forEach(({ code, n }, i) => {
      const hot = code === 'PC', th = rad(ANG[i]), L = 50 + n * 9, y = 3 + i * 2.2
      const a: Pt = [Math.sin(th), Math.cos(th)], w: Pt = [Math.cos(th), -Math.sin(th)]
      const at = (u: number, v: number): Pt => [PX + u * w[0] + v * a[0], PZ + u * w[1] + v * a[1]]
      const face = above([at(-CW / 2, 0), at(CW / 2, 0), at(CW / 2, L), at(-CW / 2, L)], 0.5)
      const on = (pts: readonly Pt[], yy: number): P3[] => pts.map(([x, z]) => [x, yy, z])
      s.poly(on(face, y - 1), 'side', 'line')
      s.poly(on(face, y), hot ? 'accent' : 'top', 'line')
      s.poly(on([at(-CW / 2, L), at(CW / 2, L), at(CW / 2, L - 4.5), at(-CW / 2, L - 4.5)], y), hot ? 'accent-side' : 'detail', 'none')
      const O = (u: number, v: number): P3 => { const [x, z] = at(u, v); return [x, y, z] }
      const U: P3 = [w[0], 0, w[1]], V: P3 = [-a[0], 0, -a[1]]
      s.text(code, O(-CW / 2 + 3, L - 12.5), U, V, { size: 8, fill: hot ? 'on-accent' : 'ink', weight: 700, mono: true })
      s.text(`${n} FLIGHTS`, O(-CW / 2 + 3, L - 18), U, V, { size: 3.6, fill: hot ? 'on-accent' : 'muted', weight: 600, mono: true })
    }),
  )
  return s.done()
}

// ── Crossings E: the hotel reception's key rack, one hook per UTC offset; a key hangs on each offset you reached.
function keyRack(k: number) {
  const s = new Scene(k)
  const PITCH = 16, L = 12 * PITCH + 10, H = 84, T = 4
  s.poly(flat([[-4, T], [L + 6, T], [L + 6, T + 14], [-4, T + 14]], 0), 'shadow', 'none')
  s.box(0, 0, 0, L, T, H)
  const rows = [{ z: 70, from: -11 }, { z: 30, from: 1 }]
  for (const { z, from } of rows)
    for (let i = 0; i < 12; i++) {
      const o = from + i, x = 5 + PITCH / 2 + i * PITCH, hot = REACHED.has(o)
      s.text(sgn(o), [x, T, z + 4.5], X, Zd, { size: 5, fill: hot ? 'ink' : 'muted', weight: 600, mono: true, anchor: 'middle' })
      s.box(x - 0.9, T, z - 1.8, 1.8, 3, 1.8, { top: 'top' })
      if (!hot) continue
      const y = T + 2.4
      s.poly(s.circle([x, y, z - 3.2], X, Zu, 0, 0, 2.6, 20), 'none', 'line', undefined, 1.1)
      s.line([[x, y, z - 5.8], [x, y, z - 7.4]], 'line', 1)
      const fob = roundRect(x - 5.6, z - 27, 11.2, 19.6, 3).map(([u, v]) => [u, y, v] as P3)
      s.poly(fob, 'accent', 'accent')
      s.poly(s.circle([x, y, z - 10.4], X, Zu, 0, 0, 1.1, 12), 'on-accent', 'none')
      s.text(sgn(o), [x, y, z - 20.5], X, Zd, { size: 6, fill: 'on-accent', weight: 700, mono: true, anchor: 'middle' })
    }
  return s.done()
}

// ── Crossings F: the time-zone rule, chunkier: bigger cells, the forward/back split printed along the edge, the cursor over the reached span only.
function slideRule2(k: number) {
  const s = new Scene(k)
  const CELL = 10, L = 24 * CELL + 16, D = 34, Z = 5
  s.poly(flat([[-5, -4], [L + 5, -4], [L + 5, D + 6], [-5, D + 6]], 0), 'shadow', 'none')
  s.rbox(0, 0, 0, L, D, Z, 3)
  const P0 = (u: number, v: number, z: number): P3 => [u, v, z]
  const xo = (o: number) => 8 + (o + 11) * CELL
  for (let o = -11; o <= 12; o++) {
    const x = xo(o), hot = REACHED.has(o)
    s.poly(flat([[x + 1.2, 5], [x + CELL - 1.2, 5], [x + CELL - 1.2, 13], [x + 1.2, 13]], Z), hot ? 'accent' : 'glass', hot ? 'accent' : 'detail', undefined, 0.7)
  }
  for (const o of [-9, -6, -3, 0, 3, 6, 9, 12]) flatText(s, P0, 0, sgn(o), xo(o) + CELL / 2, 19, Z, { size: 6, fill: o >= 0 && o <= 9 ? 'ink' : 'muted', weight: 700 })
  // The split, printed from zero: forward to the right in coral, back to the left in ghost, both to one scale.
  const z0 = xo(0) + CELL / 2, per = 2.2
  s.poly(flat([[z0, 25], [z0 + 39 * per, 25], [z0 + 39 * per, 28], [z0, 28]], Z), 'accent', 'none')
  s.poly(flat([[z0 - 43 * per, 25], [z0 - 1, 25], [z0 - 1, 28], [z0 - 43 * per, 28]], Z), 'line', 'none')
  flatText(s, P0, 0, '+39 h', z0 + 39 * per + 2, 26.5, Z, { size: 5.4, fill: 'accent', weight: 700, anchor: 'start' })
  flatText(s, P0, 0, '−43 h', z0 - 43 * per - 2, 26.5, Z, { size: 5.4, fill: 'muted', weight: 700, anchor: 'end' })
  const x0 = xo(0) - 1.5, x1 = xo(9) + CELL + 1.5, SD = 17
  s.box(x0 - 2.4, -2, Z, 2.4, SD, 2.6, { top: 'top' })
  s.poly(flat([[x0, -2], [x1, -2], [x1, SD - 2], [x0, SD - 2]], Z + 2.6), 'none', 'line', undefined, 0.8)
  s.box(x1, -2, Z, 2.4, SD, 2.6, { top: 'top' })
  return s.done()
}

// ── Crossings G: the reception clocks, cleaner: bigger faces, finer hands, a brass plaque per city, a coral second hand on the farthest offset.
function wallClocks2(k: number) {
  const s = new Scene(k)
  const CITIES = [
    { code: 'UTC', off: '±0 h', h: 6, m: 41 },
    { code: 'VKO', off: '+3 h', h: 9, m: 41 },
    { code: 'TBS', off: '+4 h', h: 10, m: 41 },
    { code: 'ICN', off: '+9 h', h: 15, m: 41, hot: true },
  ]
  const PITCH = 44, R = 18, L = CITIES.length * PITCH + 8, H = 62, T = 4, CZ = 38
  s.poly(flat([[-4, T], [L + 6, T], [L + 6, T + 14], [-4, T + 14]], 0), 'shadow', 'none')
  s.box(0, 0, 0, L, T, H)
  CITIES.forEach(({ code, off, h, m, hot }, i) => {
    const cx = 4 + PITCH / 2 + i * PITCH, y = T + 2.6
    const a = s.circle([cx, T, CZ], X, Zu, 0, 0, R, 48), b = s.circle([cx, y, CZ], X, Zu, 0, 0, R, 48)
    s.poly2(hull(s.pp([...a, ...b])), 'side', 'line')
    s.poly(b, hot ? 'accent' : 'top', 'line')
    s.poly(s.circle([cx, y, CZ], X, Zu, 0, 0, R - 2.2, 48), 'none', hot ? 'on-accent' : 'detail', undefined, 0.6)
    const at = (r: number, th: number): P3 => [cx + r * Math.sin(th), y, CZ + r * Math.cos(th)]
    const ticks: P3[][] = []
    for (let q = 0; q < 12; q++) ticks.push([at(R - 3, (q / 12) * 2 * Math.PI), at(R - (q % 3 ? 4.4 : 6), (q / 12) * 2 * Math.PI)])
    s.segs(ticks, hot ? 'on-accent' : 'line', 0.8)
    const hand: Paint = hot ? 'on-accent' : 'ink'
    s.line([at(0, 0), at(8, (((h % 12) + m / 60) / 12) * 2 * Math.PI)], hand, 1.5)
    s.line([at(0, 0), at(13, (m / 60) * 2 * Math.PI)], hand, 0.9)
    if (hot) s.line([at(-3, rad(200)), at(14, rad(20))], 'ink', 0.6)
    s.poly(s.circle([cx, y, CZ], X, Zu, 0, 0, 1.3, 16), hot ? 'on-accent' : 'ink', 'none')
    s.poly([[cx - 11, T, 15], [cx + 11, T, 15], [cx + 11, T, 4], [cx - 11, T, 4]], hot ? 'accent' : 'top', hot ? 'accent' : 'line', undefined, 0.8)
    s.text(code, [cx, T, 9.4], X, Zd, { size: 6.4, fill: hot ? 'on-accent' : 'ink', weight: 700, mono: true, anchor: 'middle' })
    s.text(off, [cx, T, 5.2], X, Zd, { size: 3.6, fill: hot ? 'on-accent' : 'muted', weight: 600, mono: true, anchor: 'middle' })
  })
  return s.done()
}

// ── Aircraft D2: the hangars, polished: names painted above the doors, panelled doors on a track, arch trim, side windows, and each share painted on the apron as a stand marking.
export function hangars2(k: number, lit = 'AIRBUS', blank = false) {
  const s = new Scene(k)
  const SHEDS = [
    { key: 'AIRBUS', share: '59%', x0: 0, w: 60, d: 62, h: 30 },
    { key: 'BOEING', share: '31%', x0: 68, w: 44, d: 46, h: 22 },
    { key: 'OTHER', share: '10%', x0: 120, w: 24, d: 26, h: 13 },
  ].map((shed) => ({ ...shed, hot: shed.key === lit }))
  const FY = 66, G = 2, TAXI = 98
  const P0 = (u: number, v: number, z: number): P3 => [u, v, z]
  s.poly(flat([[-12, 0], [162, 0], [162, 108], [-12, 108]], 0), 'shadow', 'none')
  s.rbox(-10, 0, 0, 170, 106, G, 3, { top: 'front' })
  s.line([[-6, TAXI, G], [156, TAXI, G]], 'detail', 1, '4 3')
  for (const { key, share, x0, w, d, h, hot } of SHEDS) {
    const wall = h * 0.28, y0 = FY - d, cx = x0 + w / 2
    const arc = (inset: number): Pt[] => Array.from({ length: 25 }, (_, j) => {
      const a = (j / 24) * Math.PI
      return [cx + (w / 2 - inset) * Math.cos(a), G + wall + (h - wall - inset) * Math.sin(a)]
    })
    // Contact shadow, then the shed.
    s.poly(flat([[x0 + 2, y0 + 2], [x0 + w + 3.5, y0 + 2], [x0 + w + 3.5, FY + 2.5], [x0 + 2, FY + 2.5]], G), 'shadow', 'none')
    s.prism([[x0 + w, G], ...arc(0), [x0, G]], y0, d)
    for (let yy = y0 + 7; yy < FY - 3; yy += 8)
      s.line(arc(0).filter((_, j) => j <= 14).map(([x, z]) => [x, yy, z] as P3), 'detail', 0.6)
    // Windows along the lit side wall, where it is tall enough for them.
    if (wall > 5)
      for (let yy = y0 + 5; yy + 5 < FY - 3; yy += 8)
        s.poly([[x0 + w, yy, G + wall * 0.8], [x0 + w, yy + 5, G + wall * 0.8], [x0 + w, yy + 5, G + wall * 0.35], [x0 + w, yy, G + wall * 0.35]], 'glass', 'detail', undefined, 0.6)
    const front = (pts: readonly Pt[]) => pts.map(([x, z]) => [x, FY, z] as P3)
    s.line(front([[x0 + 1.6, G], ...arc(1.6).reverse(), [x0 + w - 1.6, G]]).reverse(), 'detail', 0.6)
    // Doors: four leaves under a track, the name painted on the arch above.
    const dz = G + wall + (h - wall) * (h < 15 ? 0.22 : 0.42), dl = x0 + w * 0.12, dr = x0 + w * 0.88
    s.poly(front([[dl, dz], [dr, dz], [dr, G], [dl, G]]), hot ? 'accent' : 'glass', hot ? 'accent' : 'line')
    s.segs([0.31, 0.5, 0.69].map((q) => front([[x0 + w * q, dz - 0.6], [x0 + w * q, G + 0.4]])), hot ? 'accent-side' : 'detail', 0.7)
    s.line(front([[x0 + w * 0.08, dz + 1.2], [x0 + w * 0.92, dz + 1.2]]), 'line', 0.9)
    const size = Math.max(3.8, w / 9.5)
    s.text(key, [cx, FY, dz + (h < 15 ? 2 : 2.6)], X, Zd, { size, fill: hot ? 'accent' : 'ink', weight: 700, mono: true, anchor: 'middle' })
    // Stand marking: lead-in line from the door to the taxiway, broken by the painted share.
    const ss = Math.max(5, w / 7)
    s.line([[cx, FY + 2, G], [cx, FY + 5, G]], 'detail', 0.9)
    flatText(s, P0, 0, blank ? '—' : share, cx, FY + 6 + ss * 0.6, G, { size: ss, fill: hot ? 'accent' : 'muted', weight: 700 })
    s.line([[cx, FY + 8 + ss * 1.2, G], [cx, TAXI - 1, G]], 'detail', 0.9)
  }
  return s.done()
}

export const figures: Record<string, () => IsoFigureData> = {
  'rankings-c2-wallet-steps': fit(walletSteps),
  'rankings-c3-wallet-fan': fit(walletFan),
  'crossings-e-key-rack': fit(keyRack),
  'crossings-f-rule': fit(slideRule2),
  'crossings-g-clocks': fit(wallClocks2),
  'makers-d2-hangars': fit((k) => hangars2(k)),
}
