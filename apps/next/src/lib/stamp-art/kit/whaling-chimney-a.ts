// Abandoned whaling station on a shore: a tall tapering square brick chimney with a bold lip and
// two bands, low gabled sheds with corrugated roofs and a row of round oil tanks. The box is the
// whole station; the bottom is the shore line. The chimney stands at `at` (fraction of the width).
import { type Pt, type SvgNode, body, fill, hatch, hline, occlude, rectPts, stroke } from '../grid'
import { type KitModule, num } from './util'

export const whalingChimneyA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const out: SvgNode[] = []
  const cx = x + w * num(p, 'at', 0.3)
  // Sheds behind and beside the chimney.
  const shed = (sx: number, sw: number, sh: number): SvgNode[] => {
    const ridge = sh * 0.38
    const wall: Pt[] = [
      [sx, base],
      [sx, base - sh + ridge],
      [sx + sw, base - sh + ridge],
      [sx + sw, base],
    ]
    const roof: Pt[] = [
      [sx - 1.2, base - sh + ridge + 0.4],
      [sx + sw / 2, base - sh],
      [sx + sw + 1.2, base - sh + ridge + 0.4],
    ]
    const o: SvgNode[] = [...body(wall, 'line'), ...body(roof, 'line')]
    o.push(...hatch(roof, 'v', 1.9, 'hair', 0.5))
    o.push(fill(rectPts(sx + sw * 0.15, base - (sh - ridge) * 0.6, 2.4, 3)))
    o.push(fill(rectPts(sx + sw * 0.62, base - (sh - ridge) * 0.7, 3.4, (sh - ridge) * 0.7)))
    return o
  }
  out.push(...shed(cx + 14, 30, 24))
  out.push(...shed(cx - 38, 22, 18))
  // Tanks on the right.
  const tankX = cx + 50
  for (let i = 0; i < 3; i++) {
    const tw = 12
    const tx = tankX + i * (tw + 2.6)
    if (tx + tw > x + w) break
    const th = 15 - i * 1.5
    out.push(...body(rectPts(tx, base - th, tw, th), 'line'))
    out.push(...hatch(rectPts(tx + tw * 0.62, base - th, tw * 0.38, th), 'v', 2.4, 'hair', 0.2))
    out.push(hline('hair', tx, tx + tw, base - th * 0.5))
    out.push(hline('bold', tx - 0.8, tx + tw + 0.8, base - th))
  }
  // Chimney.
  const bw = num(p, 'width', 14)
  const topW = bw * 0.62
  const top = y + 3
  const lip = 3.4
  const shaft: Pt[] = [
    [cx - bw / 2, base],
    [cx - topW / 2, top + lip],
    [cx + topW / 2, top + lip],
    [cx + bw / 2, base],
  ]
  out.push(
    occlude([
      [cx - topW / 2 - 1.4, top],
      [cx + topW / 2 + 1.4, top],
      [cx + bw / 2, base],
      [cx - bw / 2, base],
    ]),
  )
  out.push(...body(shaft, 'line'))
  const at = (f: number, t: number) => cx - (bw + (topW - bw) * t) / 2 + (bw + (topW - bw) * t) * f
  out.push(
    ...hatch(
      [
        [at(0.55, 0), base],
        [at(0.55, 1), top + lip],
        [at(1, 1), top + lip],
        [at(1, 0), base],
      ],
      'v',
      1.9,
      'hair',
      0.2,
    ),
  )
  out.push(...body(rectPts(cx - topW / 2 - 1.4, top, topW + 2.8, lip), 'line'))
  for (const f of [0.35, 0.7]) {
    const yy = top + lip + (base - top - lip) * f
    const t = f
    out.push(
      stroke('bold', [
        [at(0, t) - 0.6, yy],
        [at(1, t) + 0.6, yy],
      ]),
    )
  }
  // Base plinth.
  out.push(...body(rectPts(cx - bw / 2 - 2, base - 3, bw + 4, 3), 'line'))
  out.push(hline('bold', x, x + w, base))
  return out
}
