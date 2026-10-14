// Plain of Jars (Laos): megalithic stone jars, tall barrels with a wide mouth, a swelling shoulder
// and a narrower foot, standing in grass. Some have a flat lid, some are open and dark inside, one
// is cracked. Lit left, shaded right in fall-line verticals. `jars` lists
// [x fraction, height fraction of the box, 0 open | 1 lid]. The box bottom is the front ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatch, hline, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

const DEFAULT_JARS: [number, number, number][] = [
  [0.1, 0.3, 0],
  [0.36, 0.32, 1],
  [0.64, 0.3, 0],
  [0.92, 0.28, 1],
  [0.22, 0.46, 1],
  [0.52, 0.62, 0],
  [0.82, 0.42, 0],
]

function jar(cx: number, base: number, ht: number, lid: number, rand: () => number): SvgNode[] {
  const out: SvgNode[] = []
  const w = ht * 0.78
  const hw = (t: number) => {
    // Half width from the rim (t 0): flared lip, narrow neck, belly at 40% down, tapering foot.
    if (t < 0.07) return (w / 2) * (0.78 - 0.08 * (t / 0.07))
    if (t < 0.42) return (w / 2) * (0.7 + 0.3 * Math.sin(((t - 0.07) / 0.35) * (Math.PI / 2)))
    return (w / 2) * (1 - 0.4 * ((t - 0.42) / 0.58) ** 1.3)
  }
  const top = base - ht
  const n = 18
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    left.push([cx - hw(t), top + ht * t])
    right.push([cx + hw(t), top + ht * t])
  }
  const outline: Pt[] = [...left, ...right.reverse()]
  out.push(...body(outline, 'line'))
  // Shaded right third: vertical hatching along the fall line.
  const shade: Pt[] = []
  const shadeR: Pt[] = []
  for (let i = 1; i <= n; i++) {
    const t = i / n
    shade.push([cx + hw(t) * 0.62, top + ht * t])
    shadeR.push([cx + hw(t) - 0.6, top + ht * t])
  }
  out.push(...toneFill([...shade, ...shadeR.reverse()], 'T4', { angle: 90, gap: [2.2, 2.2] }))
  // Rock texture on the lit side: short pitted dashes and one crack.
  for (let i = 0; i < 5; i++) {
    const t = 0.25 + rand() * 0.6
    const px = cx - hw(t) * 0.75 + rand() * hw(t) * 0.9
    const py = top + ht * t
    out.push(
      stroke('fine', [
        [px, py],
        [px + 2.4 + rand() * 2, py + 0.8],
      ]),
    )
  }
  out.push(
    stroke('fine', [
      [cx - hw(0.2) * 0.3, top + ht * 0.2],
      [cx - hw(0.35) * 0.1, top + ht * 0.4],
      [cx - hw(0.5) * 0.35, top + ht * 0.58],
    ]),
  )
  // Rim: ellipse; open jars are dark inside, lidded jars carry a flat slab.
  const rx = hw(0) + 0.4
  const ry = Math.max(2, rx * 0.26)
  const rim: Pt[] = Array.from({ length: 20 }, (_, i): Pt => {
    const a = (Math.PI * 2 * i) / 20
    return [cx + Math.cos(a) * rx, top + Math.sin(a) * ry]
  })
  if (lid) {
    const slabH = Math.max(2.4, ht * 0.07)
    const lx = rx + 1.4
    const topRim: Pt[] = Array.from({ length: 20 }, (_, i): Pt => {
      const a = (Math.PI * 2 * i) / 20
      return [cx + Math.cos(a) * lx, top - slabH + Math.sin(a) * ry * 0.9]
    })
    out.push(
      ...body(
        [
          [cx - lx, top - slabH],
          [cx - lx, top + ry * 0.2],
          [cx + lx, top + ry * 0.2],
          [cx + lx, top - slabH],
        ],
        'line',
      ),
    )
    out.push(...body(topRim, 'line'))
  } else {
    out.push(...body(rim, 'line'))
    out.push(fill(rim.map(([px, py]): Pt => [cx + (px - cx) * 0.78, top + (py - top) * 0.7])))
  }
  // Foot shadow.
  out.push(
    ...hatch(
      [
        [cx - hw(1) - 3, base + 0.4],
        [cx + hw(1) + 4, base + 0.4],
        [cx + hw(1) + 4, base + 2],
        [cx - hw(1) - 3, base + 2],
      ],
      'h',
      1.2,
      'hair',
    ),
  )
  return out
}

export const stoneJars: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const jars = (Array.isArray(p.jars) ? p.jars : DEFAULT_JARS) as [number, number, number][]
  const base = y + h
  const out: SvgNode[] = []
  // Back jars sit higher, so draw them in order of ground height (small first).
  const order = [...jars].sort((a, b) => a[1] - b[1])
  for (const [fx, fh, lid] of order) {
    const ht = fh * h
    const b = base - (1 - fh) * h * 0.3
    out.push(...jar(x + fx * w, b, ht, lid, rand))
  }
  // Foreground grass: short tufts along the base.
  for (let gx = x; gx < x + w; gx += 2.6 + rand() * 1.8) {
    const len = 2 + rand() * 4
    out.push(
      stroke('hair', [
        [gx, base + 0.8],
        [gx + (rand() - 0.5) * 2, base + 0.8 - len],
      ]),
    )
  }
  out.push(hline('hair', x, x + w, base + 1))
  return out
}
