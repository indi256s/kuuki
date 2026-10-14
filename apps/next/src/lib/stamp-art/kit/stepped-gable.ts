// Netherlands: a narrow canal house in elevation with a stepped, bell or neck gable, a hoist beam
// and tall windows. Brick faces are lit (T0) or dark (T4) so a row alternates in tone.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  quad,
  rectPts,
  stroke,
  toneFill,
  vline,
} from '../grid'
import { type KitModule, num, str } from './util'
import { windowRow } from './windows'

export const steppedGable: KitModule = ([x, y, w, h], p) => {
  const style = str(p, 'style', ['stepped', 'bell', 'neck', 'pointed'] as const, 'stepped')
  const gableH = h * num(p, 'gableH', 0.26)
  const steps = Math.max(2, Math.round(num(p, 'steps', 4)))
  const wallY = y + gableH
  const cx = x + w / 2
  const out: SvgNode[] = []
  let outline: Pt[]
  if (style === 'stepped') {
    const sw = (w * 0.62) / steps
    const sh = gableH / (steps + 0.5)
    const topY = wallY - gableH
    const pts: Pt[] = [[x, wallY]]
    for (let i = 0; i < steps; i++) {
      const stepY = wallY - ((i + 1) * gableH) / steps
      pts.push([x + i * sw, stepY], [x + (i + 1) * sw, stepY])
    }
    pts.push([cx, topY])
    const right = pts
      .slice(1, -1)
      .map(([px, py]): Pt => [2 * cx - px, py])
      .reverse()
    outline = [...pts, ...right, [x + w, wallY], [x + w, y + h], [x, y + h]]
  } else if (style === 'bell') {
    const lt = quad(
      [x, wallY],
      [x + w * 0.02, y + gableH * 0.35],
      [cx - w * 0.14, y + gableH * 0.3],
      8,
    )
    const top = quad(
      [cx - w * 0.14, y + gableH * 0.3],
      [cx - w * 0.04, y + gableH * 0.1],
      [cx, y],
      6,
    )
    const left = [...lt, ...top]
    const right = left
      .slice(0, -1)
      .map(([px, py]): Pt => [2 * cx - px, py])
      .reverse()
    outline = [...left, ...right, [x + w, y + h], [x, y + h]]
  } else if (style === 'pointed') {
    // Bryggen: a plain steep triangle over a plank wall.
    outline = [
      [x, wallY],
      [cx, y],
      [x + w, wallY],
      [x + w, y + h],
      [x, y + h],
    ]
  } else {
    const dip = gableH * 0.25
    outline = [
      [x, wallY],
      [x, wallY - gableH * 0.7],
      [cx - 3, wallY - gableH * 0.7 - dip * 0.4],
      [cx, y],
      [cx + 3, wallY - gableH * 0.7 - dip * 0.4],
      [x + w, wallY - gableH * 0.7],
      [x + w, y + h],
      [x, y + h],
    ]
  }
  out.push(...body(outline, 'line'))
  if (str(p, 'tone', ['lit', 'dark'] as const, 'lit') === 'dark') {
    out.push(
      ...toneFill(rectPts(x + 1, wallY - gableH * 0.4, w - 2, h - gableH * 0.6), 'T4', {
        inset: 0.2,
      }),
    )
  } else {
    out.push(
      ...toneFill(rectPts(x + w * 0.78, wallY + 1, w * 0.22 - 0.4, h - gableH - 1), 'T4', {
        inset: 0.2,
      }),
    )
  }
  const rows = Math.max(2, Math.round(num(p, 'rows', 3)))
  const cols = Math.max(1, Math.round(num(p, 'cols', 2)))
  const pitch = (w - 4) / cols
  const rh = (h - gableH - 8) / rows
  for (let r = 0; r < rows; r++)
    out.push(
      ...windowRow(
        x + 2,
        x + w - 2,
        wallY + 3 + r * rh,
        Math.min(3.4, pitch * 0.5),
        Math.max(4, rh * 0.62),
        pitch,
      ),
    )
  out.push(fill(rectPts(cx - 2, y + h - 9, 4, 9)))
  out.push(fill(rectPts(cx - 1.2, wallY - gableH * 0.55, 2.4, 3.6)))
  out.push(vline('hair', cx, y - 3, y + 1), hline('hair', cx - 1.6, cx + 1.6, y - 2))
  out.push(
    stroke('hair', [
      [x, wallY],
      [x + w, wallY],
    ]),
  )
  return out
}
