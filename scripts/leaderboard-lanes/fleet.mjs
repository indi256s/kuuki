// Lane airliners, one per ICAO type, generated from the measured geometry in packages/data/src/aircraft-geometry/*.json
// (fields per SCHEMA.md; the planform and tail rules follow apps/next/src/client/overview/iso/fleet.ts). Same camera,
// line weight, tone system, livery rule and level-of-detail switch as the gate (build.mjs, via common.mjs).
// Build-time only: it writes one SVG file per type, a gallery and a line-check page. Nothing here is wired into the app.
//
//   node scripts/leaderboard-lanes/fleet.mjs           writes .scratch/leaderboard-lanes/fleet/* and fleet.html
//   node scripts/leaderboard-lanes/fleet.mjs --audit   also runs the kit audit on every type
//   MASS=1 node …                                      lengths blend true scale (0) and equal area (1); default 0.5
//
// Each type is drawn in metres and scaled so the nose sits at x = 100. Its length is the geometric mean of true scale
// (against the A21N at 100) and equal silhouette area with the A21N (MASS 0.5): big types stay bigger, small ones keep
// lane weight. Estimated here, not in the data: belly height (clears the lowest nacelle),
// gear stations, wheel sizes, bogie axles, door stations, window-row height on one-deck types, wing and tail thickness.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  A,
  ART_CSS,
  k,
  BOUNDS,
  D,
  DEG,
  G,
  HOST_CSS,
  KS,
  L,
  LEN,
  P,
  S,
  SIDE,
  THEMES,
  XF,
  YF,
  at,
  coarse,
  css,
  emit,
  f1,
  fine,
  loftOf,
  pathOf,
  sheared,
  silhouetteArea,
  wheel,
  workshop,
} from './common.mjs'

const DATA = 'packages/data/src/aircraft-geometry'
const OUT = '.scratch/leaderboard-lanes/fleet'
const TYPES = [
  'A319',
  'A320',
  'A20N',
  'A321',
  'A21N',
  'A332',
  'A333',
  'A359',
  'A35K',
  'A388',
  'B733',
  'B738',
  'B38M',
  'B763',
  'B788',
  'B77W',
  'E170',
  'E195',
  'SU95',
  'DH8B',
]
const REFERENCE = 'A21N'
const MASS = Number(process.env.MASS ?? 0.5)
// Facets: the nacelles stay under ~30 px at the 4× view, so they need fewer than the gate's lathe steps.
const NAC_STEPS = Number(process.env.NAC_STEPS ?? 24)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const tan = (deg) => Math.tan(deg * DEG)

const records = new Map(
  readdirSync(DATA)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(DATA, f), 'utf8')))
    .map((r) => [r.icao, r]),
)

// The generic fallback, as fleet.ts draws an unknown narrowbody: a plain body, wing and tail sized to the class, no
// wingtip device and no engines (their number and mounting would claim a type).
function genericGeometry(
  { length: Lg, span: b, height: h, width: w } = { length: 37, span: 34, height: 11.8, width: 3.9 },
) {
  const hh = 1.05 * w
  return {
    icao: 'GENERIC',
    name: 'Airliner',
    dims: { length: Lg, span: b, height: h, fuselageWidth: w, fuselageHeight: hh },
    fuselage: {
      noseLength: 1.5 * w,
      tailconeLength: Math.min(2.4 * w, 0.3 * Lg),
      tailUpsweep: 0.35 * w,
      cockpitWindowX: 0.85 * w,
      decks: 1,
    },
    wing: {
      position: 'low',
      rootLEx: 0.34 * Lg,
      rootChord: 0.16 * b,
      kinkY: 0.14 * b,
      tipChord: 0.045 * b,
      sweepLE: 27,
      dihedral: 5,
    },
    wingtip: { type: 'none', height: 0, below: 0, cant: 0, rakeSpan: 0 },
    htail: {
      position: 'fuselage',
      rootLEx: 0.85 * Lg,
      span: 0.36 * b,
      rootChord: 0.09 * b,
      tipChord: 0.03 * b,
      sweepLE: 35,
      dihedral: 6,
    },
    vtail: {
      rootLEx: 0.78 * Lg,
      height: Math.max(0.12 * b, h - 1.6 - hh),
      rootChord: 0.14 * Lg,
      tipChord: 0.05 * Lg,
      sweepLE: 38,
      dorsalFin: false,
    },
    engines: [],
  }
}

/** A convex polygon (2D) through the given points, for prisms: the kit's prism needs a convex ring. */
const hull2 = (pts) => G.hullOf(pts)

// ======================================================================================================
// One airliner from its record. Stations xs run aft from the nose tip in metres (the data's convention); heights z are
// metres above the fuselage bottom. W3 maps them to world units: nose at x = LEN, +y toward the viewer, ground z = 0.
// ======================================================================================================
function airlinerFrom(g, len = LEN) {
  const W = workshop('air')
  const { dims: Dm, fuselage: F, wing: Wg, wingtip: T, htail: H, vtail: V } = g
  const Lm = Dm.length
  const m = len / Lm
  const X = (xs) => LEN - xs * m
  const E = F.end ?? Lm // fuselage tail end
  const rh = Dm.fuselageWidth / 2
  const rv = Dm.fuselageHeight / 2
  const fH = Dm.fuselageHeight
  const ln = F.noseLength
  const lt = F.tailconeLength
  const T0 = E - lt // start of the tail taper
  const nn = F.noseExponent ?? 2.4
  const bladeTail = F.tailEnd === 'blade'

  // Fuselage: oval section (rh × rv), superellipse nose whose axis drops 0.28 rv, linear taper raised by the upsweep.
  const sv = (xs) => {
    if (xs < ln) return Math.max(0, 1 - ((ln - xs) / ln) ** nn) ** (1 / nn)
    if (xs > T0) return 1 - 0.8 * clamp((xs - T0) / lt, 0, 1)
    return 1
  }
  const sw = (xs) => {
    const v = sv(xs)
    if (!bladeTail || E - xs >= 0.55 * lt) return v
    const u = clamp((E - xs) / (0.55 * lt), 0, 1)
    return v * (0.3 + 0.7 * u * u * (3 - 2 * u))
  }
  const Zc = (xs) => {
    if (xs < ln) return rv - 0.28 * rv * ((ln - xs) / ln)
    if (xs > T0) return rv + F.tailUpsweep * clamp((xs - T0) / lt, 0, 1) ** 1.3
    return rv
  }
  const crownZ = (xs) => Zc(xs) + rv * sv(xs)
  const bellyZ = (xs) => Zc(xs) - rv * sv(xs)
  /** Near-side half-width at station xs and height z, or null outside the section. */
  const nearY = (xs, z) => {
    const q = (z - Zc(xs)) / (rv * sv(xs) || 1e-9)
    return Math.abs(q) >= 1 ? null : rh * sw(xs) * Math.sqrt(1 - q * q)
  }

  // Wing (fleet.ts rules, in stations): swept leading edge from the body side, optional inboard break, straight
  // inboard trailing edge to the kink, raked tips from measured vertices; wingtip devices take the span's last metres.
  const half = Dm.span / 2
  const high = Wg.position === 'high'
  const lean = (h, c) => h * tan(c)
  const bladed = ['sharklet', 'blended', 'curved', 'at-winglet'].includes(T.type)
  const upY = bladed ? (T.rootY != null ? half - T.rootY : lean(T.height, T.cant)) : 0
  const dnY = T.type === 'at-winglet' && T.below > 0 ? lean(T.below, Math.min(60, T.cant + 25)) : 0
  const hw = T.rootY ?? half - Math.max(upY, dnY)
  const raked = T.type === 'raked'
  const rLE = raked && T.rakeLE?.length > 1 ? T.rakeLE : null
  const rTE = raked && T.rakeTE?.length > 1 ? T.rakeTE : null
  const rk = Boolean(rLE && rTE)
  const along = (pts, y) => {
    if (y <= pts[0].y) return pts[0].x
    for (let i = 1; i < pts.length; i++)
      if (y <= pts[i].y)
        return (
          pts[i - 1].x +
          ((pts[i].x - pts[i - 1].x) * (y - pts[i - 1].y)) / (pts[i].y - pts[i - 1].y || 1e-9)
        )
    return pts[pts.length - 1].x
  }
  const yr = rk ? rLE[0].y : hw - (raked ? T.rakeSpan : 0)
  const tanS = tan(Wg.sweepLE)
  const tanIn = tan(Wg.sweepLEInboard ?? Wg.sweepLE)
  const tanOut = tan(T.rakeSweepLE ?? Wg.sweepLE + 20)
  const yb =
    Wg.leBreakY != null && Wg.sweepLEInboard != null && Wg.leBreakY > 0.8 * rh && Wg.leBreakY < yr
      ? Wg.leBreakY
      : null
  const le = (y) => {
    const ay = Math.min(y, yr)
    const b =
      yb == null
        ? Wg.rootLEx + (ay - rh) * tanS
        : Wg.rootLEx + (Math.min(ay, yb) - rh) * tanIn + Math.max(0, ay - yb) * tanS
    if (rk && y > yr) return along(rLE, y)
    return raked && y > yr ? b + (y - yr) * tanOut : b
  }
  const teRoot = Wg.rootLEx + Wg.rootChord
  const teTip = rk ? rTE[rTE.length - 1].x : le(hw) + Wg.tipChord
  const teEndY = rk ? rTE[0].y : hw
  const teEndX = rk ? rTE[0].x : teTip
  const kink = Wg.kinkY == null ? null : clamp(Wg.kinkY, rh, teEndY - 0.1)
  const te = (y) => {
    if (y <= (kink ?? rh)) return teRoot
    if (rk && y > teEndY) return along(rTE, y)
    const y1 = kink ?? rh
    return teRoot + ((y - y1) / (teEndY - y1)) * (teEndX - teRoot)
  }
  const tipY = rk ? rLE[rLE.length - 1].y : hw
  const th = clamp(0.06 * Wg.rootChord, 0.16, 0.7) // drawn wing thickness, constant
  const zw = high ? 0.94 * fH : 0.225 * fH // upper surface at the root
  const dih = tan(Wg.dihedral)
  // The root sits on the skin where the plate is widest: the upper surface of a low wing, the lower of a high one.
  const yRoot = (nearY(ln + 0.5 * (T0 - ln), high ? zw - th : zw) ?? 0.5 * rh) - 0.03
  const wz = (y) => zw + Math.max(0, y - yRoot) * dih // upper surface at span station y
  const wl = (y) => wz(y) - th // lower surface

  // Belly height: the fuselage bottom sits high enough for the lowest nacelle to clear the ground by 0.5 m.
  const engines = g.engines ?? []
  const nacLow = Math.min(
    0,
    ...engines.map((e) => wl(e.y) - e.dropBelowWing - e.nacelleDiameter / 2),
  )
  const B = Math.max(0.42 * fH, 0.5 - nacLow)
  const W3 = (xs, y, z) => [X(xs), y * m, (B + z) * m]

  // ---------- fuselage: one loft, nose to tail ----------
  const RING = Number(process.env.RING ?? 32)
  const stations = []
  for (let i = 0; i <= 16; i++)
    stations.push(0.004 * ln + (ln - 0.004 * ln) * (1 - (1 - i / 16) ** 2.2))
  for (let i = 1; i <= 2; i++) stations.push(ln + ((T0 - ln) * i) / 2)
  for (let i = 1; i <= 12; i++) stations.push(T0 + ((E - 0.002 * lt - T0) * i) / 12)
  const ringAt = (xs) =>
    Array.from({ length: RING }, (_, j) => {
      const t = (j / RING) * 2 * Math.PI
      return W3(xs, rh * sw(xs) * Math.cos(t), Zc(xs) + rv * sv(xs) * Math.sin(t))
    })
  const foreRings = stations.filter((xs) => xs <= T0 + 1e-9).map(ringAt)
  const tailRings = stations.filter((xs) => xs >= T0 - 1e-9).map(ringAt)
  const onSkin = (xs, z, out = 0.01) => {
    const y = nearY(xs, z)
    return y === null ? null : W3(xs, y + out, z)
  }
  const onAngle = (xs, deg) =>
    W3(xs, rh * sw(xs) * Math.cos(deg * DEG) + 0.01, Zc(xs) + rv * sv(xs) * Math.sin(deg * DEG))
  // Window rows: one per deck, dots at a 0.533 m pitch from behind the cockpit to the taper; below the size threshold
  // each row becomes one band.
  const rows =
    F.decks === 2
      ? [F.mainDeckWindowZ ?? 0.46 * fH, F.upperDeckWindowZ ?? 0.8 * fH]
      : [F.mainDeckWindowZ ?? 0.6 * fH]
  const cabin0 = F.cockpitWindowX + 2.0
  const cabin1 = T0 + 0.3 * lt
  const doorW = rh > 2.5 ? 1.07 : 0.81
  const doorsAt = [F.cockpitWindowX + 1.0, cabin1 - 0.4 - doorW]
  const midDoors = Math.max(0, Math.round((doorsAt[1] - doorsAt[0]) / 14) - 1)
  for (let i = 1; i <= midDoors; i++)
    doorsAt.push(doorsAt[0] + ((doorsAt[1] - doorsAt[0]) * i) / (midDoors + 1))
  const dots = []
  const bands = []
  for (const zr of rows) {
    for (let xs = cabin0; xs <= cabin1; xs += 0.533) {
      if (doorsAt.some((d) => xs > d - 0.3 && xs < d + doorW + 0.3)) continue
      const p = onSkin(xs, zr)
      if (p) dots.push(at(p))
    }
    const hb = Math.max(0.3, 0.9 / m) // half-height of the band, at least 0.9 world units (about 0.6 px at 64 px)
    const top = []
    const bot = []
    for (let xs = cabin0; xs <= cabin1; xs += (cabin1 - cabin0) / 24) {
      top.push(onSkin(xs, zr + hb, 0.02))
      bot.push(onSkin(xs, zr - hb, 0.02))
    }
    bands.push(
      `<path class="lv-band" d="${pathOf([...top, ...bot.reverse()].filter(Boolean), true)}"/>`,
    )
  }
  const doorPath = (xs, z0, z1) => {
    const pts = []
    for (let z = z0; z <= z1 + 1e-6; z += (z1 - z0) / 6) pts.push(onSkin(xs, z))
    for (let z = z1; z >= z0 - 1e-6; z -= (z1 - z0) / 6) pts.push(onSkin(xs + doorW, z))
    return pathOf(pts.filter(Boolean), true)
  }
  const doorRows =
    F.decks === 2
      ? [
          [0.3 * fH, 0.56 * fH],
          [0.68 * fH, 0.9 * fH],
        ]
      : [[0.3 * fH, rows[0] + 0.28 * fH]]
  const doors = doorsAt.flatMap((d) => doorRows.map(([z0, z1]) => doorPath(d, z0, z1))).join('')
  // Cockpit glazing on the nose skin: a side window and the windscreen, between the record's section angles.
  const CK = F.cockpit ?? {}
  const c0 = CK.aftX ?? F.cockpitWindowX
  const c1 = CK.foreX ?? c0 - 1.2
  const lo = CK.lowDeg ?? 30
  const hi = CK.highDeg ?? 46
  const wdt = c0 - c1
  const glass = (corners) => {
    const pts = []
    for (let i = 0; i < corners.length; i++) {
      const [ax, ad] = corners[i]
      const [bx, bd] = corners[(i + 1) % corners.length]
      for (let t = 0; t < 4; t++)
        pts.push(onAngle(ax + ((bx - ax) * t) / 4, ad + ((bd - ad) * t) / 4))
    }
    const d = pathOf(pts, true)
    return `<path class="lv-glass" d="${d}"/>` + L(d, { tone: 'hi' })
  }
  const cockpit =
    glass([
      [c0, lo],
      [c0 - 0.45 * wdt, lo - 2],
      [c0 - 0.45 * wdt, hi + 4],
      [c0, hi],
    ]) +
    glass([
      [c0 - 0.55 * wdt, lo - 2],
      [c1, lo - 4],
      [c1, hi + 14],
      [c0 - 0.55 * wdt, hi + 10],
    ])
  // Audit stand-ins: lathes along the nose, barrel and taper axes (radius = half-width) and a thin side-profile slab
  // that carries the crown (taller than wide on the A380).
  const along3 = (a, b) => {
    const p0 = W3(a, 0, Zc(a))
    const p1 = W3(b, 0, Zc(b))
    const F3 = G.frameAlong(p0, G.sub3(p1, p0))
    const Ls = G.len3(G.sub3(p1, p0))
    const prof = Array.from({ length: 9 }, (_, i) => {
      const xs = a + ((b - a) * i) / 8
      return [(Ls * i) / 8, Math.max(0.01, rh * sw(xs) * m)]
    })
    return A.solid(F3, prof)
  }
  // Two items, one skin (one owner): the barrel and nose, and the tail cone, so the fin and the tailplanes can be painted
  // between the tail cone and the parts in front of it.
  const sideOf = (a, b) =>
    A.prism(
      SIDE(-0.35 * rh * m),
      hull2(
        stations
          .filter((xs) => xs >= a - 1e-9 && xs <= b + 1e-9)
          .flatMap((xs) => [
            [X(xs), (B + crownZ(xs)) * m],
            [X(xs), (B + bellyZ(xs)) * m],
          ]),
      ),
      0,
      0.7 * rh * m,
      {},
    )
  W.put(
    'fuselage',
    W3(T0 / 2, 0, rv),
    S(loftOf(foreRings, { open: 'end' }), { tone: 'hi' }) +
      fine(
        L(doors, { tone: 'mid' }) + D(dots, { size: 0.2 * KS * Math.min(1, m / 1.6), tone: 'hi' }),
      ) +
      coarse(bands.join('')) +
      cockpit,
    [along3(0.01, ln), along3(ln, T0), sideOf(0, T0)],
    { livery: true },
  )
  W.put(
    'tailcone',
    W3(T0 + lt / 2, 0, rv),
    S(loftOf(tailRings, { open: 'start' }), { tone: 'hi' }),
    [along3(T0, E - 0.01), sideOf(T0, E)],
    { livery: true, own: 'air.fuselage' },
  )

  // ---------- wings ----------
  const ys = [
    yRoot,
    ...(yb == null ? [] : [yb]),
    ...(raked ? [yr] : []),
    ...(rk ? rLE.slice(1).map((p) => p.y) : [hw]),
  ]
  const plan = [
    ...ys.map((y) => [le(y), y]),
    ...(rk ? [...rTE].reverse().map((p) => [p.x, p.y]) : [[teTip, hw]]),
    ...(kink == null ? [] : [[te(kink), kink]]),
    [teRoot, yRoot],
  ]
  const DIH = Math.atan(dih)
  const wingOwner = (sd) => (sd > 0 ? 'air.wing.near' : 'air.wing.far')
  for (const sd of [1, -1]) {
    const v = [0, sd * Math.cos(DIH), Math.sin(DIH)]
    const n0 = G.unit3(G.cross3([1, 0, 0], v))
    const Fw = G.frameOf(
      W3(0, sd * yRoot, wl(yRoot)),
      n0[2] < 0 ? G.mul3(n0, -1) : n0,
      [1, 0, 0],
      v,
    )
    // The frame origin carries x = 0, so u is the world x itself.
    Fw.o = [0, Fw.o[1], Fw.o[2]]
    const poly = hull2(plan.map(([xs, y]) => [X(xs), ((y - yRoot) / Math.cos(DIH)) * m]))
    // Flap hinge line 24% ahead of the trailing edge, on the near wing only.
    const onTop = (xs, y) =>
      G.add3(
        Fw.o,
        G.add3(
          G.mul3(Fw.u, X(xs)),
          G.add3(G.mul3(Fw.v, ((y - yRoot) / Math.cos(DIH)) * m), G.mul3(Fw.a, th * m)),
        ),
      )
    const hinge = []
    const yEnd = Math.min(hw, teEndY) - 0.2
    for (let i = 0; i <= 10; i++) {
      const y = yRoot + 0.15 + ((yEnd - yRoot - 0.15) * i) / 10
      hinge.push(onTop(te(y) - 0.24 * (te(y) - le(y)), y))
    }
    const cuts = [kink ?? 0.35 * hw, 0.7 * hw]
      .map((y) => pathOf([onTop(te(y) - 0.24 * (te(y) - le(y)), y), onTop(te(y) - 0.01, y)]))
      .join('')
    W.prism(sd > 0 ? 'wing.near' : 'wing.far', Fw, poly, 0, th * m, {
      tone: 'hi',
      inner: sd > 0 ? fine(L(pathOf(hinge) + cuts, { tone: 'faint' })) : '',
    })
    // Wingtip devices: blades on the tip, canted outward, swept back; the fence and the AT winglet also hang below.
    const ct = Wg.tipChord
    const x0 = le(hw)
    const bladeOf = (name, { h, rake, topC, root = ct, down = false, cant = T.cant, dx = 0 }) => {
      if (!(h > 0)) return
      const BT = 0.12
      const c = cant * DEG
      const vv = [0, sd * Math.sin(c), down ? -Math.cos(c) : Math.cos(c)]
      const aa = G.unit3(G.cross3([1, 0, 0], vv))
      const zBase = down ? wl(hw) + 0.3 * th : wz(hw) - 0.3 * th
      const Fb = G.frameOf([0, (sd * hw - sd * 0.05) * m, (B + zBase) * m], aa, [1, 0, 0], vv)
      const xa = x0 + dx
      const poly = hull2([
        [X(xa), 0],
        [X(xa + root), 0],
        [X(xa + h * tan(rake) + root * topC), h * m],
        [X(xa + h * tan(rake)), h * m],
      ])
      W.prism(`${name}.${sd > 0 ? 'near' : 'far'}`, Fb, poly, (-BT / 2) * m, (BT / 2) * m, {
        tone: 'hi',
        own: wingOwner(sd),
      })
    }
    switch (T.type) {
      case 'fence':
        bladeOf('fence', {
          h: T.height,
          rake: 38,
          topC: 0.3,
          root: 0.75 * ct,
          dx: 0.1 * ct,
          cant: 0,
        })
        bladeOf('fence.lower', {
          h: T.below,
          rake: 38,
          topC: 0.3,
          root: 0.75 * ct,
          dx: 0.1 * ct,
          cant: 0,
          down: true,
        })
        break
      case 'sharklet':
        bladeOf('sharklet', { h: T.height, rake: 38, topC: 0.4 })
        break
      case 'blended':
        bladeOf('winglet', { h: T.height, rake: 42, topC: 0.4 })
        break
      case 'curved':
        bladeOf('winglet', { h: T.height, rake: 52, topC: 0.3 })
        break
      case 'at-winglet':
        bladeOf('winglet', { h: T.height, rake: 36, topC: 0.35 })
        bladeOf('winglet.lower', {
          h: T.below,
          rake: 30,
          topC: 0.45,
          root: 0.8 * ct,
          dx: 0.1 * ct,
          cant: Math.min(60, T.cant + 25),
          down: true,
        })
        break
      default:
    }
  }

  // ---------- engines ----------
  for (const [ei, e] of engines.entries()) {
    for (const sd of [1, -1]) {
      const tagOf = (part) =>
        `${part}${engines.length > 1 ? ei + 1 : ''}.${sd > 0 ? 'near' : 'far'}`
      const y = sd * e.y
      const d = e.nacelleDiameter
      const NR = (d / 2) * m
      const NL = e.nacelleLength * m
      const prop = Boolean(e.prop)
      const zc = wl(e.y) - e.dropBelowWing
      const nac = (s) => {
        const u = clamp(s / NL, 0, 1)
        if (prop)
          return (
            NR *
            (u < 0.2 ? 0.82 + 0.18 * (1 - (1 - u / 0.2) ** 2) : 1 - 0.62 * ((u - 0.2) / 0.8) ** 1.8)
          )
        return u < 0.3
          ? NR * (0.9 + 0.1 * (1 - (1 - u / 0.3) ** 2))
          : NR * (1 - 0.22 * ((u - 0.3) / 0.7) ** 1.6)
      }
      const nacSlope = (s) => {
        const h = 0.02
        return (
          (nac(Math.min(NL, s + h)) - nac(Math.max(0, s - h))) /
          (Math.min(NL, s + h) - Math.max(0, s - h))
        )
      }
      const NF = G.frameOf(W3(e.fanX, y, zc), [-1, 0, 0], [0, 1, 0], [0, 0, 1])
      const nprof = [[0, nac(0)]]
      for (let i = 1; i < 10; i++) nprof.push([(NL * i) / 10, nac((NL * i) / 10), 1])
      nprof.push([NL, nac(NL)])
      const lip = G.circleOf(NF, 0, nac(0), P)
      const fan = G.circleOf(NF, 0, nac(0) * 0.86, P)
      const intake = prop
        ? ''
        : `<path class="lv-intake" d="${lip}"/><path class="lv-fan" d="${fan}"/>` +
          L(fan, { tone: 'mid' }) +
          S(G.sphereOf(G.pointOf(NF, 0.25 * NR, 0, 0), nac(0) * 0.3, P), { tone: 'mid' })
      // A high wing's nacelles run through the wing: one owner with it, like the pylons and props below.
      const own = high ? wingOwner(sd) : `air.${tagOf('engine')}`
      W.turned(tagOf('nacelle'), NF, nprof, {
        tone: 'hi',
        smooth: { slope: nacSlope, radius: nac, rows: 3 },
        radius: nac,
        steps: NAC_STEPS,
        inner: prop
          ? ''
          : fine(
              L(G.arcOf(NF, NL * 0.36, nac(NL * 0.36), P, { slope: nacSlope(NL * 0.36) }), {
                tone: 'faint',
              }),
            ),
        extra: intake,
        rims: 'all',
        own,
      })
      const ex = (e.exhaustLength ?? (prop ? 0 : 0.2 * e.nacelleLength)) * m
      if (ex > 0) {
        const CF = G.frameOf(G.add3(NF.o, [-NL, 0, 0]), [-1, 0, 0], [0, 1, 0], [0, 0, 1])
        const r1 = nac(NL)
        W.turned(
          tagOf('core'),
          CF,
          [
            [0, r1 * 0.78],
            [0.6 * ex, r1 * 0.6],
            [0.6 * ex, r1 * 0.42],
            [ex, 0],
          ],
          { tone: 'mid', crease: 'lo', own },
        )
      }
      if (!high) {
        // Pylon: a swept plate from the nacelle crown back up to the wing's lower surface, inside the wing chord.
        const c = te(e.y) - le(e.y)
        const top = wl(e.y) + 0.05
        const nt = zc + 0.75 * (d / 2)
        const pyl = hull2([
          [X(e.fanX + 0.22 * e.nacelleLength), (B + nt) * m],
          [X(e.fanX + 0.85 * e.nacelleLength), (B + nt) * m],
          [X(te(e.y) - 0.15 * c), (B + top) * m],
          [X(le(e.y) + 0.12 * c), (B + top) * m],
        ])
        const PT = 0.3 * (d / 2) * m
        W.prism(tagOf('pylon'), SIDE(y * m - PT / 2), pyl, 0, PT, { tone: 'mid', own })
      } else {
        // A high wing's nacelle is deep: the main gear bay hangs under the engine as a long pod.
        const podR = 0.42 * d * m
        const podL = 0.66 * NL
        const pod = (s) => podR * Math.max(0, Math.sin(Math.PI * clamp(s / podL, 0, 1))) ** 0.6
        const podSlope = (s) => (pod(Math.min(podL, s + 0.02)) - pod(Math.max(0, s - 0.02))) / 0.04
        const PF0 = G.frameOf(
          G.add3(NF.o, [-0.16 * NL, 0, -0.5 * d * m]),
          [-1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        )
        const pprof = [[0, 0]]
        for (let i = 1; i < 12; i++) pprof.push([(podL * i) / 12, pod((podL * i) / 12), 1])
        pprof.push([podL, 0])
        W.turned(tagOf('pod'), PF0, pprof, {
          tone: 'hi',
          smooth: { slope: podSlope, radius: pod, rows: 4 },
          radius: pod,
          own,
        })
      }
      if (prop) {
        // Static four-blade propeller: spinner cone ahead of the nacelle, blades in the disc plane, faint disc.
        const R = (e.prop.diameter / 2) * m
        const xs = e.fanX - 0.18
        const SF = G.frameOf(W3(e.fanX + 0.02, y, zc), [1, 0, 0], [0, 1, 0], [0, 0, 1])
        const sl = 0.75 * m
        const sr = nac(0) * 0.92
        const spin = [
          [0, sr],
          [0.35 * sl, sr * 0.85, 1],
          [0.7 * sl, sr * 0.5, 1],
          [sl, 0],
        ]
        const PF = G.frameOf(W3(xs, y, zc), [1, 0, 0], [0, 1, 0], [0, 0, 1])
        const disc = G.circleOf(PF, 0, R, P, 40)
        // The faint disc is part of the spinner item; its thin-disc stand-in keeps the audit's coverage honest.
        W.put(
          tagOf('spinner'),
          G.add3(SF.o, [sl / 2, 0, 0]),
          S(G.solidOf(spin, SF, P, { smooth: 'auto', steps: 40 }), {
            tone: 'mid',
            crease: 'faint',
          }) + fine(`<path class="lv-disc" d="${disc}"/>`),
          [A.solid(SF, spin), A.disc(PF, -0.01 * m, 0.01 * m, R, {})],
          { own },
        )
        const bt = 0.07 * m
        for (const [bi, phi] of [18, 108, 198, 288].entries()) {
          const u = [0, Math.cos(phi * DEG), Math.sin(phi * DEG)]
          const vv = [0, -Math.sin(phi * DEG), Math.cos(phi * DEG)]
          const BF = G.frameOf(W3(xs, y, zc), [1, 0, 0], u, vv)
          const w0 = 0.16 * m
          const w1 = 0.07 * m
          W.prism(
            `${tagOf('blade')}#${bi + 1}`,
            BF,
            [
              [0.5 * sr, -w0],
              [R, -w1],
              [R, w1],
              [0.5 * sr, w0],
            ],
            -bt / 2,
            bt / 2,
            { tone: 'mid', own },
          )
        }
      }
    }
  }

  // ---------- tail ----------
  const finT = 0.3 * m
  const finBase = (xs) => crownZ(xs) - 0.02 * rv * sv(xs)
  const xf = V.rootLEx
  const finTop = crownZ(xf) + V.height
  const topLE = xf + V.height * tan(V.sweepLE)
  const topTE = topLE + V.tipChord
  const xte = Math.min(E - 0.05, xf + V.rootChord)
  const hingeRoot = xf + 0.7 * (xte - xf)
  const hingeTop = topLE + 0.7 * V.tipChord
  const zz = (z) => (B + z) * m
  // The fin, rudder, dorsal fillet and tailplanes share the fuselage's owner: one airframe. Their straight roots cross the
  // tail cone's curved crown, whose audit stand-in (a hull of the side profile) sits a little above the drawn skin.
  W.prism(
    'fin',
    SIDE(-finT / 2),
    hull2([
      [X(xf), zz(finBase(xf))],
      [X(topLE), zz(finTop)],
      [X(hingeTop), zz(finTop)],
      [X(hingeRoot), zz(finBase(hingeRoot))],
    ]),
    0,
    finT,
    { tone: 'hi', livery: true, own: 'air.fuselage' },
  )
  W.prism(
    'rudder',
    SIDE(-finT * 0.4),
    hull2([
      [X(hingeRoot), zz(finBase(hingeRoot))],
      [X(hingeTop), zz(finTop)],
      [X(topTE), zz(finTop)],
      [X(xte), zz(finBase(xte) + 0.1)],
    ]),
    0,
    finT * 0.8,
    { tone: 'hi', livery: true, own: 'air.fuselage' },
  )
  if (V.dorsalFin && V.dorsalLength != null && V.dorsalHeight != null) {
    const dl = V.dorsalLength
    const dh = V.dorsalHeight
    W.prism(
      'dorsal',
      SIDE(-finT * 0.45),
      hull2([
        [X(xf - dl), zz(finBase(xf - dl))],
        [X(xf + dh * tan(V.sweepLE)), zz(crownZ(xf) + dh)],
        [X(xf), zz(finBase(xf))],
      ]),
      0,
      finT * 0.9,
      { tone: 'hi', livery: true, own: 'air.fuselage' },
    )
  }
  // Stabiliser: rootLEx / rootChord at span station rootY, leading edge swept to the measured tip anchors.
  const tTail = H.position === 't-tail'
  const semi = H.span / 2
  const yRootH = tTail ? 0 : (H.rootY ?? 0.8 * rh * sw(H.rootLEx))
  const tipLE = H.tipLEx ?? H.rootLEx + (semi - yRootH) * tan(H.sweepLE)
  const tipTE = Math.min(Lm - 0.01, H.tipTEx ?? tipLE + H.tipChord)
  const tanH = (tipLE - H.rootLEx) / (semi - yRootH)
  const chordAt = (y) =>
    H.rootChord + ((tipTE - tipLE - H.rootChord) * (y - yRootH)) / (semi - yRootH)
  const hz = tTail ? finTop - (H.zBelowFinTop ?? 0) : Zc(H.rootLEx + 0.4 * H.rootChord) - 0.1
  const y0 = tTail
    ? 0
    : Math.min(yRootH, 0.95 * (nearY(H.rootLEx + 0.4 * H.rootChord, hz) ?? rh * sw(H.rootLEx)))
  const hT = clamp(0.05 * H.rootChord, 0.14, 0.4)
  const HD = H.dihedral * DEG
  for (const sd of [1, -1]) {
    const v = [0, sd * Math.cos(HD), Math.sin(HD)]
    const n0 = G.unit3(G.cross3([1, 0, 0], v))
    const Fh = G.frameOf(
      [0, sd * y0 * m, zz(hz - hT / 2)],
      n0[2] < 0 ? G.mul3(n0, -1) : n0,
      [1, 0, 0],
      v,
    )
    const dd = ((semi - y0) / Math.cos(HD)) * m
    const leR = H.rootLEx - (yRootH - y0) * tanH
    const poly = hull2([
      [X(leR), 0],
      [X(tipLE), dd],
      [X(tipTE), dd],
      [X(leR + chordAt(y0)), 0],
    ])
    W.prism(sd > 0 ? 'tailplane.near' : 'tailplane.far', Fh, poly, 0, hT * m, {
      tone: 'hi',
      own: 'air.fuselage',
    })
  }

  // ---------- landing gear ----------
  const rMain = clamp(0.145 * fH, 0.36, 0.66)
  const wMain = 0.62 * rMain
  const axles = rh > 2.9 && Lm > 70 ? 3 : rh > 2.4 ? 2 : 1
  const leg = (name, xs, y, r, w, axleCount, topZ) => {
    const pitch = 2.3 * r
    const xs0 = xs - ((axleCount - 1) * pitch) / 2
    const gap = 0.45 * w
    const own = `air.${name}`
    for (let a = 0; a < axleCount; a++) {
      const x = X(xs0 + a * pitch)
      for (const yy of [y + gap / 2 + w, y - gap / 2])
        wheel(W, `${name}.wheel`, x, yy * m, r * m, w * m, { rim: 0.6, lugs: 0 })
      W.disc(`${name}.axle`, YF([x, (y - gap / 2) * m, r * m]), 0, gap * m, r * 0.22 * m, {
        tone: 'lo',
        own,
      })
    }
    if (axleCount > 1) {
      const p0 = [X(xs0 - 0.3 * r), y * m, r * m]
      W.disc(
        `${name}.bogie`,
        G.frameOf(p0, [-1, 0, 0], [0, 1, 0], [0, 0, 1]),
        0,
        ((axleCount - 1) * pitch + 0.6 * r) * m,
        0.2 * r * m,
        { tone: 'lo', own },
      )
    }
    const sr = 0.11 * m * Math.max(1, rMain / 0.6)
    W.disc(
      `${name}.strut`,
      G.frameOf([X(xs), y * m, r * 1.15 * m], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
      0,
      (B + topZ) * m - r * 1.15 * m,
      sr,
      { tone: 'mid', own },
    )
  }
  const noseX = F.cockpitWindowX + 1.8
  leg('nosegear', noseX, 0, 0.62 * rMain, 0.6 * wMain, 1, bellyZ(noseX) + 0.02)
  for (const sd of [1, -1]) {
    if (high) {
      // On the Dash 8 the main legs retract into the engine nacelles.
      const e = engines[0]
      const xs = e.fanX + 0.42 * e.nacelleLength
      leg(
        sd > 0 ? 'main.near' : 'main.far',
        xs,
        sd * e.y,
        rMain,
        wMain,
        1,
        wl(e.y) - e.dropBelowWing - 0.92 * e.nacelleDiameter + 0.08,
      )
    } else {
      const xs = Wg.rootLEx + 0.8 * Wg.rootChord
      const y = clamp(1.9 * rh, yRoot + 0.6, 0.45 * hw)
      leg(sd > 0 ? 'main.near' : 'main.far', xs, sd * y, rMain, wMain, axles, wl(y) + 0.15)
    }
  }

  // Far-side parts above the roofline: from this camera the far wing (and its tip device, the far tailplane, a far
  // engine) rises over the fuselage roof and reads as a second dorsal fin. Each far part is clipped to the region below
  // the roof's screen outline. Below the roof it is already behind the fuselage in painter's order, so the clip only
  // omits what would show above the roof; the solids and the audit are unchanged. FAR_ROOF=0 draws them in full.
  // A high wing keeps its far half: there the wing over the roof is the true high-wing cue (FAR_ROOF_HIGH=0 clips it).
  const clipFar = process.env.FAR_ROOF !== '0' && (!high || process.env.FAR_ROOF_HIGH === '0')
  if (clipFar) {
    const id = `lane-${g.icao}-roof`
    const tops = [...foreRings, ...tailRings].map((ring) =>
      ring.map(at).reduce((a, b) => (b[1] < a[1] ? b : a)),
    )
    tops.sort((a, b) => a[0] - b[0])
    const deep = 400
    const roof = [
      [tops[0][0], tops[0][1] + deep],
      ...tops,
      [tops[tops.length - 1][0], tops[tops.length - 1][1] + deep],
    ]
    const def = `<clipPath id="${id}"><path class="lv-clip" d="${k.pathOf(roof, true)}"/></clipPath>`
    let first = true
    for (const item of W.R.items) {
      if (!/\.far(#\d+)?$/.test(item.name) || (tTail && /tailplane/.test(item.name))) continue
      item.svg = `${first ? def : ''}<g clip-path="url(#${id})">${item.svg}</g>`
      item.clipped = true
      first = false
    }
  }

  const name = g.name ?? g.icao
  return {
    W,
    label: `${name.replace(/ \(.*\)$/, '')} in side three-quarter view, gear down, fuselage and fin in the livery colour.`,
    // A high wing's nacelles run through the wing plate, which a painter's order cannot split; tiny slivers elsewhere.
    // Plates rooted on the curved tail cone (fin, rudder, dorsal, near tailplane) leave sub-2 px² slivers at the root.
    allow: [
      ['air.nacelle*', 'air.wing*'],
      ['air.pod*', 'air.wing*'],
      ...['fin', 'rudder', 'dorsal', 'tailplane.near'].map((p) => ['air.tailcone', `air.${p}`]),
    ],
    foot: { x: X(0.9 * E), y: -0.12 * Lm * m, w: X(0.08 * E) - X(0.9 * E), d: 0.24 * Lm * m, r: 8 },
  }
}

// ======================================================================================================
// Build every type, normalise by silhouette area against the A21N, write the files.
// ======================================================================================================
const KEYS = [...TYPES, 'GENERIC']
const geometryOf = (key) => (key === 'GENERIC' ? genericGeometry() : records.get(key))
for (const key of TYPES) if (!records.has(key)) throw new Error(`no geometry record for ${key}`)
const AREA = Object.fromEntries(
  KEYS.map((key) => [
    key,
    silhouetteArea(airlinerFrom(geometryOf(key)).W.R.items.filter((item) => !item.clipped)),
  ]),
)
const trueLen = (key) => (LEN * geometryOf(key).dims.length) / records.get(REFERENCE).dims.length
const LENGTHS = Object.fromEntries(
  KEYS.map((key) => [
    key,
    trueLen(key) ** (1 - MASS) * (LEN * Math.sqrt(AREA[REFERENCE] / AREA[key])) ** MASS,
  ]),
)
const only = process.env.ONLY ? process.env.ONLY.split(',') : KEYS
const vehicles = Object.fromEntries(
  only.map((key) => [key, emit(airlinerFrom(geometryOf(key), LENGTHS[key]), key)]),
)
console.log(
  `MASS ${MASS} · lengths: ${only.map((key) => `${key} ${LENGTHS[key].toFixed(1)}`).join(' · ')}`,
)

const VB = [BOUNDS[0] - 1.5, BOUNDS[1] - 1.5, BOUNDS[2] - BOUNDS[0] + 3, BOUNDS[3] - BOUNDS[1] + 3]
const vb = VB.map(f1).join(' ')
const groundAt = (x) => sheared(at([x, 0, 0]))
const nose = groundAt(LEN)
const tail = groundAt(0)
const DRAWN = nose[0] - tail[0] // screen length of a 100-unit vehicle (the A21N), viewBox units
const svgWidth = (px) => (px * VB[2]) / DRAWN
const noseFrac = (nose[0] - VB[0]) / VB[2]
const groundFrac = (nose[1] - VB[1]) / VB[3]
const artCss = ART_CSS.replace(/\s*\n\s*/g, '')
const tag = MASS === 0.5 ? '' : `-mass${Math.round(MASS * 100)}`

// One file per type: an SVG holding one <symbol> with its own art rules (document CSS does not reach <use> clones).
// A page loads only the types on its board with <use href="fleet/A21N.svg#lane-A21N">; colour roles, the livery and
// the detail switch are inherited custom properties set on the host (vehicles.css).
const sizes = {}
if (!tag) {
  mkdirSync(OUT, { recursive: true })
  for (const key of only) {
    const file = `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="lane-${key}" viewBox="${vb}"><title>${vehicles[key].label}</title><style>${artCss}</style><g class="lane-art">${vehicles[key].body}</g></symbol></svg>`
    writeFileSync(join(OUT, `${key}.svg`), file)
    sizes[key] = { raw: file.length, gzip: gzipSync(file).length }
  }
  writeFileSync(
    join(OUT, 'vehicles.css'),
    `/* Generated by scripts/leaderboard-lanes/fleet.mjs. Host rules for <use> boards; inline copies also need the art rules. */\n${HOST_CSS}\n${ART_CSS}`,
  )
  writeFileSync(
    join(OUT, 'meta.json'),
    JSON.stringify(
      { viewBox: VB, nose, tail, mass: MASS, lengths: LENGTHS, area: AREA, sizes },
      null,
      2,
    ),
  )
  console.log(
    `files (raw / gzip, bytes):\n${only.map((key) => `  ${key.padEnd(8)} ${String(sizes[key].raw).padStart(7)} ${String(sizes[key].gzip).padStart(7)}`).join('\n')}`,
  )
}

// ---------- pages ----------
const label = (key) => (key === 'GENERIC' ? 'generic' : key)
const INKS = ['indigo', 'oxblood', 'moss', 'teal']
const useOf = (key, href) =>
  `<svg class="iso-svg lane-vehicle" data-vehicle="${key}" viewBox="${vb}" role="img" aria-label="${vehicles[key].label}"><use href="${href}#lane-${key}" x="${f1(VB[0])}" y="${f1(VB[1])}" width="${f1(VB[2])}" height="${f1(VB[3])}"/></svg>`
const inlineOf = (key) =>
  `<svg class="iso-svg lane-vehicle" data-vehicle="${key}" viewBox="${vb}" role="img" aria-label="${vehicles[key].label}"><g class="lane-art">${vehicles[key].body}</g></svg>`
// Gallery hrefs point at the per-type files; the MASS comparison page inlines its drawings (no files are written).
const art = (key, px, ink) =>
  `<div class="veh lane-veh" style="width:${f1(svgWidth(px))}px;--lane-livery:var(--stamp-ink-${ink})">${tag ? inlineOf(key) : useOf(key, `fleet/${key}.svg`)}</div>`
const BOARD = [
  ['A388', 'Mika', '412 flights', 1, 'indigo'],
  ['B788', 'Juno', '318 flights', 0.78, 'oxblood'],
  ['A21N', 'Ola', '240 flights', 0.6, 'moss'],
  ['E170', 'Rin', '150 flights', 0.38, 'teal'],
  ['DH8B', 'Pia', '96 flights', 0.24, 'indigo'],
].filter(([key]) => vehicles[key])
const board = (px) =>
  BOARD.map(
    ([
      key,
      who,
      value,
      frac,
      ink,
    ]) => `<div class="lane"><div class="who"><b>${who}</b><span>${value} · ${key}</span></div>
  <div class="track" style="--h:${f1((svgWidth(px) * VB[3]) / VB[2])}px"><div class="road" style="top:calc(var(--h) * ${f1(groundFrac)})"></div>
  <div class="slot" style="left:calc(${frac * 100}% - ${f1(svgWidth(px) * noseFrac)}px)">${art(key, px, ink)}</div></div></div>`,
  ).join('')
const block = (theme) => `<section class="theme" data-theme="${theme}" style="${THEMES[theme]}">
<h2>${theme}${tag ? ` · MASS ${MASS}` : ''}</h2>
<div class="cols"><div class="col" style="width:390px"><h3>390 px board · A21N 64 px</h3><div class="card" data-size="s">${board(64)}</div></div>
<div class="col" style="width:720px"><h3>720 px board · A21N 140 px</h3><div class="card" data-size="l">${board(140)}</div></div></div>
${
  tag
    ? ''
    : `<h3>All types · 64 px</h3>
<div class="grid s">${only.map((key, i) => `<figure data-key="${key}">${art(key, 64, INKS[i % 4])}<figcaption>${label(key)}</figcaption></figure>`).join('')}</div>
<h3>All types · 140 px</h3>
<div class="grid l">${only.map((key, i) => `<figure data-key="${key}">${art(key, 140, INKS[i % 4])}<figcaption>${label(key)}</figcaption></figure>`).join('')}</div>`
}
</section>`
const pageCss = `${css}
*{box-sizing:border-box}
body{margin:0;font:13px/1.4 Commissioner,system-ui,sans-serif}
.theme{background:var(--background);color:var(--text);padding:24px 28px 40px}
h2{margin:0 0 12px;font-size:15px;text-transform:uppercase;letter-spacing:.08em}
h3{margin:18px 0 8px;font-size:12px;font-weight:500;color:var(--text-muted)}
.cols{display:flex;gap:40px;align-items:flex-start}
.card{background:var(--surface);border-radius:14px;padding:14px 16px;display:grid;gap:10px}
.lane{display:grid;gap:2px}
.who{display:flex;gap:8px;align-items:baseline}.who span{color:var(--text-muted);font-size:12px}
.track{position:relative;height:var(--h)}
.road{position:absolute;left:0;right:0;height:max(4px, calc(var(--h) * .16));translate:0 -50%;background:var(--surface-inset);border-radius:999px}
.slot{position:absolute;top:0}
.veh{flex:none}
.lane-vehicle{--lane-halo-blur:2px}
[data-size=s] .lane-vehicle,.grid.s .lane-vehicle{--lane-halo-blur:1px}
.grid{display:grid;width:fit-content;gap:10px 14px;background:var(--surface);border-radius:14px;padding:14px}
.grid.s{grid-template-columns:repeat(7, max-content)}
.grid.l{grid-template-columns:repeat(4, max-content)}
figure{margin:0;display:grid;gap:2px;justify-items:start}
figcaption{font-size:11px;color:var(--text-muted);font-variant-numeric:tabular-nums}
.z{background:var(--surface);padding:12px;width:fit-content}`
writeFileSync(
  `.scratch/leaderboard-lanes/fleet${tag}.html`,
  `<!doctype html><html><head><meta charset="utf-8"><title>Lane fleet${tag}</title><style>${pageCss}</style></head><body>${block('dark')}${block('light')}</body></html>`,
)
// The line-end check cannot see into <use> clones: every type inlined at 560 px, per theme.
if (!tag)
  writeFileSync(
    '.scratch/leaderboard-lanes/fleet-lines.html',
    `<!doctype html><html><head><meta charset="utf-8"><title>Lane fleet lines</title><style>${pageCss}</style></head><body>${[
      'dark',
      'light',
    ]
      .map(
        (theme) =>
          `<section class="theme" data-theme="${theme}" style="${THEMES[theme]}">${only.map((key) => `<div class="z" data-key="${key}" style="width:${f1(svgWidth(560))}px;--lane-livery:var(--stamp-ink-teal)">${inlineOf(key)}</div>`).join('')}</section>`,
      )
      .join('')}</body></html>`,
  )
console.log(`fleet${tag}.html · viewBox ${vb} · drawn A21N length ${f1(DRAWN)}`)
