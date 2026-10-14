// Peranakan shophouses (Singapore): a terrace of narrow two-storey houses sharing party walls. Each
// has a five-foot-way arcade (a round arch, dark), a pair of shuttered windows above (louvres as
// vertical hatching), a string course and a front parapet; bays alternate a low pediment and a
// shallow tile roof. The box is the whole row; its bottom is the ground.
import { type Pt, type SvgNode, body, hline, quad, rectPts, stroke, toneFill, vline } from '../grid'
import { type KitModule, num, nums } from './util'

function bay(x0: number, w: number, base: number, ht: number, kind: number): SvgNode[] {
  const out: SvgNode[] = []
  const top = base - ht
  const eave = top + ht * 0.2 // underside of the parapet band
  const floorY = base - ht * 0.4
  out.push(...body(rectPts(x0, eave, w, base - eave), 'line'))
  // Ground floor: one wide round arch of the five-foot way, dark.
  const aw = w * 0.7
  const ax0 = x0 + (w - aw) / 2
  const spring = floorY + ht * 0.14
  const arch: Pt[] = [
    [ax0, base - 1],
    [ax0, spring],
    ...quad([ax0, spring], [x0 + w / 2, spring - aw * 0.95], [ax0 + aw, spring], 10).slice(1),
    [ax0 + aw, base - 1],
  ]
  out.push(...toneFill(arch, 'T4', { angle: 90, gap: [3.8, 3.8], weight: 'hair', inset: 0.4 }))
  out.push(stroke('fine', arch))
  out.push(hline('line', x0, x0 + w, floorY))
  // Upper floor: a pair of shuttered windows, wider than tall, louvres as vertical hatching.
  const ww = w * 0.27
  const wy0 = eave + ht * 0.09
  const wy1 = floorY - ht * 0.07
  for (const fx of [0.26, 0.74]) {
    const wx = x0 + w * fx - ww / 2
    const win = rectPts(wx, wy0, ww, wy1 - wy0)
    out.push(...toneFill(win, 'T4', { angle: 90, gap: [3.8, 3.8], weight: 'fine', inset: 0.3 }))
    out.push(stroke('hair', win, true))
  }
  // Parapet band, then a low pediment (kind 0) or a shallow tile roof (kind 1).
  out.push(hline('line', x0 - 0.6, x0 + w + 0.6, eave))
  if (kind === 0) {
    const ped: Pt[] = [
      [x0 + w * 0.08, eave],
      [x0 + w * 0.08, eave - ht * 0.04],
      [x0 + w * 0.32, eave - ht * 0.04],
      [x0 + w / 2, top - 0.5],
      [x0 + w * 0.68, eave - ht * 0.04],
      [x0 + w * 0.92, eave - ht * 0.04],
      [x0 + w * 0.92, eave],
    ]
    out.push(...body(ped, 'line'))
  } else {
    const roof: Pt[] = [
      [x0 - 0.6, eave],
      [x0 + w * 0.14, top],
      [x0 + w * 0.86, top],
      [x0 + w + 0.6, eave],
    ]
    out.push(...body(roof, 'line'))
    out.push(
      ...toneFill(
        [
          [x0 + 1, eave - 0.8],
          [x0 + w * 0.14 + 0.6, top + 1.8],
          [x0 + w * 0.86 - 0.6, top + 1.8],
          [x0 + w - 1, eave - 0.8],
        ],
        'T4',
        { angle: 0, gap: [4.4, 4.4], weight: 'fine', inset: 0.5 },
      ),
    )
  }
  return out
}

export const shophouseRow: KitModule = ([x, y, w, h], p) => {
  const bays = Math.max(3, Math.round(num(p, 'bays', 4)))
  const base = y + h
  const out: SvgNode[] = []
  const heights = nums(p, 'heights', [0.93, 1, 0.96, 0.9, 0.97, 0.94])
  const bw = w / bays
  for (let i = 0; i < bays; i++) {
    const ht = h * heights[i % heights.length]
    out.push(...bay(x + bw * i, bw, base, ht, i % 2))
  }
  // Kerb and plinth.
  out.push(hline('bold', x - 2, x + w + 2, base))
  out.push(hline('hair', x - 2, x + w + 2, base + 2.4))
  for (let px = x + 1; px < x + w; px += 3.6) out.push(vline('fine', px, base + 0.6, base + 2))
  return out
}
