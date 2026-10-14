// Alamgiri Gate, Lahore Fort (Pakistan): a tall central gate block with a pointed-arch portal and
// a row of blind arches, flanked by two half-round bastions crowned with merlons and open kiosks,
// and fort walls running out to both sides. Right sides of the bastions are shaded. The box is the
// whole front; its bottom is the ground.
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { kiosk, merlons, pointedArch } from './dome-parts-c'
import { type KitModule, num } from './util'

export const alamgiriGate: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const wallTop = y + h * num(p, 'wallTop', 0.56)
  // Fort walls with merlons and course lines.
  out.push(...body(rectPts(x, wallTop, w, base - wallTop), 'line'))
  for (let cy = wallTop + 6; cy < base - 3; cy += 6) out.push(hline('fine', x + 1, x + w - 1, cy))
  out.push(...merlons(x + 1, x + w - 4, wallTop, 3, 2.4, 2.8))
  out.push(hline('bold', x, x + w, wallTop))
  // Bastions.
  const bw = w * 0.2
  const bTop = y + h * 0.3
  for (const s of [-1, 1]) {
    const bx = cx + s * w * 0.25
    out.push(...body(rectPts(bx - bw / 2, bTop, bw, base - bTop), 'line'))
    out.push(
      ...toneFill(rectPts(bx + bw * 0.1, bTop + 1, bw * 0.4 - 0.4, base - bTop - 1), 'T4', {
        gap: [3.6, 3.6],
        inset: 0.25,
      }),
    )
    out.push(...merlons(bx - bw / 2 + 0.6, bx + bw / 2 - 0.4, bTop, 2.8, 1.8, 2.6))
    out.push(hline('bold', bx - bw / 2 - 1, bx + bw / 2 + 1, bTop))
    out.push(...kiosk(bx, bTop, bw * 0.55, h * 0.2))
  }
  // Central gate block.
  const gw = w * 0.3
  const gTop = y + h * 0.2
  out.push(...body(rectPts(cx - gw / 2, gTop, gw, base - gTop), 'line'))
  out.push(
    ...toneFill(rectPts(cx + gw * 0.42, gTop + 1, gw * 0.08 - 0.4, base - gTop - 1), 'T4', {
      gap: [2.8, 2.8],
      inset: 0.25,
    }),
  )
  for (let k = -1; k <= 1; k++) {
    const aw = gw * 0.2
    out.push(stroke('hair', pointedArch(cx + k * gw * 0.3 - aw / 2, gTop + 5, aw, gTop + 16)))
  }
  const px: Pt[] = pointedArch(cx - gw * 0.2, y + h * 0.42, gw * 0.4, base)
  out.push(fill(px))
  out.push(stroke('line', pointedArch(cx - gw * 0.27, y + h * 0.36, gw * 0.54, base), false))
  out.push(...merlons(cx - gw / 2 + 0.6, cx + gw / 2 - 3, gTop, 3, 2.2, 2.8))
  out.push(hline('bold', cx - gw / 2 - 1, cx + gw / 2 + 1, gTop))
  out.push(...kiosk(cx, gTop, gw * 0.3, h * 0.2))
  out.push(hline('bold', x + 1, x + w - 1, base))
  return out
}
