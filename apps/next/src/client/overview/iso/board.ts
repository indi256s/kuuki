import { Scene, type P3 } from './scene'

// The housing: W wide, D deep, its face H tall standing on two posts LEG high.
const W = 132,
  D = 12,
  H = 58,
  LEG = 14
/** Flaps in each row's bar: a row lights as many as its share of the leader's flights. */
export const BOARD_FLAPS = 8
const ROW = { v0: 16, gap: 4, codeU: 6, codeW: 10, barU: 32 }

/**
 * Rankings: a split-flap departures board, one row per ranked airline (leader first). Each row shows the airline code on two flaps, then a bar of flaps lit by `share`, the airline's flights over the leader's (so the leader's bar is full).
 * Codes are drawn from k = 0.9; smaller, the tile's text names the leader.
 * Parts: `backlight` (the leader's glow, which hover raises).
 */
export function flapBoard(rows: readonly { code: string; share: number }[], k = 1) {
  const s = new Scene(k)
  const big = k >= 0.9

  // Posts on foot plates, then the housing over them.
  s.poly(
    [
      [-3, D + 6, 0],
      [W + 6, D + 6, 0],
      [W + 6, -4, 0],
      [-3, -4, 0],
    ],
    'shadow',
    'none',
  )
  for (const x of [14, W - 22]) {
    s.box(x - 5, -2, 0, 18, D + 4, 2)
    s.box(x, 3, 2, 8, 6, LEG - 2)
  }
  s.box(0, 0, LEG, W, D, H)

  const face = s.on([0, D, LEG + H], [1, 0, 0], [0, 0, -1])
  const U: P3 = [1, 0, 0],
    V: P3 = [0, 0, -1]
  const rect = (u: number, v: number, w: number, h: number) => [
    face(u, v),
    face(u + w, v),
    face(u + w, v + h),
    face(u, v + h),
  ]
  // Header: a rule under the title, and the title itself at section size.
  s.segs([[face(4, 12), face(W - 4, 12)]], 'detail', 0.8)
  if (big)
    s.text('DEPARTURES', face(6, 9), U, V, {
      size: 6.5,
      weight: 700,
      mono: true,
      fill: 'muted',
    })
  else
    s.segs(
      [0, 1, 2].map((i) => [face(6 + i * 9, 6.5), face(12 + i * 9, 6.5)]),
      'detail',
      1.4,
    )
  // Mounting screws at the face's corners.
  for (const [u, v] of [
    [3, 3],
    [W - 3, 3],
    [3, H - 3],
    [W - 3, H - 3],
  ])
    s.poly(s.circle([0, D, LEG + H], U, V, u, v, 0.9, 8), 'detail', 'none')

  // The flap window: a dark well holding the rows.
  const well = { u: 3.5, v: ROW.v0 - 2.5, w: W - 7, h: H - ROW.v0 - 1 }
  s.poly(rect(well.u, well.v, well.w, well.h), 'shadow', 'line')
  const rh = (H - ROW.v0 - 6 - ROW.gap * 2) / 3
  const flapW = (W - 6 - ROW.barU - (BOARD_FLAPS - 1) * 1.6) / BOARD_FLAPS

  const flap = (u: number, v: number, w: number, lit: boolean) => {
    const pts = rect(u, v, w, rh)
    s.poly(pts, lit ? 'accent' : 'side', lit ? 'accent' : 'line', undefined, 0.8)
    // The split: every flap is two leaves on a hinge across its middle.
    s.segs([[face(u, v + rh / 2), face(u + w, v + rh / 2)]], lit ? 'accent-side' : 'line', 0.8)
  }
  for (let r = 0; r < 3; r++) {
    const row = rows[r],
      v = ROW.v0 + r * (rh + ROW.gap)
    for (let c = 0; c < 2; c++) {
      const u = ROW.codeU + c * (ROW.codeW + 1.6)
      flap(u, v, ROW.codeW, false)
      const ch = row?.code[c]
      if (big && ch)
        s.text(ch, face(u + ROW.codeW / 2, v + rh / 2 + 3.2), U, V, {
          size: 9,
          weight: 700,
          mono: true,
          fill: 'ink',
          anchor: 'middle',
        })
    }
    const lit = row ? Math.max(1, Math.round(row.share * BOARD_FLAPS)) : 0
    if (r === 0 && lit)
      s.group('backlight', () =>
        s.glow(3, () => s.poly(rect(ROW.barU, v, lit * (flapW + 1.6) - 1.6, rh), 'accent', 'none')),
      )
    for (let c = 0; c < BOARD_FLAPS; c++) flap(ROW.barU + c * (flapW + 1.6), v, flapW, c < lit)
  }
  return s.done()
}
