// Shared by the lane drawings (build.mjs: the three-vehicle gate; fleet.mjs: one airliner per ICAO type): the anatomy
// kit, the one camera, the part workshop, the loft, the build-time shear and path minifier, the visual-mass measure,
// and the colour, livery and level-of-detail CSS. Build-time only.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { verifiedAnatomyKit } from '../concorde/verify-kit.mjs'

const KIT = verifiedAnatomyKit()
const k = await import(pathToFileURL(join(KIT, 'iso-kit.mjs')))
const G = await import(pathToFileURL(join(KIT, 'lathe.mjs')))
const A = await import(pathToFileURL(join(KIT, 'audit.mjs')))
const argv = process.argv.slice(2)
const DEG = Math.PI / 180

const AZ = Number(process.env.AZ ?? 70)
const EL = Number(process.env.EL ?? 11)
const LEN = 100 // drawn length of every vehicle, world units

// ---------- the one camera ----------
// Fit the union of the three vehicles' extremes once; every vehicle uses this P and the same viewBox, so the ground
// line and the nose line coincide and a page can stack them on lanes.
// Two viewBox units per world unit (k = 2): the 0.1 path rounding is 1/20 of a world unit, 0.15 px at the 4× view.
const P = {
  origin: [0, 0],
  scale: Number(process.env.K ?? 2) / Math.sqrt(1.6),
  azimuth: AZ,
  elevation: EL,
}
const at = (p) => k.iso(p, P)
const S = (paths, style) => k.solidSvg(paths, style)
const L = (d, style) => k.lineSvg(d, style)
const D = (points, style) => k.dotsSvg(points, style)
const f1 = (n) => (Math.round(n * 100) / 100).toString()
const KS = G.scaleOf(P)
// Facet counts sized for the display (≤ 560 px for the 4× view), not for the k = 2 viewBox the kit would assume.
const STEPS = {
  lathe: Number(process.env.LATHE_STEPS ?? 40),
  disc: Number(process.env.DISC_STEPS ?? 28),
}

const XF = (o) => G.frameOf(o, [1, 0, 0], [0, 1, 0], [0, 0, 1]) // axis +x; angle 0 → +y (near side), 90° → up
const YF = (o) => G.frameOf(o, [0, 1, 0], [0, 0, 1], [1, 0, 0]) // axis +y (toward the viewer's side)
const SIDE = (y) => G.frameOf([0, y, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]) // polygon in (x, z), thickness along +y from y
const TOP = (z) => G.frameOf([0, 0, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]) // polygon in (x, y), thickness along +z
const pathOf = (pts, closed) => k.pathOf(pts.map(at), closed)

/** Fine detail (seams, window rows, grille slots, door lines): hidden below the lane size threshold, see --lane-fine. */
const fine = (svg) => (svg ? `<g class="lv-fine">${svg}</g>` : '')
/** Coarse stand-ins for fine detail (a window band for a window row): shown only below the threshold. */
const coarse = (svg) => (svg ? `<g class="lv-coarse">${svg}</g>` : '')

/** One vehicle's recorder and part helpers. Every helper records the shape it draws, for settle and the audit. */
function workshop(tag) {
  const R = A.recorder(P)
  const put = (name, ref, svg, shapes, { bias = 0, livery = false, own } = {}) => {
    const id = R.nameFor(`${tag}.${name}`)
    for (const s of shapes) {
      s.name = s.name ?? id
      s.owner = s.owner ?? own ?? id
      R.solid(s)
    }
    // Livery parts take the person's colour; every other part is neutral (.nt: one step darker in the light theme).
    return R.put({
      name: id,
      at: ref,
      bias,
      svg: `<g class="${livery ? 'lv' : 'nt'}">${svg}</g>`,
      shapes,
    })
  }
  const centre = (F, poly, s0, s1) => {
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length
    return G.add3(F.o, G.add3(G.mul3(F.a, (s0 + s1) / 2), G.add3(G.mul3(F.u, cx), G.mul3(F.v, cy))))
  }
  return {
    R,
    put,
    prism(
      name,
      F,
      poly,
      s0,
      s1,
      { tone = 'mid', crease = 'faint', inner = '', extra = '', ...o } = {},
    ) {
      const svg = S(G.prismOf(F, poly, s0, s1, P), { tone, crease, inner }) + extra
      return put(name, centre(F, poly, s0, s1), svg, [A.prism(F, poly, s0, s1, {})], o)
    },
    turned(
      name,
      F,
      profile,
      {
        tone = 'mid',
        crease = 'faint',
        inner = '',
        extra = '',
        smooth,
        radius,
        rims,
        steps = STEPS.lathe,
        ...o
      } = {},
    ) {
      const paths = G.solidOf(profile, F, P, { smooth: smooth ?? 'auto', rims, steps })
      const s0 = profile[0][0]
      const s1 = profile[profile.length - 1][0]
      const svg = S(paths, { tone, crease, inner }) + extra
      return put(
        name,
        G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)),
        svg,
        [A.solid(F, profile, { radius })],
        o,
      )
    },
    disc(
      name,
      F,
      s0,
      s1,
      r,
      { tone = 'mid', crease = 'faint', inner = '', extra = '', bevel = 0, ...o } = {},
    ) {
      const svg =
        S(G.disc(s0, s1, r, F, P, { bevel, steps: STEPS.disc }), { tone, crease, inner }) + extra
      return put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), svg, [A.disc(F, s0, s1, r, {})], o)
    },
    box(
      name,
      plan,
      z,
      h,
      { tone = 'mid', steps = 3, bevel = 0, inner = '', extra = '', ...o } = {},
    ) {
      const svg = S(k.slabOf(plan, z, h, P, steps, bevel), { tone, inner }) + extra
      return put(
        name,
        [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2],
        svg,
        [A.slab(plan, z, h, {}, steps)],
        o,
      )
    },
    sphere(name, c, r, { tone = 'mid', ...o } = {}) {
      return put(name, c, S(G.sphereOf(c, r, P), { tone }), [A.ball(c, r, {})], o)
    },
  }
}

// A wheel on a +y axis: tyre disc, rim face with a hub ring and lug dots, seen on its outer face.
function wheel(W, name, x, yOut, r, w, { rim = 0.62, lugs = 5, steel = false } = {}) {
  // The disc runs from y = yOut − w to yOut; its outer face (+y) faces the viewer.
  const F = YF([x, yOut - w, r])
  const face = w
  const ring = (rr) => G.circleOf(F, face, rr, P)
  const extra =
    `<path class="iso-fill lv-tyre-face" d="${ring(r * rim)}"/>` +
    L(ring(r * rim), { tone: 'mid' }) +
    L(ring(r * rim * 0.42), { tone: 'lo' }) +
    (lugs
      ? D(G.dotsOf(F, face, r * rim * 0.68, lugs, P, { all: true }), {
          size: r * 0.05 * KS,
          tone: 'hi',
        })
      : '')
  const tyre = S(G.disc(0, w, r, F, P, { steps: STEPS.disc }), { tone: 'hi', crease: 'lo' })
  const svg = (steel ? tyre : `<g class="lv-rubber">${tyre}</g>`) + extra
  return W.put(name, G.add3(F.o, G.mul3(F.a, w / 2)), svg, [A.disc(F, 0, w, r, {})])
}

// A convex polygon whose corners are filleted: each point is [x, y, radius], arcs sampled every ~8°.
function rounded(points) {
  const n = points.length
  const out = []
  for (let i = 0; i < n; i++) {
    const [px, py, r] = points[i]
    const [ax, ay] = points[(i - 1 + n) % n]
    const [bx, by] = points[(i + 1) % n]
    if (!r) {
      out.push([px, py])
      continue
    }
    const ua = [ax - px, ay - py]
    const ub = [bx - px, by - py]
    const la = Math.hypot(...ua)
    const lb = Math.hypot(...ub)
    const ea = [ua[0] / la, ua[1] / la]
    const eb = [ub[0] / lb, ub[1] / lb]
    const half = Math.acos(Math.max(-1, Math.min(1, ea[0] * eb[0] + ea[1] * eb[1]))) / 2
    const t = Math.min(r / Math.tan(half), la * 0.45, lb * 0.45)
    const rr = t * Math.tan(half)
    const p0 = [px + ea[0] * t, py + ea[1] * t]
    const p1 = [px + eb[0] * t, py + eb[1] * t]
    const bis = [ea[0] + eb[0], ea[1] + eb[1]]
    const bl = Math.hypot(...bis)
    const cd = rr / Math.sin(half)
    const cc = [px + (bis[0] / bl) * cd, py + (bis[1] / bl) * cd]
    let a0 = Math.atan2(p0[1] - cc[1], p0[0] - cc[0])
    let a1 = Math.atan2(p1[1] - cc[1], p1[0] - cc[0])
    let da = a1 - a0
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    const steps = Math.max(2, Math.ceil(Math.abs(da) / (8 * DEG)))
    for (let j = 0; j <= steps; j++) {
      const a = a0 + (da * j) / steps
      out.push([cc[0] + rr * Math.cos(a), cc[1] + rr * Math.sin(a)])
    }
  }
  return out
}

// A lofted solid: rings of 3D points at stations along a body, shaded facet by facet with the kit's light and
// four-tone bands, merged into runs of one tone along each ring. The body must be convex (its hull is the fill and the
// outline). Marked seamless, so abutting tone sheets show no hairlines, as the kit's smooth lathes are.
function loftOf(rings, { open = null } = {}) {
  const V = G.viewOf(P)
  const Lt = G.lightOf(P)
  const buckets = [[], [], [], [], []]
  const flat = []
  const n = rings[0].length
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i]
    const b = rings[i + 1]
    const axis = G.mul3(
      G.add3(
        a.reduce((s, p) => G.add3(s, p), [0, 0, 0]),
        b.reduce((s, p) => G.add3(s, p), [0, 0, 0]),
      ),
      1 / (2 * n),
    )
    let run = null
    const flush = () => {
      if (!run) return
      const pts = [...run.top, ...run.bottom.reverse()].map(at)
      buckets[run.tone].push(k.pathOf(pts, true))
      run = null
    }
    for (let j = 0; j < n; j++) {
      const p00 = a[j]
      const p01 = a[(j + 1) % n]
      const p10 = b[j]
      const p11 = b[(j + 1) % n]
      let nrm = G.cross3(G.sub3(p11, p00), G.sub3(p01, p10))
      const len = G.len3(nrm)
      const mid = G.mul3(G.add3(G.add3(p00, p01), G.add3(p10, p11)), 0.25)
      let tone = null
      if (len > 1e-9) {
        nrm = G.mul3(nrm, 1 / len)
        if (G.dot3(nrm, G.sub3(mid, axis)) < 0) nrm = G.mul3(nrm, -1)
        if (G.dot3(nrm, V) > 1e-6) tone = G.bandOf(G.dot3(nrm, Lt))
      }
      if (tone === null) {
        flush()
        continue
      }
      if (run && run.tone === tone && run.j === j - 1) {
        run.top.push(p01)
        run.bottom.push(p11)
        run.j = j
      } else {
        flush()
        run = { tone, j, top: [p00, p01], bottom: [p10, p11] }
      }
    }
    flush()
  }
  for (const ring of rings) for (const p of ring) flat.push(at(p))
  const hull = k.pathOf(G.hullOf(flat), true)
  const outline = open ? openOutline(rings, open === 'start' ? 0 : rings.length - 1) : hull
  return {
    fill: hull,
    outline,
    crease: '',
    top: buckets[4].join(''),
    shades: buckets.slice(0, 4).map((l) => l.join('')),
    seamless: true,
  }
}

// Sutherland–Hodgman clip of a polygon of {p, v, s} vertices to f(q) >= 0, interpolating every attribute.
function clipPoly(poly, f) {
  const out = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const fa = f(a)
    const fb = f(b)
    if (fa >= 0) out.push(a)
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb)
      out.push({
        p: G.add3(a.p, G.mul3(G.sub3(b.p, a.p), t)),
        v: a.v + (b.v - a.v) * t,
        s: a.s + (b.s - a.s) * t,
      })
    }
  }
  return out
}

// The outline of a loft whose foot sits on another body: its screen hull with the stretches that fall inside the
// cover's screen hull left out, so the joint shows as a change of tone and not as a line.
function outlineOutside(rings, coverRings) {
  const hull = G.hullOf(rings.flat().map(at))
  const cover = G.hullOf(coverRings.flat().map(at))
  const inside = ([x, y]) => {
    let c = false
    for (let i = 0, j = cover.length - 1; i < cover.length; j = i++) {
      const [xi, yi] = cover[i]
      const [xj, yj] = cover[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  const n = hull.length
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const edge = (a, b) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (inside(lerp(a, b, mid)) === inside(a)) lo = mid
      else hi = mid
    }
    return lerp(a, b, (lo + hi) / 2)
  }
  const start = hull.findIndex((q) => inside(q))
  if (start < 0) return k.pathOf(hull, true)
  const runs = []
  let run = null
  for (let i = 1; i <= n; i++) {
    const a = hull[(start + i - 1) % n]
    const b = hull[(start + i) % n]
    const ia = inside(a)
    const ib = inside(b)
    if (ia && !ib) run = [edge(a, b), b]
    else if (!ia && !ib && run) run.push(b)
    else if (!ia && ib && run) {
      run.push(edge(a, b))
      runs.push(run)
      run = null
    }
  }
  return runs.map((r) => k.pathOf(r, false)).join('')
}

// A loft shaded with continuous tone contours instead of per-facet tones. Tones come from vertex normals (the mean of
// the four facets around each vertex); along each ring the tone is interpolated and cut exactly where the light score
// crosses a band threshold or the surface turns away from the viewer, and each strip between two rings joins matching
// band intervals with straight edges, so band borders run as smooth lines rather than stair-steps. A strip whose rings
// carry different band sequences falls back to per-facet tones. Same output contract as loftOf.
function loftSmoothOf(rings, opts = {}) {
  const V = G.viewOf(P)
  const Lt = G.lightOf(P)
  const THRESH = [0, 0.2, 0.42, 0.62]
  const band = (sc) => THRESH.filter((t) => sc >= t).length
  const n = rings[0].length
  const S = rings.length
  // Facet normals, oriented away from the strip's centroid.
  const fn = []
  for (let i = 0; i < S - 1; i++) {
    const a = rings[i]
    const b = rings[i + 1]
    const c = G.mul3(
      [...a, ...b].reduce((s, p) => G.add3(s, p), [0, 0, 0]),
      1 / (2 * n),
    )
    fn.push(
      Array.from({ length: n }, (_, j) => {
        const p00 = a[j]
        const p01 = a[(j + 1) % n]
        const p10 = b[j]
        const p11 = b[(j + 1) % n]
        let nrm = G.cross3(G.sub3(p11, p00), G.sub3(p01, p10))
        const len = G.len3(nrm)
        if (len < 1e-12) return [0, 0, 0]
        nrm = G.mul3(nrm, 1 / len)
        const mid = G.mul3(G.add3(G.add3(p00, p01), G.add3(p10, p11)), 0.25)
        return G.dot3(nrm, G.sub3(mid, c)) < 0 ? G.mul3(nrm, -1) : nrm
      }),
    )
  }
  const vis = []
  const sc = []
  for (let i = 0; i < S; i++) {
    vis.push([])
    sc.push([])
    for (let j = 0; j < n; j++) {
      let v = [0, 0, 0]
      for (const ii of [i - 1, i])
        for (const jj of [j - 1, j]) if (ii >= 0 && ii < S - 1) v = G.add3(v, fn[ii][(jj + n) % n])
      const len = G.len3(v)
      v = len > 1e-12 ? G.mul3(v, 1 / len) : v
      vis[i].push(G.dot3(v, V))
      sc[i].push(G.dot3(v, Lt))
    }
  }
  // Light scores relaxed along the stations (1-2-1, a few passes): small section-to-section wobbles in the normals
  // would otherwise make the band borders meander across flat flanks.
  for (let pass = 0; pass < (opts.relax ?? 4); pass++) {
    const prev = sc.map((r) => r.slice())
    for (let i = 1; i < S - 1; i++)
      for (let j = 0; j < n; j++) sc[i][j] = (prev[i - 1][j] + 2 * prev[i][j] + prev[i + 1][j]) / 4
  }
  const buckets = [[], [], [], [], []]
  for (let i = 0; i < S - 1; i++) {
    // Start both rings at the most back-facing vertex of ring i, so no visible interval wraps around.
    let s0 = 0
    for (let j = 1; j < n; j++) if (vis[i][j] < vis[i][s0]) s0 = j
    const intervals = (r) => {
      const out = []
      const lab = (u) => {
        const j0 = Math.floor(u)
        const t = u - j0
        const ja = (s0 + j0) % n
        const jb = (s0 + j0 + 1) % n
        const v = vis[r][ja] + (vis[r][jb] - vis[r][ja]) * t
        return v > 1e-6 ? band(sc[r][ja] + (sc[r][jb] - sc[r][ja]) * t) : -1
      }
      for (let j = 0; j < n; j++) {
        const ja = (s0 + j) % n
        const jb = (s0 + j + 1) % n
        const cuts = [j, j + 1]
        const cross = (f0, f1, level) => {
          if ((f0 - level) * (f1 - level) < 0) cuts.push(j + (level - f0) / (f1 - f0))
        }
        cross(vis[r][ja], vis[r][jb], 1e-6)
        for (const t of THRESH) cross(sc[r][ja], sc[r][jb], t)
        cuts.sort((p, q) => p - q)
        for (let c = 0; c + 1 < cuts.length; c++) {
          const u0 = cuts[c]
          const u1 = cuts[c + 1]
          if (u1 - u0 < 1e-9) continue
          const l = lab((u0 + u1) / 2)
          const last = out[out.length - 1]
          if (last && last.l === l && Math.abs(last.u1 - u0) < 1e-9) last.u1 = u1
          else out.push({ l, u0, u1 })
        }
      }
      return out.filter((q) => q.l >= 0)
    }
    const A_ = intervals(i)
    const B_ = intervals(i + 1)
    const along = (ring, u0, u1) => {
      const pt = (u) => {
        const j0 = Math.floor(u)
        const t = u - j0
        const p = ring[(s0 + j0) % n]
        const q = ring[(s0 + j0 + 1) % n]
        return G.add3(p, G.mul3(G.sub3(q, p), t))
      }
      const pts = [pt(u0)]
      for (let j = Math.floor(u0) + 1; j < u1; j++) pts.push(pt(j))
      pts.push(pt(u1))
      return pts
    }
    if (A_.length === B_.length && A_.every((q, h) => q.l === B_[h].l)) {
      A_.forEach((qa, h) => {
        const qb = B_[h]
        const pts = [
          ...along(rings[i], qa.u0, qa.u1),
          ...along(rings[i + 1], qb.u0, qb.u1).reverse(),
        ]
        buckets[qa.l].push(k.pathOf(pts.map(at), true))
      })
    } else {
      // Fallback: clip each facet's two triangles against the interpolated visibility and band thresholds, so the
      // contours stay continuous through strips where a band border runs along the rings.
      for (let j = 0; j < n; j++) {
        const vx = (r, c) => ({ p: rings[r][c % n], v: vis[r][c % n], s: sc[r][c % n] })
        const a = vx(i, j)
        const b = vx(i, j + 1)
        const c = vx(i + 1, j + 1)
        const d = vx(i + 1, j)
        for (const tri of [
          [a, b, c],
          [a, c, d],
        ]) {
          const seen = clipPoly(tri, (q) => q.v - 1e-6)
          if (seen.length < 3) continue
          for (let bd = 0; bd <= THRESH.length; bd++) {
            let poly = seen
            if (bd > 0) poly = clipPoly(poly, (q) => q.s - THRESH[bd - 1])
            if (bd < THRESH.length && poly.length >= 3)
              poly = clipPoly(poly, (q) => THRESH[bd] - q.s)
            if (poly.length >= 3)
              buckets[bd].push(
                k.pathOf(
                  poly.map((q) => at(q.p)),
                  true,
                ),
              )
          }
        }
      }
    }
  }
  const hull = k.pathOf(G.hullOf(rings.flat().map(at)), true)
  return {
    fill: hull,
    outline: hull,
    crease: '',
    top: buckets[4].join(''),
    shades: buckets.slice(0, 4).map((l) => l.join('')),
    seamless: true,
  }
}

// The outline of a loft that continues into another one: its hull without the arc that the joint ring contributes,
// so two lofts meeting on one ring show no line across the body. Andrew's monotone chain over tagged points.
function openOutline(rings, joint) {
  const pts = rings.flatMap((ring, r) => ring.map((p) => ({ p: at(p), joint: r === joint })))
  pts.sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1])
  const cross = (o, a, b) =>
    (a.p[0] - o.p[0]) * (b.p[1] - o.p[1]) - (a.p[1] - o.p[1]) * (b.p[0] - o.p[0])
  const half = (list) => {
    const out = []
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }
  const hull = [...half(pts), ...half([...pts].reverse())]
  const n = hull.length
  const start = hull.findIndex((q, i) => !q.joint && hull[(i - 1 + n) % n].joint)
  if (start < 0)
    return k.pathOf(
      hull.map((q) => q.p),
      true,
    )
  const run = [hull[(start - 1 + n) % n]]
  for (let i = 0; i < n; i++) {
    const q = hull[(start + i) % n]
    run.push(q)
    if (q.joint) break
  }
  return k.pathOf(
    run.map((q) => q.p),
    false,
  )
}

// ======================================================================================================
// Car: one generic five-door compact hatchback, 4.28 m long, 1.79 m wide, 1.46 m tall, 2.64 m wheelbase,
// 0.86 / 0.78 m overhangs, 0.33 m wheel radius (proportions of the C-segment class, not one model). The lower body and
// the greenhouse are lofts: superellipse sections (rounder over the shoulder, squarer at the sill) under the side
// profile, with rounded plan corners, so bonnet, boot, roof and shoulders shade smoothly.

// The lane is level in the page, so the drawing is sheared to level the vehicle's x axis: y' = y − SLOPE·x. A shear of
// the image plane keeps the projection direction, so this is still an exact parallel (oblique) projection of the same
// solids: visibility, shading and painter's order are unchanged; verticals stay vertical and the ground runs flat.
const SLOPE = (Math.cos(AZ * DEG) * Math.sin(EL * DEG)) / Math.sin(AZ * DEG)
const sheared = ([x, y]) => [x, y - SLOPE * x]
const BOUNDS = [Infinity, Infinity, -Infinity, -Infinity]
const grow = ([x, y]) => {
  BOUNDS[0] = Math.min(BOUNDS[0], x)
  BOUNDS[1] = Math.min(BOUNDS[1], y)
  BOUNDS[2] = Math.max(BOUNDS[2], x)
  BOUNDS[3] = Math.max(BOUNDS[3], y)
}
const num = (t) => (t / 10).toString().replace(/^(-?)0\./, '$1.')
// Shear every coordinate, then write paths as relative commands in integer tenths (lossless at 0.1).
function minifyD(d, halo = false) {
  if (!d) return d
  if (!/^[MLZ0-9 .\-]+$/.test(d)) throw new Error(`unexpected path command in ${d.slice(0, 40)}`)
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+/g)
  let out = ''
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let first = true
  let prev = ''
  for (let i = 0; i < tokens.length;) {
    const c = tokens[i++]
    if (c === 'Z') {
      out += 'z'
      cx = sx
      cy = sy
      prev = 'z'
      continue
    }
    const [px, py] = sheared([parseFloat(tokens[i++]), parseFloat(tokens[i++])])
    if (!halo) grow([px, py])
    const x = Math.round(px * 10)
    const y = Math.round(py * 10)
    const dx = first ? x : x - cx
    const dy = first ? y : y - cy
    const cmd = c === 'M' ? (first ? 'M' : 'm') : 'l'
    const pair = num(dx) + (dy < 0 ? '' : ' ') + num(dy)
    out += (cmd === prev && cmd === 'l' ? (dx < 0 ? '' : ' ') : cmd) + pair
    prev = cmd
    first = false
    cx = x
    cy = y
    if (c === 'M') {
      sx = x
      sy = y
    }
  }
  return out
}
function finish(svg) {
  return svg
    .replace(
      /(class="[^"]*(?:iso-halo|lv-clip)[^"]*" )?(?<![\w-])d="([^"]*)"/g,
      (_, h, d) => `${h ?? ''}d="${minifyD(d, Boolean(h))}"`,
    )
    .replace(/<circle cx="([^"]*)" cy="([^"]*)"/g, (_, x, y) => {
      const [sx, sy] = sheared([Number(x), Number(y)])
      return `<circle cx="${f1(sx)}" cy="${f1(sy)}"`
    })
}

function emit(vehicle, name) {
  const { W, label, foot, allow = [], last = null } = vehicle
  const R = W.R
  R.solid(
    A.slab({ x: -20, y: -60, w: 140, d: 120, r: 0 }, -2, 2, { name: 'stand.lane', ground: true }),
  )
  A.settle(R, P)
  // `last`: items painted after everything else (a wheel in a painted-on arch opening), each excused in `allow`.
  if (last) {
    const top = Math.max(...R.items.map((i) => i.key))
    R.items.filter((i) => last.test(i.name)).forEach((i, n) => (i.key = top + 1 + n))
  }
  R.items.sort((a, b) => a.key - b.key)
  if (process.env.SIZES)
    for (const i of [...R.items].sort((p, q) => q.svg.length - p.svg.length).slice(0, 6))
      console.log(name, i.name, (i.svg.length / 1024).toFixed(1))
  if (argv.includes('--audit')) {
    console.log(`\n=== audit: ${name} ===`)
    A.auditOrExit(R, P, { argv: ['--audit'], allow })
  }
  const halo = `<path class="iso-halo lv-halo" d="${k.haloOf(foot, 0, 0.1, P)}"/>`
  return { label, body: finish(halo + R.items.map((i) => i.svg).join('')), items: R.items.length }
}

// Visual-mass normalisation. Each vehicle is first built 100 units long and its silhouette area measured (the union of
// every solid's fill, rasterised at 0.5 viewBox units, unsheared: a shear keeps area). Each is then rebuilt at
// length 100·√(A_air / A_v), so all three cover the airliner's silhouette area. Noses stay at x = 100, so every
// vehicle's front sits on its lane value whatever its length.
function silhouetteArea(items) {
  const cell = 0.5
  const filled = new Set()
  for (const item of items) {
    for (const [, d] of item.svg.matchAll(/class="iso-fill[^"]*" d="([^"]*)"/g)) {
      for (const sub of d.split('M').filter(Boolean)) {
        const pts = [...('M' + sub).matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((q) => [
          Number(q[1]),
          Number(q[2]),
        ])
        if (pts.length < 3) continue
        const ys = pts.map((p) => p[1])
        for (
          let row = Math.floor(Math.min(...ys) / cell);
          row <= Math.ceil(Math.max(...ys) / cell);
          row++
        ) {
          const y = (row + 0.5) * cell
          const xs = []
          for (let i = 0; i < pts.length; i++) {
            const [x0, y0] = pts[i]
            const [x1, y1] = pts[(i + 1) % pts.length]
            if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y))
              xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0))
          }
          xs.sort((a, b) => a - b)
          for (let i = 0; i + 1 < xs.length; i += 2)
            for (let c = Math.ceil(xs[i] / cell - 0.5); c + 0.5 <= xs[i + 1] / cell; c++)
              filled.add(`${c},${row}`)
        }
      }
    }
  }
  return filled.size * cell * cell
}

// The kit's rules scoped under .lane-vehicle (as scripts/generate-concorde.mjs does), keeping what the vehicles use.
const SCOPE = '.lane-vehicle' // the lane's <svg>
const ART = '.lane-art' // the drawing's root <g>
function rulesOf(css) {
  const rules = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) {
      rules.push(css.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  return rules.filter(Boolean)
}
const scoped = (selector) =>
  selector
    .split(',')
    .map((part) => {
      const s = part.trim()
      if (s === '.iso') return ART
      if (s.startsWith('.iso-svg ')) return `${ART}${s.slice(8)}`
      if (s.startsWith('.iso ')) return `${ART}${s.slice(4)}`
      return `${ART} ${s}`
    })
    .join(',')
const UNUSED =
  /data-mat|iso-(plate|legend|key|swatch|wire|figure|flow|pulse|face-text)|\.tb\b|tb-|data-(flow|pulse|dotted|dashed)|"(red|green|blue)"|^body/
function scope(css) {
  return rulesOf(css)
    .flatMap((rule) => {
      const open = rule.indexOf('{')
      const head = rule.slice(0, open).trim()
      const body = rule.slice(open + 1, -1)
      if (UNUSED.test(head)) return []
      if (head.startsWith('@keyframes')) return []
      if (head.startsWith('@media')) {
        const inner = scope(body)
        return inner ? [`${head}{${inner}}`] : []
      }
      if (/^\.iso(\[data-theme="(dark|light)"\])?$/.test(head) || head === '.iso-svg') return []
      return [`${scoped(head)}{${body}}`]
    })
    .join('\n')
}
const kitCss = scope(readFileSync(join(KIT, 'iso.css'), 'utf8'))

// The colour roles: exactly the Concorde mapping (auth-card/concorde/concorde.css) onto the app's --iso-* tokens, plus
// one livery ramp. A livery part mixes --lane-livery into every face and line tone, so the shading stays four-tone
// and theme-aware; lines keep most of the neutral so the outline weight reads the same on every part.
// Host rules: on the lane's <svg> (or any ancestor). Colour roles are inherited custom properties, so they reach
// into <use> clones.
const HOST_CSS = `
${SCOPE}{display:block;width:100%;height:auto;overflow:visible}
${SCOPE}{
  --anatomy-paper: var(--iso-side);
  --anatomy-top: var(--iso-top);
  --anatomy-face: var(--iso-top);
  --anatomy-shade-0: color-mix(in oklab, var(--iso-side) 84%, #000);
  --anatomy-shade-1: var(--iso-side);
  --anatomy-shade-2: color-mix(in oklab, var(--iso-side) 50%, var(--iso-front));
  --anatomy-shade-3: var(--iso-front);
  --anatomy-hi: var(--iso-line);
  --anatomy-mid: color-mix(in oklab, var(--iso-line) 55%, var(--iso-detail));
  --anatomy-lo: var(--iso-detail);
  --anatomy-faint: color-mix(in oklab, var(--iso-detail) 60%, var(--iso-side));
  --anatomy-dot: var(--iso-line);
  --anatomy-lit: var(--accent);
  --anatomy-halo: var(--iso-shadow);
  --anatomy-halo-opacity: 1;
  --anatomy-weight: 0.75px;
  display: block;
  overflow: visible;
}
${SCOPE}{--lane-void: color-mix(in oklab, var(--iso-side) 55%, #000)}
/* Neutral parts (wings, nacelles, gear, roof gear, greenhouse): in the light theme the kit's near-white ramp vanishes
   on a #fafafa card at phone size, so every neutral tone is pulled --lane-nt toward a darker grey. Dark theme: 0%. */
${SCOPE}{--lane-nt: 24%; --lane-nt-ink: color-mix(in oklab, var(--iso-side) 72%, #000)}
[data-theme='dark'] ${SCOPE}, ${SCOPE}[data-theme='dark']{--lane-nt: 0%}
/* Level of detail: seams, window rows, grille slots, door lines and spokes (.lv-fine) drop out at phone size, either
   from a .lane-sm wrapper or when the vehicle's wrapper (a size container) is under 110 px wide. Both set an inherited
   custom property, so the switch reaches into <use> clones, where ancestor selectors cannot. */
.lane-sm{--lane-fine: none; --lane-coarse: inline}
.lane-veh{container-type: inline-size}
@container (max-width: 110px){${SCOPE}{--lane-fine: none; --lane-coarse: inline}}
`
// Art rules: matched inside the drawing. Each <symbol> carries a copy in its own <style>, since document selectors do
// not reach into a <use> shadow tree; the page carries one more for inline copies.
const ART_CSS = `${kitCss}
${ART} .lv{
  --lv: var(--lane-livery, var(--accent));
  --anatomy-paper: color-mix(in oklab, var(--lv) 58%, var(--iso-side));
  --anatomy-top: color-mix(in oklab, var(--lv) 58%, var(--iso-top));
  --anatomy-shade-0: color-mix(in oklab, var(--lv) 58%, color-mix(in oklab, var(--iso-side) 84%, #000));
  --anatomy-shade-1: color-mix(in oklab, var(--lv) 58%, var(--iso-side));
  --anatomy-shade-2: color-mix(in oklab, var(--lv) 58%, color-mix(in oklab, var(--iso-side) 50%, var(--iso-front)));
  --anatomy-shade-3: color-mix(in oklab, var(--lv) 58%, var(--iso-front));
  --anatomy-hi: color-mix(in oklab, var(--lv) 22%, var(--iso-line));
  --anatomy-mid: color-mix(in oklab, var(--lv) 40%, color-mix(in oklab, var(--iso-line) 55%, var(--iso-detail)));
  --anatomy-faint: color-mix(in oklab, var(--lv) 30%, color-mix(in oklab, var(--iso-detail) 60%, var(--iso-side)));
}
${ART} .lv-glass{fill:color-mix(in oklab, var(--iso-line) 45%, var(--iso-side));stroke:none}
${ART} .lv-intake{fill:var(--anatomy-shade-0);stroke:none}
${ART} .lv-fan{fill:var(--iso-shadow);stroke:none}
${ART} .lv-void{fill:var(--lane-void);stroke:none}
${ART} .lv-lamp{fill:color-mix(in oklab, var(--iso-line) 55%, var(--iso-top));stroke:none}
${ART} .lv-tyre-face{fill:var(--anatomy-shade-2)}
${ART} .lv-rubber{
  --rb: color-mix(in oklab, var(--iso-line) 30%, #1d1b1a);
  --anatomy-paper: var(--rb);
  --anatomy-top: color-mix(in oklab, var(--rb) 84%, #fff);
  --anatomy-shade-0: color-mix(in oklab, var(--rb) 82%, #000);
  --anatomy-shade-1: var(--rb);
  --anatomy-shade-2: color-mix(in oklab, var(--rb) 93%, #fff);
  --anatomy-shade-3: color-mix(in oklab, var(--rb) 88%, #fff);
}
${ART} .lv-steel .iso-fill{fill:var(--anatomy-shade-3)}
${ART} .lv-halo{filter:blur(var(--lane-halo-blur, 3px));transform:none}
${ART} .nt{
  --anatomy-paper: color-mix(in oklab, var(--iso-side), var(--lane-nt-ink) var(--lane-nt));
  --anatomy-top: color-mix(in oklab, var(--iso-top), var(--lane-nt-ink) var(--lane-nt));
  --anatomy-shade-0: color-mix(in oklab, color-mix(in oklab, var(--iso-side) 84%, #000), var(--lane-nt-ink) var(--lane-nt));
  --anatomy-shade-1: color-mix(in oklab, var(--iso-side), var(--lane-nt-ink) var(--lane-nt));
  --anatomy-shade-2: color-mix(in oklab, color-mix(in oklab, var(--iso-side) 50%, var(--iso-front)), var(--lane-nt-ink) var(--lane-nt));
  --anatomy-shade-3: color-mix(in oklab, var(--iso-front), var(--lane-nt-ink) var(--lane-nt));
}
${ART} .lv-fine{display:var(--lane-fine, inline)}
${ART} .lv-coarse{display:var(--lane-coarse, none)}
${ART} .lv-band{fill:color-mix(in oklab, var(--iso-line) 78%, var(--iso-side));stroke:none}
${ART} .lv-disc{fill:var(--iso-line);opacity:.14;stroke:none}
`

const css = `/* Generated by scripts/leaderboard-lanes/build.mjs from the anatomy kit's iso.css (MIT). */\n${HOST_CSS}\n${ART_CSS}`

// The app's theme tokens (apps/next/src/app/styles.css, :root and :root[data-theme='dark']) the gate page needs.
const THEMES = {
  light: `--background:#ffffff;--surface:#fafafa;--surface-inset:#f2f2f2;--text:#302d2a;--text-muted:#66605b;--hairline:#e3e3e3;
    --iso-top:#fafafa;--iso-front:#f1eeea;--iso-side:#dcd7d1;--iso-line:#5f5954;--iso-crease:#a9a199;--iso-detail:#cfc8c1;--iso-glass:#fff0ec;
    --iso-glow:.4;--iso-shadow:rgb(48 45 42 / 14%);--accent:#ec684d;
    --stamp-ink-indigo:#344c99;--stamp-ink-oxblood:#90272d;--stamp-ink-moss:#365f19;--stamp-ink-teal:#005f5f;color-scheme:light`,
  dark: `--background:#2e2e2e;--surface:#282828;--surface-inset:#232323;--text:#f1efeb;--text-muted:#c4beb7;--hairline:#3a3a3a;
    --iso-top:#282828;--iso-front:#393735;--iso-side:#292725;--iso-line:#a8a098;--iso-crease:#756f68;--iso-detail:#5f5954;--iso-glass:#4f3e3a;
    --iso-glow:.75;--iso-shadow:rgb(0 0 0 / 35%);--accent:#ea846f;
    --stamp-ink-indigo:#a2bcff;--stamp-ink-oxblood:#ffa09c;--stamp-ink-moss:#9fce85;--stamp-ink-teal:#72d0d0;color-scheme:dark`,
}

export {
  A,
  ART,
  coarse,
  loftSmoothOf,
  outlineOutside,
  ART_CSS,
  AZ,
  BOUNDS,
  D,
  DEG,
  EL,
  G,
  HOST_CSS,
  KIT,
  KS,
  L,
  LEN,
  P,
  S,
  SCOPE,
  SIDE,
  SLOPE,
  STEPS,
  THEMES,
  TOP,
  XF,
  YF,
  argv,
  at,
  css,
  emit,
  f1,
  fine,
  finish,
  grow,
  k,
  loftOf,
  minifyD,
  pathOf,
  rounded,
  sheared,
  silhouetteArea,
  wheel,
  workshop,
}
