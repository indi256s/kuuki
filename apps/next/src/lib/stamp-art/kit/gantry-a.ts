// Launch pad: a slender two-stage rocket with two side boosters standing beside a tall
// rectangular lattice service tower. The box is the whole pad; the bottom is the ground. The
// tower is on the right (`tower` fraction of the width), the rocket on the left of it.
import { type Pt, type SvgNode, body, fill, hatch, occlude, rectPts, stroke } from '../grid'
import { type KitModule, num } from './util'

export const gantryA: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const out: SvgNode[] = []
  // Tower lattice.
  const tw = w * num(p, 'tower', 0.24)
  const tx = x + w - tw
  const bays = Math.max(4, Math.round(num(p, 'bays', 8)))
  const bayH = (h - 3) / bays
  out.push(occlude(rectPts(tx, y, tw, h)))
  const leg = 2
  out.push(
    ...body(rectPts(tx, y, leg, h), 'line'),
    ...body(rectPts(tx + tw - leg, y, leg, h), 'line'),
  )
  for (let i = 0; i < bays; i++) {
    const t = y + bayH * i
    const b = t + bayH
    const x0 = tx + leg,
      x1 = tx + tw - leg
    out.push(
      stroke('fine', [
        [x0, i % 2 ? b : t],
        [x1, i % 2 ? t : b],
      ]),
    )
    out.push(
      stroke('fine', [
        [x0, i % 2 ? t : b],
        [x1, i % 2 ? b : t],
      ]),
    )
    out.push(
      stroke('hair', [
        [tx - 1, b],
        [tx + tw + 1, b],
      ]),
    )
  }
  out.push(...body(rectPts(tx - 2.5, y - 1, tw + 5, 3.4), 'line'))
  // Arms reaching to the rocket at two heights.
  const rcx = x + (w - tw) * num(p, 'rocketAt', 0.46)
  const rw = Math.min(w * 0.1, 13)
  for (const f of [0.28, 0.58]) {
    const ay = y + h * f
    out.push(...body(rectPts(rcx + rw / 2 + 4, ay - 1.2, tx - rcx - rw / 2 - 4, 2.4), 'hair'))
  }
  // Boosters (behind the core), then core and fairing.
  const bw = rw * 0.42
  const boosterTop = y + h * 0.5
  for (const s of [-1, 1]) {
    const bx = rcx + s * (rw / 2 + bw / 2 - 0.6)
    const bp: Pt[] = [
      [bx - bw / 2, base - 5],
      [bx - bw / 2, boosterTop + bw * 1.1],
      [bx, boosterTop],
      [bx + bw / 2, boosterTop + bw * 1.1],
      [bx + bw / 2, base - 5],
    ]
    out.push(...body(bp, 'line'))
    if (s === 1)
      out.push(
        ...hatch(
          rectPts(bx, boosterTop + bw, bw / 2, base - boosterTop - bw - 5),
          'v',
          2.6,
          'hair',
          0.2,
        ),
      )
    out.push(fill(rectPts(bx - bw / 2, boosterTop + bw * 3, bw, 2)))
  }
  const noseH = h * 0.2
  const coreTop = y + 2 + noseH
  const core: Pt[] = [
    [rcx - rw / 2, base - 5],
    [rcx - rw / 2, coreTop],
    [rcx - rw / 2 + 0.6, coreTop - noseH * 0.45],
    [rcx - rw * 0.2, coreTop - noseH * 0.85],
    [rcx, y + 2],
    [rcx + rw * 0.2, coreTop - noseH * 0.85],
    [rcx + rw / 2 - 0.6, coreTop - noseH * 0.45],
    [rcx + rw / 2, coreTop],
    [rcx + rw / 2, base - 5],
  ]
  out.push(...body(core, 'line'))
  out.push(
    ...hatch(
      rectPts(rcx + rw * 0.12, coreTop, rw * 0.38, base - 5 - coreTop),
      'v',
      2.6,
      'hair',
      0.2,
    ),
  )
  out.push(fill(rectPts(rcx - rw / 2, coreTop + 1, rw, 3.2)))
  out.push(fill(rectPts(rcx - rw / 2, coreTop + (base - coreTop) * 0.5, rw, 3)))
  out.push(
    stroke('bold', [
      [rcx - rw / 2, coreTop],
      [rcx + rw / 2, coreTop],
    ]),
  )
  // Launch table and pad.
  out.push(...body(rectPts(rcx - rw * 1.3, base - 5, rw * 2.6, 5), 'line'))
  out.push(...hatch(rectPts(rcx - rw * 1.3, base - 5, rw * 2.6, 5), 'v', 2.6, 'fine', 0.2))
  out.push(
    stroke('bold', [
      [x, base],
      [x + w, base],
    ]),
  )
  return out
}
