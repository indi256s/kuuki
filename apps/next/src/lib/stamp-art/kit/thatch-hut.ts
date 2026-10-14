// Thatched hut on a low earth platform (Joya de Ceren). The box is platform plus hut; the platform
// takes the bottom `platform` fraction, the adobe wall the next `wall`, and a steep thatched roof
// the rest. Thatch strands run down the roof's fall line: dense on the shaded right, a few fine
// streaks on the lit left. Eaves carry a bold fringe and crossed ridge poles top the roof.
import { mulberry32 } from '../hash'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  quad,
  rectPts,
  stroke,
  toneFill,
} from '../grid'
import { type KitModule, num } from './util'

export const thatchHut: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const platH = h * num(p, 'platform', 0.12)
  const wallH = h * num(p, 'wall', 0.2)
  const base = y + h
  const wallTop = base - platH - wallH
  const cx = x + w / 2
  const over = w * 0.08
  const out: SvgNode[] = []
  // Platform with two shallow steps at the front.
  out.push(...body(rectPts(x, base - platH, w, platH), 'hair'))
  out.push(hline('bold', x - 1, x + w + 1, base))
  // Wall (lit) with a dark doorway.
  const wx = x + w * 0.1
  const ww = w * 0.8
  out.push(...body(rectPts(wx, wallTop, ww, wallH), 'hair'))
  out.push(
    ...toneFill(rectPts(wx + ww * 0.66, wallTop, ww * 0.34, wallH), 'T4', { gap: 1.8, inset: 0.3 }),
  )
  out.push(fill(rectPts(cx - ww * 0.12 - ww * 0.08, wallTop + wallH * 0.2, ww * 0.2, wallH * 0.8)))
  // Roof: concave sides to a pointed ridge.
  const eaveY = wallTop + 0.6
  const left = quad([x - over, eaveY], [cx - w * 0.22, y + (eaveY - y) * 0.42], [cx, y], 12)
  const right = quad([cx, y], [cx + w * 0.22, y + (eaveY - y) * 0.42], [x + w + over, eaveY], 12)
  const roof: Pt[] = [...left, ...right.slice(1)]
  out.push(occlude(roof), stroke('line', roof, true))
  out.push(
    stroke('bold', [
      [x - over, eaveY],
      [x + w + over, eaveY],
    ]),
  )
  // Right half is the shaded face: dense strands along the fall line from the ridge.
  for (let px = cx + (x + w + over - cx) * 0.4; px < x + w + over - 1; px += 3.4) {
    out.push(
      stroke('hair', [
        [cx + (px - cx) * 0.18, y + (eaveY - y) * 0.12 + (rand() - 0.5)],
        [px, eaveY - 1],
      ]),
    )
  }
  // Lit left half: a few fine strands.
  for (let px = x - over + 3; px < cx - 2; px += 4 + rand() * 3) {
    const f = 1 - (px - (x - over)) / (cx - (x - over))
    out.push(
      stroke('fine', [
        [px + (cx - px) * 0.1, eaveY - 2],
        [px + (cx - px) * 0.38, eaveY - (eaveY - y) * (0.35 + f * 0.4)],
      ]),
    )
  }
  // Crossed ridge poles.
  out.push(
    stroke('line', [
      [cx - 2.2, y - 1.8],
      [cx + 1.6, y + 1.4],
    ]),
    stroke('line', [
      [cx + 2.2, y - 1.8],
      [cx - 1.6, y + 1.4],
    ]),
  )
  return out
}
