// Nan Madol (Micronesia): a basalt enclosure wall built log-cabin style from crisscrossed
// columns. Horizontal courses run along the face, T5 column ends stagger at both corners, and the
// corners rise as upturned prows over a lower middle. No door. Mangrove crowns stand behind, a
// pale T1 tidal channel runs along the foot. The box is the wall; its bottom is the wall's foot.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatch,
  hline,
  occlude,
  quad,
  rectPts,
  toneFill,
} from '../grid'
import { canopyNodes } from './mass-b'
import { clipPoly } from './rock-b'
import { type KitModule, num } from './util'

const quadPts = (a: Pt, c: Pt, b: Pt): Pt[] => quad(a, c, b, 8)

export const nanMadol: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const base = y + h
  const out: SvgNode[] = []
  const x0 = x + w * 0.05,
    x1 = x + w * 0.95
  const plateau = base - h * 0.46
  const topEnd = y + 6
  const tw = w * 0.15
  // Silhouette: a U. Each corner is a tower whose courses project outward as they rise, so it
  // leans out like an upturned prow; the middle wall is lower.
  const lt = quadPts([x0 + tw, topEnd], [x0 + tw + 1, plateau - 2], [x0 + tw + 8, plateau])
  const left: Pt[] = [[x0 + 3, base], [x0 - 3, topEnd], [x0 + tw, topEnd], ...lt]
  const right: Pt[] = left.map(([px, py]) => [2 * (x + w / 2) - px, py] as Pt).reverse()
  const pts: Pt[] = [...left, ...right]
  // Mangrove crowns behind the wall.
  out.push(...canopyNodes(x, x + w, plateau + 6, h * 0.34, rand, { crowns: 7, thr: 0.3 }))
  out.push(...body(pts, 'line'))
  for (const row of hatch(pts, 'h', 4, 'hair', 0.6, 0.0)) out.push(row)
  // Shaded right return.
  const cutX = x0 + (x1 - x0) * 0.86
  out.push(
    ...toneFill(
      clipPoly(pts, ([px]) => px - cutX),
      'T4',
      { gap: 2.3, inset: 0.3 },
    ),
  )
  // Column ends: T5 squares staggering in and out along both corner edges.
  const edgeAt = (yy: number, dir: 1 | -1): number => {
    const seq = dir === 1 ? left : right.slice().reverse()
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = seq[i],
        b = seq[i + 1]
      if ((a[1] - yy) * (b[1] - yy) <= 0 && a[1] !== b[1])
        return a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
    }
    return seq[0][0]
  }
  let k = 0
  for (let yy = base - 3; yy > topEnd + 1; yy -= 4, k++) {
    const off = k % 2 ? 1.4 : -0.6
    const lx = edgeAt(yy, 1),
      rx = edgeAt(yy, -1)
    out.push(
      fill(rectPts(lx - 1.6 - off, yy - 2.6, 3.2, 2.6)),
      fill(rectPts(rx - 1.6 + off, yy - 2.6, 3.2, 2.6)),
    )
    if (yy < plateau - 3) {
      // Inner edge of the towers above the middle wall, and a few ends across the tower face.
      out.push(fill(rectPts(x0 + tw - 1 + off + (plateau - yy) * 0.0, yy - 2.6, 3, 2.6)))
      out.push(fill(rectPts(x1 - tw - 2 - off, yy - 2.6, 3, 2.6)))
      out.push(fill(rectPts(lx + 6 + (k % 2) * 2.4, yy - 2.6, 2.4, 2.6)))
    }
  }
  out.push(hline('bold', x0 - 2, x1 + 2, base))
  // Pale tidal channel along the foot.
  const ch: Pt[] = [
    [x + 2, base + 1],
    [x + w - 2, base + 1],
    [x + w - 8, base + 12],
    [x + 8, base + 12],
  ]
  out.push(occlude(ch), ...hatch(ch, 'h', 3.4, 'fine', 1))
  return out
}
