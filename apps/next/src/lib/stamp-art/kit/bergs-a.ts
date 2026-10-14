// Greenland: icebergs off Ilulissat. Four to six bergs recede across the fjord; the nearest is a
// tall jagged berg with several spires, lit paper on the left, T4 on its shadow facets, standing
// on a pale T1 foot under the water line. Smaller bergs behind are the same jag, smaller and
// higher on the horizon. The box is the whole view; its bottom is the near water line.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hatch, hline, occlude, stroke, toneFill } from '../grid'
import { rockMass } from './rock-b'
import { type KitModule, num } from './util'

/** A jagged berg between x0 and x1, standing on `base`, up to `h` tall. */
function berg(x0: number, x1: number, base: number, h: number, rand: () => number): SvgNode[] {
  const w = x1 - x0
  const n = 6
  const pts: Pt[] = [[x0, base]]
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const spire = i % 2 === 1
    const env = 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.8))
    const hh = h * env * (spire ? 0.7 + rand() * 0.3 : 0.4 + rand() * 0.2)
    pts.push([x0 + w * (u * 0.9 + 0.05) + (rand() - 0.5) * w * 0.04, base - hh])
  }
  pts.push([x1, base])
  const out = rockMass(pts, rand, {
    ridge: pts.slice(1, -1),
    shade: 0.64,
    slant: 0.22,
    fracture: 0,
    smooth: true,
    darkGap: 2.2,
  })
  // A few facet cracks across the lit side.
  for (let k = 0; k < 3; k++) {
    const sx = x0 + w * (0.15 + rand() * 0.3)
    const sy = base - h * (0.5 + rand() * 0.3)
    out.push(
      stroke('fine', [
        [sx, sy],
        [sx + w * 0.1, sy + h * 0.28],
      ]),
    )
  }
  out.push(hline('hair', x0 - 1, x1 + 1, base))
  return out
}

export const bergsA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const X = (u: number) => x + w * u
  const base = y + h
  const out: SvgNode[] = []
  // Far to near: small, high on the horizon, then the big one.
  out.push(...berg(X(0.74), X(0.9), base - 7, h * 0.3, rand))
  out.push(...berg(X(0.02), X(0.2), base - 6, h * 0.34, rand))
  out.push(...berg(X(0.86), X(1.0), base - 2, h * 0.44, rand))
  out.push(...berg(X(0.56), X(0.74), base - 4, h * 0.42, rand))
  // The near berg, faceted by hand: a tall twin-spire mass with a notch and shoulders.
  const wl = base - 2
  const nb: Pt[] = [
    [X(0.17), wl],
    [X(0.2), wl - h * 0.22],
    [X(0.22), wl - h * 0.36],
    [X(0.27), wl - h * 0.52],
    [X(0.31), wl - h * 0.82],
    [X(0.35), wl - h * 0.58],
    [X(0.37), wl - h * 0.54],
    [X(0.43), wl - h * 0.98],
    [X(0.48), wl - h * 0.72],
    [X(0.52), wl - h * 0.62],
    [X(0.55), wl - h * 0.7],
    [X(0.6), wl - h * 0.5],
    [X(0.65), wl - h * 0.3],
    [X(0.68), wl],
  ]
  // Pale underwater foot, wider than the berg and tapering down.
  const foot: Pt[] = [
    [X(0.15), wl],
    [X(0.7), wl],
    [X(0.64), wl + 8],
    [X(0.5), wl + 13],
    [X(0.3), wl + 12],
    [X(0.2), wl + 7],
  ]
  out.push(occlude(foot), ...hatch(foot, 'h', 3.2, 'fine', 1.5))
  out.push(
    ...rockMass(nb, rand, {
      ridge: nb.slice(1, -1),
      shade: 0.62,
      slant: 0.3,
      fracture: 0,
      smooth: true,
      darkGap: 2.2,
    }),
  )
  // Shadow facets under the spires, T4.
  const f1: Pt[] = [
    [X(0.31), wl - h * 0.82],
    [X(0.35), wl - h * 0.58],
    [X(0.36), wl - h * 0.3],
    [X(0.31), wl - h * 0.3],
    [X(0.3), wl - h * 0.6],
  ]
  out.push(...toneFill(f1, 'T4', { gap: 2.2 }))
  out.push(
    stroke('hair', [
      [X(0.43), wl - h * 0.98],
      [X(0.41), wl - h * 0.6],
      [X(0.39), wl - h * 0.2],
    ]),
  )
  out.push(hline('bold', X(0.16), X(0.69), wl))
  return out
}
