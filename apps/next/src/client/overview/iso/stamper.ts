import { MON, X, Y, Zd, flat, flatText, onPlan } from './flat'
import { Scene, hull, type IsoFigureData, type P3 } from './scene'

/** How far a pick pushes the head down, and how far the month band rolls per month, in iso units. */
const PRESS_TRAVEL = 3,
  ROLL_STEP = 6.5

export type StamperInput = {
  /** 0–11: the month the band shows. */
  month: number
  /** The count behind `flightsLabel`; the lettering itself is the caller's. */
  flights: number
  /** Localized short month, upper-case: the impression's lettering (and the band's current line, unless `bandLabel` says otherwise). */
  monthLabel: string
  /** The band's current line when it differs from the impression: mid-pick the band has rolled on and the impression has not been stamped yet. A year works as well as a month. */
  bandLabel?: string
  /** The impression's count line, pre-formatted by the caller ("11 FLIGHTS"). */
  flightsLabel: string
  /** Twelve localized short months, upper-case, January first, for the band's neighbours; English when omitted. */
  monthLabels?: readonly string[]
  /** How far the head is already pushed down, as geometry: the housing compresses and the posts shorten. A pick animates the `head` part instead. */
  press?: number
  /** The impression's stroke width; 0 leaves it unprinted. */
  ink?: number
}

/**
 * Rhythm: the passport-control date stamper. Its month band reads the picked month and its last impression sits beside it.
 * Parts: `head` (housing with its band window, then crossbar and knob: two groups, the near post stands between them), `band` (the month labels, clipped to the window, inside the first `head`) and `impression`.
 * Vars: `head` carries `--press-y` (the push down, in px), `band` carries `--roll-y` (one month's roll, in px). Live: the band's plate and the impression.
 */
export function stamper(
  k: number,
  {
    month,
    monthLabel,
    bandLabel = monthLabel,
    flightsLabel,
    monthLabels,
    press = 0,
    ink = 0.9,
  }: StamperInput,
): IsoFigureData {
  const s = new Scene(k)
  const Z = 0.6,
    H = Z - press,
    F = 34
  const labels = monthLabels ?? MON
  const name = (m: number) => (m === month ? bandLabel : labels[((m % 12) + 12) % 12])
  const [, pressY] = s.vector(0, 0, -PRESS_TRAVEL),
    [, rollY] = s.vector(0, 0, ROLL_STEP)

  s.poly(
    flat(
      [
        [-6, -4],
        [108, -4],
        [108, 60],
        [-6, 60],
      ],
      0,
    ),
    'shadow',
    'none',
  )
  s.rbox(-2, -2, 0, 106, 58, 0.6, 1.5)

  // Impression: coral ink, double frame.
  s.group('impression', () => {
    if (ink <= 0) return
    const frame = (w: number, d: number) =>
      flat(
        [
          [76 - w, 26 - d],
          [76 + w, 26 - d],
          [76 + w, 26 + d],
          [76 - w, 26 + d],
        ],
        Z,
      )
    s.glow(3, () => s.poly(frame(20, 13), 'none', 'accent', undefined, ink))
    s.poly(frame(20, 13), 'none', 'accent', undefined, ink)
    s.poly(frame(17.5, 10.5), 'none', 'accent', undefined, ink)
    flatText(s, onPlan, 0, monthLabel, 76, 23.5, Z, { size: 11, fill: 'accent', weight: 700 })
    flatText(s, onPlan, 0, flightsLabel, 76, 32, Z, { size: 4.4, fill: 'accent', weight: 600 })
  })

  // The stamper: base and far post stand still.
  s.box(4, 10, Z, 36, 28, 5)
  s.box(4, 20, Z + 5, 3, 8, 34 - press)

  // The head: the housing, with its band window. The clip is the housing's hull, so a head pushed down sinks into the base instead of drawing over it.
  const m = 0.7 / k,
    housing: P3[] = []
  for (const x of [10 - m, 34 + m])
    for (const y of [14 - m, 34 + m])
      for (const z of [Z + 5 - m, Z + 26 + m]) housing.push([x, y, z])
  s.group(
    'head',
    () => {
      s.box(10, 14, H + 5 + press, 24, 20, 21 - press)
      const win = (z: number): P3[] => [
        [12, F, z],
        [32, F, z],
      ]
      s.poly([...win(H + 25), ...win(H + 7.5 + press).reverse()], 'glass', 'line')
      s.glow(3, () =>
        s.poly(
          [
            [12.8, F, H + 19.2],
            [31.2, F, H + 19.2],
            [31.2, F, H + 13],
            [12.8, F, H + 13],
          ],
          'accent',
          'none',
        ),
      )
      s.poly(
        [
          [12.8, F, H + 19.2],
          [31.2, F, H + 19.2],
          [31.2, F, H + 13],
          [12.8, F, H + 13],
        ],
        'accent',
        'accent',
      )
      // Labels two steps out wait outside the window, so a roll has a line to bring in.
      s.group(
        'band',
        () => {
          const line = (offset: number, z: number, size: number, fill: 'muted' | 'on-accent') =>
            s.text(name(month + offset), [22, F, H + z], X, Zd, {
              size,
              fill,
              weight: 700,
              mono: true,
              anchor: 'middle',
            })
          line(-2, 28.9, 4.6, 'muted')
          line(-1, 21.6, 4.6, 'muted')
          line(0, 14.3, 6.4, 'on-accent')
          if (press < 1) line(1, 8.6, 4.6, 'muted')
          line(2, 3, 4.6, 'muted')
        },
        {
          clip: [...win(H + 25), ...win(H + 7.5 + press)],
          vars: { '--roll-y': `${rollY}px` },
        },
      )
    },
    { clip: housing, vars: { '--press-y': `${pressY}px` } },
  )

  // The near post is nearer than the housing, so it comes after; the crossbar rides on the posts' tops.
  s.box(37, 20, Z + 5, 3, 8, 34 - press)
  s.group(
    'head',
    () => {
      s.box(4, 20, H + 39, 36, 8, 3)
      const knob = (r: number, z0: number, z1: number) => {
        const a = s.circle([22, 24, z0], X, Y, 0, 0, r, 40),
          b = s.circle([22, 24, z1], X, Y, 0, 0, r, 40)
        s.poly2(hull(s.pp([...a, ...b])), 'front', 'line')
        s.poly(b, 'top', 'line')
      }
      knob(2.6, H + 42, H + 48)
      knob(8, H + 48, H + 55)
    },
    { vars: { '--press-y': `${pressY}px` } },
  )
  return s.done()
}
