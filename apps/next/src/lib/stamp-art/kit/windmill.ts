// Windmill (lane C): a tapered tower with a cap, a gallery and four lattice sails. The box is the
// tower (base at the bottom); the sails reach `sail` x tower height around the hub near the top.
import { type Pt, type SvgNode, body, fill, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const windmill: KitModule = ([x, y, w, h], p) => {
  const out: SvgNode[] = []
  const cx = x + w / 2
  const top = w * 0.58
  const baseY = y + h
  const hubY = y + h * 0.1
  const reach = h * num(p, 'sail', 0.78)
  const rot = (num(p, 'angle', 20) * Math.PI) / 180
  const tower: Pt[] = [
    [cx - w / 2, baseY],
    [cx - top / 2, hubY + 4],
    [cx + top / 2, hubY + 4],
    [cx + w / 2, baseY],
  ]
  // sails behind the tower
  for (let k = 0; k < 4; k++) {
    const a = rot + (k * Math.PI) / 2
    const dx = Math.cos(a),
      dy = Math.sin(a)
    const nx = -dy,
      ny = dx
    const hub: Pt = [cx, hubY]
    const tip: Pt = [cx + dx * reach, hubY + dy * reach]
    out.push(stroke('line', [hub, tip]))
    const s0 = 0.28,
      s1 = 1
    const bw = reach * 0.17
    const blade: Pt[] = [
      [cx + dx * reach * s0 + nx * 0.5, hubY + dy * reach * s0 + ny * 0.5],
      [cx + dx * reach * s1 + nx * 0.5, hubY + dy * reach * s1 + ny * 0.5],
      [cx + dx * reach * s1 + nx * bw, hubY + dy * reach * s1 + ny * bw],
      [cx + dx * reach * s0 + nx * bw, hubY + dy * reach * s0 + ny * bw],
    ]
    out.push(stroke('hair', blade, true))
    out.push(
      ...toneFill(blade, 'T4', {
        angle: (a * 180) / Math.PI + 90,
        gap: 2,
        weight: 'fine',
        inset: 0.3,
      }),
    )
    for (let i = 1; i < 5; i++) {
      const f = s0 + ((s1 - s0) * i) / 5
      out.push(
        stroke('fine', [
          [cx + dx * reach * f + nx * 0.5, hubY + dy * reach * f + ny * 0.5],
          [cx + dx * reach * f + nx * bw, hubY + dy * reach * f + ny * bw],
        ]),
      )
    }
  }
  out.push(...body(tower, 'line'))
  out.push(
    ...toneFill(
      [
        [cx + top * 0.1, hubY + 4],
        [cx + top / 2, hubY + 4],
        [cx + w / 2, baseY],
        [cx + w * 0.12, baseY],
      ],
      'T4',
      { inset: 0.3 },
    ),
  )
  const cap: Pt[] = [
    [cx - top / 2 - 1.5, hubY + 4],
    [cx, hubY - 5],
    [cx + top / 2 + 1.5, hubY + 4],
  ]
  out.push(occlude(cap), fill(cap))
  out.push(hline('line', cx - w * 0.62, cx + w * 0.62, baseY - h * 0.22))
  out.push(
    fill([
      [cx - 2, baseY],
      [cx - 2, baseY - 6],
      [cx + 2, baseY - 6],
      [cx + 2, baseY],
    ]),
  )
  out.push(
    fill([
      [cx - 1.2, hubY + h * 0.3],
      [cx + 1.2, hubY + h * 0.3],
      [cx + 1.2, hubY + h * 0.3 + 4],
      [cx - 1.2, hubY + h * 0.3 + 4],
    ]),
  )
  return out
}
