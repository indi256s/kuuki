// PW: Rock Islands Southern Lagoon. Low limestone islets undercut by the sea until each one is a
// mushroom: a dark, tufted forest crown on a pale neck that is narrowest at the waterline.
// `islets` lists [centre x, width, height, depth] as fractions of the box (height from the
// waterline at the box bottom; depth 0 is the nearest, 1 the farthest). Far islets are a light
// diagonal T2 hatch; near ones have a lit left neck, a shaded right neck and a dark crown.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, quad, stroke, toneFill } from '../grid'
import { type KitModule, num, nums } from './util'

export const mushroomIslets: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 12)))
  const flat = nums(p, 'islets', [0.22, 0.34, 0.8, 0.5, 0.74, 0.3, 0.7, 0.6, 0.48, 0.4, 1, 0.1])
  const base = y + h
  const out: SvgNode[] = []
  const items: { cx: number; w: number; h: number; d: number }[] = []
  for (let i = 0; i + 3 < flat.length; i += 4)
    items.push({ cx: x + w * flat[i], w: w * flat[i + 1], h: h * flat[i + 2], d: flat[i + 3] })
  items.sort((a, b) => b.d - a.d)
  for (const it of items) {
    const far = it.d > 0.6
    const hw = it.w / 2
    const wl = base - it.d * 10 // far islets sit a little higher on the water
    const top = wl - it.h
    const rimY = top + it.h * 0.7 // underside of the crown
    const neckY = rimY + (wl - rimY) * 0.5
    const j = () => (rand() - 0.5) * 1.6
    // crown: rounded top with a lumpy canopy edge
    const lump = (pts: Pt[], k: number): Pt[] =>
      pts.map(([px, py], i) => [
        px,
        py - (i > 0 && i < pts.length - 1 ? Math.abs(Math.sin(i * 2.1 + k)) * 1.9 : 0),
      ])
    const crown: Pt[] = lump(
      quad([it.cx - hw, rimY], [it.cx - hw * 1.08, top - it.h * 0.12], [it.cx - hw * 0.1, top], 9),
      it.cx,
    )
    const crownR: Pt[] = lump(
      quad([it.cx - hw * 0.1, top], [it.cx + hw * 1.1, top - it.h * 0.1], [it.cx + hw, rimY], 9),
      it.cx + 3,
    ).slice(1)
    const rim: Pt[] = [
      [it.cx + hw * 0.7, rimY + 1.8 + j()],
      [it.cx + hw * 0.38, rimY + 0.6 + j()],
      [it.cx + hw * 0.02, rimY + 2.2 + j()],
      [it.cx - hw * 0.38, rimY + 0.8 + j()],
      [it.cx - hw * 0.7, rimY + 1.8 + j()],
    ]
    const neckL = it.cx - hw * 0.66
    const neckR = it.cx + hw * 0.62
    const sil: Pt[] = [
      ...crown,
      ...crownR,
      [it.cx + hw * 0.8, rimY + 2],
      [neckR + 2, neckY],
      [neckR - 1.2, wl - 0.6],
      [neckL + 1.2, wl - 0.6],
      [neckL - 1, neckY],
      [it.cx - hw * 0.8, rimY + 2],
    ]
    out.push(...body(sil, far ? 'hair' : 'line'))
    if (far) {
      out.push(...toneFill(sil, 'T2', { gap: 2.4, inset: 0.4 }))
    } else {
      // crown: dense vertical hatching, dark; the lit top edge stays paper
      const dome: Pt[] = [
        [it.cx - hw * 0.25, top + it.h * 0.16],
        ...crownR.filter(([px]) => px > it.cx - hw * 0.25),
        ...rim.slice(0, 4),
      ]
      out.push(...toneFill(dome, 'T4', { gap: 2.7, inset: 0.3 }))
      out.push(stroke('hair', rim))
      // neck: lit left, shaded right with fall-line hatching
      const shade: Pt[] = [
        [it.cx + hw * 0.1, rimY + 3],
        [it.cx + hw * 0.8, rimY + 2],
        [neckR + 2, neckY],
        [neckR - 1.2, wl - 0.6],
        [it.cx + hw * 0.04, wl - 0.6],
      ]
      out.push(...toneFill(shade, 'T4', { gap: 2.4, inset: 0.3 }))
      out.push(
        stroke('hair', [
          [neckL + 2, neckY - 1],
          [neckL + 4, wl - 1.4],
        ]),
      )
    }
    // reflection and waterline foam under the neck
    out.push(hline('hair', neckL - 4, neckR + 4, wl + 1.8))
    if (!far) out.push(hline('fine', neckL - 1, neckR + 7, wl + 3.8))
  }
  return out
}
