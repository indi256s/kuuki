// Granite outcrops on a grass plateau edge: a pile of rounded boulders and tors of different sizes
// standing on a low rise. Each boulder is a dome with a curved crack, lit upper left and hatched
// along the fall line on the right. The box bottom is the foot of the pile.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const outcropsB: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 8)))
  const base = y + h
  const out: SvgNode[] = []
  // [cx fraction, width fraction, height fraction, bottom fraction]
  const rocks: [number, number, number, number][] = [
    [0.2, 0.34, 0.5, 1],
    [0.58, 0.42, 0.7, 1],
    [0.86, 0.26, 0.4, 1],
    [0.4, 0.22, 0.42, 0.62],
    [0.64, 0.2, 0.34, 0.45],
    [0.08, 0.2, 0.3, 1],
  ]
  for (const [fx, fw, fh, fb] of rocks.map(
    (r) => r.map((v) => v) as [number, number, number, number],
  )) {
    const cx = x + w * fx,
      rw = (w * fw) / 2
    const bot = y + h * fb,
      top = bot - h * fh
    const left = quad([cx - rw, bot], [cx - rw * 1.02, top + (bot - top) * 0.05], [cx, top], 12)
    const right = quad([cx, top], [cx + rw * 1.02, top + (bot - top) * 0.05], [cx + rw, bot], 12)
    const dome: Pt[] = [...left, ...right.slice(1)]
    out.push(occlude(dome, { halo: 0.8 }), stroke('line', dome, true))
    const shade: Pt[] = [
      [cx + rw * 0.15, top + (bot - top) * 0.1],
      ...right.slice(2),
      [cx + rw * 0.2, bot],
    ]
    out.push(...toneFill(shade, 'T4', { angle: 84, gap: 1.8, weight: 'fine', inset: 0.5 }))
    out.push(
      stroke(
        'hair',
        quad(
          [cx - rw * 0.6, top + (bot - top) * 0.45],
          [cx - rw * 0.1, top + (bot - top) * 0.38],
          [cx + rw * 0.25, top + (bot - top) * 0.6],
          8,
        ),
      ),
    )
  }
  // Grass foot: short horizontal flecks.
  for (let k = 0; k < 3; k++)
    for (let sx = x + rand() * 5; sx < x + w - 5; sx += 7 + rand() * 7)
      out.push(
        stroke('hair', [
          [sx, base - 1 - k * 2.4],
          [sx + 4 + rand() * 4, base - 1 - k * 2.4],
        ]),
      )
  return out
}
