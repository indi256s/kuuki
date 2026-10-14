// UM: a Laysan albatross gliding on long, straight, narrow wings. Seen from slightly below: a
// white body with a hooked beak, wings that bend at the wrist and droop to dark tips, a short tail.
// The box is the bird; the wings span its full width, the body sits at the centre.
import { type Pt, type SvgNode, body, fill, quad, stroke, toneFill } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

export const albatross: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const cy = y + h * 0.5
  const droop = num(p, 'droop', 0.3)
  const out: SvgNode[] = []
  const side = (s: 1 | -1): void => {
    const X = (f: number) => cx + s * w * 0.5 * f
    // leading edge: shoulder, gentle arch, drooped tip
    const lead: Pt[] = quad([X(0.05), cy - 5], [X(0.55), cy - h * 0.36], [X(1), cy + h * droop], 20)
    // trailing edge: tip back to the body; the chord narrows from 14 at the root to 2 at the tip
    const trail: Pt[] = quad(
      [X(1), cy + h * droop + 2],
      [X(0.6), cy - h * 0.06],
      [X(0.05), cy + 8],
      20,
    )
    const pts: Pt[] = [...lead, ...trail]
    out.push(...body(s === 1 ? pts : pts.slice().reverse(), 'line'))
    // dark outer wing: primaries
    const tipFrom = Math.round(lead.length * 0.66)
    const prim: Pt[] = [...lead.slice(tipFrom), ...trail.slice(0, Math.round(trail.length * 0.34))]
    out.push(fill(prim))
    // coverts: fine feather lines along the span on the inner wing
    for (let i = 1; i <= 3; i++) {
      const t = 0.2 + i * 0.13
      out.push(
        stroke('fine', [
          [X(t * 0.3), cy - h * 0.06 + i * 1.8],
          [X(t * 1.15), cy - h * 0.2 + h * 0.18 + i * 0.4],
        ]),
      )
    }
  }
  side(1)
  side(-1)
  // body: a plump teardrop pointing to the left (head), tail wedge to the right
  const torso: Pt[] = [
    [cx - 12.6, cy - 2.8],
    [cx - 7.0, cy - 8.4],
    [cx + 4.2, cy - 7.7],
    [cx + 12.6, cy - 1.4],
    [cx + 21.0, cy + 4.2],
    [cx + 12.6, cy + 8.4],
    [cx - 1.4, cy + 10.5],
    [cx - 11.2, cy + 5.6],
  ]
  out.push(...body(torso, 'line'))
  out.push(
    ...toneFill(
      [
        [cx + 5.6, cy + 1.4],
        [cx + 21.0, cy + 4.2],
        [cx + 12.6, cy + 8.4],
        [cx + 1.4, cy + 9.8],
      ],
      'T4',
      { gap: 1.8, inset: 0.2 },
    ),
  )
  // head and hooked beak
  const head: Pt[] = quad([cx - 9.8, cy - 2.8], [cx - 16.8, cy - 9.8], [cx - 21.0, cy - 2.8], 6)
  out.push(...body([...head, [cx - 21.0, cy + 1.4], [cx - 12.6, cy + 2.8]], 'line'))
  out.push(
    fill([
      [cx - 21.0, cy - 2.8],
      [cx - 29.4, cy - 0.7],
      [cx - 27.2, cy + 2.8],
      [cx - 21.0, cy + 1.4],
    ]),
  )
  return out
}
