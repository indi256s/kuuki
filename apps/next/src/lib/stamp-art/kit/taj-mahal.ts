// Taj Mahal (India): a mausoleum on a raised white plinth. Central pointed-arch iwan between stacked
// side niches, an onion dome on a drum with four kiosks around the roof, and four slender minarets
// standing free at the corners of the plinth. The right side of every shaft is shaded. The box is
// the whole complex; its bottom is the ground.
import { type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { kiosk, onionDome, pointedArch } from './dome-parts-c'
import { type KitModule, num } from './util'

export const tajMahal: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const cx = x + w / 2
  const out: SvgNode[] = []
  const plinthTop = base - h * 0.1
  // Plinth: a paper cap over a dark foundation.
  out.push(...body(rectPts(x, plinthTop, w, base - plinthTop), 'line'))
  out.push(
    ...toneFill(rectPts(x + 1, plinthTop + 3.4, w - 2, base - plinthTop - 3.4), 'T4', {
      gap: [4.6, 4.6],
      inset: 0.3,
    }),
  )
  out.push(hline('bold', x, x + w, plinthTop))
  // Minarets.
  const mw = w * 0.05
  const mTop = y + h * num(p, 'minaretTop', 0.38)
  for (const mx of [x + w * 0.045, x + w - w * 0.045]) {
    const sh = plinthTop - mTop
    out.push(...body(rectPts(mx - mw / 2, mTop + sh * 0.1, mw, sh * 0.9 + 0.5), 'line'))
    out.push(
      ...toneFill(rectPts(mx + mw * 0.2, mTop + sh * 0.1 + 1, mw * 0.3, sh * 0.9 - 1), 'T4', {
        gap: [2.4, 2.4],
        inset: 0.2,
      }),
    )
    for (const f of [0.4, 0.7])
      out.push(hline('bold', mx - mw / 2 - 1.1, mx + mw / 2 + 1.1, mTop + sh * f))
    out.push(...kiosk(mx, mTop + sh * 0.1 + 0.5, mw * 1.7, sh * 0.2))
  }
  // Main body.
  const bw = w * 0.55
  const bx = cx - bw / 2
  const roof = y + h * 0.5
  out.push(...body(rectPts(bx, roof, bw, plinthTop - roof), 'line'))
  out.push(
    ...toneFill(rectPts(bx + bw * 0.88, roof + 1, bw * 0.12 - 0.5, plinthTop - roof - 1), 'T4', {
      gap: [2.6, 2.6],
      inset: 0.3,
    }),
  )
  out.push(hline('bold', bx - 1, bx + bw + 1, roof))
  // Pishtaq frame rising over the roofline, with the central iwan and side niches.
  const pw = bw * 0.38
  const pTop = roof - h * 0.04
  out.push(...body(rectPts(cx - pw / 2, pTop, pw, roof - pTop + 1), 'line'))
  const iw = pw * 0.7
  const iwTop = roof + (plinthTop - roof) * 0.1
  const iwan = pointedArch(cx - iw / 2, iwTop, iw, plinthTop - 1)
  out.push(...body(iwan, 'line'))
  out.push(...toneFill(iwan, 'T4', { gap: [3.4, 3.4], inset: 0.3 }))
  const door = pointedArch(
    cx - iw * 0.2,
    iwTop + (plinthTop - roof) * 0.42,
    iw * 0.4,
    plinthTop - 1,
  )
  out.push(fill(door))
  const nh = plinthTop - roof
  for (const s of [-1, 1]) {
    const nx = cx + s * bw * 0.34 - bw * 0.065
    out.push(fill(pointedArch(nx, roof + nh * 0.12, bw * 0.13, roof + nh * 0.45)))
    out.push(fill(pointedArch(nx, roof + nh * 0.55, bw * 0.13, plinthTop - 1.5)))
  }
  // Roof kiosks, drum, dome.
  for (const s of [-1, 1]) out.push(...kiosk(cx + s * bw * 0.4, roof, bw * 0.09, h * 0.13))
  const dr = bw * 0.17
  const drumTop = roof - h * 0.075
  out.push(...body(rectPts(cx - dr * 1.05, drumTop, dr * 2.1, roof - drumTop + 0.5), 'line'))
  out.push(hline('bold', cx - dr * 1.15, cx + dr * 1.15, drumTop))
  out.push(...onionDome(cx, drumTop, dr, h * num(p, 'domeH', 0.34), h * 0.07))
  out.push(
    stroke('bold', [
      [x, base],
      [x + w, base],
    ]),
  )
  return out
}
