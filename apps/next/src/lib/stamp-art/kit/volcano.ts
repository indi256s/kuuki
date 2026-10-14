// Volcano module: a stratovolcano as the subject, drawn wide and low like a landform. Light falls
// from the left, so the right flank is the shaded face. Below the snow line every hatch line runs
// along the fall line (radiating from the summit); the shaded flank is denser and cross-hatched.
// The snow cap stays paper under a jagged snow line with long white gullies reaching down.
import { mulberry32 } from '../hash'
import { clipStrokeOutside } from '../geom'
import { type Pt, type SvgNode, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num, nums, str } from './util'

type Edge = Pt[]

/** Linear interpolation of x along an edge sorted by y ascending. */
function edgeX(edge: Edge, y: number): number {
  for (let i = 0; i + 1 < edge.length; i++) {
    const a = edge[i],
      b = edge[i + 1]
    if (a[1] <= y && y <= b[1])
      return b[1] === a[1] ? a[0] : a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
  }
  return edge[edge.length - 1][0]
}

/** A stratovolcano. The box ground is the base of the cone, the box top its summit. */
export const volcano: KitModule = ([x, y, w, h], p) => {
  // `cone` is the Fuji and Mayon shape; `massif` is a broad flat-topped dome (Kilimanjaro): a wide
  // rim plateau with a shallow crater dip. Shield and plume profiles arrive with later waves.
  const profile = str(p, 'profile', ['cone', 'massif'] as const, 'cone')
  const rand = mulberry32(Math.round(num(p, 'seed', 21)))
  const base = y + h
  const top = y
  const cx = x + w * num(p, 'axis', 0.5) + (rand() - 0.5) * 1.4
  const half = w / 2
  const rim = num(p, 'summit', 10) / 2
  // 0 = straight flanks, 1 = strongly concave: steep high up, almost flat at the foot.
  const m = Math.min(0.9, Math.max(0, num(p, 'concavity', 0.45)))
  const snowS = num(p, 'snow', 0.38)
  const gullyCount = Math.max(0, Math.round(num(p, 'gullies', 7)))
  const treeH = num(p, 'trees', 0)
  const clouds = nums(p, 'clouds', [])
  const spacing = num(p, 'spacing', 1.4)

  const reachL = half * (0.985 + rand() * 0.03)
  const reachR = half * (0.97 + rand() * 0.03)
  const prof = (t: number) => (1 - m) * t + m * t ** 2.6
  const wobble = (t: number) => (rand() - 0.5) * 1.0 * Math.sin(Math.PI * t) * (t < 0.95 ? 1 : 0)
  const N = 36
  const L: Edge = [],
    R: Edge = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const yy = top + h * t
    L.push([cx - rim - (reachL - rim) * prof(t) + wobble(t), yy])
    R.push([
      cx + rim * 1.08 + (reachR - rim * 1.08) * prof(t) + wobble(t),
      yy + (i === 0 ? 0.4 : 0),
    ])
  }
  const leftX = (yy: number) => edgeX(L, yy)
  const rightX = (yy: number) => edgeX(R, yy)

  // Summit: short flat rim with three small crater notches.
  const s = rim
  const massifRim: Pt[] = [
    [cx - s, top + 0.6],
    [cx - s * 0.82, top - 0.6],
    [cx - s * 0.55, top + 0.2],
    [cx - s * 0.25, top + 1.6],
    [cx + s * 0.1, top + 2],
    [cx + s * 0.4, top + 1.2],
    [cx + s * 0.62, top - 0.4],
    [cx + s * 0.86, top - 1.2],
    [cx + s * 1.08, top + 0.8],
  ]
  const coneRim: Pt[] = [
    [cx - s, top],
    [cx - s * 0.6, top - 0.9],
    [cx - s * 0.3, top + 0.8],
    [cx + s * 0.05, top - 0.6],
    [cx + s * 0.4, top + 0.9],
    [cx + s * 0.72, top - 0.5],
    [cx + s * 1.08, top + 0.4],
  ]
  const rimLine = profile === 'massif' ? massifRim : coneRim
  const silhouette: Pt[] = [...L, ...R.slice().reverse()]
  const outline: Pt[] = [...L.slice().reverse(), ...rimLine, ...R]
  const out: SvgNode[] = [occlude(silhouette)]

  // Fall-line coordinates: ray u in [-1, 1] at height fraction t sits at cx + u * t * reach.
  const rayPt = (u: number, t: number): Pt => [cx + u * t * (u < 0 ? reachL : reachR), top + h * t]
  const widthAt = (u: number, t: number) => {
    const yy = top + h * t
    return u < 0 ? cx - leftX(yy) : rightX(yy) - cx
  }
  /** Smallest t from which the ray stays inside the cone, with a margin. */
  const needT = (u: number): number => {
    let first = 1
    for (let t = 1; t > 0.01; t -= 0.01) {
      if (Math.abs(rayPt(u, t)[0] - cx) >= widthAt(u, t) - 1.6) break
      first = t
    }
    return first
  }

  // Snow line: jagged, with longer fingers where the gullies start.
  const snowY = top + h * snowS
  const gullyU: number[] = []
  for (let i = 0; i < gullyCount; i++) {
    const f = gullyCount === 1 ? 0.5 : i / (gullyCount - 1)
    gullyU.push(-0.8 + 1.6 * f + (rand() - 0.5) * 0.12)
  }
  const gx = gullyU.map((u) => rayPt(u, snowS)[0])
  const snowLo = leftX(snowY) - 4
  const snowHi = rightX(snowY) + 4
  const jagY = (px: number): number => {
    const near = Math.min(...gx.map((g) => Math.abs(g - px)), 99)
    const zig = Math.sin(px * 1.9) * 1.5 + Math.sin(px * 0.7 + 1) * 1.3
    return snowY + zig + (near < 2.4 ? (2.4 - near) * 1.6 : 0)
  }
  const jag: Pt[] = []
  for (let px = snowLo; px <= snowHi; px += 1.5) jag.push([px, jagY(px)])
  const pad = half * 0.6
  const cap: Pt[] = [
    [snowLo - pad, top - 6],
    [snowHi + pad, top - 6],
    [snowHi + pad, jag[jag.length - 1][1]],
    ...jag.slice().reverse(),
    [snowLo - pad, jag[0][1]],
  ]

  // Gullies: long tapering white streaks along the fall line.
  const gullyPolys: Pt[][] = gullyU.map((u, i) => {
    const t0 = (jagY(gx[i]) - 1.5 - top) / h
    const t1 = Math.min(0.97, t0 + 0.2 + rand() * 0.2)
    const d0 = (1.3 + rand() * 0.9) / (t0 * half)
    const tm = t0 + (t1 - t0) * 0.55
    return [
      rayPt(u - d0, t0),
      rayPt(u + d0, t0),
      rayPt(u + d0 * 0.6, tm),
      rayPt(u, t1),
      rayPt(u - d0 * 0.6, tm),
    ]
  })

  // Treeline at the foot: irregular crowns, dark T4 verticals. Drawn over the foot of the cone.
  let treePoly: Pt[] | null = null
  if (treeH > 0) {
    const phase = rand() * 6
    const top2: Pt[] = []
    for (let tx = x + 0.5; tx <= x + w - 3; tx += 4.2) {
      const swell =
        0.72 + 0.28 * Math.sin(tx * 0.09 + phase) + 0.12 * Math.sin(tx * 0.31 + phase * 2)
      const yy = base - treeH * swell + (rand() - 0.5) * 2.4
      top2.push([tx, yy], [tx + 2.1, yy + 1.6 + rand() * 1.2])
    }
    treePoly = [[x + 0.5, base], ...top2, [x + w - 0.5, base]]
  }

  const erase = (nodes: SvgNode[]): SvgNode[] => {
    let acc = nodes.filter((n) => n.kind === 'stroke')
    const polys = [cap, ...gullyPolys, ...(treePoly ? [treePoly] : [])]
    for (const poly of polys)
      acc = acc.flatMap((n) => (n.kind === 'stroke' ? clipStrokeOutside(n, poly) : [n]))
    return acc
  }

  // Fall-line hatching below the snow. Lit side: sparse, fine, staggered starts. Shaded side
  // (right of the terminator): every ray, hair weight, plus a fine contour cross-hatch.
  const rayCount = Math.round((2 * half) / spacing)
  const termU = 0.2
  const hatch: SvgNode[] = []
  for (let i = 0; i <= rayCount; i++) {
    const u = -1 + (2 * i) / rayCount
    const shaded = u > termU
    // Rays start in tiers (every 8th at the snow line, then every 4th, 2nd, all) so the spacing
    // never drops below about two units as the rays converge upward. The lit side starts later.
    const tier = i % 8 === 0 ? 0 : i % 4 === 0 ? 1 : i % 2 === 0 ? 2 : 3
    const tierStart = [0, 0.48, 0.7, 0.9][tier] + (shaded ? 0 : 0.08 * Math.min(tier, 2))
    const t0 = Math.max(snowS + 0.02, needT(u), tierStart)
    if (t0 >= 0.99) continue
    hatch.push(stroke(shaded ? 'hair' : 'fine', [rayPt(u, t0), rayPt(u, 1)]))
  }
  out.push(...erase(hatch))

  // Snow cap: only sparse fine lines on the shaded side, following the fall line.
  for (let u = 0.2; u < 0.95; u += 0.15 + rand() * 0.05) {
    const a = Math.max(needT(u), 0.04) + rand() * 0.08
    const b = a + 0.1 + rand() * 0.14
    const [ex, ey] = rayPt(u, b)
    if (b < 0.99 && ey < jagY(ex) - 3) out.push(stroke('fine', [rayPt(u, a), [ex, ey]]))
  }
  // Snow edge: a hair line along the jagged lower edge, skipping the gullies.
  for (let i = 0; i + 1 < jag.length; i += 1) {
    const [ax, ay] = jag[i]
    const [bx, by] = jag[i + 1]
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const inside = mx > leftX(my) + 1 && mx < rightX(my) - 1
    const nearGully = gx.some((g) => Math.abs(g - mx) < 1.6)
    if (inside && !nearGully) out.push(stroke('hair', [jag[i], jag[i + 1]]))
  }
  // Clouds: soft paper bands that wipe the hatching and the sky across the cone.
  for (const ct of clouds) {
    const cy = top + h * ct
    const reach = Math.min(half - 4, widthAt(1, ct) + 10)
    const cc = cx + (rand() - 0.5) * 6
    const xl = cc - reach,
      xr = cc + reach
    const lens: Pt[] = [
      ...quad([xl, cy], [cc - reach * 0.2, cy - 4.4], [xr, cy - 0.6], 10),
      ...quad([xr, cy - 0.6], [cc + reach * 0.2, cy + 2.6], [xl, cy], 10).slice(1),
    ]
    out.push(occlude(lens))
    out.push(
      stroke('fine', [
        [cc - reach * 0.55, cy + 1.7],
        [cc + reach * 0.35, cy + 1.9],
      ]),
    )
  }
  const bodyLine = treePoly
    ? clipStrokeOutside(stroke('line', outline), treePoly)
    : [stroke('line', outline)]
  out.push(...bodyLine)
  if (treePoly) {
    out.push(...toneFill(treePoly, 'T4', { gap: num(p, 'treeGap', 2), phase: 0.3 }))
  }
  return out
}
