// Hill fortress of stepped bastions (Castillo San Felipe type). The box is hill plus fort; the hill
// takes the bottom `hill` fraction and rises to the right. Three battered terraces step up, their
// faces alternating lit and shaded bastion panels, with a sentry box (garita) on each salient and
// a squat watch tower at the top. Fall-line hatching covers the hill.
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

export const bastionFort: KitModule = ([x, y, w, h], p) => {
  const hillH = h * num(p, 'hill', 0.3)
  const tiers = Math.round(num(p, 'tiers', 3))
  const baseY = y + h
  const fortBase = baseY - hillH
  const tierH = (fortBase - y) / (tiers + 0.35)
  const out: SvgNode[] = []
  // Hill: a long slope from the left foot up to the fort, a shorter fall on the right.
  const hill: Pt[] = [
    [x, baseY],
    [x, baseY - hillH * 0.3],
    [x + w * 0.3, fortBase + hillH * 0.3],
    [x + w * 0.55, fortBase + 2],
    [x + w * 0.9, fortBase + 1],
    [x + w, baseY - hillH * 0.25],
    [x + w, baseY],
  ]
  out.push(occlude(hill), stroke('line', hill.slice(1, -1)))
  for (let px = x + 2; px < x + w - 1; px += 2.6) {
    const t = (px - x) / w
    let top = fortBase + 2
    for (let i = 1; i < hill.length - 1; i++) {
      const a = hill[i],
        b = hill[i + 1]
      if (px >= a[0] && px <= b[0]) top = a[1] + ((px - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
    }
    out.push(
      stroke(t > 0.5 ? 'hair' : 'fine', [
        [px, top + 1.5],
        [px - 2.2, Math.min(baseY - 1, top + 5 + (t < 0.3 ? 8 : 4))],
      ]),
    )
  }
  // Terraces from the bottom up: widths shrink, each shifted right toward the summit.
  for (let t = 0; t < tiers; t++) {
    const tw = w * (num(p, 'width', 0.64) - t * 0.06)
    const tx = x + w * (0.03 + t * num(p, 'shift', 0.15))
    const yb = fortBase + (tiers - 1 - t) * num(p, 'drop', 3) - t * tierH
    const yt = yb - tierH
    const batter = num(p, 'batter', 2.2)
    const pairs = Math.max(2, Math.round(tw / 20))
    const pw = tw / pairs
    // Each pair is a wide lit curtain face and a narrower shaded bastion face; the top edge dips
    // at every salient so the wall reads as a zig-zag in plan.
    const poly: Pt[] = [[tx - batter, yb]]
    for (let k = 0; k < pairs; k++) {
      poly.push(
        [tx + pw * k, yt],
        [tx + pw * (k + 0.62), yt],
        [tx + pw * (k + 0.62), yt + 2.4],
        [tx + pw * (k + 1), yt + 2.4],
      )
    }
    poly.push([tx + tw + batter, yb])
    out.push(...body(poly, 'line'))
    out.push(hline('bold', tx - batter, tx + tw + batter, yb))
    for (let k = 0; k < pairs; k++) {
      out.push(
        ...toneFill(rectPts(tx + pw * (k + 0.62), yt + 3.4, pw * 0.38, yb - yt - 3.4), 'T4', {
          gap: 2.1,
          inset: 0.3,
        }),
      )
      out.push(hline('hair', tx + pw * k + 1, tx + pw * (k + 0.62) - 1, yt + 3.6))
      if (t === tiers - 1 && k > 0) {
        const gx = tx + pw * k
        const g: Pt[] = [
          [gx - 1.7, yt],
          [gx - 1.7, yt - 3.2],
          [gx, yt - 5.4],
          [gx + 1.7, yt - 3.2],
          [gx + 1.7, yt],
        ]
        out.push(occlude(g), fill(g))
      }
    }
    if (t === tiers - 1) {
      // Squat watch tower at the summit.
      const tx0 = tx + tw * 0.62
      const tw0 = Math.min(11, tw * 0.2)
      out.push(...body(rectPts(tx0, yt - tierH * 0.55, tw0, tierH * 0.55 + 1), 'line'))
      out.push(
        ...toneFill(
          rectPts(tx0 + tw0 * 0.62, yt - tierH * 0.55 + 1, tw0 * 0.38, tierH * 0.55),
          'T4',
          { gap: 1.8, inset: 0.3 },
        ),
      )
      out.push(fill(rectPts(tx0 + tw0 * 0.3, yt - tierH * 0.4, 2, 3)))
      out.push(hline('bold', tx0 - 1, tx0 + tw0 + 1, yt - tierH * 0.55))
    }
  }
  return out
}
