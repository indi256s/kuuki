import { makerOf } from '@kuuki/data/aircraft-makers'
import { GEOMETRY, type Geometry } from './fleet-geometry.generated'
import { Scene, fitK, hull, r1, type IsoFigureData, type P3, type Paint, type Pt } from './scene'

type Engine = Geometry['engines'][number]
type BodyDims = { length: number; span: number; height: number; width: number }

// Types with measured geometry (fleet-geometry.generated.ts). Other body classes borrow a representative airframe (a widebody without
// its engines, whose count would claim a type), or draw a generic outline.
const STAND_IN: Record<string, string> = { widebody: 'A333', regional: 'E195', turboprop: 'DH8B' }
// Body-class sizes (metres) for the generic outline: bizjet, piston and anything the refs cannot place.
const BODIES: Record<string, BodyDims> = {
  narrowbody: { length: 37, span: 34, height: 11.8, width: 3.9 },
  widebody: { length: 63, span: 60, height: 17, width: 5.8 },
  regional: { length: 29, span: 26, height: 9.8, width: 3 },
  bizjet: { length: 20, span: 20, height: 6, width: 2.3 },
  piston: { length: 8.3, span: 11, height: 2.7, width: 1.3 },
}

/** Whether the type has measured geometry rather than a stand-in. */
export const hasDims = (icao: string) => Object.hasOwn(GEOMETRY, icao)

type Plane = { key: string; g: Geometry; generic: boolean }
const generics = new Map<string, Plane>()
function resolve(icao: string, body: string | null): Plane {
  if (hasDims(icao)) return { key: icao, g: GEOMETRY[icao], generic: false }
  const standIn = Object.hasOwn(STAND_IN, body ?? '') ? STAND_IN[body!] : null
  if (standIn) {
    // Regional jets and turboprops are twins, so the borrowed pair claims nothing; widebodies may have two or four.
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

/** A plain body, wing and tail sized to the body class, drawn as faint outlines. No engines: their number and mounting would claim a type. */
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

/** How far the lit plane lifts off its stand on hover: 5px at any scale, in metres at scale k. */
const lift = (k: number) => 5 / k
/** Below this scale (px per metre) the drawing drops sub-pixel parts and thins interior strokes. */
const LOD = 1
/** Below this scale the cabin windows are one continuous band; dashes would merge into a bar. */
const WINDOW_DASHES = 1.5
/** Gap between the lowest rendered point of any plane and the plinth top, in metres. */
const CLEARANCE = 0.4
const rad = Math.PI / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** A scene that remembers the lowest projected point; nacelles hang below the belly (z = 0). */
class Probe extends Scene {
  minZ = 0
  override P(x: number, y: number, z: number): Pt {
    if (z < this.minZ) this.minZ = z
    return super.P(x, y, z)
  }
}
const lowest = new Map<string, number>()
/** Lowest z (m, fuselage bottom = 0) of anything drawn for this plane; at most 0. */
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

/**
 * One airplane from its measured geometry, fuselage bottom at O, tail at O.x and nose toward +x.
 * `lit` lights the wings and tailplane, and adds `window` runs that light the cabin on hover; otherwise the accents fall back to line work.
 * `generic` draws faint outlines only: no windows, cockpit, lights or accents.
 * `shadow` (a z) draws only the contact shadow instead: fuselage, wings and stabiliser flattened onto that plane.
 * Below the LOD scale, interior strokes thin to 0.6 and the cockpit glass, pylons, spinners and hairlines drop out.
 */
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
  const Xt = L - (F.end ?? L), // fuselage tail end
    ln = F.noseLength,
    lt = F.tailconeLength
  const A = ([x, y, z]: P3): P3 => [O[0] + x, O[1] + y, O[2] + z]
  const accent: Paint = lit ? 'accent' : 'detail'
  const top: Paint = lit ? 'accent' : 'top'
  const fill = (p: Paint): Paint => (generic ? 'top' : p)
  const lod = k < LOD,
    inner = lod ? 0.6 : 1 // stroke width for parts inside the silhouette
  const poly = (pts: readonly P3[], f: Paint, stroke: Paint = 'line', width?: number) =>
    s.poly(pts.map(A), fill(f), stroke, undefined, width)
  const poly2 = (pts: readonly Pt[], f: Paint, stroke: Paint = 'line', width?: number) =>
    s.poly2(pts, fill(f), stroke, width)
  const line = (pts: readonly P3[], stroke: Paint = 'line', width = 1, dash?: string) =>
    s.line(pts.map(A), generic ? 'line' : stroke, width, dash)
  /** Hairline detail (flap track, rudder hinge, crown seam): dropped below the LOD scale. */
  const hairline = (pts: readonly P3[]) => {
    if (!lod) line(pts, 'detail')
  }
  /** A small part is skipped below the LOD scale once it projects under 1.5px. */
  const tiny = (pts: readonly P3[]) => {
    if (!lod) return false
    const sp = pts.map((p) => s.project(A(p)))
    const span = (i: 0 | 1) => Math.max(...sp.map((p) => p[i])) - Math.min(...sp.map((p) => p[i]))
    return Math.max(span(0), span(1)) < 1.5
  }
  // Glow blurs are stdDeviations at k = 1; Scene.glow scales them with the figure.
  const glow = (blur: number, draw: () => void) => {
    if (lit) s.glow(blur, draw)
  }

  // Fuselage: oval section (rh x rv), superellipse nose, linear tail taper raised by the upsweep.
  const nn = F.noseExponent ?? 2.4,
    bladeTail = F.tailEnd === 'blade'
  const sv = (x: number) => {
    if (x > L - ln) return Math.max(0, 1 - ((x - (L - ln)) / ln) ** nn) ** (1 / nn)
    if (x < Xt + lt) return 1 - 0.8 * (1 - (x - Xt) / lt)
    return 1
  }
  // A blade tail cone also flattens the width over the last 55% of the taper.
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
  /** Point on the +y side at height z. */
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

  // Wingtip device reach: span is the overall width, so the wing ends where the blade root starts.
  const lean = (h: number, cantDeg: number) => h * Math.tan(cantDeg * rad)
  const bladed = ['sharklet', 'blended', 'curved', 'at-winglet'].includes(T.type)
  const upY = bladed ? (T.rootY != null ? half - T.rootY : lean(T.height, T.cant)) : 0
  const dnY = T.type === 'at-winglet' && T.below > 0 ? lean(T.below, Math.min(60, T.cant + 25)) : 0
  const hw = T.rootY ?? half - Math.max(upY, dnY) // wing semi-span at the blade root

  // Wing: swept leading edge (optional inboard break) from the body side, straight inboard trailing edge to the kink.
  const Xr = L - W.rootLEx,
    tanS = Math.tan(W.sweepLE * rad),
    dih = Math.tan(W.dihedral * rad)
  const raked = T.type === 'raked'
  // Raked tip from measured vertices (x aft from the nose, converted by X = L - x), inboard to tip.
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
  const wl = (y: number) => wz(y) - thick(y) // drawn lower surface
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
    teEndX = rk ? rTE[0].x : teTip // end of the straight inboard trailing edge
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
  /** Upper surface outline, leading edge root to tip, then the trailing edge back to the root. */
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
    // Flap-track hint: one hairline along the trailing edge.
    const ya = sg * (kink ?? 1.6 * rh),
      yh = yt * 0.93
    const endX = rk ? te(yh) + 0.25 * (le(yh) - te(yh)) : teTip + 0.25 * W.tipChord
    hairline([
      [te(ya) + 0.18 * W.rootChord * 0.5, ya, wz(ya)],
      [endX, yh, wz(yh)],
    ])
  }

  // Wingtip devices. A blade rises (or drops) from the tip; its outward lean follows an eased curve.
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
        // Small triangle above and below the tip.
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
        // Lower blade (smaller, canted far outward), then the larger upper blade.
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

  // Engines: nacelle hull, then the intake face, which looks toward the viewer.
  const circ = (x: number, y: number, ze: number, rr: number, flat: boolean, n = 20): P3[] =>
    Array.from({ length: n }, (_, i): P3 => {
      const a = (i / n) * 2 * Math.PI
      return [
        x,
        y + rr * Math.cos(a),
        ze + (flat ? Math.max(rr * Math.sin(a), -0.7 * rr) : rr * Math.sin(a)),
      ]
    })
  const engZ = (y: number, e: Engine) => wl(y) - e.dropBelowWing // from the wing's lower surface
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
      // Pylon, clamped to the wing's chord at this station.
      const xa = Math.min(xf - 0.15 * len, le(y) - 0.2)
      let xk = Math.max(xb - ex - 0.05 * len, te(y) + 0.2)
      if (xk >= xa - 0.05) xk = Math.max(te(y) + 0.2, xa - 0.6 * d) // nacelle sits ahead of the wing
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
  // Propeller disc: glow ring plus spinner, in front of the wing.
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

  // Tail.
  const tail = H.position === 't-tail'
  const Xf = L - V.rootLEx,
    swf = Math.tan(V.sweepLE * rad),
    finBase = (x: number) => crown(x) - 0.08 * rv * sv(x)
  const finTop = crown(Xf) + V.height,
    topLE = Xf - V.height * swf,
    topTE = topLE - V.tipChord
  const xte = Math.max(Xt + 0.05, Xf - V.rootChord)
  const fin = () => {
    // Fillet ahead of the fin leading edge, only from measured length and height.
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
      // Rudder hinge.
      const hb = finBase(xte) + 0.25 * V.height
      hairline([
        [xte + 0.15 * V.rootChord, 0, hb],
        [topTE + 0.05 * V.tipChord, 0, finTop - 0.06 * V.height],
      ])
    }
  }
  // Stabiliser: rootLEx / rootChord apply at span station rootY; the leading edge sweeps from there to the tip.
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

  // Fuselage silhouette: rings along the body, from the tail end to the nose.
  const rings: P3[] = []
  for (let i = 0; i <= 40; i++) rings.push(...ring(Xt + (i / 40) * (L - Xt)))

  if (shadow !== undefined) {
    // Straight down onto the plinth top: one shape, so the translucent fill never doubles where parts overlap.
    const flat = (pts: readonly P3[]) =>
      pts.map(([x, y]): Pt => s.project(A([x, y, shadow - O[2]])))
    s.area(
      [hull(flat(rings)), flat(wingTop(-1)), flat(wingTop(1)), flat(stabPts(-1)), flat(stabPts(1))],
      'shadow',
    )
    return
  }

  // Paint back to front: far side, fuselage, near side.
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
    // Crown seam for volume, where the top meets the near side.
    hairline(Array.from({ length: 39 }, (_, i) => surf(Xt + ((i + 1) / 40) * (L - Xt), 62)))
    // Cockpit glazing: aft edge, forward edge and section angles from the record (defaults: 1.2 m long, 30 to 46 degrees).
    const CK = F.cockpit ?? {},
      c0 = L - (CK.aftX ?? F.cockpitWindowX)
    const c1 = Math.min(CK.foreX != null ? L - CK.foreX : c0 + 1.2, L - 0.3)
    const lo = CK.lowDeg ?? 30,
      hi = CK.highDeg ?? 46
    // Cabin windows: an unlit strip between the cockpit and the tail taper, dashed per window once the scale can show
    // them, else one thin band. The lit plane adds accent runs with their glow over it, from nose (t = 0) to tail (t = 1),
    // so CSS can switch them on in order.
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
      // Runs align to a whole window pitch, keeping the dash pattern continuous.
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
    // Beacon on the crown.
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

/** Podium block heights by rank, in px, and the numeral engraved on each block's front. */
const PODIUM: Record<number, number> = { 1: 16, 2: 12, 3: 9 }
const NUMERAL = 8
/** The podium's tallest figure, so the tile stays near its neighbours' height. */
const MAX_HEIGHT = 125
/** At podium scale the stand alone is about a pixel, hidden under the belly: the planes stand this many px higher, so the rod shows. */
const RISE = 3

type Block = { x: number; y: number; w: number; d: number; H: number }

/**
 * Fleet figure. `types` is ranked most flown first (ties by ICAO code), each with its refs body class for stand-ins.
 * `podium` (the mobile tile) stands the top three on blocks side by side along x, touching and one depth deep, so their fronts read as
 * one stepped face: second, first, third from the left, each block length + 8 m long, its height set by rank and its rank engraved on
 * its front. `lineup` (the section head) draws them on plinths sized to each (length + 8 m by span + 1 m), stacked front to back.
 * Both draw at one true scale, solved so the figure is `width` px wide (the podium at most MAX_HEIGHT tall), with the most flown lit
 * in the middle.
 * Parts on the lit plane: `shadow` (its contact shadow on its block), `rod` (its stand, which slides up with it from the block top)
 * and `plane`, both carrying --lift-y; `plane` holds `window` runs (each carries --t, 0 at the nose). `generic` wraps stand-in outlines
 * so CSS can fade their strokes.
 */
export function fleet(
  types: { icao: string; body: string | null }[],
  width: number,
  mode: 'podium' | 'lineup',
): IsoFigureData {
  if (!types.length) return { width, height: 12, viewBox: `0 0 ${width} 12`, nodes: [] }
  // Second, first, third (left to right on the podium, back to front in the lineup), so the most flown sits in the middle.
  const order = [types[1], types[0], types[2]].filter(Boolean)
  const lit = order.length > 1 ? 1 : 0
  const planes = order.map((t) => resolve(t.icao, t.body))
  // One stand for the composition: the lowest point any plane draws, plus the clearance.
  const standBase = CLEARANCE - Math.min(...planes.map(lowestZ))
  // The rod stands where the tail taper starts: aft of the wing and ahead of the tailplane, so nothing is in front of it.
  const rodAt = ({ dims, fuselage: F }: Geometry) =>
    dims.length - (F.end ?? dims.length) + F.tailconeLength + 0.5
  /** One plane centred on the top of its block (at x, y, w by d, H tall), `rise` m above the stand, with its contact shadow and rod. */
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
    // Stand: a rod from the block top into the belly.
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
      // The lit plane is a specific aircraft type, drawn in its maker's colour as the chart's bar is; no known maker leaves it on the accent.
      vars = {
        '--lift-y': `${liftY}px`,
        ...(maker === 'unknown' ? {} : { '--figure-live-fill': `var(--cat-maker-${maker})` }),
      }
    s.group('shadow', shadow)
    // The rod is built LIFT longer below the block top and clipped there, so it slides out of the block as the plane rises.
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
    // Bounds cover the lifted plane at its real height, so the motion never leaves the figure's box.
    s.include([
      [O[0], O[1] - g.dims.span / 2, O[2] + LIFT + g.dims.height],
      [O[0] + g.dims.length, O[1] - g.dims.span / 2, O[2] + LIFT + g.dims.height],
      [O[0], O[1] + g.dims.span / 2, O[2] + LIFT],
    ])
    s.group('plane', body, { vars })
  }
  const C = Math.cos(Math.PI / 6),
    pad = 12.5 // Scene.done pads 6px each side and rounds the width up
  if (mode === 'podium') {
    // The winner's near tailplane reaches down-left on screen toward the second's nose, and further once it lifts: the second's block
    // grows by that tailplane's semi-span, so the two stay apart.
    const reach = planes[lit].g.htail.span / 2
    const ws = planes.map(({ g }, i) => g.dims.length + 8 + (i < lit ? reach : 0)),
      D = Math.max(...planes.map(({ g }) => g.dims.span)) + 1
    const build = (k: number) => {
      const s = new Scene(k)
      let x = 0
      planes.forEach((_, i) => {
        // Painted left to right: each block stands nearer the viewer than everything on the block before it.
        const rank = types.indexOf(order[i]) + 1,
          H = PODIUM[rank] / k,
          w = ws[i]
        s.box(x, 0, 0, w, D, H, { stroke: 'detail' })
        const size = NUMERAL / k // digits stand about 0.7 em tall: centre them on the front
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
    // Every plane stays inside its block's plan, so the plan corners (0, D) and (run, 0) set the width. A lone or tall plane would
    // stand taller than the tile's neighbours at that scale, so it draws smaller instead.
    const fig = build((width - pad) / (C * (ws.reduce((a, b) => a + b) + D)))
    if (fig.height <= MAX_HEIGHT) return fig
    return build(fitK(MAX_HEIGHT, (k) => ({ width: build(k).height })))
  }
  const sizes = planes.map(({ g }) => ({ w: g.dims.length + 8, d: g.dims.span + 1 })),
    Wmax = Math.max(...sizes.map((p) => p.w))
  // Side faces flush, so the stack reads as one shelf; y is before the gaps.
  let depth = 0
  const plinths = sizes.map(({ w, d }) => {
    const y = depth
    depth += d
    return { x: Wmax - w, y, w, d }
  })
  const H = 4,
    GAP = 6 // px between plinths, so the seam reads as space rather than a doubled line
  const draw = (k: number, gap: number) => {
    const s = new Scene(k)
    plinths.forEach(({ x, y, w, d }, i) => {
      s.box(x, y + i * gap, 0, w, d, H, { stroke: 'detail' })
      mount(s, i, { x, y: y + i * gap, w, d, H })
    })
    return s.done()
  }
  // Every plane stays inside its plinth's plan, so plinth corners set the width. A corner projects to C·(x − y)·k px, and plinth i
  // sits i gaps of GAP px further forward, so each pair of a right corner (x + w, y) and a left corner (x, y + d) reaches `width`
  // at its own k; the figure's width is the widest pair, so the smallest of those k fits.
  let k = Infinity
  plinths.forEach((r, i) =>
    plinths.forEach((l, j) => {
      const run = r.x + r.w - r.y - (l.x - l.y - l.d)
      if (run > 0) k = Math.min(k, (width - pad + C * GAP * (i - j)) / (C * run))
    }),
  )
  return draw(k, GAP / k)
}
