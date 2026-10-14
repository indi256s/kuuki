// Ark of Bukhara (Uzbekistan): a mud-brick citadel on a high mound. Steeply battered walls fluted
// with buttresses, a crenellated rim, a ramp climbing along the wall to a gate between two round
// towers, and a flat-roofed columned pavilion above the gate. The right third of the wall is
// shaded. The box is the whole citadel; its bottom is the ground.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const arkBukhara: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const cx = x + w * num(p, 'axis', 0.5)
  const wallTop = base - h * 0.56
  const batter = w * 0.05
  const out: SvgNode[] = []
  const wall: Pt[] = [
    [x, base],
    [x + batter, wallTop],
    [x + w - batter, wallTop],
    [x + w, base],
  ]
  out.push(...body(wall, 'line'))
  // Buttress flutes along the batter.
  const flutes = 22
  for (let i = 1; i < flutes; i++) {
    const f = i / flutes
    const xt = x + batter + (w - 2 * batter) * f
    const xb = x + w * f
    if (Math.abs(xt - cx) < w * 0.14) continue
    const lit = xt < x + w * 0.7
    out.push(
      stroke(lit ? 'fine' : 'hair', [
        [xt, wallTop + 3 + (rand() - 0.5)],
        [xb, base - 1],
      ]),
    )
  }
  out.push(
    ...toneFill(
      [
        [x + w * 0.78, wallTop],
        [x + w - batter, wallTop],
        [x + w, base],
        [x + w * 0.78, base],
      ],
      'T4',
      { inset: 0.5, gap: [2.3, 2.3] },
    ),
  )
  // Crenellated rim.
  for (let px = x + batter + 1; px < x + w - batter - 4; px += 6) {
    if (Math.abs(px - cx) < w * 0.17) continue
    out.push(fill(rectPts(px, wallTop - 2.4, 3.2, 2.5)))
  }
  out.push(hline('bold', x + batter - 1, x + w - batter + 1, wallTop))
  // Ramp climbing to the gate.
  const gateLevel = base - h * 0.27
  const gx = cx - w * 0.05
  const ramp: Pt[] = [
    [x + w * 0.04, base],
    [gx, gateLevel],
    [gx, base],
  ]
  out.push(...body(ramp, 'line'))
  for (let k = 1; k < 5; k++) {
    const t = k / 5
    out.push(
      stroke('fine', [
        [x + w * 0.04 + (gx - x - w * 0.04) * t, base - (base - gateLevel) * t + 2],
        [x + w * 0.04 + (gx - x - w * 0.04) * t, base - 1],
      ]),
    )
  }
  // Gate towers and passage.
  const tw = w * 0.1
  const towerTop = wallTop - h * 0.1
  for (const s of [-1, 1] as const) {
    const tx = s < 0 ? cx - w * 0.05 - tw : cx + w * 0.05
    out.push(
      ...body(rectPts(tx, towerTop, tw, gateLevel + (base - gateLevel) * 0.2 - towerTop), 'line'),
    )
    out.push(
      ...toneFill(
        rectPts(tx + tw * 0.62, towerTop + 1, tw * 0.38 - 0.5, gateLevel - towerTop),
        'T4',
        { inset: 0.4, gap: [2.2, 2.2] },
      ),
    )
    out.push(hline('bold', tx - 1, tx + tw + 1, towerTop))
  }
  const ah = h * 0.2
  out.push(
    fill([
      [cx - w * 0.05, gateLevel + (base - gateLevel) * 0.2],
      [cx - w * 0.05, gateLevel - ah * 0.6],
      [cx, gateLevel - ah],
      [cx + w * 0.05, gateLevel - ah * 0.6],
      [cx + w * 0.05, gateLevel + (base - gateLevel) * 0.2],
    ]),
  )
  // Pavilion above the gate: flat roof on slim columns.
  const pw = w * 0.16
  const pb = towerTop
  const ph = h * 0.14
  out.push(...body(rectPts(cx - pw, pb - ph, pw * 2, ph + 1), 'line'))
  out.push(
    ...toneFill(rectPts(cx - pw + 2, pb - ph + 4, pw * 2 - 4, ph - 3), 'T4', {
      inset: 0.3,
      gap: [2.2, 2.2],
    }),
  )
  for (let i = 0; i <= 5; i++) {
    const px = cx - pw + 2 + ((pw * 2 - 4) * i) / 5
    out.push(
      stroke('line', [
        [px, pb - ph + 3],
        [px, pb],
      ]),
    )
  }
  out.push(hline('bold', cx - pw - 1.5, cx + pw + 1.5, pb - ph))
  out.push(hline('bold', x + 3, x + w - 3, base))
  return out
}
