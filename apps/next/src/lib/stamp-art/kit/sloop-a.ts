// Anguilla: a racing sloop in profile. Low dark hull with a raked bow, a very tall mast, a long
// boom that overhangs the stern and a huge lit mainsail with seam lines; the jib is shaded T4. The
// box is the boat; its bottom is the waterline.
import { type Pt, type SvgNode, body, fill, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const sloopA: KitModule = ([x, y, w, h], p) => {
  const water = y + h
  const hullH = h * num(p, 'hull', 0.09)
  const deck = water - hullH
  const mx = x + w * num(p, 'mast', 0.44)
  const boomY = deck - h * 0.05
  const boomEnd = x + w * 0.98
  const bow = x + w * 0.06
  const stern = x + w * 0.9
  const out: SvgNode[] = []
  // Mainsail: luff on the mast, foot on the boom, a roached leech.
  const leech = quad([mx, y + h * 0.02], [boomEnd - w * 0.02, boomY - h * 0.42], [boomEnd, boomY])
  const main: Pt[] = [[mx + 1.2, y + h * 0.02], ...leech.slice(1), [mx + 1.2, boomY]]
  out.push(...body(main, 'hair'))
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    const sy = boomY - (boomY - y - h * 0.02) * f
    out.push(hline('fine', mx + 2.4, mx + 1.2 + (boomEnd - mx) * (1 - f) * 0.88, sy))
  }
  // Jib: tall triangle from the masthead to the bow, shaded.
  const jib: Pt[] = [
    [mx - 1.2, y + h * 0.1],
    [bow + 2, deck - 0.6],
    [mx - w * 0.1, boomY + 1],
  ]
  out.push(occlude(jib), ...toneFill(jib, 'T4', { inset: 0.4 }), stroke('hair', jib, true))
  // Mast, boom, forestay and backstay.
  out.push(
    stroke('line', [
      [mx, y],
      [mx, deck],
    ]),
  )
  out.push(
    stroke('line', [
      [mx - 0.5, boomY],
      [boomEnd, boomY],
    ]),
  )
  out.push(
    stroke('fine', [
      [mx, y],
      [bow + 1, deck - 0.6],
    ]),
  )
  out.push(
    stroke('fine', [
      [mx, y],
      [stern, deck],
    ]),
  )
  // Hull: raked bow, shallow sheer, transom.
  const hull: Pt[] = [
    [bow - 3, deck - 1.4],
    ...quad([bow - 3, deck - 1.4], [x + w * 0.45, deck + 1.4], [stern + 2, deck - 0.6]),
    [stern, water],
    [bow + 5, water],
  ]
  out.push(occlude(hull, { halo: 1.5 }), fill(hull))
  out.push(hline('fine', bow + 4, stern - 2, deck - 1.2))
  return out
}
