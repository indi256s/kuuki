// Belgium: the Bruges belfry. A square brick tower with a clock stage, a belfry stage with open
// arches, corner turrets and an octagonal lantern, rising behind a low arcaded hall.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
  vline,
} from '../grid'
import { type KitModule, num } from './util'
import { archPts } from './windows'

export const belfry: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const cx = x + w / 2
  const tw = w * num(p, 'towerW', 0.36)
  const hallTop = y + h * 0.74
  const spireH = h * 0.1
  const lanH = h * 0.17
  const belH = h * 0.2
  const lanW = tw * 0.62
  const yLan = y + spireH
  const yBel = yLan + lanH
  const yClock = yBel + belH
  // tower shaft
  out.push(...body(rectPts(cx - tw / 2, yBel, tw, hallTop - yBel + 4), 'line'))
  out.push(
    ...toneFill(rectPts(cx + tw * 0.3, yBel + 1, tw * 0.2, hallTop - yBel), 'T4', { inset: 0.3 }),
  )
  out.push(hline('bold', cx - tw / 2 - 1.5, cx + tw / 2 + 1.5, yBel))
  out.push(hline('line', cx - tw / 2, cx + tw / 2, yClock))
  // belfry arches (stage 3) and clock stage
  const aw = tw * 0.18
  for (const ax of [cx - tw * 0.28, cx + tw * 0.1])
    out.push(fill(archPts(ax, yBel + 3, aw, belH - 4)))
  const r = tw * 0.17
  out.push(
    stroke(
      'line',
      Array.from({ length: 17 }, (_, i): Pt => [
        cx - tw * 0.1 + r * Math.cos((i / 16) * 2 * Math.PI),
        yClock + 8 + r * Math.sin((i / 16) * 2 * Math.PI),
      ]),
    ),
  )
  out.push(
    vline('hair', cx - tw * 0.1, yClock + 8 - r * 0.7, yClock + 8),
    hline('hair', cx - tw * 0.1, cx - tw * 0.1 + r * 0.6, yClock + 8),
  )
  for (const sx of [cx - tw * 0.3, cx + tw * 0.18]) out.push(fill(rectPts(sx, yClock + 18, 2.4, 9)))
  // corner turrets
  for (const sx of [cx - tw / 2, cx + tw / 2 - 3.6]) {
    out.push(...body(rectPts(sx, yBel - 7, 3.6, 7), 'hair'))
    const cap: Pt[] = [
      [sx - 0.6, yBel - 7],
      [sx + 1.8, yBel - 12],
      [sx + 4.2, yBel - 7],
    ]
    out.push(occlude(cap), fill(cap))
  }
  // lantern and spire
  out.push(...body(rectPts(cx - lanW / 2, yLan, lanW, lanH + 0.5), 'line'))
  out.push(fill(archPts(cx - lanW * 0.36, yLan + 3, lanW * 0.26, lanH - 4)))
  const roof: Pt[] = [
    [cx - lanW / 2 - 1, yLan],
    [cx - 1.6, y + 2],
    [cx + 1.6, y + 2],
    [cx + lanW / 2 + 1, yLan],
  ]
  out.push(occlude(roof), fill(roof))
  out.push(vline('line', cx, y - 0.5, y + 3))
  // hall in front: low arcaded range under a long slate roof
  out.push(...body(rectPts(x, hallTop, w, y + h - hallTop), 'line'))
  const slate: Pt[] = [
    [x - 1, hallTop + 1],
    [x + 3, hallTop - h * 0.07],
    [x + w - 3, hallTop - h * 0.07],
    [x + w + 1, hallTop + 1],
  ]
  out.push(occlude(slate), fill(slate))
  const n = Math.max(3, Math.round(num(p, 'arches', 5)))
  const pitch = (w - 6) / n
  for (let i = 0; i < n; i++)
    out.push(
      fill(
        archPts(x + 3 + i * pitch + pitch * 0.28, hallTop + 6, pitch * 0.44, y + h - hallTop - 6),
      ),
    )
  return out as SvgNode[]
}
