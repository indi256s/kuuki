import { Scene, hull, type IsoFigureData, type P3, type Paint } from './scene'

type Wingtip = 'blended winglet' | 'fence' | 'none' | 'raked' | 'sharklet' | 'split scimitar'
/** Length, wingspan, height, fuselage width and engine nacelle diameter in metres; wing sweep in degrees. */
type Dims = [
  length: number,
  span: number,
  height: number,
  width: number,
  sweep: number,
  engines: 2 | 4,
  wingtip: Wingtip,
  nacelle: number,
]

// Manufacturer type data for the most flown types; anything else borrows the closest body class below.
const DIMS: Record<string, Dims> = {
  A319: [33.84, 34.1, 11.76, 3.95, 25, 2, 'fence', 2.2],
  A320: [37.57, 34.1, 11.76, 3.95, 25, 2, 'fence', 2.2],
  A321: [44.51, 34.1, 11.76, 3.95, 25, 2, 'fence', 2.2],
  A20N: [37.57, 35.8, 11.76, 3.95, 25, 2, 'sharklet', 2.4],
  A21N: [44.51, 35.8, 11.76, 3.95, 25, 2, 'sharklet', 2.4],
  A332: [58.82, 60.3, 17.39, 5.64, 30, 2, 'blended winglet', 2.9],
  A333: [63.67, 60.3, 16.79, 5.64, 30, 2, 'blended winglet', 2.9],
  A359: [66.8, 64.75, 17.05, 5.96, 31.9, 2, 'blended winglet', 3.6],
  A35K: [73.79, 64.75, 17.05, 5.96, 31.9, 2, 'blended winglet', 3.6],
  A388: [72.73, 79.75, 24.09, 7.14, 33.5, 4, 'fence', 3.4],
  B733: [33.4, 28.88, 11.1, 3.76, 25, 2, 'none', 1.9],
  B738: [39.47, 35.79, 12.55, 3.76, 25, 2, 'blended winglet', 2.0],
  B38M: [39.52, 35.92, 12.3, 3.76, 25, 2, 'split scimitar', 2.1],
  B763: [54.94, 47.57, 16.03, 5.03, 31.5, 2, 'none', 2.7],
  B788: [56.72, 60.12, 16.92, 5.77, 32, 2, 'raked', 3.4],
  B77W: [73.86, 64.8, 18.85, 6.2, 31.6, 2, 'raked', 3.9],
  E170: [29.9, 26.01, 9.83, 3.01, 23, 2, 'blended winglet', 1.6],
  E195: [38.66, 28.73, 10.54, 3.01, 23, 2, 'blended winglet', 1.7],
  DH8B: [22.25, 25.89, 7.49, 2.69, 0, 2, 'none', 1.1],
  SU95: [29.94, 27.8, 10.28, 3.46, 25, 2, 'blended winglet', 1.6],
}
const STAND_IN: Record<string, string> = {
  widebody: 'A333',
  regional: 'E195',
  turboprop: 'DH8B',
  bizjet: 'E170',
  piston: 'E170',
}
/** Whether the type is drawn from its own dimensions rather than a stand-in. */
export const hasDims = (icao: string) => Object.hasOwn(DIMS, icao)
// shortcut: unlisted types borrow body-class dimensions; extend DIMS when their measured silhouettes are needed.
const dimsOf = (icao: string, body: string | null) =>
  hasDims(icao) ? DIMS[icao] : DIMS[Object.hasOwn(STAND_IN, body ?? '') ? STAND_IN[body!] : 'A320']

/** How far the lit plane lifts off its stand on hover, in metres. */
const LIFT = 3
const rad = Math.PI / 180

/** One airliner with its fuselage bottom at O, nose toward +x. `lit` lights the wings and windows; otherwise the accents fall back to line work. */
function airliner(s: Scene, d: Dims, O: P3, lit: boolean, turboprop: boolean, doubleDeck: boolean) {
  const [L, b, height, width, sweepDeg, engineCount, wingtip, nacelle] = d
  const at = ([x, y, z]: P3): P3 => [O[0] + x, O[1] + y, O[2] + z]
  const k = s.k
  const accent: Paint = lit ? 'accent' : 'detail'
  const glow = (blur: number, draw: () => void) => {
    if (lit) s.glow(blur, draw)
  }
  const r = width / 2,
    zc = r
  const ln = (turboprop ? 1.6 : 1.9) * width,
    lt = turboprop ? 0.3 * L : Math.min(3.2 * width, 0.34 * L)
  // Fuselage radius and centre height along x, tail at 0 and nose at L.
  const R = (x: number) =>
    x > L - ln
      ? r * Math.sqrt(Math.max(0, 1 - ((x - (L - ln)) / ln) ** 2))
      : x < lt
        ? r * (1 - (turboprop ? 0.75 : 0.8) * (1 - x / lt))
        : r
  const Z = (x: number) =>
    x > L - ln
      ? zc - (turboprop ? 0.25 : 0.28) * r * ((x - (L - ln)) / ln)
      : x < lt
        ? zc + (turboprop ? 0.55 : 0.62) * r * (1 - x / lt)
        : zc
  const surf = (x: number, deg: number): P3 =>
    at([x, R(x) * Math.cos(deg * rad), Z(x) + R(x) * Math.sin(deg * rad)])
  const ring = (x: number, n = 18) => Array.from({ length: n }, (_, i) => surf(x, (i / n) * 360))
  const dot = (p: P3, radius: number) => {
    const [cx, cy] = s.project(p)
    return Array.from({ length: 12 }, (_, i): [number, number] => [
      cx + radius * Math.cos((i / 12) * 2 * Math.PI),
      cy + radius * Math.sin((i / 12) * 2 * Math.PI),
    ])
  }
  const light = (p: P3, blur: number) => {
    glow(blur, () => s.poly2(dot(p, 0.9 * k), 'accent', 'none'))
    s.poly2(dot(p, Math.max(1.4, 0.32 * k) / 2), accent, 'none')
  }

  // Wing planform: straight inboard trailing edge, swept outboard.
  const sweep = (turboprop ? 2 : sweepDeg + 3) * rad,
    dih = (turboprop ? 0 : 5) * rad
  const half = b / 2,
    cr = (turboprop ? 0.11 : 0.19) * b,
    ct = (turboprop ? 0.055 : 0.05) * b,
    xr = (turboprop ? 0.6 : 0.62) * L,
    kink = 0.36 * half
  const zw = zc + (turboprop ? 0.95 : -0.55) * r,
    wz = (y: number) => zw + Math.abs(y) * Math.tan(dih)
  const le = (y: number) => xr - Math.abs(y) * Math.tan(sweep)
  const teTip = le(half) - ct,
    te = (y: number) =>
      turboprop
        ? le(y) - (cr + ((ct - cr) * Math.abs(y)) / half)
        : Math.abs(y) <= kink
          ? xr - cr
          : xr - cr + ((Math.abs(y) - kink) / (half - kink)) * (teTip - (xr - cr))
  const wing = (sg: number) => {
    const y0 = turboprop ? 0 : sg * 0.8 * r,
      yk = sg * kink,
      yt = sg * half,
      th = 0.1 * cr
    s.poly(
      [
        at([le(y0), y0, wz(y0)]),
        at([le(yt), yt, wz(yt)]),
        at([le(yt), yt, wz(yt) - th * 0.3]),
        at([le(y0), y0, wz(y0) - th]),
      ],
      'side',
    )
    s.poly(
      [
        at([le(y0), y0, wz(y0)]),
        at([le(yt), yt, wz(yt)]),
        at([teTip, yt, wz(yt)]),
        at([te(yk), yk, wz(yk)]),
        at([te(y0), y0, wz(y0)]),
      ],
      lit ? 'accent' : 'top',
    )
    // Flap-track hint along the trailing edge.
    s.line(
      [at([te(yk) + 0.18 * cr, yk, wz(yk)]), at([teTip + 0.25 * ct, yt * 0.93, wz(yt * 0.93)])],
      'detail',
    )
  }
  const winglet = (sg: number) => {
    const yt = sg * half,
      z0 = wz(yt),
      x0 = le(yt)
    if (wingtip === 'raked' || wingtip === 'none') return
    const up =
      wingtip === 'fence'
        ? 0.9
        : wingtip === 'sharklet'
          ? 2.4
          : wingtip === 'split scimitar'
            ? 2.9
            : 0.075 * b
    const cant = wingtip === 'fence' ? 0 : 0.25 * up,
      rake = up * Math.tan(42 * rad),
      topc = 0.4 * ct
    const root = wingtip === 'fence' ? 0.75 * ct : ct
    s.poly(
      [
        at([x0, yt, z0]),
        at([x0 - rake, yt + sg * cant, z0 + up]),
        at([x0 - rake - topc, yt + sg * cant, z0 + up]),
        at([x0 - root, yt, z0]),
      ],
      'side',
    )
    if (wingtip === 'fence' || wingtip === 'split scimitar') {
      const dn = wingtip === 'fence' ? 0.6 : 1.2,
        xa = x0 - 0.1 * ct
      s.poly(
        [
          at([xa, yt, z0]),
          at([xa - dn * 0.6, yt, z0 - dn]),
          at([xa - dn * 0.6 - 0.3 * ct, yt, z0 - dn]),
          at([x0 - 0.6 * ct, yt, z0]),
        ],
        'side',
      )
    }
  }
  const tipLight = (sg: number) =>
    light(at([le(sg * half) - 0.2 * ct, sg * half, wz(sg * half) + 0.2]), (2.2 * k) / 4)

  // Engines: nacelle hull, then the intake face, which looks toward the viewer.
  const engines = engineCount === 4 ? [0.37, 0.64] : [0.34]
  const engine = (sg: number, frac: number) => {
    const y = sg * (turboprop ? 0.3 : frac) * half,
      dia = nacelle,
      len = 1.85 * dia
    const xf = le(y) + (turboprop ? 0.9 : 0.45 * len),
      xb = turboprop ? te(y) - 0.9 : xf - len,
      ze = wz(y) - (turboprop ? 0.45 * dia : 0.5 * dia + 0.15)
    s.poly(
      [
        at([xf - 0.2 * len, y, ze + 0.45 * dia]),
        at([xb + 0.15 * len, y, ze + 0.45 * dia]),
        at([xb - 0.05 * len, y, wz(y) + 0.05]),
        at([xf - 0.15 * len, y, wz(y) + 0.05]),
      ],
      'side',
    )
    const circ = (x: number, rr: number, n = 20) =>
      Array.from({ length: n }, (_, i) =>
        at([
          x,
          y + rr * Math.cos((i / n) * 2 * Math.PI),
          ze + rr * Math.sin((i / n) * 2 * Math.PI),
        ]),
      )
    s.poly2(hull(s.pp([...circ(xf, dia / 2), ...circ(xb, 0.36 * dia)])), 'front')
    if (turboprop) {
      const disc = circ(xf + 0.4, 2, 24)
      glow((1.4 * k) / 4, () => s.poly(disc, 'none', 'accent'))
      s.poly(disc, 'none', accent)
      s.poly(circ(xf + 0.45, 0.22 * dia, 10), accent, accent)
      return
    }
    const fan = circ(xf, 0.4 * dia)
    s.poly(circ(xf, dia / 2), 'side')
    glow((1.6 * k) / 4, () => s.poly(fan, 'accent', 'none'))
    s.poly(fan, 'glass', accent)
    s.poly(circ(xf + 0.05, 0.1 * dia, 10), accent, accent)
  }

  // Tail: fin on y = 0, stabilisers swept on the tail cone.
  const xs = 0.17 * L,
    crs = (turboprop ? 0.085 : 0.1) * b,
    semis = (turboprop ? 0.16 : 0.165) * b,
    sws = (turboprop ? 12 : 33) * rad
  const stab = (sg: number) => {
    const rootX = turboprop
      ? 0.22 * L - (height - 0.2 - Z(0.22 * L) - R(0.22 * L) * 0.9) * Math.tan(32 * rad)
      : xs
    const y0 = turboprop ? 0 : sg * R(xs) * 0.8,
      yt = sg * semis,
      z = turboprop ? height - 0.2 : Z(xs)
    const leT = rootX - semis * Math.tan(sws),
      ctS = (turboprop ? 0.55 : 0.4) * crs
    s.poly(
      [
        at([rootX, y0, z]),
        at([leT, yt, z]),
        at([leT - ctS, yt, z]),
        at([turboprop ? rootX - crs : Math.max(0.02 * L, xs - crs), y0, z]),
      ],
      lit ? 'accent' : 'top',
    )
  }
  const fin = () => {
    const finTop = height - (turboprop ? 0.2 : 0.45 * width),
      xfL = (turboprop ? 0.22 : 0.21) * L,
      crf = (turboprop ? 0.2 : 0.17) * L,
      swf = (turboprop ? 32 : 38) * rad
    const root = (x: number) => Z(x) + R(x) * (turboprop ? 0.9 : 0.92),
      h = finTop - root(xfL)
    const topLE = xfL - h * Math.tan(swf),
      topTE = topLE - (turboprop ? 0.55 : 0.42) * crf
    const xte = Math.max((turboprop ? 0.02 : 0.015) * L, xfL - crf)
    s.poly(
      [
        at([xfL, 0, root(xfL)]),
        at([topLE, 0, finTop]),
        at([topTE, 0, finTop]),
        at([xte, 0, root(xte) + 0.2]),
      ],
      'side',
    )
    // Rudder hinge.
    s.line(
      [
        at([xte + 0.15 * crf, 0, root(xte) + 0.25 * h]),
        at([topTE + 0.05 * crf, 0, finTop - 0.06 * h]),
      ],
      'detail',
    )
  }

  // Paint back to front.
  if (!turboprop) {
    stab(-1)
    for (const f of engines) engine(-1, f)
    wing(-1)
    winglet(-1)
    tipLight(-1)
  }
  const silhouette: P3[] = []
  for (let i = 0; i <= 40; i++) silhouette.push(...ring((i / 40) * L))
  s.poly2(hull(s.pp(silhouette)), 'front')
  // Crown seam for volume, where the top meets the near side.
  s.line(
    Array.from({ length: 39 }, (_, i) => surf(((i + 1) / 40) * L, 62)),
    'detail',
  )
  // Cabin windows: a lit strip dashed per window. On the lit plane it is cut into runs from nose (t = 0) to tail (t = 1), so CSS can switch them on in order.
  const x0 = lt * 0.62,
    x1 = L - ln * 0.82
  const windowRow = (start: number, end: number, angle: number) => {
    const strip = (from: number, to: number) => {
      const pts: P3[] = []
      for (let x = from; x < to; x += L / 60) pts.push(surf(x, angle))
      pts.push(surf(to, angle))
      return pts
    }
    const ww = Math.max(1.2, 0.34 * k),
      dash = `${r1(0.32 * k)} ${r1(0.22 * k)}`
    glow((1.8 * k) / 4, () => s.line(strip(start, end), 'accent', r1(ww * 1.6)))
    s.line(strip(start, end), accent, r1(ww), dash)
    if (lit) {
      // Runs align to a whole window pitch, keeping the dash pattern continuous.
      const pitch = 0.54,
        step = Math.ceil((end - start) / 10 / pitch) * pitch
      for (let i = 0; i * step < end - start; i++) {
        const from = start + i * step,
          to = Math.min(end, from + step)
        const t = (end - to) / Math.max(pitch, end - start - step)
        s.group('window', () => s.line(strip(from, to), 'ink', r1(ww), dash), {
          vars: { '--t': `${Math.max(0, Math.min(1, t))}` },
        })
      }
    }
  }
  windowRow(x0, x1, turboprop ? 22 : 18)
  if (doubleDeck) windowRow(0.3 * L, 0.86 * L, 52)
  // Cockpit glazing.
  const ck = [L - ln * 0.5, L - ln * 0.3]
  s.poly([surf(ck[0], 30), surf(ck[1], 26), surf(ck[1], 42), surf(ck[0], 46)], 'glass', 'line')
  // Beacon on the crown.
  light(surf(0.5 * L, 88), (2 * k) / 4)
  if (turboprop) {
    stab(-1)
    wing(-1)
    tipLight(-1)
    for (const f of engines) engine(-1, f)
  }
  fin()
  stab(1)
  for (const f of engines) engine(1, f)
  wing(1)
  winglet(1)
  tipLight(1)
}

/**
 * Fleet: the most flown types on display plinths, all at one true scale; the most flown is lit and stands in the middle.
 * `types` is ranked most flown first, each with its refs body class for stand-ins. The scale is solved so the figure is `width` px wide.
 * Parts: `plane` (the lit one; carries --lift-y) holding `window` runs (each carries --t, 0 at the nose).
 */
export function fleet(
  types: { icao: string; body: string | null }[],
  width: number,
): IsoFigureData {
  if (!types.length) return { width, height: 12, viewBox: `0 0 ${width} 12`, nodes: [] }
  // Back to front: second, first, third, so the most flown sits in the middle.
  const order = [types[1], types[0], types[2]].filter(Boolean)
  const lit = types.length > 1 ? 1 : 0
  const dims = order.map((t) => dimsOf(t.icao, t.body))
  const W = Math.max(46, ...dims.map((d) => d[0] + 8)),
    D = Math.max(37, ...dims.map((d) => d[1] + 1)),
    H = 4,
    gap = 2,
    stand = 2.2
  const draw = (k: number) => {
    const s = new Scene(k)
    dims.forEach((d, i) => {
      const y = i * (D + gap)
      s.box(0, y, 0, W, D, H)
      // Stand: a short rod from the plinth top to the belly.
      s.line(
        [
          [W / 2, y + D / 2, H],
          [W / 2, y + D / 2, H + stand + 0.6],
        ],
        'line',
      )
      const O: P3 = [(W - d[0]) / 2, y + D / 2, H + stand]
      const icao = order[i].icao
      const turboprop = icao === 'DH8B' || (!hasDims(icao) && order[i].body === 'turboprop')
      if (i !== lit) return airliner(s, d, O, false, turboprop, icao === 'A388')
      const [, liftY] = s.vector(0, 0, LIFT)
      // Bounds cover the lifted plane, so the motion never leaves the figure's box.
      s.include([
        [O[0], O[1] - d[1] / 2, O[2] + LIFT + d[2]],
        [O[0] + d[0], O[1] - d[1] / 2, O[2] + LIFT + d[2]],
        [O[0], O[1] + d[1] / 2, O[2] + LIFT],
      ])
      s.group('plane', () => airliner(s, d, O, true, turboprop, icao === 'A388'), {
        vars: { '--lift-y': `${liftY}px` },
      })
    })
    return s.done()
  }
  // Projection is linear in k, so one pass at k = 1 gives the exact scale for the target width.
  const pad = 12
  const probe = draw(1)
  return draw((width - pad) / (probe.width - pad))
}

const r1 = (n: number) => Math.round(n * 10) / 10
