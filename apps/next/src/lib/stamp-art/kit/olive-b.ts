// An old olive tree: a thick twisted trunk with a hollow that forks into two limbs under a round
// crown piled from leaf clusters. Each cluster is lit on its upper left and hatched on its lower
// right; the trunk is shaded on its right and gnarled with a few bark ticks. The box is the whole
// tree: the crown takes the top 66% of the height, the trunk base sits on the box bottom.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, hatchPoly, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

function ribbon(center: Pt[], half: number[]): { left: Pt[]; right: Pt[] } {
  const left: Pt[] = []
  const right: Pt[] = []
  center.forEach((c, i) => {
    const a = center[Math.max(0, i - 1)],
      b = center[Math.min(center.length - 1, i + 1)]
    const dx = b[0] - a[0],
      dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len,
      ny = dx / len
    left.push([c[0] + nx * half[i], c[1] + ny * half[i]])
    right.push([c[0] - nx * half[i], c[1] - ny * half[i]])
  })
  return { left, right }
}

export const oliveB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const base = y + h
  const xc = x + w / 2
  const out: SvgNode[] = []
  // Trunk: a short twisted bole, then two limbs.
  const boleTop = base - h * 0.34
  const bole: Pt[] = [
    [xc - 1, base],
    [xc - 4, base - h * 0.1],
    [xc + 1, base - h * 0.2],
    [xc - 1, boleTop],
  ]
  const limbL: Pt[] = [
    [xc - 1, boleTop],
    [xc - w * 0.15, base - h * 0.44],
    [xc - w * 0.26, base - h * 0.56],
  ]
  const limbR: Pt[] = [
    [xc - 1, boleTop],
    [xc + w * 0.12, base - h * 0.46],
    [xc + w * 0.22, base - h * 0.6],
  ]
  const crownC: Pt = [xc + 2, y + h * 0.33]
  const R = Math.min(w * 0.36, h * 0.34)
  // Clusters, back (top) to front (bottom), unit offsets from the crown centre and radius.
  const clusters: [number, number, number][] = [
    [-0.15, -0.55, 0.42],
    [0.35, -0.45, 0.38],
    [-0.62, -0.1, 0.36],
    [0.72, -0.05, 0.36],
    [0.05, -0.1, 0.46],
    [-0.4, 0.3, 0.34],
    [0.5, 0.32, 0.34],
    [0.0, 0.5, 0.3],
  ]
  // Limbs go behind the lowest clusters, so draw limbs first, then the clusters.
  const limbs = [
    ribbon(bole, [8, 8.6, 7.2, 6.4]),
    ribbon(limbL, [6, 4.6, 3.4]),
    ribbon(limbR, [6, 4.6, 3.4]),
  ]
  for (const lb of limbs) {
    const poly: Pt[] = [...lb.left, ...lb.right.slice().reverse()]
    out.push(...body(poly, 'line'))
    // Shaded right half, hatched along the limb.
    const mid: Pt[] = lb.left.map((l, i) => [
      (l[0] + lb.right[i][0]) / 2 + 0.6,
      (l[1] + lb.right[i][1]) / 2,
    ])
    out.push(
      ...toneFill([...mid, ...lb.right.slice().reverse()], 'T4', {
        gap: 1.8,
        weight: 'fine',
        inset: 0.3,
      }),
    )
  }
  // Hollow and bark ticks on the bole.
  out.push(
    fill([
      [xc - 1.8, base - h * 0.2],
      [xc - 2.4, base - h * 0.14],
      [xc - 0.8, base - h * 0.1],
      [xc - 0.6, base - h * 0.17],
    ]),
  )
  for (const [dx, dy, l] of [
    [-3, 0.06, 4],
    [1.5, 0.26, 3.4],
    [-2.4, 0.3, 3],
  ] as const) {
    out.push(
      stroke('fine', [
        [xc + dx, base - h * dy],
        [xc + dx + rand() - 0.5, base - h * dy - l],
      ]),
    )
  }
  // Crown clusters.
  const ring = (cx: number, cy: number, r: number, a0 = 0, a1 = 360): Pt[] => {
    const pts: Pt[] = []
    const n = 22
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180
      pts.push([cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.8])
    }
    return pts
  }
  clusters.forEach(([ox, oy, rr], i) => {
    const cx = crownC[0] + ox * R * 1.3
    const cy = crownC[1] + oy * R * 0.85
    const r = rr * R
    out.push(...body(ring(cx, cy, r).slice(0, -1), i === 4 ? 'line' : 'line'))
    // Lower-right crescent in hatching, leaving the upper left lit; leaf ticks on the lit part.
    const cres: Pt[] = ring(cx, cy, r * 0.94, -5, 150)
    out.push(...hatchPoly(cres, { angle: 55, gap: 2, weight: 'fine', inset: 0.3 }))
    for (let k = 0; k < 4; k++) {
      const a = (200 + rand() * 120) * (Math.PI / 180)
      const rad = r * (0.2 + rand() * 0.45)
      const lx = cx + Math.cos(a) * rad,
        ly = cy + Math.sin(a) * rad * 0.8
      out.push(
        stroke('fine', [
          [lx, ly],
          [lx + 2.6, ly - 1.2],
        ]),
      )
    }
  })
  // Roots flaring on the ground.
  out.push(hline('bold', xc - 11, xc + 11, base))
  return out
}
