// House of the Blackheads (Riga), lane C: a tall narrow guild-house facade with an ornate five-step
// gable (pinnacles on every ledge, a finial, a clock face), four storeys of tall windows over an
// arched portal, an ornament band under the gable, and the lower Schwab House beside it with a
// small stepped gable. Lit left, T4 on the right fifth. The box bottom is the street.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatchPoly,
  hline,
  occlude,
  rectPts,
  stroke,
} from '../grid'
import { clipPoly } from './rock-b'
import { type KitModule, num } from './util'

const circle = (cx: number, cy: number, r: number, n = 20): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => {
    const a = (i / n) * Math.PI * 2
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  })

/** Stepped gable outline from the base up: `widths` per step, each `rise` tall, one apex. */
function gableOutline(cx: number, baseY: number, widths: number[], rise: number): Pt[] {
  // Each riser ends at the next step's ledge; the last one closes on the apex.
  const l: Pt[] = []
  const r: Pt[] = []
  widths.forEach((wd, i) => {
    const yt = baseY - (i + 1) * rise
    const next = widths[i + 1] ?? 0
    l.push(
      [cx - wd / 2, i === 0 ? baseY : baseY - i * rise],
      [cx - wd / 2, yt],
      [cx - next / 2, yt],
    )
    r.push(
      [cx + wd / 2, i === 0 ? baseY : baseY - i * rise],
      [cx + wd / 2, yt],
      [cx + next / 2, yt],
    )
  })
  return [...l, ...r.reverse()]
}

export const blackheads: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const fw = num(p, 'facade', 42)
  const fx0 = x + 2
  const fx1 = fx0 + fw
  const cx = fx0 + fw / 2
  const out: SvgNode[] = []

  // Schwab House: lower, to the right, tucked behind the facade.
  const sx0 = fx1 - 2
  const sx1 = x + w
  const sw = sx1 - sx0
  const wallH = 26
  const sCx = sx0 + sw / 2 + 2
  const sg = gableOutline(sCx, base - wallH, [sw - 14, sw - 24, sw - 34], 4.6)
  const sOutline: Pt[] = [
    [sx0, base],
    [sx0, base - wallH],
    ...sg.slice(1, -1),
    [sx1, base - wallH],
    [sx1, base],
  ]
  out.push(...body(sOutline, 'line'))
  out.push(
    ...hatchPoly(rectPts(sx0 + sw * 0.66, base - wallH, sw * 0.34, wallH), {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
    }),
  )
  for (const wy of [base - wallH + 5, base - 15]) {
    for (let i = 0; i < 3; i++) out.push(fill(rectPts(sx0 + 6 + i * ((sw - 14) / 2.4), wy, 4, 6.5)))
  }
  out.push(hline('bold', sx0, sx1, base - wallH))

  // Facade silhouette: wall + gable.
  const wallTop = base - 36
  const widths = [fw, fw - 8, fw - 16, fw - 24, fw - 32]
  const rise = 5
  const g = gableOutline(cx, wallTop, widths, rise)
  const facade: Pt[] = [[fx0, base], ...g.slice(0, -1), [fx1, base]]
  out.push(...body(facade, 'line'))
  // The gable's last point is the apex pair; close it with a small peak.
  const apexY = wallTop - widths.length * rise
  out.push(
    stroke('line', [
      [cx - 2.6, apexY],
      [cx, apexY - 3.2],
      [cx + 2.6, apexY],
    ]),
  )

  // Right-hand shade: T4 on the right fifth of the wall and the gable.
  out.push(
    ...hatchPoly(rectPts(fx1 - fw * 0.2, wallTop, fw * 0.2, base - wallTop), {
      angle: 90,
      gap: 2.4,
      weight: 'hair',
    }),
  )
  const shadeGable = clipPoly(facade, ([px, py]) => (py < wallTop ? px - (cx + 3.4) : -1))
  if (shadeGable.length > 2)
    out.push(...hatchPoly(shadeGable, { angle: 90, gap: 2.4, weight: 'hair' }))

  // Pinnacles on every ledge: a thin obelisk with a ball, plus the finial spire on the apex.
  widths.forEach((wd, i) => {
    if (i === 0) return
    const yb = wallTop - i * rise
    for (const sgn of [-1, 1]) {
      const px = cx + sgn * (wd / 2 - 1.4)
      out.push(
        stroke('hair', [
          [px, yb],
          [px, yb - 4.6],
        ]),
        fill(circle(px, yb - 5.6, 1.1, 8)),
      )
    }
  })
  out.push(
    stroke('line', [
      [cx, apexY - 3.2],
      [cx, apexY - 7],
    ]),
    fill(circle(cx, apexY - 8, 1.4, 8)),
  )

  // Ornament band under the gable: a bold course with a row of dentils.
  out.push(hline('bold', fx0 - 1.2, fx1 + 1.2, wallTop))
  for (let dx = fx0 + 2; dx < fx1 - 1; dx += 3.6)
    out.push(
      stroke('fine', [
        [dx, wallTop + 1.4],
        [dx, wallTop + 3.6],
      ]),
    )

  // Four storeys of tall windows in three columns over the portal row.
  const storeyH = 7.6
  const cols = [0.2, 0.5, 0.8]
  for (let s = 0; s < 3; s++) {
    const top = wallTop + 4.6 + s * storeyH
    for (const c of cols) out.push(fill(rectPts(fx0 + fw * c - 2.4, top, 4.8, 5.4)))
    if (s < 2)
      out.push(
        stroke('hair', [
          [fx0 + 1, top + storeyH - 1.6],
          [fx1 - 1, top + storeyH - 1.6],
        ]),
      )
  }
  const groundTop = wallTop + 4.6 + 3 * storeyH - 1.6
  out.push(hline('line', fx0, fx1, groundTop))
  const portal: Pt[] = [
    [cx - 4.4, base],
    [cx - 4.4, base - 5.5],
    [cx, base - 9.6],
    [cx + 4.4, base - 5.5],
    [cx + 4.4, base],
  ]
  out.push(fill(portal))
  for (const dx of [-0.32, 0.32])
    out.push(fill(rectPts(fx0 + fw * (0.5 + dx) - 2.4, base - 7.4, 4.8, 5.6)))

  // Clock in the gable (third step), a ring with two hands.
  const clockY = wallTop - rise * 2.45
  out.push(
    occlude(circle(cx, clockY, 5.6), { halo: 0 }),
    stroke('line', circle(cx, clockY, 5.2), true),
  )
  out.push(
    stroke('hair', [
      [cx, clockY],
      [cx, clockY - 3.4],
    ]),
    stroke('hair', [
      [cx, clockY],
      [cx + 2.6, clockY + 1],
    ]),
  )
  // Niche on the second step.
  out.push(fill(rectPts(cx - 1.6, wallTop - rise * 1.75, 3.2, 3.6)))
  return out
}
