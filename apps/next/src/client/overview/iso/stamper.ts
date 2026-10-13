import { MON, X, Y, Zd, flat, flatText, onPlan } from './flat'
import { Scene, hull, labelSize, type IsoFigureData, type P3 } from './scene'

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
 * Parts: `head` (housing with its band window, then crossbar, spring and handle: two groups, the near post stands between them), `band` (the month labels, clipped to the window, inside the first `head`) and `impression`.
 * Vars: `head` carries `--press-y` (the push down, in px), `band` carries `--roll-y` (one month's roll, in px). Live: the impression alone; the band's plate is plain ink.
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
    F = 28,
    ZP = Z + 0.5
  const labels = monthLabels ?? MON
  const name = (m: number) => (m === month ? bandLabel : labels[((m % 12) + 12) % 12])
  const [, pressY] = s.vector(0, 0, -PRESS_TRAVEL),
    [, rollY] = s.vector(0, 0, ROLL_STEP)
  const rect = (x0: number, y0: number, x1: number, y1: number, z: number) =>
    flat(
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      z,
    )
  const dot = (x: number, y: number, z: number, r = 0.55) =>
    s.poly(s.circle([x, y, z], X, Y, 0, 0, r, 8), 'detail', 'line')
  /** The near half of a ring round an upright cylinder, `rise` climbing over it (a seam when 0, a coil turn otherwise). */
  const ring = (
    cx: number,
    cy: number,
    r: number,
    z: number,
    rise = 0,
    stroke: 'crease' | 'line' = 'crease',
    width = 1,
  ) => {
    const pts: P3[] = []
    for (let i = 0; i <= 14; i++) {
      const a = (-45 + (180 * i) / 14) * (Math.PI / 180)
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z + rise * (i / 14 - 0.5)])
    }
    s.line(pts, stroke, width)
  }

  // The base: a darker pan, so the paper and the pad stand out of it.
  s.poly(rect(-6, -5, 110, 62, 0), 'shadow', 'none')
  s.rbox(-2, -2, 0, 108, 60, Z, 1.5, { top: 'front' })

  // The page the stamper prints on: ghosted earlier impressions at its margins, the new one in the middle.
  s.box(46, 1, Z, 56, 48, 0.5)
  const ghost = (cx: number, cy: number, w: number, d: number) => {
    s.poly(rect(cx - w, cy - d, cx + w, cy + d, ZP), 'none', 'crease', 0.9)
    s.poly(rect(cx - w + 1.6, cy - d + 1.6, cx + w - 1.6, cy + d - 1.6, ZP), 'none', 'crease', 0.6)
    s.line(
      [
        [cx - w * 0.5, cy - 0.6, ZP],
        [cx + w * 0.5, cy - 0.6, ZP],
      ],
      'crease',
      0.8,
    )
    s.line(
      [
        [cx - w * 0.35, cy + 1.2, ZP],
        [cx + w * 0.35, cy + 1.2, ZP],
      ],
      'crease',
      0.8,
    )
  }
  ghost(66, 6.5, 14, 4.8)
  ghost(92, 44, 8.5, 3.8)

  // Impression: coral ink, double frame.
  s.group('impression', () => {
    if (ink <= 0) return
    const frame = (w: number, d: number) => rect(76 - w, 25 - d, 76 + w, 25 + d, ZP)
    s.glow(3, () => s.poly(frame(24, 14), 'none', 'accent', undefined, ink))
    s.poly(frame(24, 14), 'none', 'accent', undefined, ink)
    s.poly(frame(21.5, 11.5), 'none', 'accent', undefined, ink)
    flatText(s, onPlan, 0, monthLabel, 76, 22, ZP, { size: 11, fill: 'accent', weight: 700 })
    // The minimum readable font can outgrow the inner frame at smaller scales.
    if (flightsLabel.length * labelSize(5.4, k) * 0.62 <= 41)
      flatText(s, onPlan, 0, flightsLabel, 76, 31, ZP, { size: 5.4, fill: 'accent', weight: 600 })
  })

  // A ruler along the front edge: ticks grow from its front edge.
  s.box(4, 50.5, Z, 96, 5, 0.8, { top: 'side' })
  const ticks: P3[][] = []
  for (let x = 6; x <= 98; x += 2)
    ticks.push([
      [x, 55.5, Z + 0.8],
      [x, 55.5 - (x % 10 === 6 ? 3 : 1.6), Z + 0.8],
    ])
  s.segs(ticks, 'crease', 0.6)

  // The stamper: base and far post stand still.
  s.poly(rect(1, 1, 45, 36, Z), 'shadow', 'none')
  s.box(4, 4, Z, 36, 28, 3.6)
  s.box(5, 5, Z + 3.6, 34, 26, 1.4)
  for (const [x, y] of [
    [7.5, 7.5],
    [36.5, 7.5],
    [7.5, 29.5],
    [36.5, 29.5],
  ])
    dot(x, y, Z + 5)
  const post = { top: 'front', front: 'side', side: 'side' } as const
  s.box(3.4, 13.6, Z + 5, 4.2, 8.8, 1.2)
  s.box(4, 14, Z + 6.2, 3, 8, 32.8 - press, post)

  // The head: the housing, with its band window. The clip is the housing's hull, so a head pushed down sinks into the base instead of drawing over it.
  const m = 0.7 / k,
    housing: P3[] = []
  for (const x of [9.4 - m, 34.6 + m])
    for (const y of [7.4 - m, 28.6 + m])
      for (const z of [Z + 5 - m, Z + 27.2 + m]) housing.push([x, y, z])
  s.group(
    'head',
    () => {
      s.box(10, 8, H + 5 + press, 24, 20, 21 - press)
      s.box(9.4, 7.4, H + 5 + press, 25.2, 21.2, 1.6)
      s.box(9.4, 7.4, H + 26, 25.2, 21.2, 1.2)
      const win = (z: number): P3[] => [
        [12, F, z],
        [32, F, z],
      ]
      // The bezel round the opening, then the glass.
      s.poly(
        [
          [11.4, F, H + 25.6],
          [32.6, F, H + 25.6],
          [32.6, F, H + 6.9 + press],
          [11.4, F, H + 6.9 + press],
        ],
        'top',
        'line',
      )
      s.poly([...win(H + 25), ...win(H + 7.5 + press).reverse()], 'glass', 'line')
      // The month on the line is read in plain ink on a pale plate; the impression is the lit part.
      s.poly(
        [
          [12.8, F, H + 19.2],
          [31.2, F, H + 19.2],
          [31.2, F, H + 13],
          [12.8, F, H + 13],
        ],
        'top',
        'crease',
      )
      for (const x of [10.7, 33.3]) dot(x, F, Z + 6.1, 0.5)
      // Labels two steps out wait outside the window, so a roll has a line to bring in.
      s.group(
        'band',
        () => {
          const line = (offset: number, z: number, size: number, fill: 'muted' | 'ink') =>
            s.text(name(month + offset), [22, F, H + z], X, Zd, {
              size,
              fill,
              weight: 700,
              mono: true,
              anchor: 'middle',
            })
          line(-2, 28.9, 5.4, 'muted')
          line(-1, 21.6, 5.4, 'muted')
          line(0, 14.3, 6.8, 'ink')
          if (press < 1) line(1, 8.6, 5.4, 'muted')
          line(2, 3, 5.4, 'muted')
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
  s.box(36.4, 13.6, Z + 5, 4.2, 8.8, 1.2)
  s.box(37, 14, Z + 6.2, 3, 8, 32.8 - press, post)
  s.group(
    'head',
    () => {
      // The band wheel on the housing's side, ahead of the near post.
      const wheel = (x: number) => s.circle([x, 0, 0], Y, [0, 0, 1], 25.4, H + 12.6, 2.7, 24)
      const a = wheel(34),
        b = wheel(36.4)
      s.poly2(hull(s.pp([...a, ...b])), 'front', 'line')
      for (let i = 0; i < 24; i++) {
        const t = (i / 24) * 2 * Math.PI
        if (Math.cos(t) + Math.sin(t) > 0.2 && i % 2 === 0) s.line([a[i], b[i]], 'crease', 0.7)
      }
      s.poly(b, 'top', 'line')
      dot(36.4, 25.4, H + 12.6, 0.5)
      s.box(4, 14, H + 39, 36, 8, 3)
      s.box(4.6, 14.6, H + 42, 34.8, 6.8, 0.6, { top: 'top' })
      dot(7.5, 18, H + 42.6)
      dot(36.5, 18, H + 42.6)
      // The handle: a washer, the spring, a washer, then the cap with its seam.
      s.cylinder(22, 18, 4.3, H + 42.6, H + 43.4)
      s.cylinder(22, 18, 3.4, H + 43.4, H + 50, { side: 'side' })
      for (let j = 0; j < 4; j++) ring(22, 18, 3.4, H + 44.2 + j * 1.6, 1.2, 'line', 0.9)
      s.cylinder(22, 18, 4.3, H + 50, H + 50.8)
      s.cylinder(22, 18, 8, H + 50.8, H + 57)
      ring(22, 18, 8, H + 54)
      s.poly(s.circle([22, 18, H + 57], X, Y, 0, 0, 6.2, 32), 'none', 'crease')
      dot(22, 18, H + 57, 0.8)
    },
    { vars: { '--press-y': `${pressY}px` } },
  )

  // The ink pad in its tin, with the lid beside it: in front of the stamper, so they come last.
  s.poly(s.circle([16, 41, Z], X, Y, 0, 0, 8, 24), 'shadow', 'none')
  s.poly(s.circle([33, 41, Z], X, Y, 0, 0, 7, 24), 'shadow', 'none')
  s.cylinder(16, 41, 6, Z, Z + 4.2)
  ring(16, 41, 6, Z + 3, 0, 'crease')
  s.poly(s.circle([16, 41, Z + 4.2], X, Y, 0, 0, 4.7, 28), 'shade', 'crease')
  s.line(
    [
      [13.2, 39.2, Z + 4.2],
      [15, 37.9, Z + 4.2],
      [18, 37.9, Z + 4.2],
    ],
    'crease',
    0.7,
  )
  s.cylinder(33, 41, 5, Z, Z + 1.8)
  s.poly(s.circle([33, 41, Z + 1.8], X, Y, 0, 0, 3.6, 24), 'none', 'crease')
  dot(33, 41, Z + 1.8, 0.7)
  return s.done()
}
