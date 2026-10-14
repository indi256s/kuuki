// Latte stones of the Marianas: pairs of squared stone pillars (haligi), each capped with a
// hemispherical cup (tasa) set flat side up, standing on bare ground. The box is the group; the
// bottom is the ground. `count` pillars stand side by side, alternating in height.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, occlude, quad, stroke, toneFill, vline } from '../grid'
import { type KitModule, num } from './util'

function one(
  cx: number,
  base: number,
  pw: number,
  h: number,
  lean: number,
  rand: () => number,
): SvgNode[] {
  const out: SvgNode[] = []
  const capH = h * 0.3
  const capW = pw * 1.6
  const topY = base - h
  const pillarTop = topY + capH
  const topW = pw * 0.86
  const pillar: Pt[] = [
    [cx - pw / 2, base],
    [cx - topW / 2 + lean, pillarTop],
    [cx + topW / 2 + lean, pillarTop],
    [cx + pw / 2, base],
  ]
  out.push(...body(pillar, 'line'))
  // Shaded right face.
  const sx = cx + pw * 0.14
  const shade: Pt[] = [[sx, base], [sx + lean * 0.8, pillarTop], pillar[2], pillar[3]]
  out.push(...toneFill(shade, 'T4', { gap: 2.4, inset: 0.2 }))
  out.push(vline('hair', sx, pillarTop + 1, base - 1))
  // Weathering ticks on the lit face.
  for (const f of [0.3, 0.55, 0.78]) {
    const yy = pillarTop + (base - pillarTop) * f
    const x0 = cx - pw * 0.36 + lean * (1 - f) + rand()
    out.push(
      stroke('fine', [
        [x0, yy],
        [x0 + pw * (0.22 + rand() * 0.12), yy + 0.6],
      ]),
    )
  }
  // Cup: flat top, rounded sides curving in to the pillar head.
  const tl: Pt = [cx - capW / 2 + lean, topY]
  const tr: Pt = [cx + capW / 2 + lean, topY]
  const left = quad(
    tl,
    [tl[0] - 0.5, pillarTop - capH * 0.1],
    [cx - topW / 2 + lean, pillarTop],
    10,
  )
  const right = quad(
    [cx + topW / 2 + lean, pillarTop],
    [tr[0] + 0.5, pillarTop - capH * 0.1],
    tr,
    10,
  )
  const cup: Pt[] = [...left, ...right]
  out.push(...body(cup, 'line'))
  // Shaded right half of the cup.
  const cs = cx + capW * 0.16 + lean
  const cupShade = [
    [cs, topY + 1] as Pt,
    ...right.filter((q) => q[0] >= cs),
    ...[[cs, pillarTop] as Pt],
  ]
  out.push(...toneFill(cupShade, 'T4', { gap: 2.4, inset: 0.2 }))
  out.push(stroke('bold', [tl, tr]))
  out.push(hline('fine', cx - topW / 2 + lean, cx + topW / 2 + lean, pillarTop + 1.8))
  return out
}

export const latte: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const count = Math.max(1, Math.round(num(p, 'count', 2)))
  const base = y + h
  const pw = Math.min(w / count / 1.9, h * 0.5)
  const out: SvgNode[] = []
  for (let i = 0; i < count; i++) {
    const cx = x + (w * (i + 0.5)) / count
    const perspective =
      p.recede === true ? 1 - (0.55 * i) / Math.max(1, count - 1) : i % 2 ? 0.86 : 1
    const hh = h * perspective
    out.push(
      ...one(
        cx,
        base - (p.recede === true ? (h * 0.3 * i) / count : 0),
        pw * perspective,
        hh,
        (i % 2 ? -1 : 1) * 0.8,
        rand,
      ),
    )
  }
  out.push(hline('bold', x - 4, x + w + 4, base))
  out.push(
    occlude([
      [x, base],
      [x + w, base],
      [x + w, base + 1],
      [x, base + 1],
    ]),
  )
  return out
}
