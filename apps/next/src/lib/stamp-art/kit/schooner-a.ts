// Two-masted gaff schooner in profile (British Virgin Islands). Low dark hull with a high stern and
// a bowsprit, a shorter foremast and a taller mainmast, each with a lit gaff sail and a topsail,
// and shaded headsails forward. The box is the vessel; its bottom is the waterline.
import { type Pt, type SvgNode, body, fill, hline, occlude, stroke, toneFill } from '../grid'
import { quad } from '../grid'
import { type KitModule, num } from './util'

export const schoonerA: KitModule = ([x, y, w, h], p) => {
  const water = y + h
  const hullH = h * num(p, 'hull', 0.11)
  const bx = x + w * 0.13
  const sx = x + w * 0.95
  const sheerBow = water - hullH * 1.05
  const sheerMid = water - hullH * 0.8
  const sheerStern = water - hullH * 1.3
  const m1 = x + w * 0.36
  const m2 = x + w * 0.65
  const top1 = y + h * 0.12
  const top2 = y
  const boom1 = sheerMid - h * 0.05
  const boom2 = sheerMid - h * 0.04
  const out: SvgNode[] = []

  // Main gaff sail and topsail.
  const gaff2: Pt = [m2 + w * 0.27, y + h * 0.17]
  const main: Pt[] = [[m2 + 1.4, y + h * 0.27], gaff2, [sx + 3, boom2], [m2 + 1.4, boom2]]
  out.push(...body(main, 'hair'))
  for (const f of [0.28, 0.5, 0.72])
    out.push(
      hline(
        'fine',
        m2 + 3,
        m2 + 1.4 + (sx + 3 - m2) * (0.97 - f * 0.22),
        boom2 - (boom2 - y - h * 0.27) * f,
      ),
    )
  const top: Pt[] = [
    [m2 + 1.4, y + h * 0.01],
    [gaff2[0] - 1.5, gaff2[1] - 1.5],
    [m2 + 1.4, y + h * 0.25],
  ]
  out.push(...body(top, 'hair'))

  // Foresail and topsail.
  const gaff1: Pt = [m1 + w * 0.21, y + h * 0.3]
  const fore: Pt[] = [[m1 + 1.4, y + h * 0.4], gaff1, [m2 - 3.5, boom1], [m1 + 1.4, boom1]]
  out.push(...body(fore, 'hair'))
  for (const f of [0.3, 0.55, 0.8])
    out.push(
      hline(
        'fine',
        m1 + 3,
        m1 + 1.4 + (m2 - 3.5 - m1) * (0.97 - f * 0.2),
        boom1 - (boom1 - y - h * 0.4) * f,
      ),
    )
  const top1sail: Pt[] = [
    [m1 + 1.4, top1 + 1],
    [gaff1[0] - 1.5, gaff1[1] - 1.5],
    [m1 + 1.4, y + h * 0.38],
  ]
  out.push(...body(top1sail, 'hair'))

  // Headsails: shaded jib to the bowsprit tip, lit staysail between.
  const tip: Pt = [x + 1, sheerBow - 1.5]
  const jib: Pt[] = [[m1 - 1.4, top1 + h * 0.03], tip, [m1 - w * 0.17, boom1 - 1]]
  out.push(occlude(jib), ...toneFill(jib, 'T4', { inset: 0.4 }), stroke('hair', jib, true))
  const stay: Pt[] = [
    [m1 - 1.4, top1 + h * 0.2],
    [bx + 4, sheerBow - 1.2],
    [m1 - 1.4, boom1 + 1],
  ]
  out.push(...body(stay, 'hair'))

  // Masts, booms, bowsprit and a backstay.
  out.push(
    stroke('line', [
      [m1, top1],
      [m1, sheerMid],
    ]),
  )
  out.push(
    stroke('line', [
      [m2, top2],
      [m2, sheerMid],
    ]),
  )
  out.push(
    stroke('line', [
      [m1 - 0.4, boom1],
      [m2 - 3, boom1],
    ]),
  )
  out.push(
    stroke('line', [
      [m2 - 0.4, boom2],
      [sx + 4, boom2],
    ]),
  )
  out.push(stroke('line', [[bx, sheerBow], tip]))
  out.push(
    stroke('fine', [
      [m2, top2],
      [sx - 2, sheerStern],
    ]),
  )
  out.push(
    stroke('fine', [
      [m1, top1],
      [m2 - 0.5, y + h * 0.2],
    ]),
  )

  // Hull with a high stern, a dark deckhouse and a cap rail.
  const hull: Pt[] = [
    [bx - 2, sheerBow],
    ...quad([bx - 2, sheerBow], [x + w * 0.5, sheerMid + hullH * 0.18], [sx, sheerStern]),
    [sx - 2, water],
    [bx + hullH * 0.9, water],
  ]
  out.push(occlude(hull, { halo: 1.5 }), fill(hull))
  const house: Pt[] = [
    [sx - w * 0.2, sheerStern - hullH * 0.9],
    [sx - 2, sheerStern - hullH * 0.9],
    [sx - 2, sheerStern],
    [sx - w * 0.2, sheerStern + 1],
  ]
  out.push(
    occlude(house, { halo: 1 }),
    ...body(house, 'hair'),
    hline('fine', sx - w * 0.19, sx - 3, sheerStern - hullH * 0.45),
  )
  out.push(
    stroke('bold', [
      [bx - 3, sheerBow - 0.4],
      ...quad(
        [bx - 3, sheerBow - 0.4],
        [x + w * 0.5, sheerMid + hullH * 0.1],
        [sx + 1, sheerStern - 0.4],
      ).slice(1),
    ]),
  )
  return out
}
