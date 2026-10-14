// A dugout canoe (pirogue) on the water, bow to the right: a long narrow hull with raised ends,
// a dark hollow inside, a rounded palm-thatch awning over the middle on two posts, and a
// paddle leaning at the stern. The box bottom is the waterline.
import { type Pt, type SvgNode, hline, fill, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const pirogue: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const hullTop = base - h * 0.24
  const out: SvgNode[] = []
  const rim: Pt[] = [
    [x, hullTop - 3],
    [x + w * 0.5, hullTop],
    [x + w, hullTop - 5],
  ]
  const hull: Pt[] = [
    ...quad(rim[0], rim[1], rim[2], 14),
    ...quad([x + w * 0.97, base - 1], [x + w * 0.5, base + 1], [x + w * 0.03, base - 1], 14),
  ]
  out.push(occlude(hull), stroke('line', hull, true))
  if (p.awning !== false) out.push(...toneFill(hull, 'T4', { gap: 3, weight: 'fine', inset: 0.5 }))
  out.push(stroke(p.awning === false ? 'hair' : 'bold', quad(rim[0], rim[1], rim[2], 14)))
  if (p.awning !== false) {
    // Awning: dome of thatch over posts.
    const ax0 = x + w * num(p, 'awning', 0.3),
      ax1 = ax0 + w * 0.42
    const dome: Pt[] = quad(
      [ax0, hullTop - 1],
      [(ax0 + ax1) / 2, y - h * 0.45],
      [ax1, hullTop - 1],
      14,
    )
    const under: Pt[] = [
      [ax1, hullTop - 1],
      [ax0, hullTop - 1],
    ]
    out.push(occlude([...dome, ...under]), stroke('line', [...dome, ...under], true))
    for (let sx = ax0 + 2; sx < ax1 - 1; sx += 2.2) {
      const t = (sx - ax0) / (ax1 - ax0)
      const topY = hullTop - 1 - ((4 * Math.sin(Math.PI * t) * (h * 0.5)) / 4) * 0.9
      out.push(
        stroke('fine', [
          [sx, topY + 1.5],
          [sx - 0.3, hullTop - 3],
        ]),
      )
    }
  } else if (w < 40) out.push(fill(hull))
  out.push(
    stroke('hair', [
      [x + w * 0.1, hullTop - 12],
      [x + w * 0.16, base - 1],
    ]),
  )
  out.push(
    stroke('line', [
      [x + w * 0.09, hullTop - 14],
      [x + w * 0.12, hullTop - 8],
    ]),
  )
  for (let k = 0; k < 3; k++)
    out.push(
      hline('hair', x + w * (0.02 + 0.06 * k), x + w * (0.34 + 0.06 * k), base + 2.4 + k * 2.2 - 0),
    )
  return out
}
