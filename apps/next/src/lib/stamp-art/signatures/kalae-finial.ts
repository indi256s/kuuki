// TH: crossed horn finials (kalae) at the gable apex.
import { type Pt, type SvgNode, cubic, fill, mirrorPts } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

/** A tapered curved blade from (bx, by) rising toward (tx, ty), thickness shrinking to a point. */
function blade(bx: number, by: number, tx: number, ty: number, bend: number, thick: number): Pt[] {
  const c1: Pt = [bx + (tx - bx) * 0.15 + bend, by + (ty - by) * 0.45]
  const c2: Pt = [bx + (tx - bx) * 0.55 + bend * 1.2, by + (ty - by) * 0.85]
  const spine = cubic([bx, by], c1, c2, [tx, ty], 14)
  const a: Pt[] = [],
    b: Pt[] = []
  spine.forEach(([px, py], i) => {
    const t = i / (spine.length - 1)
    const th = thick * (1 - t) ** 0.8 + 0.2
    a.push([px - th / 2, py])
    b.push([px + th / 2, py])
  })
  return [...a, ...b.reverse()]
}

/** Two blades crossing low on the ridge and fanning out into a V, drawn solid. */
export const kalaeFinial: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const thick = num(p, 'thick', 3.4)
  const bottom = y + h
  const left = blade(cx + w * 0.1, bottom, x + w * 0.04, y, -w * 0.12, thick)
  const right = mirrorPts(left, cx).reverse()
  return [fill(left), fill(right)] as SvgNode[]
}
