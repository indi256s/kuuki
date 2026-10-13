// Object modules: statue (an abstract monument on a plinth; never a figure).
import { type SvgNode, body, fill, rectPts, stroke } from '../grid'
import { type KitModule, num, str } from './util'

export const statue: KitModule = ([x, y, w, h], p) => {
  const kind = str(p, 'kind', ['obelisk', 'column', 'orb'] as const, 'obelisk')
  const plinthH = h * num(p, 'plinth', 0.3)
  const cx = x + w / 2
  const out: SvgNode[] = []
  out.push(...body(rectPts(x, y + h - plinthH, w, plinthH), 'line'))
  out.push(...body(rectPts(x + w * 0.12, y + h - plinthH * 1.35, w * 0.76, plinthH * 0.35), 'line'))
  const sh = h - plinthH * 1.35
  const sw = w * 0.4
  if (kind === 'obelisk') {
    out.push(
      ...body(
        [
          [cx - sw / 2, y + sh],
          [cx - sw * 0.28, y + sh * 0.12],
          [cx, y],
          [cx + sw * 0.28, y + sh * 0.12],
          [cx + sw / 2, y + sh],
        ],
        'line',
      ),
    )
  } else if (kind === 'column') {
    out.push(...body(rectPts(cx - sw / 3, y + sh * 0.08, (sw * 2) / 3, sh * 0.92), 'line'))
    out.push(...body(rectPts(cx - sw / 2, y, sw, sh * 0.1), 'line'))
  } else {
    const r = Math.min(sw / 2, sh / 2)
    const pts = Array.from(
      { length: 16 },
      (_, i) =>
        [cx + r * Math.cos((i * Math.PI) / 8), y + sh - r + r * Math.sin((i * Math.PI) / 8)] as [
          number,
          number,
        ],
    )
    out.push(fill(pts))
  }
  out.push(
    stroke('bold', [
      [x - 1, y + h],
      [x + w + 1, y + h],
    ]),
  )
  return out
}
