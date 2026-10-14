// Grand-Bassam colonial house: a low hipped roof over an upper veranda behind slim posts and a
// railing, shuttered windows, and an arcade of dark arches below. Box bottom is the ground line.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  hatch,
  quad,
  rectPts,
  stroke,
  vline,
} from '../grid'
import { type KitModule, num } from './util'

export const veranda: KitModule = ([x, y, w, h], p) => {
  const bays = Math.max(3, Math.round(num(p, 'bays', 5)))
  const roofH = h * 0.26
  const upH = h * 0.3
  const base = y + h
  const lowH = h - roofH - upH
  const out: SvgNode[] = []
  const bw = w / bays
  // Ground storey: wall with arches.
  out.push(...body(rectPts(x, base - lowH, w, lowH), 'line'))
  for (let i = 0; i < bays; i++) {
    const ax = x + bw * i + bw * 0.25
    const aw = bw * 0.5
    const ah = lowH * 0.78
    const arch: Pt[] = [
      [ax, base],
      [ax, base - ah + aw / 2],
      ...Array.from({ length: 7 }, (_, k): Pt => [
        ax + aw / 2 - (aw / 2) * Math.cos((Math.PI * (k + 1)) / 8),
        base - ah + aw / 2 - (aw / 2) * Math.sin((Math.PI * (k + 1)) / 8),
      ]),
      [ax + aw, base - ah + aw / 2],
      [ax + aw, base],
    ]
    out.push(fill(arch))
  }
  out.push(hline('bold', x - 1.5, x + w + 1.5, base - lowH))
  // Upper veranda: shaded wall behind posts, shutters, railing.
  const upTop = base - lowH - upH
  const wall = rectPts(x + 1, upTop, w - 2, upH)
  out.push(...body(wall, 'hair'))
  out.push(...hatch(rectPts(x + w * 0.62, upTop, w * 0.37, upH), 'v', 2.6, 'hair', 0.5))
  for (let i = 0; i <= bays; i++)
    out.push(
      ...body(
        rectPts(x + bw * i - 0.9 + (i === bays ? -0.9 : i === 0 ? 0.9 : 0), upTop, 1.8, upH),
        'hair',
      ),
    )
  out.push(...body(rectPts(x, base - lowH - upH * 0.32, w, upH * 0.32), 'hair'))
  out.push(hline('hair', x, x + w, base - lowH - upH * 0.16))
  // Hipped roof: solid eave band under a hatched slope.
  const eaveY = upTop
  const roof: Pt[] = [
    [x - 4, eaveY],
    [x + w * 0.12, eaveY - roofH],
    [x + w * 0.88, eaveY - roofH],
    [x + w + 4, eaveY],
  ]
  out.push(...body(roof, 'line'))
  out.push(
    fill([
      [x - 4, eaveY],
      [x + w + 4, eaveY],
      [x + w + 3, eaveY - 1.8],
      [x - 3, eaveY - 1.8],
    ]),
  )
  for (let rx = x + w * 0.45; rx < x + w - 1; rx += 4.6)
    out.push(
      stroke('hair', [
        [rx, eaveY - 2.6],
        [x + w * 0.12 + (rx - x) * 0.76, eaveY - roofH + 0.8],
      ]),
    )
  out.push(vline('hair', x + w * 0.5, eaveY - roofH - 3, eaveY - roofH))
  void quad
  return out
}
