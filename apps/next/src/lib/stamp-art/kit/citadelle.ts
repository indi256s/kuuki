// Citadelle Laferriere (Haiti): a ship-shaped mountaintop fortress seen from its bow. A lit prow
// face on the left, a long shaded flank with rows of gun ports, a stepped second tier with a
// crenellated crown and a low square tower at the stern. The box bottom is the foundation line.
import { type Pt, type SvgNode, body, fill, hatch, hline, rectPts, stroke } from '../grid'
import { type KitModule, num } from './util'

export const citadelle: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const out: SvgNode[] = []
  const tier1Top = y + h * 0.4
  const bow = w * num(p, 'bow', 0.34)
  const jx = x + bow
  // Long shaded flank (battered: the base is wider than the top).
  const flank: Pt[] = [
    [jx, base],
    [jx, tier1Top + 2],
    [x + w - 2, tier1Top],
    [x + w, base],
  ]
  out.push(...body(flank, 'line'))
  out.push(...hatch(flank, 'v', 2.2, 'hair', 0.5))
  // Lit prow face: a tall wedge whose point leans out to the left.
  const prow: Pt[] = [
    [x, base],
    [x + bow * 0.12, tier1Top + h * 0.06],
    [jx, tier1Top + 1],
    [jx, base],
  ]
  out.push(...body(prow, 'line'))
  // Course joints on the prow.
  for (let i = 1; i < 6; i++) {
    const ly = tier1Top + ((base - tier1Top) * i) / 6
    out.push(hline('fine', x + (bow * 0.08 * (6 - i)) / 6 + 1, jx - 1, ly))
  }
  // Gun ports: a row on the prow, two rows along the flank.
  for (const fy of [0.34, 0.6]) {
    const py = tier1Top + (base - tier1Top) * fy
    out.push(fill(rectPts(x + bow * 0.4, py, 3.4, 3.4)))
    for (let px = jx + 6; px < x + w - 6; px += 9.5) out.push(fill(rectPts(px, py, 3.4, 3.4)))
  }
  // Second tier: a crenellated block stepping back toward the stern.
  const t2x = x + w * 0.42
  const t2w = w * 0.5
  const t2Top = y + h * 0.12
  const merlons = 8
  const pitch = t2w / merlons
  const crown: Pt[] = [[t2x, tier1Top + 1]]
  for (let i = 0; i < merlons; i++) {
    const a = t2x + pitch * i
    crown.push(
      [a, t2Top],
      [a + pitch * 0.58, t2Top],
      [a + pitch * 0.58, t2Top + 3],
      [a + pitch, t2Top + 3],
    )
  }
  crown.push([t2x + t2w, tier1Top + 1])
  out.push(...body(crown, 'line'))
  out.push(
    ...hatch(rectPts(t2x + 0.5, t2Top + 4, t2w - 1, tier1Top - t2Top - 4), 'v', 2.4, 'hair', 0.5),
  )
  for (let px = t2x + 6; px < t2x + t2w - 5; px += 9.5)
    out.push(fill(rectPts(px, t2Top + 8, 3, 3.4)))
  // Square tower at the stern with a flat cap.
  const tw = w * 0.14
  const tx = x + w - tw - 3
  const tTop = y
  out.push(...body(rectPts(tx, tTop, tw, t2Top - tTop + 3), 'line'))
  out.push(...body(rectPts(tx - 1.5, tTop - 2.4, tw + 3, 2.6), 'line'))
  out.push(fill(rectPts(tx + tw / 2 - 1.2, tTop + 5, 2.4, 5)))
  out.push(
    stroke('bold', [
      [x, base],
      [x + w, base],
    ]),
  )
  return out
}
