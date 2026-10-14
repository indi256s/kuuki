// Loropeni-style laterite ruin: a long high wall of rough courses with a ragged broken crown, a
// low doorway with a lintel, a shaded return wall at the right and rubble at the foot. The box
// bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, hatch, quad, rectPts, stroke } from '../grid'
import { type KitModule, bool, num } from './util'

export const ruinWall: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const faceW = w * 0.78
  const out: SvgNode[] = []
  // Broken crown: stepped heights, every step a block wide.
  const steps = 11
  const crown: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const fx = x + (faceW * i) / steps
    const edgeDrop = i < 3 ? 0.3 : 0
    const hh =
      h *
      (0.74 + 0.26 * Math.sin(i * 1.7 + 1) * 0.6 + (rand() - 0.5) * 0.18 - edgeDrop * (3 - i) * 0.4)
    const top = base - Math.min(h * 0.98, hh)
    if (i > 0) crown.push([fx, crown[crown.length - 1][1]])
    crown.push([fx, top])
  }
  if (bool(p, 'crumble', false)) {
    const rounded: Pt[] = []
    for (let i = 0; i + 1 < crown.length; i++) {
      const a = crown[i],
        b = crown[i + 1]
      rounded.push(...quad(a, [(a[0] + b[0]) / 2 + 1, (a[1] + b[1]) / 2 + 1], b, 3))
    }
    crown.splice(0, crown.length, ...rounded)
  }
  const face: Pt[] = [[x, base], ...crown, [x + faceW, base]]
  // Return wall in shade.
  const rw = w - faceW
  const ret: Pt[] = [
    [x + faceW, base],
    [x + faceW, crown[crown.length - 1][1]],
    [x + faceW + rw, crown[crown.length - 1][1] + h * 0.18],
    [x + faceW + rw, base - 1],
  ]
  out.push(...body(ret, 'line'))
  out.push(...hatch(ret, 'v', 2.4, 'hair', 0.5))
  out.push(...body(face, 'line'))
  const topAt = (px: number) => {
    for (let i = 0; i + 1 < crown.length; i++)
      if (crown[i][0] <= px && px <= crown[i + 1][0]) return Math.max(crown[i][1], crown[i + 1][1])
    return base
  }
  // Courses: staggered rough joints.
  const rows = 7
  for (let r = 1; r < rows; r++) {
    const ly = base - ((h * r) / rows) * 0.98
    let sx = x + 1
    while (sx < x + faceW - 1) {
      const ex = Math.min(x + faceW - 1, sx + 7 + rand() * 9)
      const ty = Math.max(topAt(sx + 0.5), topAt(ex - 0.5)) + 1
      if (ly > ty) out.push(hline('hair', sx, ex - 0.8, ly))
      sx = ex
    }
    for (let jx = x + 4 + (r % 2) * 5; jx < x + faceW - 3; jx += 9 + rand() * 4)
      if (ly - h / rows > topAt(jx) + 1)
        out.push(
          stroke('fine', [
            [jx, ly],
            [jx + (rand() - 0.5), ly - h / rows],
          ]),
        )
  }
  // Doorway with lintel.
  const dx = x + faceW * 0.46
  out.push(...body(rectPts(dx - 1.6, base - h * 0.52, 15.2, 2.4), 'hair'))
  out.push(fill(rectPts(dx, base - h * 0.52 + 2.4, 11.6, h * 0.52 - 2.4)))
  // Rubble.
  for (let i = 0; i < 6; i++) {
    const rx = x + faceW * (0.02 + 0.2 * i) + rand() * 8
    const s = 2.4 + rand() * 2.4
    out.push(
      ...body(
        [
          [rx, base + 0.5],
          [rx + 1, base - s],
          [rx + s * 1.4, base - s * 0.6],
          [rx + s * 1.8, base + 0.5],
        ],
        'hair',
      ),
    )
  }
  return out
}
