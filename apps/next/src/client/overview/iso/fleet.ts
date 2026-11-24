import { makerOf } from '@kuuki/data/aircraft-makers'
import { GEOMETRY, type Geometry } from './fleet-geometry.generated'
import { Scene, fitK, hull, r1, type IsoFigureData, type P3, type Paint, type Pt } from './scene'

type Engine = Geometry['engines'][number]
type BodyDims = { length: number; span: number; height: number; width: number }

const STAND_IN: Record<string, string> = { widebody: 'A333', regional: 'E195', turboprop: 'DH8B' }
const BODIES: Record<string, BodyDims> = {
  narrowbody: { length: 37, span: 34, height: 11.8, width: 3.9 },
  widebody: { length: 63, span: 60, height: 17, width: 5.8 },
  regional: { length: 29, span: 26, height: 9.8, width: 3 },
  bizjet: { length: 20, span: 20, height: 6, width: 2.3 },
  piston: { length: 8.3, span: 11, height: 2.7, width: 1.3 },
}

export const hasDims = (icao: string) => Object.hasOwn(GEOMETRY, icao)

type Plane = { key: string; g: Geometry; generic: boolean }
const generics = new Map<string, Plane>()
function resolve(icao: string, body: string | null): Plane {
  if (hasDims(icao)) return { key: icao, g: GEOMETRY[icao], generic: false }
  const standIn = Object.hasOwn(STAND_IN, body ?? '') ? STAND_IN[body!] : null
  if (standIn) {
    const engines = body === 'widebody' ? [] : GEOMETRY[standIn].engines
    return { key: `standin:${standIn}`, g: { ...GEOMETRY[standIn], engines }, generic: false }
  }
  const name = Object.hasOwn(BODIES, body ?? '') ? body! : 'narrowbody'
  let plane = generics.get(name)
  if (!plane) {
    plane = { key: `generic:${name}`, g: genericGeometry(BODIES[name]), generic: true }
    generics.set(name, plane)
  }
  return plane
}

function genericGeometry({ length: L, span: b, height: h, width: w }: BodyDims): Geometry {
  const hh = 1.05 * w
  return {
    dims: { length: L, span: b, height: h, fuselageWidth: w, fuselageHeight: hh },
    fuselage: {
      noseLength: 1.5 * w,
      tailconeLength: Math.min(2.4 * w, 0.3 * L),
      tailUpsweep: 0.35 * w,
      cockpitWindowX: 0.85 * w,
      decks: 1,
    },
    wing: {
      position: 'low',
      rootLEx: 0.34 * L,
      rootChord: 0.16 * b,
      kinkY: 0.14 * b,
      tipChord: 0.045 * b,
      sweepLE: 27,
      dihedral: 5,
    },
    wingtip: { type: 'none', height: 0, below: 0, cant: 0, rakeSpan: 0 },
    htail: {
      position: 'fuselage',
      rootLEx: 0.85 * L,
      span: 0.36 * b,
      rootChord: 0.09 * b,
      tipChord: 0.03 * b,
      sweepLE: 35,
      dihedral: 6,
    },
    vtail: {
      rootLEx: 0.78 * L,
      height: Math.max(0.12 * b, h - 1.6 - hh),
      rootChord: 0.14 * L,
      tipChord: 0.05 * L,
      sweepLE: 38,
      dorsalFin: false,
    },
    engines: [],
  }
}

const lift = (k: number) => 5 / k
const LOD = 1
const WINDOW_DASHES = 1.5
const CLEARANCE = 0.4
const rad = Math.PI / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

class Probe extends Scene {
  minZ = 0
  override P(x: number, y: number, z: number): Pt {
    if (z < this.minZ) this.minZ = z
    return super.P(x, y, z)
  }
}
const lowest = new Map<string, number>()
function lowestZ({ key, g, generic }: Plane) {
  let z = lowest.get(key)
  if (z === undefined) {
    const probe = new Probe(1)
    airliner(probe, g, [0, 0, 0], { lit: false, generic })
    z = probe.minZ
    lowest.set(key, z)
  }
  return z
}

function airliner(
  s: Scene,
  g: Geometry,
  O: P3,
  { lit, generic, shadow }: { lit: boolean; generic: boolean; shadow?: number },
) {
  const { dims: D, fuselage: F, wing: W, wingtip: T, htail: H, vtail: V } = g
  const k = s.k
  const L = D.length,
    half = D.span / 2,
    rh = D.fuselageWidth / 2,
    rv = D.fuselageHeight / 2
  const Xt = L - (F.end ?? L),
    ln = F.noseLength,
    lt = F.tailconeLength
  const A = ([x, y, z]: P3): P3 => [O[0] + x, O[1] + y, O[2] + z]
  const accent: Paint = lit ? 'accent' : 'detail'
  const top: Paint = lit ? 'accent' : 'top'
  const fill = (p: Paint): Paint => (generic ? 'top' : p)
  const lod = k < LOD,
    inner = lod ? 0.6 : 1
  const poly = (pts: readonly P3[], f: Paint, stroke: Paint = 'line', width?: number) =>
    s.poly(pts.map(A), fill(f), stroke, undefined, width)
  const poly2 = (pts: readonly Pt[], f: Paint, stroke: Paint = 'line', width?: number) =>
    s.poly2(pts, fill(f), stroke, width)
  const line = (pts: readonly P3[], stroke: Paint = 'line', width = 1, dash?: string) =>
    s.line(pts.map(A), generic ? 'line' : stroke, width, dash)
  const hairline = (pts: readonly P3[]) => {
    if (!lod) line(pts, 'detail')
  }
  const tiny = (pts: readonly P3[]) => {
    if (!lod) return false
    const sp = pts.map((p) => s.project(A(p)))
    const span = (i: 0 | 1) => Math.max(...sp.map((p) => p[i])) - Math.min(...sp.map((p) => p[i]))
    return Math.max(span(0), span(1)) < 1.5
  }
  const glow = (blur: number, draw: () => void) => {
    if (lit) s.glow(blur, draw)
  }

  const nn = F.noseExponent ?? 2.4,
    bladeTail = F.tailEnd === 'blade'
  const sv = (x: number) => {
    if (x > L - ln) return Math.max(0, 1 - ((x - (L - ln)) / ln) ** nn) ** (1 / nn)
    if (x < Xt + lt) return 1 - 0.8 * (1 - (x - Xt) / lt)
    return 1
  }
  const sw = (x: number) => {
    const v = sv(x)
    if (!bladeTail || x >= Xt + 0.55 * lt) return v
    const u = clamp((x - Xt) / (0.55 * lt), 0, 1)
    return v * (0.3 + 0.7 * u * u * (3 - 2 * u))
  }
  const Zc = (x: number) => {
    if (x > L - ln) return rv - 0.28 * rv * ((x - (L - ln)) / ln)
    if (x < Xt + lt) return rv + F.tailUpsweep * (1 - clamp((x - Xt) / lt, 0, 1)) ** 1.3
    return rv
  }
  const crown = (x: number) => Zc(x) + rv * sv(x)
  const surf = (x: number, deg: number): P3 => [
    x,
    rh * sw(x) * Math.cos(deg * rad),
    Zc(x) + rv * sv(x) * Math.sin(deg * rad),
  ]
  const surfZ = (x: number, z: number): P3 => {
    const q = clamp((z - Zc(x)) / (rv * sv(x)), -0.97, 0.97)
    return [x, rh * sw(x) * Math.sqrt(1 - q * q), z]
  }
  const ring = (x: number, n = 18) => Array.from({ length: n }, (_, i) => surf(x, (i / n) * 360))
  const dot = (p: P3, radius: number) => {
    const [cx, cy] = s.project(A(p))
    return Array.from({ length: 12 }, (_, i): Pt => [
      cx + radius * Math.cos((i / 12) * 2 * Math.PI),
      cy + radius * Math.sin((i / 12) * 2 * Math.PI),
    ])
  }
  const light = (p: P3, blur: number) => {
    glow(blur, () => s.poly2(dot(p, 0.9 * k), 'accent', 'none'))
    s.poly2(dot(p, Math.max(1.4, 0.32 * k) / 2), accent, 'none')
  }

  const lean = (h: number, cantDeg: number) => h * Math.tan(cantDeg * rad)
  const bladed = ['sharklet', 'blended', 'curved', 'at-winglet'].includes(T.type)
  const upY = bladed ? (T.rootY != null ? half - T.rootY : lean(T.height, T.cant)) : 0
  const dnY = T.type === 'at-winglet' && T.below > 0 ? lean(T.below, Math.min(60, T.cant + 25)) : 0
  const hw = T.rootY ?? half - Math.max(upY, dnY)

  const Xr = L - W.rootLEx,
    tanS = Math.tan(W.sweepLE * rad),
    dih = Math.tan(W.dihedral * rad)
  const raked = T.type === 'raked'
  const rakeLE = T.rakeLE ?? [],
    rakeTE = T.rakeTE ?? []
  const rk = raked && rakeLE.length > 1 && rakeTE.length > 1
  const rLE = rk ? rakeLE.map((p) => ({ x: L - p.x, y: p.y })) : []
  const rTE = rk ? rakeTE.map((p) => ({ x: L - p.x, y: p.y })) : []
  const along = (pts: { x: number; y: number }[], y: number) => {
    if (y <= pts[0].y) return pts[0].x
    for (let i = 1; i < pts.length; i++)
      if (y <= pts[i].y)
        return (
          pts[i - 1].x +
          ((pts[i].x - pts[i - 1].x) * (y - pts[i - 1].y)) / (pts[i].y - pts[i - 1].y || 1e-9)
        )
    return pts[pts.length - 1].x
  }
  const yr = rk ? rLE[0].y : hw - (raked ? T.rakeSpan : 0),
    tanOut = Math.tan((T.rakeSweepLE ?? W.sweepLE + 20) * rad)
  const yb =
    W.leBreakY != null && W.sweepLEInboard != null && W.leBreakY > 0.8 * rh && W.leBreakY < yr
      ? W.leBreakY
      : null
  const tanIn = Math.tan((W.sweepLEInboard ?? W.sweepLE) * rad)
  const high = W.position === 'high'
  const zw = high ? 0.94 * D.fuselageHeight : 0.225 * D.fuselageHeight
  const wz = (y: number) => zw + Math.max(0, Math.abs(y) - rh) * dih
  const th = 0.07 * W.rootChord
  const thick = (y: number) =>
    th * (1 - 0.7 * clamp((Math.abs(y) - 0.8 * rh) / (hw - 0.8 * rh), 0, 1))
  const wl = (y: number) => wz(y) - thick(y)
  const le = (y: number) => {
    const ay = Math.min(Math.abs(y), yr)
    const b =
      yb == null
        ? Xr - (ay - rh) * tanS
        : Xr - (Math.min(ay, yb) - rh) * tanIn - Math.max(0, ay - yb) * tanS
    if (rk && Math.abs(y) > yr) return along(rLE, Math.abs(y))
    return raked && Math.abs(y) > yr ? b - (Math.abs(y) - yr) * tanOut : b
  }
  const teRoot = Xr - W.rootChord,
    teTip = rk ? rTE[rTE.length - 1].x : le(hw) - W.tipChord
  const teEndY = rk ? rTE[0].y : hw,
    teEndX = rk ? rTE[0].x : teTip
  const kink = W.kinkY == null ? null : clamp(W.kinkY, rh, teEndY - 0.1)
  const te = (y: number) => {
    const ay = Math.abs(y)
    if (ay <= (kink ?? rh)) return teRoot
    if (rk && ay > teEndY) return along(rTE, ay)
    const y1 = kink ?? rh
    return teRoot + ((ay - y1) / (teEndY - y1)) * (teEndX - teRoot)
  }
  const wingYs = (sg: number) => [
    sg * 0.8 * rh,
    ...(yb == null ? [] : [sg * yb]),
    ...(raked ? [sg * yr] : []),
    ...(rk ? rLE.slice(1).map((p) => sg * p.y) : [sg * hw]),
  ]
  const wingTop = (sg: number): P3[] => {
    const ys = wingYs(sg),
      y0 = ys[0],
      yt = sg * hw
    const yk = kink == null ? null : sg * kink
    const tipTE: P3[] = rk
      ? [...rTE].reverse().map((p): P3 => [p.x, sg * p.y, wz(sg * p.y)])
      : [[teTip, yt, wz(yt)]]
    return [
      ...ys.map((y): P3 => [le(y), y, wz(y)]),
      ...tipTE,
      ...(yk == null ? [] : [[te(yk), yk, wz(yk)] as P3]),
      [teRoot, y0, wz(y0)],
    ]
  }
  const wing = (sg: number) => {
    const ys = wingYs(sg),
      yt = sg * hw
    poly(
      [
        ...ys.map((y): P3 => [le(y), y, wz(y)]),
        ...[...ys].reverse().map((y): P3 => [le(y), y, wl(y)]),
      ],
      'side',
      'line',
      inner,
    )
    poly(wingTop(sg), top)
    const ya = sg * (kink ?? 1.6 * rh),
      yh = yt * 0.93
    const endX = rk ? te(yh) + 0.25 * (le(yh) - te(yh)) : teTip + 0.25 * W.tipChord
    hairline([
      [te(ya) + 0.18 * W.rootChord * 0.5, ya, wz(ya)],
      [endX, yh, wz(yh)],
    ])
  }

  type Tip = { sg: number; yt: number; z0: number; x0: number; ct: number }
  type Blade = {
    h: number
    Y: number
    rake: number
    topC: number
    ts: number[]
    root?: number
    down?: boolean
    x0?: number
    expo?: number
  }
  const blade = (c: Tip, b: Blade): P3 => {
    const { h, Y, rake, topC, ts, root = c.ct, down = false, x0 = c.x0, expo = 1 } = b
    const dir = down ? -1 : 1
    const at = (u: number, aft: boolean): P3 => {
      const xle = x0 - h * Math.tan(rake * rad) * u ** expo,
        ch = root * (1 - (1 - topC) * u)
      return [aft ? xle - ch : xle, c.yt + c.sg * Y * (1 - (1 - u) ** 2), c.z0 + dir * h * u]
    }
    poly([...ts.map((u) => at(u, false)), ...[...ts].reverse().map((u) => at(u, true))], 'side')
    return at(1, true)
  }
  const device = (c: Tip): P3 | null => {
    switch (T.type) {
      case 'fence': {
        const o = {
          Y: 0,
          rake: 38,
          topC: 0.3,
          ts: [0, 1],
          root: 0.75 * c.ct,
          x0: c.x0 - 0.1 * c.ct,
        }
        if (T.below > 0) blade(c, { ...o, h: T.below, down: true })
        return blade(c, { ...o, h: T.height })
      }
      case 'sharklet':
        return blade(c, { h: T.height, Y: upY, rake: 38, topC: 0.4, ts: [0, 0.15, 0.4, 1] })
      case 'blended':
        return blade(c, { h: T.height, Y: upY, rake: 42, topC: 0.4, ts: [0, 0.12, 0.35, 1] })
      case 'at-winglet':
        if (T.below > 0)
          blade(c, {
            h: T.below,
            Y: dnY,
            rake: 30,
            topC: 0.45,
            ts: [0, 0.5, 1],
            root: 0.8 * c.ct,
            down: true,
            x0: c.x0 - 0.1 * c.ct,
          })
        return blade(c, { h: T.height, Y: upY, rake: 36, topC: 0.35, ts: [0, 0.12, 0.35, 1] })
      case 'curved':
        return blade(c, {
          h: T.height,
          Y: upY,
          rake: 52,
          topC: 0.3,
          ts: [0, 0.15, 0.3, 0.5, 0.75, 1],
          expo: 1.7,
        })
      default:
        return null
    }
  }
  const winglet = (sg: number) =>
    device({ sg, yt: sg * hw, z0: wz(hw), x0: le(hw), ct: W.tipChord })
  const tipLight = (sg: number, topCorner: P3 | null) => {
    if (generic) return
    const p: P3 = topCorner
      ? [topCorner[0] + 0.1, topCorner[1], topCorner[2]]
      : [
          rk ? (rLE[rLE.length - 1].x + rTE[rTE.length - 1].x) / 2 : le(sg * hw) - 0.2 * W.tipChord,
          sg * hw,
          wz(sg * hw) + 0.2,
        ]
    light(p, 2.2 / 4)
  }

  const circ = (x: number, y: number, ze: number, rr: number, flat: boolean, n = 20): P3[] =>
    Array.from({ length: n }, (_, i): P3 => {
      const a = (i / n) * 2 * Math.PI
      return [
        x,
        y + rr * Math.cos(a),
        ze + (flat ? Math.max(rr * Math.sin(a), -0.7 * rr) : rr * Math.sin(a)),
      ]
    })
  const engZ = (y: number, e: Engine) => wl(y) - e.dropBelowWing
  const engine = (sg: number, e: Engine) => {
    const y = sg * e.y,
      d = e.nacelleDiameter,
      len = e.nacelleLength,
      flat = e.section === 'flat-bottom'
    const xf = L - e.fanX,
      xb = xf - len,
      ze = engZ(y, e),
      ex = e.exhaustLength ?? 0
    if (!high) {
      const xa = Math.min(xf - 0.15 * len, le(y) - 0.2)
      let xk = Math.max(xb - ex - 0.05 * len, te(y) + 0.2)
      if (xk >= xa - 0.05) xk = Math.max(te(y) + 0.2, xa - 0.6 * d)
      const pylon: P3[] = [
        [xa, y, ze + 0.45 * d],
        [xk, y, ze + 0.45 * d],
        [xk, y, wz(y) + 0.05],
        [xa, y, wz(y) + 0.05],
      ]
      if (!tiny(pylon)) poly(pylon, 'side', 'line', inner)
    }
    const cone = (x: number, r: number, n = 24): P3[] =>
      Array.from({ length: n }, (_, i): P3 => {
        const a = (i / n) * 2 * Math.PI
        return [x, y + r * Math.cos(a), ze + r * Math.sin(a)]
      })
    poly2(
      hull(
        s.pp(
          [
            ...circ(xf, y, ze, d / 2, flat),
            ...circ(xf - 0.3 * len, y, ze, d / 2, flat),
            ...cone(xb, 0.3 * d),
            ...(ex > 0 ? cone(xb - ex, 0.12 * d, 12) : []),
          ].map(A),
        ),
      ),
      'front',
    )
    poly(circ(xf, y, ze, d / 2, flat), 'side', 'line', inner)
    if (generic) return
    if (e.prop) {
      const hub = circ(xf + 0.01, y, ze, 0.2 * d, false, 10)
      if (!tiny(hub)) poly(hub, accent, accent)
      return
    }
    const fan = circ(xf, y, ze, 0.4 * d, flat)
    glow(1.6 / 4, () => poly(fan, 'accent', 'none'))
    poly(fan, 'glass', accent, inner)
    const spinner = circ(xf + 0.05, y, ze, 0.1 * d, false, 10)
    if (!tiny(spinner)) poly(spinner, accent, accent)
  }
  const prop = (sg: number, e: Engine) => {
    if (!e.prop || generic) return
    const y = sg * e.y,
      ze = engZ(y, e),
      x = L - e.fanX - 0.5
    const disc = circ(x, y, ze, e.prop.diameter / 2, false, 28)
    glow(1.4 / 4, () => poly(disc, 'none', 'accent'))
    poly(disc, 'none', accent, inner)
    const spinner = circ(x + 0.05, y, ze, 0.22 * e.nacelleDiameter, false, 10)
    if (!tiny(spinner)) poly(spinner, accent, accent)
  }

  const tail = H.position === 't-tail'
  const Xf = L - V.rootLEx,
    swf = Math.tan(V.sweepLE * rad),
    finBase = (x: number) => crown(x) - 0.08 * rv * sv(x)
  const finTop = crown(Xf) + V.height,
    topLE = Xf - V.height * swf,
    topTE = topLE - V.tipChord
  const xte = Math.max(Xt + 0.05, Xf - V.rootChord)
  const fin = () => {
    if (V.dorsalFin && V.dorsalLength != null && V.dorsalHeight != null) {
      const d = V.dorsalLength,
        hh = V.dorsalHeight
      poly(
        [
          [Xf + d, 0, finBase(Xf + d)],
          [Xf - hh * swf, 0, crown(Xf) + hh],
          [Xf, 0, finBase(Xf)],
        ],
        'side',
        'line',
        inner,
      )
    }
    poly(
      [
        [Xf, 0, finBase(Xf)],
        [topLE, 0, finTop],
        [topTE, 0, finTop],
        [xte, 0, finBase(xte) + 0.1],
      ],
      'side',
    )
    if (!generic) {
      const hb = finBase(xte) + 0.25 * V.height
      hairline([
        [xte + 0.15 * V.rootChord, 0, hb],
        [topTE + 0.05 * V.tipChord, 0, finTop - 0.06 * V.height],
      ])
    }
  }
  const stabPts = (sg: number) => {
    const Xs = L - H.rootLEx,
      semi = H.span / 2,
      z = tail ? finTop - (H.zBelowFinTop ?? 0) : Zc(Xs),
      tanH = Math.tan(H.sweepLE * rad)
    const body = rh * sw(Xs),
      yRoot = tail ? 0 : (H.rootY ?? 0.8 * body)
    const y0a = tail ? 0 : Math.min(yRoot, 0.97 * body),
      y0 = sg * y0a,
      yt = sg * semi
    const chordAt = (ay: number) =>
      H.rootChord + ((H.tipChord - H.rootChord) * (ay - yRoot)) / (semi - yRoot)
    const leAt = (ay: number) => Xs - (ay - yRoot) * tanH,
      run = semi - y0a
    const zt = z + run * Math.tan(H.dihedral * rad),
      leR = leAt(y0a),
      leT = leAt(semi)
    return [
      [leR, y0, z],
      [leT, yt, zt],
      [leT - H.tipChord, yt, zt],
      [leR - chordAt(y0a), y0, z],
    ] as P3[]
  }
  const stab = (sg: number) => poly(stabPts(sg), top)

  const rings: P3[] = []
  for (let i = 0; i <= 40; i++) rings.push(...ring(Xt + (i / 40) * (L - Xt)))

  if (shadow !== undefined) {
    const flat = (pts: readonly P3[]) =>
      pts.map(([x, y]): Pt => s.project(A([x, y, shadow - O[2]])))
    s.area(
      [hull(flat(rings)), flat(wingTop(-1)), flat(wingTop(1)), flat(stabPts(-1)), flat(stabPts(1))],
      'shadow',
    )
    return
  }

  if (!tail) stab(-1)
  g.engines.forEach((e) => engine(-1, e))
  if (!high) {
    wing(-1)
    tipLight(-1, winglet(-1))
  }
  poly2(hull(s.pp(rings.map(A))), 'front')
  if (high) {
    wing(-1)
    tipLight(-1, winglet(-1))
    g.engines.forEach((e) => prop(-1, e))
  }
  if (!generic) {
    hairline(Array.from({ length: 39 }, (_, i) => surf(Xt + ((i + 1) / 40) * (L - Xt), 62)))
    const CK = F.cockpit ?? {},
      c0 = L - (CK.aftX ?? F.cockpitWindowX)
    const c1 = Math.min(CK.foreX != null ? L - CK.foreX : c0 + 1.2, L - 0.3)
    const lo = CK.lowDeg ?? 30,
      hi = CK.highDeg ?? 46
    const x0 = Xt + 0.62 * lt,
      x1 = c0 - 1.2
    const windowRow = (at: (x: number) => P3) => {
      const strip = (from: number, to: number) => {
        const pts: P3[] = []
        for (let x = from; x < to; x += L / 60) pts.push(at(x))
        pts.push(at(to))
        return pts
      }
      const dashed = k >= WINDOW_DASHES,
        ww = dashed ? r1(Math.max(1.2, 0.34 * k)) : 0.8,
        dash = dashed ? `${r1(0.32 * k)} ${r1(0.22 * k)}` : undefined
      line(strip(x0, x1), 'detail', ww, dash)
      if (!lit) return
      const pitch = 0.54,
        step = Math.ceil((x1 - x0) / 10 / pitch) * pitch
      for (let i = 0; i * step < x1 - x0; i++) {
        const from = x0 + i * step,
          to = Math.min(x1, from + step)
        const t = (x1 - to) / Math.max(pitch, x1 - x0 - step)
        s.group(
          'window',
          () => {
            glow(1.8 / 4, () => line(strip(from, to), 'accent', r1(Math.max(1.2, ww) * 1.6)))
            line(strip(from, to), 'accent', ww, dash)
          },
          { vars: { '--t': `${Math.max(0, Math.min(1, t))}` } },
        )
      }
    }
    if (F.decks === 2) {
      windowRow((x) => surfZ(x, F.mainDeckWindowZ ?? 0.32 * D.fuselageHeight))
      windowRow((x) => surfZ(x, F.upperDeckWindowZ ?? 0.72 * D.fuselageHeight))
    } else windowRow((x) => surf(x, 18))
    const glass = [surf(c0, lo), surf(c1, lo - 4), surf(c1, hi - 4), surf(c0, hi)]
    if (!tiny(glass)) poly(glass, 'glass', 'line', inner)
    light(surf(0.5 * L, 88), 2 / 4)
  }
  fin()
  if (tail) {
    stab(-1)
    stab(1)
  } else stab(1)
  g.engines.forEach((e) => engine(1, e))
  wing(1)
  tipLight(1, winglet(1))
  g.engines.forEach((e) => prop(1, e))
}

const PODIUM: Record<number, number> = { 1: 16, 2: 12, 3: 9 }
const NUMERAL = 8
const MAX_HEIGHT = 125
const RISE = 3

type Block = { x: number; y: number; w: number; d: number; H: number }

export function fleet(
  types: { icao: string; body: string | null }[],
  width: number,
  mode: 'podium' | 'lineup',
): IsoFigureData {
  if (!types.length) return { width, height: 12, viewBox: `0 0 ${width} 12`, nodes: [] }
  const order = [types[1], types[0], types[2]].filter(Boolean)
  const lit = order.length > 1 ? 1 : 0
  const planes = order.map((t) => resolve(t.icao, t.body))
  const standBase = CLEARANCE - Math.min(...planes.map(lowestZ))
  const rodAt = ({ dims, fuselage: F }: Geometry) =>
    dims.length - (F.end ?? dims.length) + F.tailconeLength + 0.5
  const mount = (s: Scene, i: number, { x, y, w, d, H }: Block, rise = 0) => {
    const { g, generic } = planes[i],
      k = s.k,
      stand = standBase + rise
    const O: P3 = [x + (w - g.dims.length) / 2, y + d / 2, H + stand]
    const foot: P3 = [O[0] + rodAt(g), O[1], H]
    const shadow = () => airliner(s, g, O, { lit: false, generic, shadow: H })
    const body = () =>
      generic
        ? s.group('generic', () => airliner(s, g, O, { lit: false, generic }))
        : airliner(s, g, O, { lit: i === lit, generic })
    const rod = (from: number) =>
      s.line(
        [
          [foot[0], foot[1], from],
          [foot[0], foot[1], H + stand + 0.6],
        ],
        'line',
      )
    if (i !== lit) {
      shadow()
      rod(H)
      return body()
    }
    const LIFT = lift(k),
      [, liftY] = s.vector(0, 0, LIFT),
      maker = makerOf(order[i].icao),
      vars = {
        '--lift-y': `${liftY}px`,
        ...(maker === 'unknown' ? {} : { '--figure-live-fill': `var(--cat-maker-${maker})` }),
      }
    s.group('shadow', shadow)
    const a = 3 / k
    s.group('rod', () => rod(H - LIFT), {
      vars,
      clip: [
        [foot[0] + a, foot[1] - a, H],
        [foot[0] - a, foot[1] + a, H],
        [foot[0] + a, foot[1] - a, H + stand + LIFT + 2],
        [foot[0] - a, foot[1] + a, H + stand + LIFT + 2],
      ],
    })
    s.include([
      [O[0], O[1] - g.dims.span / 2, O[2] + LIFT + g.dims.height],
      [O[0] + g.dims.length, O[1] - g.dims.span / 2, O[2] + LIFT + g.dims.height],
      [O[0], O[1] + g.dims.span / 2, O[2] + LIFT],
    ])
    s.group('plane', body, { vars })
  }
  const C = Math.cos(Math.PI / 6),
    pad = 12.5
  if (mode === 'podium') {
    const reach = planes[lit].g.htail.span / 2
    const ws = planes.map(({ g }, i) => g.dims.length + 8 + (i < lit ? reach : 0)),
      D = Math.max(...planes.map(({ g }) => g.dims.span)) + 1
    const build = (k: number) => {
      const s = new Scene(k)
      let x = 0
      planes.forEach((_, i) => {
        const rank = types.indexOf(order[i]) + 1,
          H = PODIUM[rank] / k,
          w = ws[i]
        s.box(x, 0, 0, w, D, H, { stroke: 'detail' })
        const size = NUMERAL / k
        s.text(String(rank), [x + w / 2, D, H / 2 - 0.35 * size], [1, 0, 0], [0, 0, -1], {
          size,
          fill: 'muted',
          anchor: 'middle',
        })
        mount(s, i, { x, y: 0, w, d: D, H }, RISE / k)
        x += w
      })
      return s.done()
    }
    const fig = build((width - pad) / (C * (ws.reduce((a, b) => a + b) + D)))
    if (fig.height <= MAX_HEIGHT) return fig
    return build(fitK(MAX_HEIGHT, (k) => ({ width: build(k).height })))
  }
  const sizes = planes.map(({ g }) => ({ w: g.dims.length + 8, d: g.dims.span + 1 })),
    Wmax = Math.max(...sizes.map((p) => p.w))
  let depth = 0
  const plinths = sizes.map(({ w, d }) => {
    const y = depth
    depth += d
    return { x: Wmax - w, y, w, d }
  })
  const H = 4,
    GAP = 6
  const draw = (k: number, gap: number) => {
    const s = new Scene(k)
    plinths.forEach(({ x, y, w, d }, i) => {
      s.box(x, y + i * gap, 0, w, d, H, { stroke: 'detail' })
      mount(s, i, { x, y: y + i * gap, w, d, H })
    })
    return s.done()
  }
  let k = Infinity
  plinths.forEach((r, i) =>
    plinths.forEach((l, j) => {
      const run = r.x + r.w - r.y - (l.x - l.y - l.d)
      if (run > 0) k = Math.min(k, (width - pad + C * GAP * (i - j)) / (C * run))
    }),
  )
  return draw(k, GAP / k)
}
