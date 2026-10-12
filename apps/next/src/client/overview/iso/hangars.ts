import { X, Zd, flat, flatText, onPlan } from './flat'
import { Scene, type IsoFigureData, type P3, type Pt } from './scene'

export type Shed = {
  /** Identifier-safe (letters, digits, hyphen): it names the shed's parts and its `--lit-<key>` variable. */
  key: string
  /** Painted over the door, as given: the caller localizes and upper-cases. */
  name: string
  /** Share of flights, 0–1. */
  share: number
}

/** Floor area per unit of share, so the approved 59 / 31 / 10 split draws 60 / 44 / 24 wide. */
const AREA_PER_SHARE = 6305,
  GAP = 8,
  G = 2

/** Plan and height of the shed that carries `share` of the flights: floor area proportional to the share, almost square, the roof rising with the span. Widths are whole even units. */
export function shedSize(share: number) {
  const area = Math.max(0, share) * AREA_PER_SHARE,
    w = Math.max(14, 2 * Math.round((Math.sqrt(area + 1) - 1) / 2))
  return { w, d: w + 2, h: Math.round(13 + ((w - 24) * 17) / 36) }
}

/**
 * Makers: arched hangars on an apron, floor area by share of flights; the lit one has coral doors, name and stand marking.
 * `sheds` run largest first (one to three).
 * Geometry never depends on `lit`. Every shed draws its lighting twice, as sibling parts `shed-<key>-unlit` and `shed-<key>-lit`, layered by an inline opacity that reads `var(--lit-<key>, 0|1)`, the fallback being `lit`. A caller moves the light with a CSS opacity transition and either a new `lit` or `--lit-<key>` on the svg or a parent; no geometry is rebuilt. Nothing moves.
 */
export function hangars(
  k: number,
  {
    sheds,
    lit,
    shareLabel,
  }: { sheds: readonly Shed[]; lit: string | null; shareLabel: (share: number) => string },
): IsoFigureData {
  const s = new Scene(k)
  const plan = sheds.map((shed) => ({ ...shed, ...shedSize(shed.share) }))
  const FY = Math.max(...plan.map((p) => p.d)) + 4,
    TAXI = FY + 32
  let end = 0
  const placed = plan.map((p, i) => {
    const x0 = i === 0 ? 0 : end + GAP
    end = x0 + p.w
    return { ...p, x0 }
  })
  s.poly(
    flat(
      [
        [-12, 0],
        [end + 18, 0],
        [end + 18, TAXI + 10],
        [-12, TAXI + 10],
      ],
      0,
    ),
    'shadow',
    'none',
  )
  s.rbox(-10, 0, 0, end + 26, TAXI + 8, G, 3, { top: 'front' })
  s.line(
    [
      [-6, TAXI, G],
      [end + 12, TAXI, G],
    ],
    'detail',
    1,
    '4 3',
  )
  for (const { key, name, share, x0, w, d, h } of placed) {
    const wall = h * 0.28,
      y0 = FY - d,
      cx = x0 + w / 2
    const arc = (inset: number): Pt[] =>
      Array.from({ length: 25 }, (_, j) => {
        const a = (j / 24) * Math.PI
        return [cx + (w / 2 - inset) * Math.cos(a), G + wall + (h - wall - inset) * Math.sin(a)]
      })
    // Contact shadow, then the shed.
    s.poly(
      flat(
        [
          [x0 + 2, y0 + 2],
          [x0 + w + 3.5, y0 + 2],
          [x0 + w + 3.5, FY + 2.5],
          [x0 + 2, FY + 2.5],
        ],
        G,
      ),
      'shadow',
      'none',
    )
    s.prism([[x0 + w, G], ...arc(0), [x0, G]], y0, d)
    for (let yy = y0 + 7; yy < FY - 3; yy += 8)
      s.line(
        arc(0)
          .filter((_, j) => j <= 14)
          .map(([x, z]) => [x, yy, z] as P3),
        'detail',
        0.6,
      )
    // Windows along the lit side wall, where it is tall enough for them.
    if (wall > 5)
      for (let yy = y0 + 5; yy + 5 < FY - 3; yy += 8)
        s.poly(
          [
            [x0 + w, yy, G + wall * 0.8],
            [x0 + w, yy + 5, G + wall * 0.8],
            [x0 + w, yy + 5, G + wall * 0.35],
            [x0 + w, yy, G + wall * 0.35],
          ],
          'glass',
          'detail',
          undefined,
          0.6,
        )
    const front = (pts: readonly Pt[]) => pts.map(([x, z]) => [x, FY, z] as P3)
    s.line(
      front([[x0 + 1.6, G], ...arc(1.6).reverse(), [x0 + w - 1.6, G]]).reverse(),
      'detail',
      0.6,
    )
    // Doors: four leaves under a track, the name painted on the arch above.
    const dz = G + wall + (h - wall) * (h < 15 ? 0.22 : 0.42),
      dl = x0 + w * 0.12,
      dr = x0 + w * 0.88
    const door = front([
      [dl, dz],
      [dr, dz],
      [dr, G],
      [dl, G],
    ])
    // Long names shrink to the arch instead of running off the door.
    const size = Math.min(Math.max(3.8, w / 9.5), (w * 0.8) / (Math.max(1, name.length) * 0.62))
    const ss = Math.max(5, w / 7),
      standAt = FY + 6 + ss * 0.6,
      label = shareLabel(share)
    // The rail over the door and the stand's lead-in lines read the same lit or not.
    s.line(
      front([
        [x0 + w * 0.08, dz + 1.2],
        [x0 + w * 0.92, dz + 1.2],
      ]),
      'line',
      0.9,
    )
    s.line(
      [
        [cx, FY + 2, G],
        [cx, FY + 5, G],
      ],
      'detail',
      0.9,
    )
    s.line(
      [
        [cx, FY + 8 + ss * 1.2, G],
        [cx, TAXI - 1, G],
      ],
      'detail',
      0.9,
    )
    // The lighting: door, its seams, the painted name, and the share on the stand.
    const lighting = (hot: boolean) => {
      if (hot) s.glow(4, () => s.poly(door, 'accent', 'none'))
      s.poly(door, hot ? 'accent' : 'glass', hot ? 'accent' : 'line')
      s.segs(
        [0.31, 0.5, 0.69].map((q) =>
          front([
            [x0 + w * q, dz - 0.6],
            [x0 + w * q, G + 0.4],
          ]),
        ),
        hot ? 'accent-side' : 'detail',
        0.7,
      )
      s.text(name, [cx, FY, dz + (h < 15 ? 2 : 2.6)], X, Zd, {
        size,
        fill: hot ? 'accent' : 'ink',
        weight: 700,
        mono: true,
        anchor: 'middle',
      })
      flatText(s, onPlan, 0, label, cx, standAt, G, {
        size: ss,
        fill: hot ? 'accent' : 'muted',
        weight: 700,
      })
    }
    const on = `var(--lit-${key}, ${lit === key ? 1 : 0})`
    s.group(`shed-${key}-unlit`, () => lighting(false), { vars: { opacity: `calc(1 - ${on})` } })
    s.group(`shed-${key}-lit`, () => lighting(true), { vars: { opacity: on } })
  }
  return s.done()
}
