// Obelisk in elevation: a tapering four-sided shaft with a pyramidion on a square plinth. The box
// is the whole monument (plinth foot at the bottom). The lit face is paper, the right face T4,
// with a ladder of small dark windows near the top and a bold course under the pyramidion.
import { type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const obelisk: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const plinthH = h * num(p, 'plinth', 0.1)
  const stepH = plinthH * 0.45
  const capH = h * num(p, 'cap', 0.1)
  const baseHalf = w * num(p, 'width', 0.2)
  const topHalf = baseHalf * num(p, 'taper', 0.42)
  const shaftBot = y + h - plinthH
  const shaftTop = y + capH
  const out: SvgNode[] = []
  // Plinth: two steps.
  const s1 = rectPts(x, y + h - stepH, w, stepH)
  const s2 = rectPts(x + w * 0.12, shaftBot, w * 0.76, plinthH - stepH)
  out.push(...body(s1), ...body(s2))
  out.push(hline('bold', x, x + w, y + h))
  const shaft = [
    [cx - baseHalf, shaftBot],
    [cx - topHalf, shaftTop],
    [cx + topHalf, shaftTop],
    [cx + baseHalf, shaftBot],
  ] as [number, number][]
  out.push(...body(shaft))
  const pyr = [
    [cx - topHalf, shaftTop],
    [cx, y],
    [cx + topHalf, shaftTop],
  ] as [number, number][]
  out.push(...body(pyr))
  out.push(hline('bold', cx - topHalf - 0.6, cx + topHalf + 0.6, shaftTop))
  // Shaded right face: the right 38% of the shaft, tapered.
  const at = (f: number, t: number) => {
    const half = baseHalf + (topHalf - baseHalf) * t
    return cx - half + 2 * half * f
  }
  out.push(
    ...toneFill(
      [
        [at(0.66, 0), shaftBot],
        [at(0.66, 1), shaftTop],
        [at(1, 1), shaftTop],
        [at(1, 0), shaftBot],
      ],
      'T4',
      { inset: 0.4, gap: 1.8 },
    ),
  )
  out.push(
    stroke('hair', [
      [at(0.66, 0), shaftBot],
      [at(0.66, 1), shaftTop],
    ]),
  )
  // Windows near the top and a doorway at the foot.
  out.push(fill(rectPts(at(0.28, 0.9) - 0.8, shaftTop + (shaftBot - shaftTop) * 0.12, 1.6, 2.4)))
  out.push(fill(rectPts(cx - 1.4 - baseHalf * 0.12, shaftBot - 5, 2.8, 5)))
  return out
}
