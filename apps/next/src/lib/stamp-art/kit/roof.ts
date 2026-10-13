// Roof modules: hip, gable, curved-eave, pagoda-tier, stilts.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatch,
  hline,
  quad,
  rectPts,
  stroke,
  vline,
} from '../grid'
import { type KitModule, bool, num, nums, weight } from './util'

/** Hipped roof in elevation: trapezoid with a ridge, eave line and roof courses. */
export const hip: KitModule = ([x, y, w, h], p) => {
  const ridge = w * num(p, 'ridge', 0.25)
  const lines = Math.round(num(p, 'lines', 3))
  const cx = x + w / 2
  const poly: Pt[] = [
    [x, y + h],
    [cx - ridge / 2, y],
    [cx + ridge / 2, y],
    [x + w, y + h],
  ]
  const out: SvgNode[] = body(poly, weight(p, 'weight', 'line'))
  out.push(
    stroke('bold', [
      [x - 0.5, y + h],
      [x + w + 0.5, y + h],
    ]),
  )
  for (let i = 1; i <= lines; i++) {
    const t = i / (lines + 1)
    const yy = y + h * t
    const half = (ridge + (w - ridge) * t) / 2
    out.push(hline('hair', cx - half + 1.5, cx + half - 1.5, yy))
  }
  // Shaded right slope.
  if (bool(p, 'shade', true)) {
    for (let t = 0.2; t < 0.9; t += 0.1) {
      const yy = y + h * t
      const half = (ridge + (w - ridge) * t) / 2
      out.push(vline('hair', cx + half * 0.55, yy + 0.5, Math.min(y + h - 1, yy + h * 0.1)))
    }
  }
  const fin = num(p, 'finial', 0)
  if (fin > 0)
    out.push(
      stroke('bold', [
        [cx, y],
        [cx, y - fin],
      ]),
    )
  return out
}

/**
 * Gable end of a steep roof: double barge board, plank hatch inside, eave line. With `wallH` the
 * box also holds the wall under the eave (planks, central opening).
 */
export const gable: KitModule = ([x, y, w, h], p) => {
  const wallFrac = num(p, 'wallH', 0)
  const roofH = h * (1 - wallFrac)
  const over = num(p, 'overhang', 0.1) * w
  const cx = x + w / 2
  const k = num(p, 'barge', 4.2)
  const out: SvgNode[] = []
  if (wallFrac > 0) {
    const wy = y + roofH
    const ww = w * 0.8
    out.push(...body(rectPts(cx - ww / 2, wy, ww, h - roofH), 'line'))
    out.push(
      ...hatch(
        rectPts(cx - ww / 2 + 1.5, wy + 2, ww - 3, h - roofH - 3),
        'h',
        num(p, 'planks', 3.4),
        'hair',
        0.5,
      ),
    )
    const ow = ww * 0.26,
      oh = (h - roofH) * 0.62
    out.push(...body(rectPts(cx - ow / 2, wy + (h - roofH) * 0.2, ow, oh), 'line'))
    out.push(fill(rectPts(cx - ow / 2 + 1.2, wy + (h - roofH) * 0.2 + 1.2, ow - 2.4, oh - 2.4)))
  }
  const tri: Pt[] = [
    [x, y + roofH],
    [cx, y],
    [x + w, y + roofH],
  ]
  out.push(...body(tri, 'line'))
  const slope = Math.hypot(w / 2, roofH)
  const dx = (k * slope) / roofH
  const inner: Pt[] = [
    [x + dx + 0.5, y + roofH - k * 0.6],
    [cx, y + k * (slope / (w / 2)) * 0.95 + 1],
    [x + w - dx - 0.5, y + roofH - k * 0.6],
  ]
  out.push(stroke('line', inner, true))
  out.push(...hatch(inner, 'v', num(p, 'slats', 3.4), 'hair', 1.2))
  out.push(
    stroke('bold', [
      [x - over, y + roofH],
      [x + w + over, y + roofH],
    ]),
  )
  return out
}

/**
 * Roof with upturned corners seen from the front. The ridge is a short flat line; each side sweeps
 * down in a concave curve and lifts at the tip; the eave band has a thick lower edge.
 */
export const curvedEave: KitModule = ([x, y, w, h], p) => {
  const ridge = w * num(p, 'ridge', 0.36)
  const lift = num(p, 'lift', 0.3) // how far the tips sit above the eave line (fraction of h)
  const thick = h * num(p, 'thick', 0.2)
  const rows = Math.round(num(p, 'rows', 3))
  const cx = x + w / 2
  const tipY = y + h * (1 - lift)
  const eY = y + h
  const rl: Pt = [cx - ridge / 2, y]
  const rr: Pt = [cx + ridge / 2, y]
  // Left top edge, ridge to tip.
  const leftTop = quad(rl, [x + w * 0.2, y + h * 0.6], [x, tipY], 12)
  const leftBottom = quad([x, tipY + 1], [x + w * 0.1, eY], [x + w * 0.3, eY], 8)
  const rightTop = leftTop.map(([px, py]) => [2 * cx - px, py] as Pt)
  const rightBottom = leftBottom.map(([px, py]) => [2 * cx - px, py] as Pt)
  const poly: Pt[] = [...leftTop, ...leftBottom, ...rightBottom.reverse(), ...rightTop.reverse()]
  const out: SvgNode[] = body(poly, weight(p, 'weight', 'line'))
  // Eave band: the thick lower edge.
  out.push(
    stroke('line', [
      [x + w * 0.1 + 1, eY - thick - (leftBottom[2][1] - eY) * 0],
      [x + w * 0.3, eY - thick],
      [x + w * 0.7, eY - thick],
      [x + w * 0.9 - 1, eY - thick],
    ]),
  )
  out.push(
    stroke('bold', [
      [x + w * 0.3, eY],
      [x + w * 0.7, eY],
    ]),
  )
  // Tile courses between the ridge and the eave band.
  for (let i = 1; i <= rows; i++) {
    const t = i / (rows + 1)
    const yy = y + (h - thick) * t
    const half = ridge / 2 + (w / 2 - ridge / 2) * Math.pow(t, 1.4) * 0.9
    out.push(hline('hair', cx - half, cx + half, yy))
  }
  // Ridge cap.
  out.push(stroke('bold', [rl, rr]))
  if (bool(p, 'finials', false)) {
    for (const s of [-1, 1]) {
      const fx = cx + s * (ridge / 2)
      out.push(
        stroke('line', [
          [fx, y],
          [fx + s * 1.5, y - 6],
          [fx + s * -1.5, y - 8],
        ]),
      )
    }
  }
  return out
}

/**
 * A stack of walled tiers, each capped with a curved-eave roof, narrowing upward. `tiers` lists
 * relative wall widths bottom to top (default five, each narrower). `gables` marks tiers that get
 * a front gable on their roof.
 */
export const pagodaTier: KitModule = ([x, y, w, h], p) => {
  const n = Math.max(1, Math.round(num(p, 'tiers', 5)))
  const taper = num(p, 'taper', 0.13)
  const widths = nums(
    p,
    'widths',
    Array.from({ length: n }, (_, i) => 1 - taper * i * (1 + i * 0.04)),
  )
  const gables = nums(p, 'gables', [])
  const windows = Math.round(num(p, 'windows', 2))
  const cx = x + w / 2
  const roofW = num(p, 'roofW', 1.3) // roof width over the wall
  const roofRatio = num(p, 'roofRatio', 0.46) // roof height over wall height
  const unit = h / widths.reduce((sum, _, i) => sum + (1 + roofRatio) * (1 - i * 0.06), 0)
  const out: SvgNode[] = []
  let yy = y + h
  for (let i = 0; i < n; i++) {
    const wallH = unit * (1 - i * 0.06)
    const roofH = wallH * roofRatio
    const ww = (w / roofW) * widths[i]
    // Wall.
    out.push(...body(rectPts(cx - ww / 2, yy - wallH, ww, wallH), 'line'))
    const ws = Math.max(1, windows)
    for (let k = 0; k < ws && windows > 0; k++) {
      const wx = cx - ww / 2 + (ww * (k + 1)) / (ws + 1)
      const wsz = Math.min(5, ww * 0.1)
      out.push(fill(rectPts(wx - wsz / 2, yy - wallH * 0.62, wsz, wsz * 1.1)))
    }
    yy -= wallH
    // Roof.
    const rw = ww * roofW
    const gableTier = gables.includes(i)
    out.push(
      ...curvedEave([cx - rw / 2, yy - roofH, rw, roofH], {
        ridge: num(p, 'ridge', 0.34),
        lift: 0.32,
        thick: 0.24,
        rows: 2,
        finials: i === n - 1,
      }),
    )
    if (gableTier) {
      const gw = rw * 0.34
      const gh = roofH * 1.05
      const gy = yy - roofH * 0.35
      out.push(
        ...body(
          [
            [cx - gw / 2, gy],
            [cx, gy - gh],
            [cx + gw / 2, gy],
          ],
          'line',
        ),
      )
      out.push(
        ...hatch(
          [
            [cx - gw / 2 + 2, gy - 1],
            [cx, gy - gh + 3.5],
            [cx + gw / 2 - 2, gy - 1],
          ],
          'h',
          3.2,
          'hair',
        ),
      )
    }
    yy -= roofH * 0.88
  }
  return out
}

/** Posts on footings under a floor beam, with cross beams and braces. */
export const stilts: KitModule = ([x, y, w, h], p) => {
  const count = Math.max(2, Math.round(num(p, 'count', 4)))
  const postW = num(p, 'postW', 4.4)
  const braces = bool(p, 'braces', true)
  const out: SvgNode[] = []
  const xs = Array.from(
    { length: count },
    (_, i) => x + postW / 2 + ((w - postW) * i) / (count - 1),
  )
  // Footings and posts.
  for (const px of xs) {
    out.push(...body(rectPts(px - postW / 2, y, postW, h), 'line'))
    out.push(
      ...body(
        [
          [px - postW * 0.95, y + h],
          [px - postW * 0.6, y + h - 2.6],
          [px + postW * 0.6, y + h - 2.6],
          [px + postW * 0.95, y + h],
        ],
        'line',
      ),
    )
  }
  // Cross beam and braces.
  const beamY = y + h * num(p, 'beam', 0.5)
  out.push(...body(rectPts(xs[0], beamY, xs[xs.length - 1] - xs[0], 3), 'line'))
  if (braces) {
    for (let i = 0; i + 1 < xs.length; i++) {
      out.push(
        stroke('hair', [
          [xs[i] + postW / 2, y + h - 3],
          [xs[i + 1] - postW / 2, beamY + 3],
        ]),
      )
    }
  }
  // Floor beam.
  out.push(
    stroke('bold', [
      [x - 1.5, y],
      [x + w + 1.5, y],
    ]),
  )
  return out
}
