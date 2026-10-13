// Ground modules: water, mountains, twin-peak, cliff, platform, steps.
import { type Pt, type SvgNode, body, hline, occlude, quad, stroke, vline } from '../grid'
import { type KitModule, bool, num, nums, pairs, str, weight, xAtY } from './util'

/** Rows of broken horizontal lines. Rows spread out toward the bottom (nearer water). */
export const water: KitModule = ([x, y, w, h], p) => {
  const rows = Math.max(1, Math.round(num(p, 'rows', 6)))
  const w0 = weight(p, 'weight', 'hair')
  const out: SvgNode[] = []
  for (let i = 0; i < rows; i++) {
    const t = (i + 0.5) / rows
    const yy = y + h * Math.pow(t, 1.25)
    let cx = x + ((i * 11) % 17)
    let j = 0
    while (cx < x + w) {
      const len = w * (0.12 + 0.07 * ((i * 5 + j * 3) % 4)) * (0.6 + t * 0.7)
      const a = Math.max(x, cx),
        b = Math.min(x + w, cx + len)
      if (b - a > 3) out.push(hline(w0, a, b, yy))
      cx += len + 5 + 4 * ((i + j) % 3)
      j++
    }
  }
  return out
}

/** Ridge line of a mountain range: peaks are [x fraction, height fraction] inside the box. */
function ridge([x, y, w, h]: [number, number, number, number], peaks: Pt[], jag: number): Pt[] {
  const sorted = [...peaks].sort((a, b) => a[0] - b[0])
  const py = (hf: number) => y + h * (1 - hf)
  const corners: Pt[] = [[x, y + h]]
  sorted.forEach(([xf, hf], i) => {
    if (i > 0) {
      const a = corners[corners.length - 1]
      const px = x + w * xf
      // A valley between peaks, a quarter of the way up from the base.
      corners.push([
        (a[0] + px) / 2,
        Math.min(y + h, Math.max(a[1], py(hf)) + (y + h - Math.max(a[1], py(hf))) * 0.3),
      ])
    }
    corners.push([x + w * xf, py(hf)])
  })
  corners.push([x + w, y + h])
  // Roughen each slope with a few deterministic kinks (peaks and valleys stay exactly where asked).
  const kinks = [-1, 0.7, -0.5, 0.9, -0.8]
  const pts: Pt[] = [corners[0]]
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1],
      b = corners[i]
    for (let k = 1; k <= 3; k++) {
      const t = k / 4
      const o = kinks[(i * 3 + k) % kinks.length] * jag
      pts.push([a[0] + (b[0] - a[0]) * t + o * 0.8, a[1] + (b[1] - a[1]) * t + o])
    }
    pts.push(b)
  }
  return pts
}

/** Tapered vertical hatch hugging a slope: engraver's shading for the shaded face. */
function shadeSlope(slope: Pt[], gap: number, depth: number): SvgNode[] {
  const out: SvgNode[] = []
  const x0 = slope[0][0],
    x1 = slope[slope.length - 1][0]
  const span = x1 - x0
  for (let xx = x0 + gap / 2; xx < x1; xx += gap) {
    const s = (xx - x0) / span
    const ys = xAtYInv(slope, xx)
    const len = depth * Math.pow(1 - s, 0.9) + 1.5
    out.push(vline('hair', xx, ys + 2, ys + 2 + len))
  }
  return out
}
/** y on a polyline sorted by x ascending. */
function xAtYInv(line: Pt[], x: number): number {
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1]
    if (a[0] <= x && x <= b[0])
      return b[0] === a[0] ? a[1] : a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])
  }
  return line[line.length - 1][1]
}

export const mountains: KitModule = (box, p) => {
  const [x, y, w, h] = box
  const peaks = pairs(p, 'peaks', [
    [0.3, 0.8],
    [0.7, 1],
  ])
  const line = ridge(box, peaks, num(p, 'jag', 1.2))
  const wt = weight(p, 'weight', 'line')
  const shade = str(p, 'shade', ['right', 'none'] as const, 'right')
  const out: SvgNode[] = [occlude([...line, [x, y + h]]), stroke(wt, line)]
  if (shade === 'right') {
    const depth = num(p, 'shadeDepth', h * 0.5)
    const gap = num(p, 'shadeGap', 3.4)
    // For each peak, shade from the summit down the right-hand slope to the next valley.
    const peakIdx = line
      .map((pt, i) => ({ pt, i }))
      .filter(({ pt }) => peaks.some(([xf]) => Math.abs(x + w * xf - pt[0]) < 1e-6))
    const tol = num(p, 'jag', 1.2) * 2.5
    for (const { i } of peakIdx) {
      let j = i + 1
      // The right slope runs until the ridge rises again or ends.
      while (j < line.length - 1 && line[j + 1][1] < line[j][1] + tol) j++
      out.push(...shadeSlope(line.slice(i, j + 1), gap, depth))
    }
  }
  return out
}

/** Twin-peak volcano pair (Ararat): broad greater cone, lesser cone, concave flanks, snow line, shaded right flanks. */
export const twinPeak: KitModule = ([x, y, w, h], p) => {
  const ratio = num(p, 'ratio', 0.78)
  const split = num(p, 'split', 0.64)
  const snow = num(p, 'snow', 0.3)
  const wt = weight(p, 'weight', 'hair')
  const base = y + h
  const bx = x + w * num(p, 'bigX', 0.3)
  const sx = x + w * (split + 0.14)
  const sy = y + h * (1 - ratio)
  const saddle: Pt = [x + w * split, y + h * num(p, 'saddle', 0.52)]
  const flat = 3.5
  // Concave flanks: the control point sits low on the near side so slopes steepen toward the summit.
  const c = num(p, 'concave', 0.5) // 0 = straight flanks, 1 = bell
  const leftB = quad(
    [x, base],
    [bx - (bx - x) * (1 - c * 0.6), base - h * 0.12 * (1 - c)],
    [bx - flat, y + 1],
    12,
  )
  const downB = quad(
    [bx + flat, y + 1],
    [bx + (saddle[0] - bx) * 0.55, saddle[1] - h * 0.1],
    saddle,
    12,
  )
  const upS = quad(
    saddle,
    [sx - (sx - saddle[0]) * 0.55, saddle[1] - h * 0.04],
    [sx - 2, sy + 1],
    10,
  )
  const downS = quad(
    [sx + 2, sy + 1],
    [sx + (x + w - sx) * (1 - c * 0.6), base - h * 0.12 * (1 - c)],
    [x + w, base],
    12,
  )
  const line: Pt[] = [...leftB, ...downB, ...upS.slice(1), ...downS]
  const out: SvgNode[] = [occlude([...line, [x, base]]), stroke(wt, line)]
  out.push(
    stroke(wt, [
      [bx - flat, y + 1],
      [bx - flat + 1.5, y],
      [bx + flat - 1.5, y],
      [bx + flat, y + 1],
    ]),
  )
  const snowAt = (peakY: number) => peakY + (base - peakY) * snow
  const zig = (peakY: number, cx: number, half: number): Pt[] => {
    const yy = snowAt(peakY)
    return Array.from(
      { length: 7 },
      (_, i) => [cx - half + (2 * half * i) / 6, yy + (i % 2 ? 2.2 : -1.4)] as Pt,
    )
  }
  out.push(stroke(wt, zig(y, bx, (bx - x) * 0.34)))
  out.push(stroke(wt, zig(sy, sx, (x + w - sx) * 0.3)))
  const shadeBig = downB.filter((q) => q[1] > snowAt(y))
  if (shadeBig.length > 1) out.push(...shadeSlope(shadeBig, 3.4, h * 0.34))
  const shadeSmall = downS.filter((q) => q[1] > snowAt(sy))
  if (shadeSmall.length > 1) out.push(...shadeSlope(shadeSmall, 3.4, h * 0.3))
  return out
}

/**
 * Rock mass with a flat plateau and an irregular vertical face. `side` is the side the mass sits
 * on. Vertical strata of alternating length read as columnar basalt.
 */
export const cliff: KitModule = ([x, y, w, h], p) => {
  const side = str(p, 'side', ['left', 'right'] as const, 'left')
  const fx = (t: number) => (side === 'left' ? x + t : x + w - t)
  const wob = nums(p, 'wobble', [0, 1, -2.5, 0.8, -3.2, -0.5, -2.2, 0])
  const rows = wob.length
  const poly: Pt[] = [
    [fx(0), y],
    [fx(w - 2), y],
  ]
  wob.forEach((o, i) => poly.push([fx(w + o), y + 2 + ((h - 2) * i) / (rows - 1)]))
  poly.push([fx(0), y + h])
  const out: SvgNode[] = body(poly, 'line')
  out.push(
    stroke('bold', [
      [fx(0), y],
      [fx(w - 2), y],
    ]),
  )
  const gap = num(p, 'gap', 3.6)
  let k = 0
  for (let t = w - 5; t > 3; t -= gap, k++) {
    const len = h * (k % 2 ? 0.5 : 0.78) * (0.55 + 0.45 * (t / w))
    out.push(vline('hair', fx(t), y + 4, Math.min(y + h - 1, y + 4 + len)))
  }
  for (const f of [0.55, 0.82])
    out.push(hline('hair', fx(w * 0.35), fx(w + wob[Math.round(f * (rows - 1))] - 1.5), y + h * f))
  return out
}

/** Masonry base: trapezoid with optional flare, stone courses and staggered joints. */
export const platform: KitModule = ([x, y, w, h], p) => {
  const batter = num(p, 'batter', 0)
  const flare = bool(p, 'flare', false)
  const courses = Math.round(num(p, 'courses', 0))
  const joints = num(p, 'joints', 0)
  const wt = weight(p, 'weight', 'line')
  const edge = (sx: number, ex: number): Pt[] =>
    flare
      ? quad([sx, y], [sx + (ex - sx) * 0.02, y + h * 0.7], [ex, y + h], 12)
      : [
          [sx, y],
          [ex, y + h],
        ]
  const L = edge(x + batter, x)
  const R = edge(x + w - batter, x + w).map(([px, py]) => [px, py] as Pt)
  const poly: Pt[] = [...L, ...R.reverse()]
  const out: SvgNode[] = [occlude(poly), stroke(wt, poly, true)]
  const topLine = bool(p, 'topLine', true)
  if (topLine)
    out.push(
      stroke('bold', [
        [x + batter, y],
        [x + w - batter, y],
      ]),
    )
  for (let i = 1; i < courses; i++) {
    const yy = y + (h * i) / courses
    const xl = xAtY(L, yy),
      xr = xAtY(R.slice().reverse(), yy)
    out.push(hline('hair', xl + 0.8, xr - 0.8, yy))
    if (joints > 0) {
      const off = i % 2 ? 0 : joints / 2
      for (let jx = x + off + joints; jx < x + w - joints / 2; jx += joints) {
        if (jx > xl + 2 && jx < xr - 2) out.push(vline('hair', jx, yy, yy + h / courses))
      }
    }
  }
  return out
}

/**
 * Stairs. `front`: stacked slabs widening downward. `left`/`right`: side profile rising toward that
 * side, with underside stringer and a handrail.
 */
export const steps: KitModule = ([x, y, w, h], p) => {
  const count = Math.max(2, Math.round(num(p, 'count', 5)))
  const dir = str(p, 'dir', ['front', 'left', 'right'] as const, 'front')
  const out: SvgNode[] = []
  if (dir === 'front') {
    const narrow = num(p, 'narrow', 0.7)
    for (let i = count - 1; i >= 0; i--) {
      const t = (i + 1) / count
      const tw = w * (narrow + (1 - narrow) * (i / (count - 1)))
      const ty = y + (h * i) / count
      out.push(
        ...body(
          [
            [x + (w - tw) / 2, ty],
            [x + (w + tw) / 2, ty],
            [x + (w + tw) / 2, y + h * t],
            [x + (w - tw) / 2, y + h * t],
          ],
          'line',
        ),
      )
    }
    return out
  }
  const sx = dir === 'right' ? 1 : -1
  const x0 = sx === 1 ? x : x + w
  const rise = h / count,
    run = w / count
  const prof: Pt[] = [[x0, y + h]]
  for (let i = 0; i < count; i++) {
    const xa = x0 + sx * run * i,
      xb = x0 + sx * run * (i + 1)
    const yy = y + h - rise * (i + 1)
    prof.push([xa, yy], [xb, yy])
  }
  prof.push([x0 + sx * w, y + h])
  out.push(...body(prof, 'line'))
  // Stringer under the treads.
  out.push(
    stroke('line', [
      [x0, y + h],
      [x0 + sx * w, y + rise],
    ]),
  )
  if (bool(p, 'rail', true)) {
    const rh = num(p, 'railHeight', h * 0.34)
    const startY = y + h - rise - rh
    const endY = y - rh
    out.push(
      stroke('hair', [
        [x0 + sx * run * 0.5, startY],
        [x0 + sx * (w - run * 0.5), endY],
      ]),
    )
    for (const f of [0.25, 0.75]) {
      const tread = y + h - rise * (Math.floor(f * count) + 1)
      out.push(vline('hair', x0 + sx * w * f, startY + (endY - startY) * f, tread))
    }
  }
  return out
}
