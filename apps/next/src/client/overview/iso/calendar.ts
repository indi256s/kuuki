import { Scene, type P3 } from './scene'

// The front board leans back on an A-frame: its foot at y = FOOT, its top RISE higher and LEAN further back. The back leg ends LEG behind the top.
const W = 132,
  FOOT = 60,
  RISE = 58,
  LEAN = 20,
  LEG = 30,
  THICK = 3
const SLANT = Math.hypot(LEAN, RISE)
// Down the page, and the page normal toward the viewer.
const DOWN: P3 = [0, LEAN / SLANT, -RISE / SLANT],
  OUT: P3 = [0, RISE / SLANT, LEAN / SLANT]
const RINGS = 11
const GRID = { u0: 8, u1: W - 8, v0: 24, v1: SLANT - 7, cols: 6, rows: 2, gap: 3 }
const INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const add = (a: P3, b: P3, f = 1): P3 => [a[0] + b[0] * f, a[1] + b[1] * f, a[2] + b[2] * f]

/**
 * Rhythm: a spiral-bound desk calendar whose page is the year by month. `months` holds flights per calendar month (January first), summed over every year; each flown month is tinted by its share of the busiest, and `busiest` (1–12) is lit.
 * At section size the header names the busiest month (`label`) and each cell carries its initial.
 * Parts: `backlight` (the busiest month's glow, which hover raises).
 */
export function calendar(months: readonly number[], busiest: number | null, label: string, k = 1) {
  const s = new Scene(k)
  const big = k >= 0.9
  const top: P3 = [0, FOOT - LEAN, RISE]
  const at = s.on(top, [1, 0, 0], DOWN)
  const back = (p: P3) => add(p, OUT, -THICK)

  // Contact shadow under the frame, then the back leg, which shows to the right of the board.
  s.poly(
    [
      [-2, FOOT + 3, 0],
      [W + 4, FOOT + 3, 0],
      [W + 4, FOOT - LEAN - LEG - 2, 0],
      [-2, FOOT - LEAN - LEG - 2, 0],
    ],
    'shadow',
    'none',
  )
  s.poly(
    [
      [0, FOOT - LEAN, RISE - 1],
      [W, FOOT - LEAN, RISE - 1],
      [W, FOOT - LEAN - LEG, 0],
      [0, FOOT - LEAN - LEG, 0],
    ],
    'side',
  )

  // The board: its right edge and top edge show its thickness; two rules on the edge are the pages under the top one.
  const corner = (u: number, v: number) => at(u, v)
  const [tl, tr, br] = [corner(0, 0), corner(W, 0), corner(W, SLANT)]
  s.poly([tr, br, back(br), back(tr)], 'side')
  s.segs(
    [1, 2].map((f) => [add(tr, OUT, -f), add(br, OUT, -f)]),
    'detail',
    0.8,
  )
  s.poly([tl, tr, back(tr), back(tl)], 'top')
  s.poly([tl, tr, br, corner(0, SLANT)], 'top')

  // Header band across the page; at section size it names the busiest month.
  s.poly([at(0, 9), at(W, 9), at(W, 20), at(0, 20)], 'front', 'none')
  s.segs([[at(0, 20), at(W, 20)]], 'detail', 0.8)
  if (big && label)
    s.text(label, at(W / 2, 17.2), [1, 0, 0], DOWN, {
      size: 7.5,
      weight: 700,
      fill: 'muted',
      anchor: 'middle',
      mono: true,
    })

  // The year: twelve cells, January top left.
  const cw = (GRID.u1 - GRID.u0 - GRID.gap * (GRID.cols - 1)) / GRID.cols,
    ch = (GRID.v1 - GRID.v0 - GRID.gap * (GRID.rows - 1)) / GRID.rows
  const max = Math.max(1, ...months)
  months.slice(0, 12).forEach((flights, i) => {
    const u = GRID.u0 + (i % GRID.cols) * (cw + GRID.gap),
      v = GRID.v0 + Math.floor(i / GRID.cols) * (ch + GRID.gap)
    const cell = [at(u, v), at(u + cw, v), at(u + cw, v + ch), at(u, v + ch)]
    const initial = (fill: 'muted' | 'on-accent') =>
      big &&
      s.text(INITIALS[i], at(u + 3, v + 8.5), [1, 0, 0], DOWN, {
        size: 6.5,
        weight: 600,
        fill,
        mono: true,
      })
    if (busiest === i + 1) {
      s.group('backlight', () => s.glow(3, () => s.poly(cell, 'accent', 'none')))
      s.poly(cell, 'accent', 'accent')
      initial('on-accent')
      return
    }
    s.poly(cell, 'none', 'detail', undefined, 0.8)
    // Heat: the same ramp as the sheet's calendar reads, from a faint tint at one flight to full at the busiest.
    if (flights > 0)
      s.poly(cell, 'accent', 'none', undefined, undefined, 0.22 + 0.6 * (flights / max))
    initial(flights > max / 2 ? 'on-accent' : 'muted')
  })

  // Spiral binding: a punched hole under each ring, and the wire looping over the top edge from the page into the board.
  const holes: P3[][] = [],
    wires: P3[][] = []
  for (let i = 0; i < RINGS; i++) {
    const u = 8 + (i * (W - 16)) / (RINGS - 1)
    holes.push(s.circle(top, [1, 0, 0], DOWN, u, 4, 1.4, 10))
    const hole = at(u, 4),
      edge = add(top, [u, 0, 0])
    const centre = add(add(edge, OUT, -THICK / 2), [0, 0, 1])
    const wire: P3[] = []
    for (let a = -40; a <= 220; a += 20) {
      const r = (a * Math.PI) / 180
      wire.push(add(add(centre, OUT, Math.cos(r) * 4.4), [0, 0, 1], Math.sin(r) * 4.4))
    }
    wires.push([hole, ...wire.slice(0, -1)])
  }
  for (const hole of holes) s.poly(hole, 'shadow', 'none')
  s.segs(wires, 'line', 1.1)
  return s.done()
}
