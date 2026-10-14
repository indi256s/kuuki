// Low whitewashed colonial house with a long arcade of round arches on slim piers under a wide
// hipped tile roof (Casa de la Independencia). The box is the whole house; bottom is the ground.
// Arches are dark openings (T4 hatching), piers and the wall above are lit paper, the roof is
// tile courses in horizontal hair lines with a solid ridge.
import { type Pt, type SvgNode, body, fill, hatch, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const arcadeHouseA: KitModule = ([x, y, w, h], p) => {
  const bays = Math.max(3, Math.round(num(p, 'bays', 6)))
  const base = y + h
  const roofH = h * num(p, 'roof', 0.32)
  const eaveY = y + roofH
  const plinth = 3
  const out: SvgNode[] = []
  // Hipped roof: trapezoid with a short ridge, hatched in tile courses, shaded on the right hip.
  const inset = w * 0.2
  const roof: Pt[] = [
    [x - 2.5, eaveY],
    [x + inset, y],
    [x + w - inset, y],
    [x + w + 2.5, eaveY],
  ]
  out.push(...body(roof, 'line'))
  out.push(
    ...hatch(
      [
        [x + 1, eaveY - 1],
        [x + inset + 1.5, y + 2.4],
        [x + w - inset - 1.5, y + 2.4],
        [x + w - 1, eaveY - 1],
      ],
      'h',
      4.2,
      'fine',
      0.6,
    ),
  )
  out.push(
    stroke('hair', [
      [x + inset, y],
      [x - 0.5, eaveY],
    ]),
  )
  out.push(
    stroke('hair', [
      [x + w - inset, y],
      [x + w + 0.5, eaveY],
    ]),
  )
  out.push(
    ...toneFill(
      [
        [x + w - inset, y],
        [x + w + 2.5, eaveY],
        [x + w - inset * 0.4, eaveY],
        [x + w - inset - 1, y + 2],
      ],
      'T4',
      { gap: 2.6, inset: 0.3, weight: 'fine' },
    ),
  )
  out.push(hline('bold', x - 2.5, x + w + 2.5, eaveY))
  // Wall with a shaded cornice strip under the eave.
  const wallTop = eaveY
  const wallBot = base - plinth
  out.push(...body(rectPts(x, wallTop, w, wallBot - wallTop), 'line'))
  out.push(...hatch(rectPts(x, wallTop + 0.6, w, 3), 'h', 1.5, 'hair', 0.2))
  // Arcade: arches between piers.
  const pier = num(p, 'pier', 4.4)
  const bw = (w - pier) / bays
  const archTop = wallTop + 9
  for (let i = 0; i < bays; i++) {
    const ax = x + pier + bw * i
    const aw = bw - pier
    const spring = archTop + aw / 2
    const arch: Pt[] = [
      [ax, wallBot],
      [ax, spring],
    ]
    for (let k = 1; k < 9; k++) {
      const t = (Math.PI * k) / 9
      arch.push([ax + aw / 2 - (aw / 2) * Math.cos(t), spring - (aw / 2) * Math.sin(t)])
    }
    arch.push([ax + aw, spring], [ax + aw, wallBot])
    out.push(...toneFill(arch, 'T4', { gap: 2.4, inset: 0.1, weight: 'fine' }))
    out.push(stroke('line', arch))
    // A doorway or shuttered window in the shade behind: central bay gets a solid door.
    if (i === Math.floor(bays / 2))
      out.push(
        fill(
          rectPts(
            ax + aw * 0.22,
            wallBot - (wallBot - spring) * 0.85,
            aw * 0.56,
            (wallBot - spring) * 0.85,
          ),
        ),
      )
  }
  // Plinth and ground line.
  out.push(...body(rectPts(x - 2, wallBot, w + 4, plinth), 'line'))
  out.push(hline('bold', x - 4, x + w + 4, base))
  return out
}
