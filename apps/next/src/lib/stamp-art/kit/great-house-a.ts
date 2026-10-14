// Great house (lane A, `-a` until consolidated): a Caribbean planter's house with a steep hipped
// roof and dormers, a wrap-around gallery of slim posts above, a shuttered ground storey and a
// stone plinth with a central stair. Box bottom is the ground line.
import { type Pt, type SvgNode, body, fill, hatch, hline, rectPts, stroke, vline } from '../grid'
import { type KitModule, num } from './util'

export const greatHouseA: KitModule = ([x, y, w, h], p) => {
  const bays = Math.max(3, Math.round(num(p, 'bays', 5)))
  const plinthH = h * 0.12
  const roofH = h * num(p, 'roof', 0.4)
  const galH = h * 0.2
  const base = y + h
  const lowH = h - plinthH - roofH - galH
  const out: SvgNode[] = []
  const bw = w / bays
  // Plinth with courses and a central stair.
  const pTop = base - plinthH
  out.push(...body(rectPts(x - 2, pTop, w + 4, plinthH), 'line'))
  out.push(hline('hair', x - 2, x + w + 2, pTop + plinthH * 0.5))
  const sw = w * 0.2
  out.push(
    fill([
      [x + w / 2 - sw / 2, base],
      [x + w / 2 - sw / 2, pTop + 1],
      [x + w / 2 + sw / 2, pTop + 1],
      [x + w / 2 + sw / 2, base],
    ]),
  )
  // Ground storey: lit wall, shuttered windows, central door.
  const wTop = pTop - lowH
  out.push(...body(rectPts(x, wTop, w, lowH), 'line'))
  for (let i = 0; i < bays; i++) {
    const cx = x + bw * (i + 0.5)
    const door = i === Math.floor(bays / 2)
    const ww = door ? bw * 0.34 : bw * 0.3
    const wh = door ? lowH * 0.82 : lowH * 0.5
    const wy = door ? pTop - wh : wTop + lowH * 0.18
    out.push(fill(rectPts(cx - ww / 2, wy, ww, wh)))
    if (!door) {
      out.push(vline('hair', cx - ww / 2 - 1.8, wy, wy + wh))
      out.push(vline('hair', cx + ww / 2 + 1.8, wy, wy + wh))
    }
  }
  out.push(hline('bold', x - 2, x + w + 2, wTop))
  // Gallery: posts and railing in front of a shaded wall.
  const gTop = wTop - galH
  out.push(...body(rectPts(x + 1, gTop, w - 2, galH), 'hair'))
  out.push(...hatch(rectPts(x + 1, gTop, w - 2, galH * 0.7), 'v', 4.6, 'hair', 0.5))
  for (let i = 0; i <= bays; i++) {
    const px = x + bw * i
    out.push(...body(rectPts(px - 1 + (i === bays ? -1 : i === 0 ? 1 : 0), gTop, 2, galH), 'hair'))
  }
  out.push(hline('hair', x, x + w, wTop - galH * 0.32))
  // Steep hipped roof, slate hatch along the slope, two dormers, one chimney.
  const roof: Pt[] = [
    [x - 4, gTop],
    [x + w * 0.2, gTop - roofH],
    [x + w * 0.8, gTop - roofH],
    [x + w + 4, gTop],
  ]
  out.push(...body(roof, 'line'))
  for (let rx = x + 2; rx < x + w - 1; rx += 5.2) {
    const t = (rx - x) / w
    out.push(
      stroke('hair', [
        [rx, gTop - 2],
        [x + w * 0.2 + (t - 0.1) * w * 0.6 * 0.9, gTop - roofH + 1.5],
      ]),
    )
  }
  out.push(
    fill([
      [x - 4, gTop],
      [x + w + 4, gTop],
      [x + w + 3, gTop - 2],
      [x - 3, gTop - 2],
    ]),
  )
  for (const f of [0.34, 0.66]) {
    const dx = x + w * f
    const dw = w * 0.1
    const dy = gTop - roofH * 0.55
    out.push(
      ...body(
        [
          [dx - dw / 2, dy + roofH * 0.2],
          [dx - dw / 2, dy],
          [dx, dy - dw * 0.55],
          [dx + dw / 2, dy],
          [dx + dw / 2, dy + roofH * 0.2],
        ],
        'line',
      ),
    )
    out.push(fill(rectPts(dx - dw * 0.22, dy + 1.6, dw * 0.44, roofH * 0.15)))
  }
  out.push(fill(rectPts(x + w * 0.84 - 2.2, gTop - roofH - 3, 4.4, 9)))
  return out
}
