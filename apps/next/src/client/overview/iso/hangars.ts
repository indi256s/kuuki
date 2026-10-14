import { X, Y, Zd, flat, flatText, onPlan } from './flat'
import { Scene, labelSize, type IsoFigureData, type P3, type Pt } from './scene'

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
  G = 2,
  /** Narrowest shed drawn: a share this small is printed as "<N%" instead of drawing a lie. */
  MIN_W = 6

/** Plan and height of the shed that carries `share` of the flights: floor area proportional to the share, almost square, the roof rising with the span. Widths are whole even units; `floor` marks a shed held at the minimum width, whose true share is smaller than it looks. */
export function shedSize(share: number) {
  const area = Math.max(0, share) * AREA_PER_SHARE,
    raw = 2 * Math.round((Math.sqrt(area + 1) - 1) / 2),
    w = Math.max(MIN_W, raw)
  return { w, d: w + 2, h: Math.round(13 + ((w - 24) * 17) / 36), floor: raw <= MIN_W }
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
  const PX0 = -10,
    PX1 = end + 16,
    PY1 = TAXI + 8
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
  s.rbox(PX0, 0, 0, end + 26, PY1, G, 3, { top: 'front' })
  // Expansion joints in the gaps between sheds, and the painted guide line: both run edge to edge of the apron plate.
  for (const { x0 } of placed.slice(1))
    s.line(
      [
        [x0 - GAP / 2, 0, G],
        [x0 - GAP / 2, PY1, G],
      ],
      'crease',
      0.7,
    )
  s.line(
    [
      [PX0, TAXI, G],
      [PX1, TAXI, G],
    ],
    'detail',
    1,
    '4 3',
  )
  // Corner screws, each with its slot.
  for (const [sx, sy] of [
    [PX0 + 2.2, 2.2],
    [PX1 - 2.2, 2.2],
    [PX0 + 2.2, PY1 - 2.2],
    [PX1 - 2.2, PY1 - 2.2],
  ] as const) {
    s.poly(s.circle([sx, sy, G], X, Y, 0, 0, 0.7, 10), 'shade', 'detail', undefined, 0.5)
    s.line(
      [
        [sx - 0.5, sy + 0.5, G],
        [sx + 0.5, sy - 0.5, G],
      ],
      'detail',
      0.5,
    )
  }
  // Tie-down rings along the front of the apron, between the guide line and the plate's edge.
  for (let rx = PX0 + 8; rx < PX1 - 6; rx += 16) {
    s.poly(s.circle([rx, TAXI + 4.4, G], X, Y, 0, 0, 1.1, 12), 'shade', 'crease', undefined, 0.8)
    s.poly(s.circle([rx, TAXI + 4.4, G], X, Y, 0, 0, 0.4, 8), 'detail', 'none')
  }
  for (const { key, name, share, x0, w, d, h, floor } of placed) {
    const wall = h * 0.28,
      y0 = FY - d,
      cx = x0 + w / 2
    const arc = (inset: number, to = Math.PI): Pt[] =>
      Array.from({ length: 25 }, (_, j) => {
        const a = (j / 24) * to
        return [cx + (w / 2 - inset) * Math.cos(a), G + wall + (h - wall - inset) * Math.sin(a)]
      })
    // Height of the roof arch above the plan at `u` from the shed's centre line.
    const archZ = (u: number) =>
      G + wall + (h - wall) * Math.sqrt(Math.max(0, 1 - ((2 * u) / w) ** 2))
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
    // The wall meets the roof along an eave crease; the ribs start on it and run up over the roof to its far silhouette.
    s.line(
      [
        [x0 + w, y0, G + wall],
        [x0 + w, FY, G + wall],
      ],
      'crease',
      0.7,
    )
    const sil = Math.PI - Math.atan((h - wall) / (w / 2)),
      ribs = arc(0, sil)
    for (let yy = y0 + 7; yy < FY - 3; yy += 8)
      s.line(
        ribs.map(([x, z]) => [x, yy, z] as P3),
        'detail',
        0.6,
      )
    // The personnel door in the side wall near the front, and the windows between it and the back.
    const pdh = Math.min(wall * 0.8, 5.5),
      pdw = pdh * 0.7,
      pdy = FY - 4 - pdw,
      sideDoor = wall >= 3
    if (wall > 5)
      for (let yy = y0 + 5; yy + 5 < (sideDoor ? pdy - 2 : FY - 3); yy += 8)
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
    if (sideDoor) {
      s.poly(
        [
          [x0 + w, pdy, G + pdh],
          [x0 + w, pdy + pdw, G + pdh],
          [x0 + w, pdy + pdw, G],
          [x0 + w, pdy, G],
        ],
        'front',
        'line',
        undefined,
        0.7,
      )
      s.poly(
        [
          [x0 + w, pdy + pdw * 0.7, G + pdh * 0.5 + 0.35],
          [x0 + w, pdy + pdw * 0.85, G + pdh * 0.5 + 0.35],
          [x0 + w, pdy + pdw * 0.85, G + pdh * 0.5 - 0.35],
          [x0 + w, pdy + pdw * 0.7, G + pdh * 0.5 - 0.35],
        ],
        'line',
        'none',
      )
    }
    // Ridge vent along the crown: a base and a wider cap.
    if (w >= 14) {
      const vy = y0 + 5,
        vd = d - 10
      s.box(cx - 0.8, vy, G + h - 0.4, 1.6, vd, 1, { top: 'top', front: 'front', side: 'side' })
      s.box(cx - 1.3, vy - 0.4, G + h + 0.6, 2.6, vd + 0.8, 0.4, {
        top: 'top',
        front: 'front',
        side: 'side',
      })
    }
    const front = (pts: readonly Pt[]) => pts.map(([x, z]) => [x, FY, z] as P3)
    s.line(
      front([[x0 + 1.6, G], ...arc(1.6).reverse(), [x0 + w - 1.6, G]]).reverse(),
      'detail',
      0.6,
    )
    // Doors: four leaves under a track, the name on a plate above it. The plate keeps its text at the 6 px floor, so it takes the room it needs or the shed goes without a name (its share stays on the apron).
    const wanted = Math.min(Math.max(3.8, w / 9.5), (w * 0.8) / (Math.max(1, name.length) * 0.62)),
      size = labelSize(wanted, s.k),
      tw = Math.max(1, name.length) * 0.64 * size + 2.4,
      th = size * 0.72 + 1.8,
      dz0 = G + wall + (h - wall) * (h < 15 ? 0.22 : 0.42),
      dz = Math.min(dz0, archZ(tw / 2) - 0.8 - th - 1.8),
      plated = tw <= w - 3 && dz >= G + 5
    const doorZ = plated ? dz : dz0,
      dl = x0 + w * 0.12,
      dr = x0 + w * 0.88
    const door = front([
      [dl, doorZ],
      [dr, doorZ],
      [dr, G],
      [dl, G],
    ])
    const ss = Math.max(5, w / 7),
      standAt = FY + 6 + ss * 0.6,
      label = floor ? `<${shareLabel(0.01)}` : shareLabel(share)
    // The rail over the door and the stand's lead-in lines read the same lit or not.
    s.line(
      front([
        [x0 + w * 0.08, doorZ + 1.2],
        [x0 + w * 0.92, doorZ + 1.2],
      ]),
      'line',
      0.9,
    )
    // Door track on the apron: two rails with sleepers between them, running a little past the walls.
    for (const ry of [FY + 0.6, FY + 2.4])
      s.box(x0 - 2, ry, G, w + 4, 0.8, 0.5, { top: 'top', front: 'front', side: 'side' })
    s.segs(
      Array.from({ length: Math.floor((w + 2) / 4) + 1 }, (_, j) => [
        [x0 - 1 + j * 4, FY + 1.4, G] as P3,
        [x0 - 1 + j * 4, FY + 2.4, G] as P3,
      ]),
      'crease',
      0.6,
    )
    s.line(
      [
        [cx, FY + 3.2, G],
        [cx, FY + 5, G],
      ],
      'detail',
      0.9,
    )
    s.line(
      [
        [cx, FY + 8 + ss * 1.2, G],
        [cx, TAXI, G],
      ],
      'detail',
      0.9,
    )
    // The lighting: door, its seams, the name plate, and the share on the stand.
    const lighting = (hot: boolean) => {
      if (hot) s.glow(4, () => s.poly(door, 'accent', 'none'))
      s.poly(door, hot ? 'accent' : 'glass', hot ? 'accent' : 'line')
      s.segs(
        [0.31, 0.5, 0.69].map((q) =>
          front([
            [x0 + w * q, doorZ - 0.6],
            [x0 + w * q, G + 0.4],
          ]),
        ),
        hot ? 'accent-side' : 'detail',
        0.7,
      )
      if (plated) {
        const zb = doorZ + 1.8
        s.poly(
          front([
            [cx - tw / 2, zb + th],
            [cx + tw / 2, zb + th],
            [cx + tw / 2, zb],
            [cx - tw / 2, zb],
          ]),
          hot ? 'accent-plate' : 'front',
          hot ? 'accent' : 'crease',
          undefined,
          0.7,
        )
        s.text(name, [cx, FY, zb + 0.9], X, Zd, {
          size,
          fill: hot ? 'on-accent' : 'ink',
          weight: 700,
          mono: true,
          anchor: 'middle',
        })
      }
      flatText(s, onPlan, 0, label, cx, standAt, G, {
        size: ss,
        fill: hot ? 'accent' : 'muted',
        weight: 700,
      })
    }
    const on = `var(--lit-${key}, ${lit === key ? 1 : 0})`
    s.group(`shed-${key}-unlit`, () => lighting(false), { vars: { opacity: `calc(1 - ${on})` } })
    // A shed is a maker, so its lit parts take that maker's colour (the chart's), not the accent.
    s.group(`shed-${key}-lit`, () => lighting(true), {
      vars: { opacity: on, '--figure-live-fill': `var(--cat-maker-${key})` },
    })
  }
  // Two light poles on the apron's flanks, each with a shadow thrown toward the front.
  for (const px of [PX0 + 4, PX1 - 4]) {
    const py = FY + 10
    s.poly(
      flat(
        [
          [px - 0.5, py],
          [px + 0.5, py],
          [px + 3.5, py + 9],
          [px + 2.5, py + 9],
        ],
        G,
      ),
      'shadow',
      'none',
    )
    s.box(px - 1, py - 1, G, 2, 2, 0.8, { top: 'top', front: 'front', side: 'side' })
    s.box(px - 0.45, py - 0.45, G + 0.8, 0.9, 0.9, 13, { top: 'top', front: 'front', side: 'side' })
    s.box(px - 0.6, py - 1.1, G + 12.8, 3.4, 2.2, 1, { top: 'top', front: 'glass', side: 'side' })
  }
  return s.done()
}
