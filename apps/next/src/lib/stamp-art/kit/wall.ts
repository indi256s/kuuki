// Wall modules: fortress-wall, tower, colonnade, pediment, triumphal-arch.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hatch,
  hline,
  occlude,
  rectPts,
  stroke,
  vline,
} from '../grid'
import { hip } from './roof'
import { type KitModule, bool, num, str, weight } from './util'

/** Stone courses with staggered joints inside a rectangle (hair weight). */
export function masonry(
  x: number,
  y: number,
  w: number,
  h: number,
  courses: number,
  joint: number,
): SvgNode[] {
  const out: SvgNode[] = []
  for (let i = 1; i < courses; i++) {
    const yy = y + (h * i) / courses
    out.push(hline('hair', x + 0.8, x + w - 0.8, yy))
    if (joint > 0) {
      const off = i % 2 ? 0 : joint / 2
      for (let jx = x + off + joint; jx < x + w - 1.5; jx += joint) {
        out.push(vline('hair', jx, yy, yy + h / courses))
      }
    }
  }
  return out
}

/** Crenellated wall: merlons on top, stone courses, optional slit windows. */
export const fortressWall: KitModule = ([x, y, w, h], p) => {
  const merlons = Math.max(2, Math.round(num(p, 'merlons', 7)))
  const mh = h * num(p, 'merlonH', 0.2)
  const out: SvgNode[] = []
  const pitch = w / merlons
  const poly: Pt[] = [[x, y + h]]
  for (let i = 0; i < merlons; i++) {
    const a = x + pitch * i
    poly.push([a, y], [a + pitch * 0.58, y], [a + pitch * 0.58, y + mh], [a + pitch, y + mh])
  }
  poly.push([x + w, y + mh], [x + w, y + h])
  out.push(...body(poly, weight(p, 'weight', 'line')))
  out.push(
    stroke('bold', [
      [x, y + h],
      [x + w, y + h],
    ]),
  )
  out.push(...masonry(x, y + mh, w, h - mh, Math.round(num(p, 'courses', 3)), num(p, 'joints', 0)))
  const slits = Math.round(num(p, 'slits', 0))
  for (let i = 0; i < slits; i++) {
    const sx = x + (w * (i + 0.5)) / slits
    out.push(fill(rectPts(sx - 1.1, y + mh + (h - mh) * 0.25, 2.2, (h - mh) * 0.4)))
  }
  return out
}

/** Square tower in elevation: tapered shaft, courses, openings, optional hipped or battlement cap. */
export const tower: KitModule = ([x, y, w, h], p) => {
  const cap = str(p, 'cap', ['none', 'hip', 'battle'] as const, 'none')
  const capH = h * num(p, 'capH', cap === 'none' ? 0 : 0.26)
  const taper = num(p, 'taper', 0.05)
  const over = num(p, 'overhang', 0.12)
  const wt = weight(p, 'weight', 'line')
  const shaftTop = y + capH
  const shaftH = h - capH
  const sw = w / (1 + (cap === 'none' ? 0 : over * 2))
  const sx = x + (w - sw) / 2
  const tp = sw * taper
  const poly: Pt[] = [
    [sx + tp, shaftTop],
    [sx + sw - tp, shaftTop],
    [sx + sw, y + h],
    [sx, y + h],
  ]
  const out: SvgNode[] = [
    occlude(poly),
    stroke(wt, poly, true),
    stroke('bold', [
      [sx, y + h],
      [sx + sw, y + h],
    ]),
  ]
  const courses = Math.round(num(p, 'courses', 0))
  out.push(...masonry(sx + tp * 0.5, shaftTop, sw - tp, shaftH, courses, num(p, 'joints', 0)))
  // Shaded face: tapering vertical hatch on the right.
  if (bool(p, 'shade', true)) {
    const gap = 2.8
    for (let xx = sx + sw - 3; xx > sx + sw * 0.62; xx -= gap) {
      const t = (sx + sw - xx) / (sw * 0.38)
      out.push(
        vline('hair', xx, shaftTop + shaftH * (0.14 + 0.2 * t), y + h - 1.5 - shaftH * 0.1 * t),
      )
    }
  }
  // Openings.
  const rows = str(p, 'openings', ['none', 'slits', 'loggia', 'both'] as const, 'slits')
  if (rows === 'slits' || rows === 'both') {
    const n = Math.max(1, Math.round(num(p, 'slitRows', 2)))
    for (let i = 0; i < n; i++) {
      const yy = shaftTop + shaftH * (0.42 + (0.4 * i) / Math.max(1, n))
      out.push(fill(rectPts(sx + sw * 0.32, yy, sw * 0.12, Math.min(7, shaftH * 0.1))))
    }
  }
  if (rows === 'loggia' || rows === 'both') {
    const n = Math.max(1, Math.round(num(p, 'loggia', 3)))
    const lh = Math.min(shaftH * 0.12, 7)
    const ly = shaftTop + shaftH * 0.1
    const lw = sw * 0.16
    const gap = (sw - tp * 2 - n * lw) / (n + 1)
    for (let i = 0; i < n; i++) {
      out.push(fill(rectPts(sx + tp + gap * (i + 1) + lw * i, ly, lw, lh)))
    }
  }
  if (cap === 'hip') {
    out.push(
      ...hip([x, y, w, capH], {
        ridge: num(p, 'ridge', 0.22),
        lines: Math.round(num(p, 'capLines', 3)),
      }),
    )
  } else if (cap === 'battle') {
    out.push(
      ...fortressWall([x, y, w, capH], {
        merlons: Math.round(num(p, 'merlons', 4)),
        merlonH: 0.45,
        courses: 1,
      }),
    )
  }
  return out
}

/** Row of columns on a stylobate, with optional capitals, bases and an entablature. */
export const colonnade: KitModule = ([x, y, w, h], p) => {
  const count = Math.max(2, Math.round(num(p, 'count', 6)))
  const order = str(p, 'order', ['doric', 'ionic', 'plain'] as const, 'doric')
  const center = num(p, 'centerBay', 1)
  const colW = num(p, 'colW', 0.42) // shaft width as a fraction of column pitch
  const entH = h * num(p, 'entablature', 0)
  const stylo = Math.round(num(p, 'stylobate', 0))
  const styloH = stylo * 3
  const taper = num(p, 'taper', 0.1)
  const flutes = Math.round(num(p, 'flutes', 1))
  const out: SvgNode[] = []
  // Bay weights between columns: the middle bay may be wider.
  const bays = count - 1
  const weights = Array.from({ length: bays }, (_, i) =>
    bays % 2 === 1 && i === (bays - 1) / 2 ? center : 1,
  )
  const margin = num(p, 'margin', 0.5)
  const total = weights.reduce((a, b) => a + b, 0) + margin * 2
  const unit = w / total
  const xs: number[] = [x + unit * margin]
  weights.forEach((wt, i) => xs.push(xs[i] + unit * wt))
  const pitch = unit
  const cw = pitch * colW
  const capH = order === 'plain' ? 0 : Math.max(3, cw * 0.38)
  const top = y + entH
  const bottom = y + h - styloH
  // Entablature.
  if (entH > 0) {
    const ex = xs[0] - cw * 0.9,
      ew = xs[xs.length - 1] - xs[0] + cw * 1.8
    out.push(...body(rectPts(ex, y, ew, entH), 'line'))
    out.push(hline('hair', ex, ex + ew, y + entH * 0.34))
    out.push(hline('line', ex - 1.5, ex + ew + 1.5, y))
    if (order === 'doric') {
      for (let i = 0; i < xs.length; i++) {
        const tx = xs[i]
        out.push(vline('hair', tx - 1.1, y + entH * 0.4, y + entH - 1))
        out.push(vline('hair', tx + 1.1, y + entH * 0.4, y + entH - 1))
      }
      for (let i = 0; i + 1 < xs.length; i++) {
        const tx = (xs[i] + xs[i + 1]) / 2
        out.push(vline('hair', tx - 1.1, y + entH * 0.4, y + entH - 1))
        out.push(vline('hair', tx + 1.1, y + entH * 0.4, y + entH - 1))
      }
    }
  }
  // Stylobate steps.
  for (let i = 0; i < stylo; i++) {
    const inset = (stylo - 1 - i) * 3
    const sx = xs[0] - cw * 0.9 - inset,
      sw = xs[xs.length - 1] - xs[0] + cw * 1.8 + inset * 2
    out.push(...body(rectPts(sx, bottom + i * 3, sw, 3), 'line'))
  }
  // Columns.
  for (const cx of xs) {
    const t = cw * taper
    const poly: Pt[] = [
      [cx - cw / 2 + t, top + capH],
      [cx + cw / 2 - t, top + capH],
      [cx + cw / 2, bottom],
      [cx - cw / 2, bottom],
    ]
    out.push(occlude(poly), stroke(weight(p, 'shaft', 'line'), poly, true))
    if (flutes > 0 && (order === 'doric' || order === 'ionic')) {
      out.push(vline('hair', cx + cw * 0.14, top + capH + 2, bottom - 1.5))
    }
    if (capH > 0) {
      out.push(...body(rectPts(cx - cw * 0.62, top, cw * 1.24, capH * 0.5), 'line'))
      out.push(
        stroke('line', [
          [cx - cw * 0.46, top + capH * 0.5],
          [cx + cw * 0.46, top + capH * 0.5],
          [cx + cw / 2 - t, top + capH],
        ]),
      )
    }
  }
  return out
}

/** Triangular pediment, or a flat attic block with panels when `pitch` is 0. */
export const pediment: KitModule = ([x, y, w, h], p) => {
  const pitch = num(p, 'pitch', 0.16)
  const out: SvgNode[] = []
  if (pitch > 0.005) {
    const rise = Math.min(h - 3, w * pitch)
    const apex: Pt = [x + w / 2, y + h - rise]
    const outer: Pt[] = [[x, y + h], apex, [x + w, y + h]]
    out.push(...body(outer, 'line'))
    const k = 3.6
    const inner: Pt[] = [
      [x + k * 1.6, y + h - k],
      [apex[0], apex[1] + k * 1.15],
      [x + w - k * 1.6, y + h - k],
    ]
    out.push(stroke('hair', inner, true))
    if (str(p, 'tympanum', ['hatch', 'plain'] as const, 'hatch') === 'hatch') {
      out.push(...hatch(inner, 'h', 3.4, 'hair', 1))
    }
    out.push(hline('line', x - 1.5, x + w + 1.5, y + h))
    return out
  }
  // Attic: cornice on top, plinth line, recessed panels.
  const cornH = Math.min(5, h * 0.22)
  out.push(...body(rectPts(x, y + cornH, w, h - cornH), 'line'))
  out.push(...body(rectPts(x - 1.5, y, w + 3, cornH), 'line'))
  const panels = Math.round(num(p, 'panels', 3))
  if (panels > 0) {
    const pw = w / (panels * 1.7 + 1)
    const gap = (w - pw * panels) / (panels + 1)
    for (let i = 0; i < panels; i++) {
      const px = x + gap * (i + 1) + pw * i
      out.push(stroke('hair', rectPts(px, y + cornH + 3, pw, h - cornH - 6), true))
    }
  }
  return out
}

/** Gate / arch mass with openings, entablature and attic. */
export const triumphalArch: KitModule = ([x, y, w, h], p) => {
  const bays = Math.max(1, Math.round(num(p, 'bays', 1)))
  const kind = str(p, 'opening', ['square', 'arch'] as const, 'square')
  const dark = str(p, 'dark', ['hatch', 'fill'] as const, 'hatch')
  const atticH = h * num(p, 'atticH', 0.26)
  const entH = h * num(p, 'entH', 0.14)
  const out: SvgNode[] = []
  const wallTop = y + atticH + entH
  out.push(...body(rectPts(x, wallTop, w, h - atticH - entH), 'line'))
  out.push(
    stroke('bold', [
      [x - 2, y + h],
      [x + w + 2, y + h],
    ]),
  )
  // Entablature band and cornice, then attic.
  out.push(...body(rectPts(x - 1.5, y + atticH, w + 3, entH), 'line'))
  out.push(hline('hair', x, x + w, y + atticH + entH * 0.45))
  out.push(
    ...pediment([x + 2, y, w - 4, atticH], { pitch: 0, panels: Math.round(num(p, 'panels', 3)) }),
  )
  const ow = (w * num(p, 'openW', 0.84)) / bays
  const gap = (w - ow * bays) / (bays + 1)
  const oh = (h - atticH - entH) * num(p, 'openH', 0.9)
  for (let i = 0; i < bays; i++) {
    const ox = x + gap * (i + 1) + ow * i
    const oy = y + h - oh
    const pts: Pt[] =
      kind === 'arch'
        ? [
            [ox, y + h],
            [ox, oy + ow / 2],
            ...Array.from(
              { length: 9 },
              (_, k) =>
                [
                  ox + ow / 2 - (ow / 2) * Math.cos((Math.PI * (k + 1)) / 10),
                  oy + ow / 2 - (ow / 2) * Math.sin((Math.PI * (k + 1)) / 10),
                ] as Pt,
            ),
            [ox + ow, oy + ow / 2],
            [ox + ow, y + h],
          ]
        : rectPts(ox, oy, ow, oh)
    if (dark === 'fill') out.push(fill(pts))
    else {
      out.push(occlude(pts), stroke('line', pts, kind === 'square'))
      out.push(...hatch(pts, 'v', num(p, 'hatchGap', 3), 'hair', 0.6))
    }
  }
  return out
}
