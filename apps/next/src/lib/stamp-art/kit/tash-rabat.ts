// Tash Rabat (Kyrgyzstan): a low stone caravanserai. A long ashlar block with slit windows, a
// shallow projecting portal with a pointed arch, and a row of low domes of varied size on the
// roof. The right face of each dome is hatched along the fall line. The box is the whole
// building; its bottom is the ground.
import { type Pt, type SvgNode, body, fill, hline, quad, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const tashRabat: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const blockTop = base - h * 0.46
  const portalX = x + w * num(p, 'portal', 0.4)
  const portalW = w * 0.24
  const portalTop = base - h * 0.7
  const out: SvgNode[] = []
  // Domes first so the block overlaps their drums.
  const domes: [number, number, number][] = [
    [0.1, 0.14, 0.14],
    [0.25, 0.17, 0.19],
    [0.64, 0.18, 0.2],
    [0.8, 0.15, 0.15],
    [0.93, 0.12, 0.11],
  ]
  for (const [fx, fw, fh] of domes) {
    const cx = x + w * fx
    const hw = (w * fw) / 2
    const dh = h * fh
    const arc: Pt[] = quad(
      [cx - hw, blockTop],
      [cx - hw * 0.9, blockTop - dh * 1.7],
      [cx, blockTop - dh * 1.28],
      8,
    )
    const dome: Pt[] = [
      ...arc,
      ...arc
        .map(([px, py]): Pt => [2 * cx - px, py])
        .reverse()
        .slice(1),
    ]
    out.push(...body([...dome, [cx + hw, blockTop + 1], [cx - hw, blockTop + 1]], 'line'))
    const sh: Pt[] = [
      [cx + hw * 0.1, blockTop - dh * 1.3],
      ...dome.filter((q) => q[0] > cx + hw * 0.1),
      [cx + hw, blockTop],
      [cx + hw * 0.1, blockTop],
    ]
    out.push(...toneFill(sh, 'T4', { inset: 0.5, gap: [2.2, 2.2] }))
  }
  // Long block with ashlar courses.
  out.push(...body(rectPts(x, blockTop, w, base - blockTop), 'line'))
  for (let yy = blockTop + 5; yy < base - 2; yy += 5) {
    out.push(
      stroke('fine', [
        [x + 2, yy],
        [x + w - 2, yy],
      ]),
    )
  }
  out.push(
    ...toneFill(rectPts(x + w * 0.9, blockTop + 1, w * 0.1 - 1, base - blockTop - 1), 'T4', {
      inset: 0.4,
      gap: [2.6, 2.6],
    }),
  )
  out.push(hline('bold', x, x + w, blockTop))
  // Slit windows either side of the portal.
  for (const fx of [0.08, 0.2, 0.64, 0.76]) {
    const wx = x + w * fx
    out.push(fill(rectPts(wx, blockTop + (base - blockTop) * 0.3, 2.6, (base - blockTop) * 0.34)))
  }
  // Portal block and pointed arch.
  out.push(...body(rectPts(portalX, portalTop, portalW, base - portalTop), 'line'))
  for (let yy = portalTop + 5; yy < base - 2; yy += 5) {
    out.push(
      stroke('fine', [
        [portalX + 1.5, yy],
        [portalX + portalW * 0.28, yy],
      ]),
      stroke('fine', [
        [portalX + portalW * 0.72, yy],
        [portalX + portalW - 1.5, yy],
      ]),
    )
  }
  out.push(hline('bold', portalX - 1, portalX + portalW + 1, portalTop))
  const ax = portalX + portalW / 2
  const aw = portalW * 0.5
  const arch: Pt[] = [
    [ax - aw / 2, base],
    [ax - aw / 2, base - h * 0.2],
    ...quad(
      [ax - aw / 2, base - h * 0.2],
      [ax - aw / 2, base - h * 0.4],
      [ax, base - h * 0.42],
      6,
    ).slice(1),
    ...quad(
      [ax, base - h * 0.42],
      [ax + aw / 2, base - h * 0.4],
      [ax + aw / 2, base - h * 0.2],
      6,
    ).slice(1),
    [ax + aw / 2, base],
  ]
  out.push(fill(arch))
  out.push(
    stroke(
      'hair',
      arch.slice(1, -1).map(([px, py]): Pt => [px, py - 2.2]),
    ),
  )
  out.push(hline('bold', x, x + w, base))
  return out
}
