// Victoria Falls from the Zambian rim: a flat far plateau under a low tree line, a wide white
// curtain broken by dark rock buttresses, a boiling foam line, and a tall billowing spray plume.
// The near bluff on the right is the Zambian bank. The box bottom is the foot of the gorge.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

type Lobe = [number, number, number]

/** Union outline of overlapping circles: runs of circle points not swallowed by another lobe. */
function lobeOutline(lobes: Lobe[], skip: (p: Pt) => boolean = () => false): Pt[][] {
  const runs: Pt[][] = []
  lobes.forEach(([cx, cy, r], i) => {
    let run: Pt[] = []
    for (let k = 0; k <= 36; k++) {
      const a = (k / 36) * Math.PI * 2
      const p: Pt = [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9]
      const hidden =
        skip(p) ||
        lobes.some(
          ([ox, oy, or], j) => j !== i && Math.hypot(p[0] - ox, (p[1] - oy) / 0.9) < or - 0.4,
        )
      if (hidden) {
        if (run.length > 1) runs.push(run)
        run = []
      } else run.push(p)
    }
    if (run.length > 1) runs.push(run)
  })
  return runs
}

export const victoriaFalls: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const base = y + h
  const ry = y + h * num(p, 'rim', 0.42)
  const fx1 = x + w
  const out: SvgNode[] = []
  // Far plateau: flat rim line with a low tree band above it.
  const trees: Pt[] = [[x, ry]]
  for (let tx = x + 2; tx < x + w; tx += 3.2 + rand() * 2)
    trees.push([tx, ry - 3.4 - rand() * 3.2], [tx + 1.8, ry - 1.4])
  trees.push([x + w, ry])
  out.push(occlude([...trees, [x + w, ry + 1], [x, ry + 1]], { halo: 1 }))
  out.push(...toneFill([...trees], 'T4', { gap: 2.2, weight: 'fine', phase: 0.3 }))
  out.push(
    stroke('hair', trees),
    stroke('line', [
      [x, ry],
      [x + w, ry],
    ]),
  )
  // Dark basalt wall under the rim with the water standing out of it as white veils.
  const wall: Pt[] = [
    [x, ry],
    [x + w, ry],
    [x + w, base - 2],
    [x, base - 2],
  ]
  out.push(occlude(wall), ...toneFill(wall, 'T4', { gap: 2.2, weight: 'hair', inset: 0.2 }))
  const veils: [number, number][] = [
    [0.1, 3],
    [0.22, 5.5],
    [0.36, 8],
    [0.5, 11],
    [0.65, 7],
    [0.78, 4.5],
    [0.9, 3],
  ]
  for (const [f, half] of veils) {
    const vx = x + w * f
    const edge = (side: number): Pt[] =>
      Array.from({ length: 7 }, (_, i) => {
        const t = i / 6
        return [
          vx + side * (half * (0.8 + 0.5 * t) + (rand() - 0.5) * 1.2),
          ry + 1 + t * (base - 4 - ry - 1),
        ]
      })
    const l = edge(-1),
      r = edge(1)
    const poly: Pt[] = [...l, ...r.slice().reverse()]
    out.push(occlude(poly, { halo: 0.4 }))
    for (let k = 1; k < 5; k++) {
      const u = -1 + (2 * k) / 5
      const a0 = ry + 3 + rand() * 6
      out.push(
        stroke('fine', [
          [vx + u * half * 0.8, a0],
          [vx + u * half * 1.05, base - 6 - rand() * 14],
        ]),
      )
    }
    out.push(stroke('hair', l), stroke('hair', r))
  }
  // Spray plume above the main curtain.
  const pcx = x + w * 0.5
  const lobes: Lobe[] = []
  const top = y + 5
  const N = 16
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1)
    const r = 4.5 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 5 + rand() * 2.5 + t * 3
    const spread = 4 + t * 14
    lobes.push([
      pcx + Math.sin(t * 4.2) * 7 + t * 6 + (rand() - 0.5) * spread * 2,
      base - 12 - t * (base - 12 - top - 11),
      r,
    ])
  }
  for (const [lx, ly, lr] of lobes) {
    const ring: Pt[] = Array.from({ length: 20 }, (_, i) => [
      lx + Math.cos((i / 20) * Math.PI * 2) * lr,
      ly + Math.sin((i / 20) * Math.PI * 2) * lr * 0.9,
    ])
    out.push(occlude(ring, { halo: 1.4 }))
  }
  for (const run of lobeOutline(lobes)) out.push(stroke('hair', run))
  // Shading arcs inside the plume, bottom-right of each upper lobe.
  for (const [lx, ly, lr] of lobes.slice(2)) {
    const arc: Pt[] = Array.from({ length: 7 }, (_, i) => {
      const a = -0.2 + (i / 6) * 1.5
      return [lx + Math.cos(a) * lr * 0.62, ly + Math.sin(a) * lr * 0.55]
    })
    out.push(stroke('fine', arc))
  }
  // Foam line along the foot: scalloped lobes.
  const foam: Lobe[] = []
  for (let fx = x + 6; fx < fx1 - 3; fx += 5)
    foam.push([fx, base - 2.5 - rand() * 2, 3.4 + rand() * 1.4])
  for (const [lx, ly, lr] of foam) {
    const ring: Pt[] = Array.from({ length: 12 }, (_, i) => [
      lx + Math.cos((i / 12) * Math.PI * 2) * lr,
      ly + Math.sin((i / 12) * Math.PI * 2) * lr * 0.7,
    ])
    out.push(occlude(ring, { halo: 0.8 }))
  }
  for (const run of lobeOutline(foam)) out.push(stroke('hair', run))
  out.push(hline('hair', x, x + w, base - 0.6))
  return out
}
