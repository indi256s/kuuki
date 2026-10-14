// Sao Sebastiao-type island sea fort: a long squat battered curtain wall between two corner
// bastions seen on the diagonal (lit prow face, shaded flank), merlons along every parapet, a
// sentry box on each prow and a low gate block in the middle. A dark rubble plinth meets the
// water. The box bottom is the waterline.
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
} from '../grid'
import { type KitModule, num } from './util'

export const saoSebastiao: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const plinthH = h * num(p, 'plinth', 0.16)
  const foot = base - plinthH
  const bw = w * num(p, 'bastion', 0.27)
  const bastTop = y + h * 0.2
  const curtainTop = y + h * 0.46
  const out: SvgNode[] = []

  // Rubble plinth under everything: dark band with a ragged crown.
  const crown: Pt[] = []
  for (let px = x; px <= x + w + 0.1; px += 5) crown.push([px, foot + (px % 10 < 5 ? -1.2 : 0.8)])
  const plinth: Pt[] = [...crown, [x + w, base], [x, base]]

  // Curtain wall (behind the bastions).
  const cx0 = x + bw * 0.6
  const cw = w - bw * 1.2
  const curtain = rectPts(cx0, curtainTop, cw, foot - curtainTop + 1)
  out.push(occlude(curtain), ...body(curtain, 'line'))
  for (let cy = curtainTop + 7; cy < foot - 2; cy += 6)
    out.push(
      stroke('fine', [
        [cx0 + 2, cy],
        [cx0 + cw - 2, cy + (cy % 12 < 6 ? 0.6 : 0)],
      ]),
    )
  // Merlons along the curtain.
  const merlon = (mx: number, my: number, mw = 3.4, mh = 3.2): SvgNode[] => [
    fill(rectPts(mx, my - mh, mw, mh)),
  ]
  for (let mx = cx0 + 1; mx < cx0 + cw - 3; mx += 6.4) out.push(...merlon(mx, curtainTop))
  // Embrasures: dark slits in the curtain.
  for (let k = 1; k <= 6; k++) {
    const ex = cx0 + (cw * k) / 7
    if (Math.abs(ex - (x + w / 2)) < w * 0.1) continue
    out.push(fill(rectPts(ex - 1, curtainTop + 8, 2, 7)))
  }
  // Gate block.
  const gw = w * 0.15
  const gx = x + w / 2 - gw / 2
  const gateTop = y + h * 0.3
  const gate = rectPts(gx, gateTop, gw, foot - gateTop + 1)
  out.push(occlude(gate), ...body(gate, 'line'))
  out.push(
    ...toneFill(rectPts(gx + gw * 0.62, gateTop + 2, gw * 0.38 - 1, foot - gateTop - 3), 'T4', {
      angle: 90,
      gap: 1.8,
      weight: 'fine',
      inset: 0.3,
    }),
    fill([
      [gx + gw * 0.2, foot],
      [gx + gw * 0.2, foot - 11],
      [gx + gw * 0.35, foot - 15],
      [gx + gw * 0.5, foot - 11],
      [gx + gw * 0.5, foot],
    ]),
  )
  for (let mx = gx + 0.8; mx < gx + gw - 3; mx += 5.8) out.push(...merlon(mx, gateTop))
  out.push(hline('bold', gx - 1, gx + gw + 1, gateTop + 0.5))

  // Bastions: prow seen on the diagonal. left = lit face then shaded flank; right mirrored so
  // the shaded flank always faces the curtain.
  for (const side of [-1, 1] as const) {
    const outer = side < 0 ? x : x + w
    const inner = outer - side * bw
    const prowX = outer - side * bw * 0.52
    // Prow roofline [outer, prow, inner] and faces.
    const roofO: Pt = [outer, bastTop + 4]
    const roofP: Pt = [prowX, bastTop]
    const roofI: Pt = [inner, bastTop + 3]
    const faceLit: Pt[] = [roofO, roofP, [prowX, foot], [outer, foot]]
    const faceShade: Pt[] = [roofP, roofI, [inner, foot], [prowX, foot]]
    const lit = side < 0 ? faceLit : faceShade
    const shade = side < 0 ? faceShade : faceLit
    out.push(occlude(faceLit), occlude(faceShade))
    out.push(...body(lit, 'line'), ...body(shade, 'line'))
    out.push(...toneFill(shade, 'T4', { angle: 90, gap: 2.8, weight: 'fine', inset: 0.5 }))
    // Courses on the lit face.
    for (let cy = bastTop + 9; cy < foot - 2; cy += 6) {
      const [a, b] = side < 0 ? [outer + 2, prowX - 1.5] : [prowX + 1.5, outer - 2]
      out.push(
        stroke('fine', [
          [a, cy + (cy % 12 < 6 ? 0.4 : 0)],
          [b, cy],
        ]),
      )
    }
    // Merlons along both roof edges.
    for (let t = 0.1; t < 0.95; t += 0.15) {
      const m1x = roofO[0] + (roofP[0] - roofO[0]) * t
      const m1y = roofO[1] + (roofP[1] - roofO[1]) * t
      out.push(...merlon(m1x - 1.4, m1y + 0.5, 2.8, 3))
      const m2x = roofP[0] + (roofI[0] - roofP[0]) * t
      const m2y = roofP[1] + (roofI[1] - roofP[1]) * t
      out.push(...merlon(m2x - 1.4, m2y + 0.5, 2.8, 3))
    }
    out.push(stroke('bold', [roofO, roofP, roofI]))
    // Sentry box on the prow: small box with a cap.
    const sx = prowX
    const box = rectPts(sx - 3, bastTop - 8, 6, 8)
    out.push(occlude(box), ...body(box, 'hair'), fill(rectPts(sx - 1, bastTop - 6, 2, 3)))
    out.push(
      fill([
        [sx - 4.2, bastTop - 8],
        [sx, bastTop - 12.4],
        [sx + 4.2, bastTop - 8],
      ]),
    )
  }

  // Plinth drawn last so the walls sit in it.
  out.push(
    occlude(plinth),
    ...toneFill(plinth, 'T4', { angle: 78, gap: 2.6, weight: 'hair' }),
    stroke('line', crown),
  )
  out.push(hline('hair', x, x + w, base - 0.5))
  return out
}
