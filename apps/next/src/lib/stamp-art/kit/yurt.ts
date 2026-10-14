// Yurt (ger): a low round felt tent seen from the side. A short lattice wall under a shallow cone
// roof that overhangs the eave, a crown ring with a stove pipe on top, two roof ropes sagging
// across, a painted door in the wall. The roof's right third is hatched along the fall line, the
// wall's right quarter is shaded. The box is the whole tent; its bottom is the ground.
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

export const yurt: KitModule = ([x, y, w, h], p) => {
  const cx = x + w * num(p, 'axis', 0.5)
  const base = y + h
  const wallW = w * 0.8
  const wallTop = base - h * num(p, 'wall', 0.38)
  const eave = w / 2
  const crownY = y + h * 0.16
  const crown = w * 0.07
  const out: SvgNode[] = []
  // Stove pipe.
  const pipeW = Math.max(1.8, w * 0.025)
  out.push(...body(rectPts(cx + crown * 0.1, y, pipeW, crownY - y + 1), 'hair'))
  // Roof: shallow cone, slightly bowed.
  const rightSide = quad(
    [cx + crown, crownY],
    [cx + eave * 0.55, crownY + (wallTop - crownY) * 0.45],
    [cx + eave, wallTop],
    12,
  )
  const roof: Pt[] = [...rightSide.map(([px, py]): Pt => [2 * cx - px, py]).reverse(), ...rightSide]
  out.push(occlude(roof))
  // Fall-line hatching on the right third.
  const shadeStart = cx + eave * 0.48
  for (let px = shadeStart; px < cx + eave - 1; px += 2.6) {
    const t = (px - cx) / eave
    const yTop = crownY + (wallTop - crownY) * (t * 0.62) ** 1.1 * 0.62 + 2
    const yEnd = wallTop - 1
    out.push(
      stroke('hair', [
        [cx + crown * 0.8 + (px - cx) * 0.18, Math.min(yTop, yEnd - 4)],
        [px, yEnd],
      ]),
    )
  }
  // Roof ropes.
  for (const f of [0.38, 0.72]) {
    const yy = crownY + (wallTop - crownY) * f
    const hw = crown + (eave - crown) * f * 0.97
    out.push(stroke('line', quad([cx - hw, yy], [cx, yy + 3.4], [cx + hw, yy], 10)))
  }
  out.push(stroke('line', roof))
  // Crown ring.
  out.push(
    fill([
      [cx - crown, crownY - 1.2],
      [cx + crown, crownY - 1.2],
      [cx + crown * 0.8, crownY + 1.4],
      [cx - crown * 0.8, crownY + 1.4],
    ]),
  )
  // Wall.
  const wallPts = rectPts(cx - wallW / 2, wallTop - 1, wallW, base - wallTop + 1)
  out.push(...body(wallPts, 'line'))
  out.push(
    ...toneFill(rectPts(cx + wallW * 0.3, wallTop, wallW * 0.2, base - wallTop), 'T4', {
      inset: 0.4,
    }),
  )
  out.push(hline('bold', cx - eave - 0.5, cx + eave + 0.5, wallTop))
  // Door.
  const dw = wallW * 0.2
  const dh = (base - wallTop) * 0.78
  const dx = cx - wallW * 0.12
  out.push(fill(rectPts(dx - dw / 2, base - dh, dw, dh)))
  out.push(
    stroke('line', [
      [dx - dw / 2 - 1.2, base - dh - 1.2],
      [dx + dw / 2 + 1.2, base - dh - 1.2],
    ]),
  )
  // Lattice ticks on the lit wall.
  for (let px = cx - wallW / 2 + 3; px < cx - wallW * 0.12 - dw / 2 - 3; px += 4.5) {
    out.push(
      stroke('fine', [
        [px, wallTop + 4],
        [px + 2.2, base - 2],
      ]),
    )
  }
  out.push(hline('bold', cx - wallW / 2 - 1, cx + wallW / 2 + 1, base))
  return out
}
