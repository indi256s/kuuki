// Savanna foreground: a flat-topped acacia silhouette. The box ground is the tree's foot; the
// crown is a layered, wide, dark canopy on a thin leaning trunk with two branches.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'

export const acacia: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 13)))
  const lean = num(p, 'lean', 0.06) * h
  const base = y + h
  const crownH = h * num(p, 'crown', 0.34)
  const cx = x + w / 2
  const crownY = y + crownH * 0.5
  // Canopy: flat bottom wavy, domed top, wider than the trunk by far.
  const top: Pt[] = []
  const N = 14
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const u = t * 2 - 1
    top.push([
      cx + lean + u * (w / 2),
      crownY + crownH * 0.5 - crownH * 0.6 * (1 - u * u) ** 0.8 + (rand() - 0.5) * 0.9,
    ])
  }
  const bottom: Pt[] = []
  for (let i = N; i >= 0; i--) {
    const t = i / N
    const u = t * 2 - 1
    bottom.push([
      cx + lean + u * (w / 2) * 0.96,
      crownY + crownH * 0.5 + 0.5 + (1 - u * u) * crownH * 0.18 + (rand() - 0.5) * 0.8,
    ])
  }
  const crown: Pt[] = [...top, ...bottom]
  const fork = base - h * 0.4
  const trunk: Pt[] = [
    [cx, base],
    [cx + lean * 0.3, base - h * 0.22],
    [cx + lean * 0.6, fork],
  ]
  const out: SvgNode[] = [occlude(crown)]
  out.push(stroke('line', trunk))
  out.push(stroke('hair', [trunk[2], [cx + lean - w * 0.18, crownY + crownH * 0.75]]))
  out.push(stroke('hair', [trunk[2], [cx + lean + w * 0.2, crownY + crownH * 0.75]]))
  out.push(stroke('hair', [trunk[2], [cx + lean + 0.5, crownY + crownH * 0.8]]))
  out.push(fill(crown))
  return out
}
