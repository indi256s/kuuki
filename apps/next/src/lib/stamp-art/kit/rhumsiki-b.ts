// Rhumsiki Peak: a black volcanic plug spire (lit left face with fracture strata, T4 right face),
// two lower plugs in T2 behind it, and small round thatched huts at its foot. The box bottom is
// the savanna floor.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { rockMass } from './rock-b'
import { type KitModule, num } from './util'

/** A plug as a polygon: concave flanks to a narrow rounded top. */
function plug(
  cx: number,
  base: number,
  top: number,
  footHalf: number,
  topHalf: number,
  lean: number,
  rand: () => number,
  skew = 0.18,
): Pt[] {
  const L: Pt[] = [],
    R: Pt[] = []
  const n = 22
  for (let i = 0; i <= n; i++) {
    const t = i / n // 0 top, 1 foot
    const half = topHalf + (footHalf - topHalf) * t ** 1.9
    const c = cx + lean * (1 - t) ** 1.3
    const yy = top + 3 + (base - top - 3) * t
    const bump = i > 1 && i < n ? (rand() - 0.5) * (1.2 + 2.2 * t * (i % 3 === 0 ? 1 : 0.3)) : 0
    L.push([c - half * (1 + skew) + bump, yy])
    R.push([c + half * (1 - skew) + (rand() - 0.5) * 1.4, yy])
  }
  const crown = quad(L[0], [cx + lean + 0.6, top - 3.5], R[0], 6)
  return [...L.slice().reverse(), ...crown.slice(1), ...R.slice(1)]
}

function hut(cx: number, base: number, s: number): SvgNode[] {
  const bw = 4.2 * s,
    bh = 4.6 * s
  const body: Pt[] = [
    [cx - bw, base],
    [cx - bw, base - bh],
    [cx + bw, base - bh],
    [cx + bw, base],
  ]
  const roof: Pt[] = [
    [cx - bw - 1.6 * s, base - bh],
    [cx, base - bh - 6.4 * s],
    [cx + bw + 1.6 * s, base - bh],
  ]
  return [
    occlude([...body, ...roof], { halo: 1 }),
    stroke('hair', [body[0], body[1], body[2], body[3]]),
    stroke('hair', [...roof, roof[0]], true),
    ...toneFill(roof, 'T4', { angle: 86, gap: 1.5, weight: 'fine', inset: 0.2 }),
  ]
}

export const rhumsikiB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 8)))
  const base = y + h
  const cx = x + w * 0.46
  const out: SvgNode[] = []

  // Lower plugs behind, T2.
  const low = (c: number, topY: number, foot: number, top: number): SvgNode[] => {
    const poly = plug(c, base - 2, topY, foot, top, 0, rand)
    return [
      occlude(poly, { halo: 1.6 }),
      ...toneFill(poly, 'T2', { angle: -58, gap: 2.8, weight: 'fine', inset: 0.3 }),
      stroke('hair', poly.slice(0, poly.length - 1)),
    ]
  }
  out.push(...low(x + w * 0.14, y + h * 0.42, 16, 2.4), ...low(x + w * 0.83, y + h * 0.28, 17, 2))

  // The main plug: a fluted lit left face, T4 on the right, strata and fracture ticks on the lit side.
  const spire = plug(cx, base, y, w * 0.2, w * 0.03, 6, rand)
  out.push(
    ...rockMass(spire, rand, {
      ridge: spire.slice(0, 24),
      shade: 0.58,
      slant: 0.06,
      fracture: 0,
      strata: true,
      strataGap: 3,
      cracks: 4,
      smooth: true,
      darkGap: 2.7,
    }),
  )
  out.push(stroke('line', spire.slice(23)))

  // Huts at the foot.
  for (const [u, s] of [
    [0.18, 0.8],
    [0.3, 1],
    [0.7, 1.05],
    [0.8, 0.85],
  ] as const)
    out.push(...hut(x + w * u, base - 1, s))
  return out
}
