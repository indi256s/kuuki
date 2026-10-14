// Chateau (lane C): a Neo-Renaissance castle - a long lit block with steep dark gables at
// different heights, a tall slender tower with a spire and small turrets with needle caps
// (Peles, RO). The box base is the ground line.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  hline,
  occlude,
  rectPts,
  stroke,
} from '../grid'
import { type KitModule, num } from './util'
import { archPts } from './windows'

const spire = (cx: number, baseY: number, halfW: number, hgt: number, over = 1.2): SvgNode[] => {
  const pts: Pt[] = [
    [cx - halfW - over, baseY],
    [cx, baseY - hgt],
    [cx + halfW + over, baseY],
  ]
  return [occlude(pts), fill(pts)]
}

export const chateauC: KitModule = ([x, y, w, h], p) => {
  const X = (f: number) => x + f * w
  const Y = (f: number) => y + f * h
  const out: SvgNode[] = []
  const base = y + h
  const wallTop = Y(num(p, 'wallTop', 0.5))
  // timbered upper block
  out.push(...body(rectPts(X(0.04), wallTop, X(0.96) - X(0.04), base - wallTop), 'line'))
  out.push(hline('bold', X(0.04) - 1, X(0.96) + 1, base))
  // upper storey in half-timber: dark right third plus a string course
  const stringY = wallTop + (base - wallTop) * 0.42
  out.push(hline('line', X(0.04), X(0.96), stringY))
  out.push(
    ...hatchPoly(rectPts(X(0.78), wallTop + 1, X(0.96) - X(0.78) - 0.5, base - wallTop - 1), {
      angle: 90,
      gap: 2.3,
      weight: 'hair',
    }),
  )
  // windows: two rows
  for (const [row, step] of [
    [wallTop + 4, 0.095],
    [stringY + 5, 0.095],
  ] as const)
    for (let i = 0; i < 9; i++) {
      const wx = X(0.075 + i * step)
      if (wx > X(0.78)) break
      out.push(fill(rectPts(wx, row, 2.4, 6)))
    }
  out.push(fill(archPts(X(0.46), base - 12, 7, 12)))
  // gables: [centre, width, top]
  const gables: [number, number, number][] = [
    [0.17, 0.2, 0.22],
    [0.38, 0.16, 0.32],
    [0.7, 0.2, 0.18],
  ]
  for (const [cx, gw, top] of gables) {
    const gx = X(cx - gw / 2)
    const gW = gw * w
    const apex = Y(top)
    const fr: Pt[] = [
      [gx, wallTop],
      [gx, apex + (wallTop - apex) * 0.6],
      [gx + gW / 2, apex],
      [gx + gW, apex + (wallTop - apex) * 0.6],
      [gx + gW, wallTop],
    ]
    out.push(...body(fr, 'line'))
    out.push(
      ...hatchPoly(
        [
          [gx + gW * 0.15, wallTop - 1],
          [gx + gW * 0.15, apex + (wallTop - apex) * 0.62],
          [gx + gW / 2, apex + 5],
          [gx + gW * 0.85, apex + (wallTop - apex) * 0.62],
          [gx + gW * 0.85, wallTop - 1],
        ],
        { angle: 90, gap: 2.6, weight: 'hair' },
      ),
    )
    out.push(fill(archPts(gx + gW / 2 - 1.4, wallTop - 11, 2.8, 8)))
    out.push(...spire(gx + gW / 2, apex, 0.9, 7, 0))
  }
  // dark steep roof between gables
  const roof: Pt[] = [
    [X(0.04) - 1.5, wallTop],
    [X(0.1), wallTop - 6],
    [X(0.9), wallTop - 6],
    [X(0.96) + 1.5, wallTop],
  ]
  out.push(occlude(roof), fill(roof))
  // main tower with a balcony and a tall spire
  const tcx = X(num(p, 'towerAt', 0.56))
  const tw = w * 0.085
  const tTop = Y(0.22)
  out.push(...body(rectPts(tcx - tw / 2, tTop, tw, wallTop - tTop + 2), 'line'))
  out.push(
    ...hatchPoly(rectPts(tcx + tw * 0.1, tTop + 1, tw * 0.4, wallTop - tTop), {
      angle: 90,
      gap: 2.2,
      weight: 'hair',
    }),
  )
  out.push(...body(rectPts(tcx - tw / 2 - 2, tTop - 3, tw + 4, 3.2), 'line'))
  out.push(fill(rectPts(tcx - 1, tTop + 5, 2, 5)), fill(rectPts(tcx - 1, tTop + 16, 2, 5)))
  out.push(...spire(tcx, tTop - 3, tw / 2 + 1, h * 0.17, 1))
  out.push(
    stroke('hair', [
      [tcx, Y(0.0)],
      [tcx, Y(0.0) - 0.01],
    ]),
  )
  // corner turrets
  for (const [fx, up] of [
    [0.04, 0.2],
    [0.96, 0.24],
  ] as const) {
    const cx = X(fx)
    const tTopY = wallTop - h * up
    out.push(...body(rectPts(cx - 4, tTopY, 8, wallTop - tTopY + 2), 'line'))
    out.push(fill(rectPts(cx - 1, tTopY + 5, 2, 4)))
    out.push(...spire(cx, tTopY, 4, 14, 1.2))
  }
  return out
}
