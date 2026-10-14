// Funafuti-style atoll strip seen from above, with its runway. `part: 'sea'` is the backdrop: dense
// hatching along the strip on the ocean side, a few fine ripples on the lagoon side. `part: 'land'`
// is the subject: a long lit strip with a black runway (white centre dashes and threshold bars), a
// small apron and black palm tufts along both edges. Geometry is absolute: (x0, y0) to (x1, y1) is
// the centre line, `width` the strip's width.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'
import { tuft } from './lagoon-ring'

export const airstrip: KitModule = ([x, y, w, h], p) => {
  const [x0, y0, x1, y1] = [
    num(p, 'x0', 30),
    num(p, 'y0', 128),
    num(p, 'x1', 172),
    num(p, 'y1', 72),
  ]
  const width = num(p, 'width', 22)
  const bow = num(p, 'bow', 5)
  const len = Math.hypot(x1 - x0, y1 - y0)
  const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len]
  const [nx, ny] = [-uy, ux] // screen normal: points down-right of the strip
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const at = (t: number, off: number): Pt => {
    const s = Math.sin(Math.PI * t) * bow
    return [x0 + (x1 - x0) * t + nx * (off + s), y0 + (y1 - y0) * t + ny * (off + s)]
  }
  const halfW = (t: number) =>
    (width / 2) * Math.min(1, 0.4 + 2 * Math.sin(Math.PI * ((t - 0.12) / 0.76)) ** 0.8)
  const N = 28
  const edgeA: Pt[] = [],
    edgeB: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = 0.12 + (0.76 * i) / N
    const wob = Math.sin(i * 1.7) * 0.7
    edgeA.push(at(t, -halfW(t) - wob))
    edgeB.push(at(t, halfW(t) + wob))
  }
  const strip: Pt[] = [...edgeA, ...edgeB.slice().reverse()]
  const out: SvgNode[] = []
  if (p.part === 'sea') {
    // Window box cut by the strip's centre line into an ocean half and a lagoon half.
    const side = (pt: Pt) => (pt[0] - x0) * nx + (pt[1] - y0) * ny
    const half = (box: Pt[], sign: number): Pt[] => {
      const res: Pt[] = []
      box.forEach((a, i) => {
        const b = box[(i + 1) % box.length]
        const [da, db] = [side(a) * sign, side(b) * sign]
        if (da >= 0) res.push(a)
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db)
          res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        }
      })
      return res
    }
    const win: Pt[] = [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]
    const ocean = half(win, 1)
    const lagoon = half(win, -1)
    const ang = (Math.atan2(uy, ux) * 180) / Math.PI
    out.push(...toneFill(ocean, 'T3', { angle: ang, gap: 2.2, weight: 'hair' }))
    out.push(...toneFill(lagoon, 'T1', { angle: ang, gap: 3.4, weight: 'fine' }))
    return out
  }
  out.push(occlude(strip))
  out.push(stroke('line', strip, true))
  // Runway: two black lanes with a continuous paper centre line.
  const rw = num(p, 'runway', 7)
  const lane = (o0: number, o1: number): Pt[] => {
    const pa: Pt[] = [],
      pb: Pt[] = []
    for (let i = 0; i <= 16; i++) {
      const t = 0.2 + (0.6 * i) / 16
      pa.push(at(t, o0))
      pb.push(at(t, o1))
    }
    return [...pa, ...pb.slice().reverse()]
  }
  out.push(fill(lane(-rw / 2, -0.7)), fill(lane(0.7, rw / 2)))
  // Threshold bars across the strip ends.
  for (const t of [0.17, 0.83]) out.push(stroke('bold', [at(t, -rw * 0.8), at(t, rw * 0.8)]))
  // Apron and terminal on the lagoon side.
  const ap = [
    at(0.46, -rw / 2 - 1),
    at(0.58, -rw / 2 - 1),
    at(0.58, -rw / 2 - 5.5),
    at(0.46, -rw / 2 - 5.5),
  ]
  out.push(occlude(ap), stroke('hair', ap, true))
  // Palm tufts: along both edges, either side of the runway.
  for (let i = 0; i < 16; i++) {
    const t = 0.14 + (i / 16) * 0.72
    const side = i % 2 ? 1 : -1
    if (side < 0 && t > 0.42 && t < 0.62) continue
    const c = at(t, side * (halfW(t) - 3.6))
    out.push(...tuft(c[0], c[1], 3.6 + rand() * 1.4, rand))
  }
  // The chain of islets that continues the atoll rim beyond both ends of the strip.
  for (const [t, k] of [
    [0.04, 1],
    [0.085, 0.7],
    [0.915, 0.7],
    [0.96, 1],
  ]) {
    const c = at(t, 0)
    const isl: Pt[] = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2
      return [c[0] + Math.cos(a) * 5.4 * k, c[1] + Math.sin(a) * 3.2 * k] as Pt
    })
    out.push(occlude(isl), stroke('line', isl, true))
    out.push(...tuft(c[0], c[1], 3.4 * k, rand))
  }
  return out
}
