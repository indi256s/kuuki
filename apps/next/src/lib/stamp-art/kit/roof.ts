// Roof modules: hip, gable, curved-eave, pagoda-tier, stilts.
import {
  type Pt,
  type SvgNode,
  body,
  cubic,
  fill,
  hatch,
  hline,
  quad,
  rectPts,
  stroke,
  toneFill,
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
 * A castle keep: a stack of lit walls, each under a thin T4 hip-roof band whose tips lift `lift`
 * units. The box is the widest roof (tier 1) by the whole stack height. `widths` are the wall widths
 * bottom to top relative to tier 1 (1, .86, .72, .6, .46), `chidori` lists tiers (0-based) that get
 * a triangular gable on their roof, `kara` tiers that get a curved gable, `nubs` adds the small
 * ridge ornaments on the top roof. Tiers share the height in proportion to `heights`.
 */
export const pagodaTier: KitModule = ([x, y, w, h], p) => {
  const widths = nums(p, 'widths', [1, 0.86, 0.72, 0.6, 0.46])
  const heights = nums(
    p,
    'heights',
    widths.map(() => 1),
  )
  const chidori = nums(p, 'chidori', [])
  const kara = nums(p, 'kara', [])
  const pairs = nums(p, 'pairs', [])
  const windows = nums(
    p,
    'windows',
    widths.map((_, i) => (i < 2 ? 3 : i < widths.length - 1 ? 2 : 1)),
  )
  const wallFrac = num(p, 'wall', 0.7)
  const roofOver = num(p, 'roofW', 1.22)
  const lift = num(p, 'lift', 2)
  const cx = x + w / 2
  const unit = h / heights.reduce((a, b) => a + b, 0)
  const out: SvgNode[] = []
  // Gables sit on the roofs but rise in front of the wall above, so they are drawn last.
  const front: SvgNode[] = []
  let yb = y + h
  widths.forEach((rel, i) => {
    const tierH = unit * heights[i % heights.length]
    const wallH = tierH * wallFrac
    const roofH = tierH - wallH
    const ww = (w / roofOver) * rel
    const rw = ww * roofOver
    const yw = yb - wallH // eave line, top of the wall
    out.push(...body(rectPts(cx - ww / 2, yw, ww, wallH), 'line'))
    const wn = windows[i % windows.length]
    for (let k = 0; k < wn; k++) {
      const wx = cx - ww / 2 + (ww * (k + 1)) / (wn + 1)
      out.push(fill(rectPts(wx - 1.1, yb - wallH * 0.74, 2.2, Math.min(3.4, wallH * 0.46))))
    }
    // Roof band: thin, tips lifted, T4.
    const band: Pt[] = [
      [cx - rw / 2, yw - lift],
      [cx - rw * 0.35, yw - roofH],
      [cx + rw * 0.35, yw - roofH],
      [cx + rw / 2, yw - lift],
      [cx + rw * 0.4, yw + 0.4],
      [cx - rw * 0.4, yw + 0.4],
    ]
    out.push(...body(band, 'hair'))
    out.push(...toneFill(band, 'T4', { inset: 1.2 }))
    const gw = rw * 0.26
    const gh = roofH + 2.4
    const gableAt = (gx: number) =>
      front.push(
        ...body(
          [
            [gx - gw / 2, yw - roofH * 0.1],
            [gx, yw - gh],
            [gx + gw / 2, yw - roofH * 0.1],
          ],
          'line',
        ),
      )
    if (chidori.includes(i)) gableAt(cx)
    if (pairs.includes(i)) for (const s of [-1, 1]) gableAt(cx + s * rw * 0.24)
    if (kara.includes(i)) {
      const kw = rw * 0.34,
        kh = roofH + 3.6
      const left = cubic(
        [cx - kw / 2, yw - roofH * 0.1],
        [cx - kw * 0.3, yw - kh * 0.15],
        [cx - kw * 0.1, yw - kh * 0.6],
        [cx, yw - kh],
        10,
      )
      const bell: Pt[] = [...left, ...left.map(([px, py]) => [2 * cx - px, py] as Pt).reverse()]
      front.push(...body(bell, 'line'))
    }
    if (i === widths.length - 1 && p.nubs !== false) {
      for (const s of [-1, 1]) {
        const nx = cx + s * rw * 0.35
        out.push(
          fill([
            [nx - 1.3, yw - roofH],
            [nx - 1.1 + s * 0.8, yw - roofH - 2.6],
            [nx + 1.1 + s * 0.8, yw - roofH - 2.6],
            [nx + 1.3, yw - roofH],
          ]),
        )
      }
    }
    yb = yw - roofH
  })
  return [...out, ...front]
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
