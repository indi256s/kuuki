// Squat fortified town gate (Portón de Campo): a raised central gatehouse with a tall arched
// timber gate and a drawbridge leaf standing up in front of it on two chains, flanked by thick
// battered whitewashed walls with a sloping stone cap. The box is the whole gate and the wall
// stubs either side; bottom is the ground.
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const portonA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const cx = x + w / 2
  const gateW = w * num(p, 'gate', 0.34)
  const gx = cx - gateW / 2
  const wallH = h * num(p, 'wall', 0.52)
  const out: SvgNode[] = []
  const batter = 3
  // Flanking walls: battered, with a sloped cap and stone courses.
  for (const s of [-1, 1]) {
    const xa = s < 0 ? x : gx + gateW
    const xb = s < 0 ? gx : x + w
    const wall: Pt[] = [
      [xa - (s < 0 ? 0 : 0), base],
      [xa + (s < 0 ? 0 : batter * 0), base - wallH],
      [xb, base - wallH],
      [xb, base],
    ]
    out.push(...body(wall, 'line'))
    const cap: Pt[] = [
      [xa, base - wallH],
      [xa, base - wallH - 3],
      [xb, base - wallH - 3],
      [xb, base - wallH],
    ]
    out.push(...body(cap, 'hair'))
    out.push(hline('bold', xa, xb, base - wallH))
    for (let k = 1; k < 5; k++) {
      const ry = base - wallH + (wallH * k) / 5
      out.push(hline('fine', xa + 1, xb - 1, ry))
      for (let tx = xa + 3 + (k % 2) * 3; tx < xb - 2; tx += 6)
        out.push(
          stroke('fine', [
            [tx, ry - wallH / 5 + 0.6],
            [tx, ry - 0.6],
          ]),
        )
    }
    // Shaded outer foot (batter) on the far end.
    const far =
      s < 0
        ? [xa, base - wallH, xa + 7, base - wallH, xa + 7, base, xa, base]
        : [xb - 7, base - wallH, xb, base - wallH, xb, base, xb - 7, base]
    const farPts: Pt[] = [
      [far[0], far[1]],
      [far[2], far[3]],
      [far[4], far[5]],
      [far[6], far[7]],
    ]
    out.push(...toneFill(farPts, 'T4', { gap: 2.4, inset: 0.3 }))
  }
  // Gatehouse block: taller, with a low pitched cap, plus the arched timber gate.
  const gTop = y + h * 0.1
  const block: Pt[] = [
    [gx, base],
    [gx, gTop + 5],
    [cx, gTop],
    [gx + gateW, gTop + 5],
    [gx + gateW, base],
  ]
  out.push(...body(block, 'line'))
  out.push(
    ...toneFill(
      [
        [cx, gTop],
        [gx + gateW, gTop + 5],
        [gx + gateW, gTop + 12],
        [cx, gTop + 7],
      ],
      'T4',
      { gap: 1.8, inset: 0.4 },
    ),
  )
  out.push(hline('bold', gx - 1.5, gx + gateW + 1.5, gTop + 5))
  const ow = gateW * 0.46
  const oh = (base - gTop) * 0.62
  const ox = cx - ow / 2
  const opening: Pt[] = [
    [ox, base],
    [ox, base - oh + ow / 2],
  ]
  for (let k = 1; k < 8; k++) {
    const t = (Math.PI * k) / 8
    opening.push([cx - (ow / 2) * Math.cos(t), base - oh + ow / 2 - (ow / 2) * Math.sin(t)])
  }
  opening.push([ox + ow, base - oh + ow / 2], [ox + ow, base])
  out.push(fill(opening))
  // Raised drawbridge leaf: a paper plank panel over the opening, chains to the gate top.
  const lf = ow * 0.78
  out.push(...body(rectPts(cx - lf / 2, base - oh * 0.88, lf, oh * 0.88), 'line'))
  for (let k = 1; k < 4; k++)
    out.push(
      stroke('fine', [
        [cx - lf / 2 + (lf * k) / 4, base - oh * 0.86],
        [cx - lf / 2 + (lf * k) / 4, base - 1],
      ]),
    )
  out.push(
    stroke('hair', [
      [cx - lf / 2 + 0.5, base - oh * 0.88],
      [gx + gateW * 0.1, gTop + 9],
    ]),
  )
  out.push(
    stroke('hair', [
      [cx + lf / 2 - 0.5, base - oh * 0.88],
      [gx + gateW * 0.9, gTop + 9],
    ]),
  )
  out.push(hline('bold', x - 2, x + w + 2, base))
  return out
}
