// U Bein Bridge (Myanmar): the very long teak footbridge on a regular row of posts, seen in the
// classic view that runs away from the viewer toward the far shore. Perspective is a scale `s` that
// falls from 1 at the near end (left) to `far` at the vanishing point (right): posts shrink and bunch,
// the deck band narrows, roofed rest shelters stand on the deck. Paired posts are lit/shaded apart.
// The box is the bridge: its left edge is the near end, its bottom the near waterline; the far water
// meets the horizon at `hz` (fraction of the box height from the top).
import { type Pt, type SvgNode, body, hline, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const uBeinBridge: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const hz = y + h * num(p, 'hz', 0.5)
  const far = num(p, 'far', 0.13)
  const H = num(p, 'height', 36)
  const ratio = far ** (1 / num(p, 'posts', 14))
  const out: SvgNode[] = []
  const xv = x + w
  const pos = (s: number) => ({
    px: xv - (xv - x) * ((s - far) / (1 - far)) * 0.96 - (xv - x) * 0.04 * 0,
    foot: hz + (base - hz) * s,
  })
  const levels: number[] = []
  for (let s = 1; s >= far * 0.98; s *= ratio) levels.push(s)
  // Posts, far to near so near ones overlap. Each is a pair across the deck width.
  for (const s of [...levels].reverse()) {
    const { px, foot } = pos(s)
    const top = foot - H * s
    const wd = Math.max(1.6, 4.2 * s)
    out.push(
      stroke(s > 0.4 ? 'line' : 'hair', [
        [px, top + 1.5 * s],
        [px - 0.4 * s, foot],
      ]),
    )
    out.push(
      stroke('hair', [
        [px + wd, top - 1 * s],
        [px + wd - 0.3 * s, foot - 1.4 * s],
      ]),
    )
    if (s > 0.28)
      out.push(
        stroke('fine', [
          [px, top + 0.34 * H * s],
          [px + wd, top + 0.1 * H * s],
        ]),
      )
    // Reflection under the foot.
    out.push(
      stroke('fine', [
        [px - 0.4 * s, foot + 1.4],
        [px - 0.4 * s, foot + 1.4 + 4 * s],
      ]),
    )
  }
  // Deck: a band joining the post tops, thicker near, plus a lower edge.
  const upper: Pt[] = []
  const lower: Pt[] = []
  for (let i = 0; i <= 40; i++) {
    const s = 1 - (1 - far) * (i / 40)
    const { px, foot } = pos(s)
    const top = foot - H * s
    upper.push([px + 4.2 * s, top - 1.6 * s])
    lower.push([px, top + 2.6 * s])
  }
  out.push(...body([...upper, ...lower.reverse()], 'line'))
  // Rest shelters on the deck: a roofed box at two distances.
  for (const s of [0.62, 0.34]) {
    const { px, foot } = pos(s)
    const top = foot - H * s - 1.6 * s
    const sw = 20 * s
    const sx = px + 2 * s
    out.push(...body(rectPts(sx, top - 10 * s, sw, 10 * s), 'line'))
    out.push(
      ...toneFill(
        [
          [sx + sw * 0.5, top - 10 * s + 0.6],
          [sx + sw - 0.5, top - 10 * s + 0.6],
          [sx + sw - 0.5, top - 0.4],
          [sx + sw * 0.5, top - 0.4],
        ],
        'T4',
        { angle: 90, gap: [2.4, 2.4], inset: 0.3 },
      ),
    )
    out.push(
      ...body(
        [
          [sx - 3.4 * s, top - 10 * s],
          [sx + sw * 0.2, top - 18 * s],
          [sx + sw * 0.8, top - 18 * s],
          [sx + sw + 3.4 * s, top - 10 * s],
        ],
        'line',
      ),
    )
    out.push(hline('bold', sx - 3.4 * s, sx + sw + 3.4 * s, top - 10 * s))
  }
  return out
}
