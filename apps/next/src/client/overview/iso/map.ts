import { Scene, type P3, type Pt } from './scene'

// The sheet folds like an accordion: fold lines at X, each at height Z.
const X = [0, 46, 92, 138, 184],
  Z = [0, 13, 1, 13, 0],
  D = 84
/** How far each fold line sinks when the map unfolds a little on hover, in iso units. */
export const UNFOLD = [0, 5, 0, 5, 0]
const A = [30, 40] as const,
  B = [158, 52] as const
// Screen-space dash pattern of the route, in px, at every scale.
const DASH = 3,
  GAP = 3

const panelOf = (x: number) => Math.min(3, Math.max(0, X.findIndex((x1) => x <= x1) - 1))
const lerp = (a: number[], i: number, x: number) =>
  a[i] + ((x - X[i]) / (X[i + 1] - X[i])) * (a[i + 1] - a[i])
const zAt = (x: number) => lerp(Z, panelOf(x), x)
const sinkAt = (x: number) => lerp(UNFOLD, panelOf(x), x)

/** Splits a 3D polyline where it crosses a fold line, so each piece lies on one panel. */
function byPanel(pts: readonly P3[]): { panel: number; pts: P3[] }[] {
  const out: { panel: number; pts: P3[] }[] = []
  let piece: P3[] = [pts[0]],
    panel = panelOf(pts[0][0])
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const next = panelOf(b[0])
    if (next !== panel) {
      const fx = X[Math.max(panel, next)]
      const f = (fx - a[0]) / (b[0] - a[0])
      const cut: P3 = [fx, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
      piece.push(cut)
      out.push({ panel, pts: piece })
      piece = [cut]
      panel = next
    }
    piece.push(b)
  }
  out.push({ panel, pts: piece })
  return out.filter((p) => p.pts.length > 1)
}

/**
 * Records: a folded map with the longest flight pinned to it, `from` → `to`; `equator` draws the line the flight crosses.
 * Parts: `fold` (one per panel and layer; carries --fold-y/--fold-s/--fold-k, the screen transform that flattens that panel by UNFOLD), `dash` (a lit copy of one route dash; --t is its place along the route, 0 at `from`) and `pin` (carries --lift-y).
 */
export function foldedMap(from: string, to: string, k = 1, equator = false) {
  const s = new Scene(k)
  // Lowering fold heights shears each panel along z linearly in x; projected, that is one 2D affine map per panel, solved from three of its corners.
  const fold = (i: number) => {
    const corners: P3[] = [
      [X[i], 0, Z[i]],
      [X[i + 1], 0, Z[i + 1]],
      [X[i], D, Z[i]],
    ]
    const src = corners.map((p) => s.project(p)),
      dst = corners.map(([x, y, z]) => s.project([x, y, z - sinkAt(x)]))
    // x stays put, y' = b·x + d·y + f.
    const [[x0, y0], [x1, y1], [x2, y2]] = src
    const det = x0 * (y1 - y2) - y0 * (x1 - x2) + (x1 * y2 - x2 * y1)
    const [v0, v1, v2] = dst.map((p) => p[1])
    const b = (v0 * (y1 - y2) - y0 * (v1 - v2) + (v1 * y2 - v2 * y1)) / det,
      d = (x0 * (v1 - v2) - v0 * (x1 - x2) + (x1 * v2 - x2 * v1)) / det,
      f = (x0 * (y1 * v2 - y2 * v1) - y0 * (x1 * v2 - x2 * v1) + v0 * (x1 * y2 - x2 * y1)) / det
    return {
      '--fold-y': `${r3(f)}px`,
      '--fold-s': `${r3(d)}`,
      '--fold-k': `${r3((Math.atan(b / d) * 180) / Math.PI)}deg`,
    }
  }
  const folds = [0, 1, 2, 3].map(fold)

  for (let i = 0; i < 4; i++)
    s.group(
      'fold',
      () => {
        const up = Z[i + 1] > Z[i]
        s.poly(
          [
            [X[i], D, Z[i]],
            [X[i + 1], D, Z[i + 1]],
            [X[i + 1], D, Z[i + 1] - 2.5],
            [X[i], D, Z[i] - 2.5],
          ],
          'side',
        )
        s.poly(
          [
            [X[i], 0, Z[i]],
            [X[i + 1], 0, Z[i + 1]],
            [X[i + 1], D, Z[i + 1]],
            [X[i], D, Z[i]],
          ],
          up ? 'front' : 'top',
        )
      },
      { vars: folds[i] },
    )

  const on = (pts: readonly (readonly [number, number])[], lift: number): P3[] =>
    pts.map(([x, y]) => [x, y, zAt(x) + lift])
  const coasts = [
    [
      [8, 14],
      [24, 10],
      [40, 22],
      [58, 18],
      [70, 30],
      [64, 44],
      [78, 56],
    ],
    [
      [96, 8],
      [112, 20],
      [130, 16],
      [146, 26],
      [168, 22],
      [178, 34],
    ],
    [
      [120, 60],
      [136, 70],
      [154, 64],
      [170, 74],
    ],
  ] as const
  const coastPieces = coasts.flatMap((c) => byPanel(on(c, 0.2)))
  const equatorPieces = equator
    ? byPanel(
        on(
          X.map((x) => [x, 46] as const),
          0.2,
        ),
      )
    : []

  // The route bows north between the pins; dashes are cut in screen space so the pattern matches the design at every scale.
  const route: P3[] = []
  for (let i = 0; i <= 60; i++) {
    const u = i / 60,
      x = A[0] + (B[0] - A[0]) * u,
      y = A[1] + (B[1] - A[1]) * u - Math.sin(Math.PI * u) * 22
    route.push([x, y, zAt(x) + 0.6])
  }
  const screen = route.map((p) => s.project(p))
  const len = [0]
  for (let i = 1; i < screen.length; i++) len.push(len[i - 1] + dist(screen[i - 1], screen[i]))
  const total = len[len.length - 1]
  const at = (l: number): P3 => {
    let i = 1
    while (i < len.length - 1 && len[i] < l) i++
    const f = (l - len[i - 1]) / (len[i] - len[i - 1] || 1)
    const [a, b] = [route[i - 1], route[i]]
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
  }
  const dashes: { t: number; panel: number; pts: P3[] }[] = []
  const count = Math.floor((total + GAP) / (DASH + GAP))
  for (let j = 0; j < count; j++) {
    const l0 = j * (DASH + GAP),
      l1 = Math.min(total, l0 + DASH)
    const pts = [at(l0), ...route.filter((_, i) => len[i] > l0 && len[i] < l1), at(l1)]
    const t = count > 1 ? Math.round((j / (count - 1)) * 100) / 100 : 0
    for (const piece of byPanel(pts)) dashes.push({ t, ...piece })
  }

  const m = route[27],
    n = route[29],
    hd = Math.atan2(n[1] - m[1], n[0] - m[0])
  const glyph: P3[] = (
    [
      [4, 0],
      [1, 0.8],
      [0.2, 4.2],
      [-0.9, 4.2],
      [-0.4, 0.9],
      [-3, 0.9],
      [-3.8, 2.2],
      [-4.4, 2.2],
      [-4, 0],
      [-4.4, -2.2],
      [-3.8, -2.2],
      [-3, -0.9],
      [-0.4, -0.9],
      [-0.9, -4.2],
      [0.2, -4.2],
      [1, -0.8],
    ] as const
  ).map(([a, b]) => {
    const c = Math.cos(hd),
      q = Math.sin(hd)
    return [m[0] + (a * c - b * q) * 1.5, m[1] + (a * q + b * c) * 1.5, m[2] + 2]
  })

  // Everything lying on a panel rides that panel's fold; drawn after all panels so a later panel never covers it.
  for (let i = 0; i < 4; i++)
    s.group(
      'fold',
      () => {
        for (const c of coastPieces.filter((p) => p.panel === i)) s.line(c.pts, 'detail', 0.9)
        for (const e of equatorPieces.filter((p) => p.panel === i))
          s.line(e.pts, 'detail', 0.9, '2 3')
        const mine = dashes.filter((d) => d.panel === i)
        if (mine.length)
          s.segs(
            mine.map((d) => d.pts),
            'ink',
            1.3,
          )
        for (const d of mine)
          s.group('dash', () => s.segs([d.pts], 'accent', 1.3), { vars: { '--t': `${d.t}` } })
        if (panelOf(m[0]) === i) s.poly(glyph, 'ink', 'ink')
      },
      { vars: folds[i] },
    )

  // Pins stand off the sheet, so they rise and sink whole instead of shearing with it.
  for (const [[x, y], code] of [
    [A, from],
    [B, to],
  ] as const) {
    const z = zAt(x) + 0.3
    const [, liftY] = s.vector(0, 0, -sinkAt(x))
    s.group(
      'pin',
      () => {
        s.lit(s.circle([x, y, z], [1, 0, 0], [0, 1, 0], 0, 0, 3.4, 20), 4)
        s.line(
          [
            [x, y, z],
            [x, y, z + 30],
          ],
          'accent',
          1.4,
        )
        s.glow(4, () =>
          s.poly(
            [
              [x - 3, y - 3, z + 36],
              [x + 3, y - 3, z + 36],
              [x + 3, y + 3, z + 36],
              [x - 3, y + 3, z + 36],
            ],
            'accent',
            'none',
          ),
        )
        s.box(x - 3, y - 3, z + 29, 6, 6, 7, {
          top: 'accent',
          front: 'accent',
          side: 'accent',
          stroke: 'accent',
        })
        s.screenText(code, [x + 3, y - 3, z + 33], {
          dx: 6,
          dy: 3.5,
          size: 10,
          fill: 'muted',
          anchor: 'start',
        })
      },
      { vars: { '--lift-y': `${liftY}px` } },
    )
  }
  return s.done()
}

const r3 = (n: number) => Math.round(n * 1000) / 1000
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
