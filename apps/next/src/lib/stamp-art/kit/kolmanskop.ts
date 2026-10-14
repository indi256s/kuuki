// Kolmanskop: abandoned gable-fronted houses with dark window grids and a few missing roof planks,
// sand drifted over the lower walls from the right. The box bottom is the sand line. Sand is paper
// under a bold crest with lee wedges of horizontal hair hatching.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, hatch, quad, rectPts, stroke } from '../grid'
import { type KitModule, num } from './util'

function house(
  x: number,
  base: number,
  w: number,
  h: number,
  roof: number,
  rand: () => number,
): SvgNode[] {
  const top = base - h
  const out: SvgNode[] = body(rectPts(x, top, w, h), 'line')
  const rows = h > 24 ? 2 : 1
  const cols = Math.max(2, Math.round(w / 9))
  const cw = w / cols
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (rand() < 0.12) continue
      const wy = top + 4 + r * (h / rows - 1)
      out.push(fill(rectPts(x + c * cw + cw * 0.28, wy, cw * 0.44, Math.min(7, h / rows - 6))))
    }
  const apex: Pt = [x + w * 0.5, top - roof]
  const gable: Pt[] = [[x - 1.6, top], apex, [x + w + 1.6, top]]
  out.push(...body(gable, 'line'))
  // Roof hatching with a ragged missing patch near the ridge.
  for (let i = 1; i < 8; i++) {
    const t = i / 8
    const ex = gable[0][0] + (gable[2][0] - gable[0][0]) * t
    if (t > 0.5 && t < 0.72) continue
    out.push(
      stroke('hair', [
        [apex[0] + (ex - apex[0]) * 0.25, apex[1] + roof * 0.3],
        [ex, top - 0.8],
      ]),
    )
  }
  out.push(
    fill([
      [apex[0] - 3.6, top - roof * 0.15],
      [apex[0] + 0.4, top - roof * 0.15],
      [apex[0] - 1, top - roof * 0.45],
    ]),
  )
  out.push(hline('bold', x - 2, x + w + 2, top))
  return out
}

export const kolmanskop: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 8)))
  const base = y + h
  const out: SvgNode[] = []
  const spec: [number, number, number, number][] = [
    [0.01, 0.3, 0.42, 0.1],
    [0.34, 0.27, 0.54, 0.12],
    [0.64, 0.22, 0.4, 0.09],
    [0.82, 0.17, 0.3, 0.08],
  ]
  for (const [f, wf, hf, rf] of spec)
    out.push(...house(x + w * f, base - 3, w * wf, h * hf, h * rf, rand))
  // Drift: sand climbs the right-hand houses, crest falling to the left.
  const crest = quad(
    [x + w * 0.2, base],
    [x + w * 0.62, base - h * 0.02],
    [x + w, base - h * 0.34],
    24,
  )
  const sand: Pt[] = [...crest, [x + w, base + 2], [x, base + 2], [x, base]]
  out.push(...body(sand, 'bold'))
  const lee: Pt[] = [...crest.slice(6), [x + w, base - 0.5], [x + w * 0.45, base - 0.5]]
  out.push(...hatch(lee, 'h', 2.2, 'hair', 0.8))
  out.push(hline('bold', x, x + w, base + 2))
  return out
}
