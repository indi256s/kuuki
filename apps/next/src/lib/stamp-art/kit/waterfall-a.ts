// Waterfall over a sheer cliff (Angel Falls, Kaieteur). The box is the whole scene: ground is its
// bottom. `kind` 'tepui' is a tall flat-topped mesa on the left with a thin fall off its right
// shoulder; 'plateau' is a wide cliff across the box with a broad single plunge in the middle.
// The cliff face is hatched in vertical runs (sparse on the lit left), the fall is a paper channel
// with fine streaks, a forest rim sits on the lip, a dark forest and a mist cloud at the foot.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num, str } from './util'

function yAtX(line: Pt[], x: number): number {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (a[0] <= x && x <= b[0])
      return b[0] === a[0] ? a[1] : a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
  }
  return x < line[0][0] ? line[0][1] : line[line.length - 1][1]
}

export const waterfallA: KitModule = ([x, y, w, h], p) => {
  const kind = str(p, 'kind', ['tepui', 'plateau'] as const, 'tepui')
  const tepui = kind === 'tepui'
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const x0 = x + w * (tepui ? 0.08 : 0.02)
  const x1 = x + w * (tepui ? 0.5 : 0.98)
  const lip = y + h * (tepui ? 0.02 : 0.14)
  const cb = y + h * num(p, 'cliff', tepui ? 0.8 : 0.76)
  const fx = x + w * num(p, 'fall', tepui ? 0.43 : 0.5)
  const fw = num(p, 'fallW', tepui ? 2.1 : 8)
  const top: Pt[] = tepui
    ? [
        [x0, cb - 4],
        [x0 + w * 0.02, y + h * 0.4],
        [x0 + w * 0.04, y + h * 0.1],
        [x0 + w * 0.07, lip],
        [x1 - w * 0.06, lip],
        [x1 - w * 0.02, y + h * 0.05],
        [x1, y + h * 0.16],
        [x1 + 0.5, cb - 4],
      ]
    : [
        [x0, lip + 2],
        [x0 + w * 0.3, lip],
        [x0 + w * 0.7, lip + 1],
        [x1, lip + 2],
      ]
  const lipAt = (px: number) => yAtX(top, px)
  const out: SvgNode[] = []
  const sil: Pt[] = [[x0, cb + 6], ...top, [x1, cb + 6]]
  out.push(occlude(sil))
  // Cliff face.
  const lit = x0 + (x1 - x0) * num(p, 'lit', tepui ? 0.16 : 0.2)
  let k = 0
  for (let px = x0 + 1; px < x1 - 0.5; px += num(p, 'gap', tepui ? 2.6 : 3.3), k++) {
    const d = Math.abs(px - fx)
    const half = fw * (1 + 0.35) + 1.2
    if (d < half) continue
    const t = lipAt(px) + 1.5 + rand() * 3
    const b = cb + 1
    const near = d < num(p, 'near', tepui ? 12 : 17)
    if (near)
      out.push(
        stroke('hair', [
          [px, t],
          [px, b - (rand() < 0.3 ? rand() * (b - t) * 0.3 : 0)],
        ]),
      )
    else if (px < lit) {
      if (k % 3 === 0)
        out.push(
          stroke('fine', [
            [px, t + 1],
            [px, t + (b - t) * (0.5 + rand() * 0.4)],
          ]),
        )
    } else if (k % 2 === 0)
      out.push(
        stroke('fine', [
          [px, t],
          [px, t + (b - t) * (0.55 + rand() * 0.4)],
        ]),
      )
  }
  // Fall: a paper channel with fine streaks, widening slightly toward the foot.
  const wAt = (yy: number) => fw * (0.8 + 0.45 * ((yy - lip) / (cb - lip)))
  const fallTop = lipAt(fx)
  const chan: Pt[] = []
  for (let i = 0; i <= 8; i++) {
    const yy = fallTop + ((cb - fallTop) * i) / 8
    chan.push([fx - wAt(yy), yy])
  }
  for (let i = 8; i >= 0; i--) {
    const yy = fallTop + ((cb - fallTop) * i) / 8
    chan.push([fx + wAt(yy), yy])
  }
  out.push(occlude(chan))
  out.push(stroke('hair', chan.slice(0, 9)), stroke('hair', chan.slice(9).reverse()))
  const streaks = tepui ? 1 : 4
  for (let s = 0; s < streaks; s++) {
    const f = streaks === 1 ? 0 : (s + 0.5) / streaks - 0.5
    const sx = fx + f * fw * 1.5
    const a = fallTop + 6 + rand() * 8
    out.push(
      stroke('fine', [
        [sx, a],
        [sx, a + (cb - a) * (0.4 + rand() * 0.4)],
      ]),
    )
  }
  // Forest rim on the lip: scalloped dark band.
  const rimH = num(p, 'rim', tepui ? 2.6 : 5)
  const rim: Pt[] = []
  const start = tepui ? x0 + w * 0.1 : x0
  const end = tepui ? x1 - w * 0.06 : x1
  for (let px = start; px <= end; px += 3) rim.push([px, lipAt(px) - rimH * (0.5 + rand() * 0.6)])
  const rimPoly: Pt[] = [...rim, [end, lipAt(end) + 1], [start, lipAt(start) + 1]]
  out.push(occlude(rimPoly), ...toneFill(rimPoly, 'T4', { gap: 1.7, inset: 0.2 }))
  out.push(stroke('line', rim))
  // Cliff outline: the left and right shoulders.
  out.push(stroke('line', top.slice(0, 4)), stroke('line', top.slice(top.length - 4)))
  // Forest at the foot, scalloped top edge on the cliff base.
  const fL = Math.max(x, x0 - 8),
    fR = Math.min(x + w, x1 + 8)
  const fTop: Pt[] = []
  for (let px = fL; px <= fR; px += 3.4)
    fTop.push([px, cb - 1 - rand() * 3 + Math.sin(px * 0.3) * 1.2])
  const forest: Pt[] = [...fTop, [fR, base], [fL, base]]
  const mist = num(p, 'mist', tepui ? 7 : 16)
  const mistPoly: Pt[] = []
  for (let a = 0; a < 20; a++) {
    const t = (a / 20) * Math.PI * 2
    mistPoly.push([fx + Math.cos(t) * mist, cb + 1 + Math.sin(t) * mist * 0.32])
  }
  out.push(occlude(forest), ...toneFill(forest, 'T4', { gap: 2.5, weight: 'hair', inset: 0.2 }))
  out.push(stroke('line', fTop))
  out.push(occlude(mistPoly))
  for (let r = 0; r < 3; r++) {
    const m = mist * (0.55 + r * 0.22)
    out.push(
      stroke(
        'hair',
        quad([fx - m, cb + 2 + r * 2.2], [fx, cb - 4 + r * 2.2], [fx + m, cb + 2 + r * 2.2], 8),
      ),
    )
  }
  return out
}
