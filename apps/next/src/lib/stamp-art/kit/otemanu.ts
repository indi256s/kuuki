// Mount Otemanu (Bora Bora): a bulky volcanic plug with sheer fluted walls and a rounded crown
// rising from forested shoulders, with the lower pyramid of Mount Pahia on its left. The box
// bottom is the foot of the forest. `pahia: 0` drops the lower peak.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

function chaikin(pts: Pt[], rounds: number): Pt[] {
  let cur = pts
  for (let r = 0; r < rounds; r++) {
    const next: Pt[] = [cur[0]]
    for (let i = 0; i + 1 < cur.length; i++) {
      const [a, b] = [cur[i], cur[i + 1]]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
      next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    next.push(cur[cur.length - 1])
    cur = next
  }
  return cur
}

export const otemanu: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const at = (fx: number, fy: number): Pt => [x + w * fx, y + h * fy]
  const pahia = num(p, 'pahia', 1)
  const bl = num(p, 'blockL', 0.52)
  const br = num(p, 'blockR', 0.74)
  const shoulder = num(p, 'shoulder', 0.54)
  const out: SvgNode[] = []
  const leftPts: Pt[] = [
    at(0, 1),
    at(0.07, 0.86),
    at(0.14, 0.64 + (1 - pahia) * 0.2),
    at(0.2, 0.46 + (1 - pahia) * 0.3),
    at(0.27, 0.6 + (1 - pahia) * 0.1),
    at(0.36, shoulder + 0.04),
    at(bl - 0.07, shoulder),
  ]
  const leftSh = chaikin(leftPts, 2)
  const rightSh = chaikin(
    [at(br + 0.07, shoulder), at(br + 0.14, shoulder + 0.12), at(0.9, 0.84), at(1, 1)],
    2,
  )
  // Block: rounded crown, walls slightly bowed.
  const topY = y + 2
  const crown = quad(
    [x + w * bl, y + h * 0.16],
    [x + w * (bl + br) * 0.5, topY - 5],
    [x + w * br, y + h * 0.14],
    12,
  )
  const blockL: Pt[] = [at(bl - 0.07, shoulder), at(bl - 0.03, 0.4), at(bl - 0.005, 0.27), crown[0]]
  const blockR: Pt[] = [
    crown[crown.length - 1],
    at(br + 0.005, 0.27),
    at(br + 0.03, 0.4),
    at(br + 0.07, shoulder),
  ]
  const outline: Pt[] = [
    ...leftSh,
    ...blockL.slice(1),
    ...crown,
    ...blockR.slice(0, -1),
    ...rightSh,
  ]
  out.push(occlude([...outline, [x, base]], { halo: 1.5 }))
  // Forested slopes: dark verticals along the fall line, below the line of the shoulder.
  const treeline = y + h * num(p, 'trees', 0.8)
  const slopes: Pt[] = [...leftSh, ...rightSh].map(([px, py]) => [px, Math.max(py, treeline)])
  out.push(
    ...toneFill([...leftSh, ...rightSh, [x + w, base], [x, base]], 'T4', {
      gap: 6,
      weight: 'fine',
      inset: 0.2,
    }),
  )
  out.push(...toneFill([...slopes, [x + w, base], [x, base]], 'T4', { gap: 2.6, inset: 0.2 }))
  // Pahia's lit side: sparse diagonals on its left face keep it lighter than the block's shade.
  // Block: lit left face, shaded right face.
  const split = x + w * (bl + (br - bl) * 0.58)
  const faceBottom = y + h * shoulder + 3
  const topAt = (px: number): number => {
    let best = crown[0][1]
    for (const c of crown) if (Math.abs(c[0] - px) < Math.abs(crown[0][0] - px)) best = c[1]
    return best
  }
  const shade: Pt[] = [
    [split, topAt(split) + 2],
    ...crown.filter((c) => c[0] > split),
    ...blockR.slice(1),
    [x + w * (br + 0.07) + 1, faceBottom],
    [split, faceBottom],
  ]
  out.push(...toneFill(shade, 'T4', { gap: 2.7, inset: 0.3 }))
  // Flutes on the lit face: long verticals of uneven length from the crown down.
  let k = 0
  for (let fx = x + w * bl + 3.2; fx < split - 1.5; fx += 4.2, k++) {
    const top = topAt(fx) + 4 + rand() * 3
    out.push(
      vline('hair', fx, top, Math.min(faceBottom - 4, top + (k % 2 ? 22 : 38) + rand() * 14)),
    )
  }
  // Strata ticks across the lit face.
  for (const f of [0.34, 0.47]) {
    const yy = y + h * f
    out.push(
      stroke('fine', [
        [x + w * bl + 2, yy],
        [split - 3, yy + 0.8],
      ]),
    )
  }
  out.push(stroke('line', outline))
  out.push(stroke('bold', crown))
  // Foot line of the forest.
  out.push(
    stroke('hair', [
      [x, base - 0.6],
      [x + w, base - 0.6],
    ]),
  )
  return out
}
