// Subject buildings: small house, stilt house, gate, temple, rampart and switchback wall. Every
// module draws lit walls (T0) with contour `line`, shaded faces in T4, openings and slate roofs in
// T5, and keeps to a short list of details so the silhouette survives 96px.
import { insetTriangle } from '../geom'
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  occlude,
  rectPts,
  stroke,
  toneFill,
  vline,
} from '../grid'
import { type KitModule, num, str, weight } from './util'

/** Low house: lit wall, T4 shaded side, solid roof, one door. Roof `gable`, `hip` or `flat`. */
export const house: KitModule = ([x, y, w, h], p) => {
  const roof = str(p, 'roof', ['gable', 'hip', 'flat'] as const, 'gable')
  const roofH = h * num(p, 'roofH', roof === 'flat' ? 0.16 : 0.42)
  const over = num(p, 'overhang', 1.2)
  const wallY = y + roofH
  const wallH = h - roofH
  const cx = x + w / 2
  const out: SvgNode[] = []
  out.push(...body(rectPts(x, wallY, w, wallH), weight(p, 'weight', 'line')))
  const shade = num(p, 'shade', 0.35)
  if (shade > 0) {
    out.push(
      ...toneFill(rectPts(x + w * (1 - shade), wallY, w * shade, wallH), 'T4', { inset: 0.4 }),
    )
  }
  if (p.door !== false) {
    const dw = Math.min(3, w * 0.22),
      dh = Math.min(5.4, wallH * 0.62)
    out.push(fill(rectPts(x + w * (1 - shade) * 0.5 - dw / 2, y + h - dh, dw, dh)))
  }
  const top: Pt[] =
    roof === 'gable'
      ? [[cx, y]]
      : roof === 'hip'
        ? [
            [x + w * 0.25, y],
            [x + w * 0.75, y],
          ]
        : [
            [x - over * 0.5, y],
            [x + w + over * 0.5, y],
          ]
  const roofPts: Pt[] = [[x - over, wallY], ...top, [x + w + over, wallY]]
  out.push(occlude(roofPts), fill(roofPts), stroke('hair', roofPts, true))
  return out
}

/**
 * Thai stilt house in elevation. The box is the roof width by the whole height, split stilts 28%,
 * wall 24%, roof 48%. Eaves overhang the wall by 12% per side, the wall flares 6% wider at the top,
 * the roof is a solid T5 slate under a lit barge board, and the crawlspace between the posts is T4.
 */
export const stiltHouse: KitModule = ([x, y, w, h], p) => {
  const split = [num(p, 'stilts', 0.28), num(p, 'wall', 0.24), num(p, 'roof', 0.48)]
  const total = split[0] + split[1] + split[2]
  const [stiltH, wallH, roofH] = split.map((s) => (h * s) / total)
  const overhang = num(p, 'overhang', 0.12)
  const flare = num(p, 'flare', 0.06)
  const cx = x + w / 2
  const wallTop = w / (1 + overhang * 2)
  const wallBot = wallTop / (1 + flare)
  const roofBase = y + roofH
  const floor = roofBase + wallH
  const out: SvgNode[] = []
  // Crawlspace and posts.
  const posts = Math.max(2, Math.round(num(p, 'posts', 5)))
  const pw = num(p, 'postW', 4)
  out.push(...toneFill(rectPts(cx - wallBot / 2, floor, wallBot, stiltH), 'T4', { inset: 0 }))
  for (let i = 0; i < posts; i++) {
    const px = cx - wallBot / 2 + pw / 2 + ((wallBot - pw) * i) / (posts - 1)
    out.push(...body(rectPts(px - pw / 2, floor, pw, stiltH), 'hair'))
  }
  // Wall.
  const wall: Pt[] = [
    [cx - wallTop / 2, roofBase],
    [cx + wallTop / 2, roofBase],
    [cx + wallBot / 2, floor],
    [cx - wallBot / 2, floor],
  ]
  out.push(...body(wall, 'line'))
  out.push(
    stroke('bold', [
      [cx - wallBot / 2 - 1.5, floor],
      [cx + wallBot / 2 + 1.5, floor],
    ]),
  )
  const dw = wallTop * 0.15,
    dh = wallH * 0.66
  out.push(fill(rectPts(cx - dw / 2, floor - dh - 1, dw, dh)))
  for (const s of [-1, 1]) {
    const ww = wallTop * 0.1
    out.push(
      fill(rectPts(cx + s * wallTop * 0.28 - ww / 2, roofBase + wallH * 0.28, ww, wallH * 0.36)),
    )
  }
  // Roof: solid slate inside a lit barge board.
  const tri: [Pt, Pt, Pt] = [
    [x, roofBase],
    [cx, y],
    [x + w, roofBase],
  ]
  out.push(...body(tri, 'hair'))
  out.push(fill(insetTriangle(tri, num(p, 'rim', 6))))
  out.push(
    stroke('bold', [
      [x - 1.5, roofBase],
      [x + w + 1.5, roofBase],
    ]),
  )
  return out
}

/**
 * Colonnaded gate in elevation (Brandenburg type). The box is the whole width by the gate body
 * height (columns, entablature, stepped attic; the quadriga goes on top as a signature part).
 * Passages are T4, the centre one 1.5 times a side passage; columns stay lit with one fine flute;
 * a low guard pavilion closes each end.
 */
export const gate: KitModule = ([x, y, w, h], p) => {
  const n = Math.max(3, Math.round(num(p, 'columns', 6)))
  const pavW = w * num(p, 'pavilion', 0.1)
  const pavH = h * num(p, 'pavilionH', 0.55)
  const zones = [num(p, 'cols', 0.57), num(p, 'entablature', 0.12), num(p, 'attic', 0.17)]
  const zs = zones[0] + zones[1] + zones[2]
  const atticH = (h * zones[2]) / zs
  const entH = (h * zones[1]) / zs
  const entTop = y + atticH
  const colTop = entTop + entH
  const ground = y + h
  const x0 = x + pavW,
    x1 = x + w - pavW
  const core = x1 - x0
  const cx = x + w / 2
  const out: SvgNode[] = []
  const colW = num(p, 'colW', 5.4)
  const bays = n - 1
  const weights = Array.from({ length: bays }, (_, i) =>
    bays % 2 === 1 && i === (bays - 1) / 2 ? num(p, 'centre', 1.5) : 1,
  )
  const unit = (core - n * colW) / weights.reduce((a, b) => a + b, 0)
  const xs: number[] = [x0]
  weights.forEach((wt, i) => xs.push(xs[i] + colW + unit * wt))
  // Passages.
  for (let i = 0; i < bays; i++) {
    out.push(...toneFill(rectPts(xs[i] + colW, colTop, unit * weights[i], ground - colTop), 'T4'))
  }
  // Columns.
  for (const cxx of xs) {
    out.push(...body(rectPts(cxx, colTop, colW, ground - colTop), 'hair'))
    out.push(vline('fine', cxx + colW * 0.7, colTop + 2.5, ground - 2))
  }
  // Entablature: a bold course on top and underneath, fine triglyph ticks between.
  out.push(...body(rectPts(x0 - 1.5, entTop, core + 3, entH), 'line'))
  for (let tx = x0 + 3; tx < x1 - 1; tx += 4.5) out.push(vline('fine', tx, entTop + 2, colTop - 2))
  out.push(
    stroke('bold', [
      [x0 - 2.5, colTop],
      [x1 + 2.5, colTop],
    ]),
    stroke('line', [
      [x0 - 2.5, entTop],
      [x1 + 2.5, entTop],
    ]),
  )
  // Stepped attic: low wings and a raised centre block for the quadriga.
  const raise = num(p, 'raise', 0.4)
  const centreW = core * num(p, 'plinth', 0.34)
  const wingTop = y + atticH * raise
  const attic: Pt[] = [
    [x0, entTop],
    [x0, wingTop],
    [cx - centreW / 2, wingTop],
    [cx - centreW / 2, y],
    [cx + centreW / 2, y],
    [cx + centreW / 2, wingTop],
    [x1, wingTop],
    [x1, entTop],
  ]
  out.push(...body(attic, 'line'))
  out.push(hline('fine', x0 + 3, cx - centreW / 2 - 3, wingTop + (entTop - wingTop) / 2))
  out.push(hline('fine', cx + centreW / 2 + 3, x1 - 3, wingTop + (entTop - wingTop) / 2))
  // Guard pavilions.
  for (const px of [x, x + w - pavW]) {
    out.push(...body(rectPts(px, ground - pavH, pavW, pavH), 'line'))
    out.push(
      stroke('bold', [
        [px - 1, ground - pavH],
        [px + pavW + 1, ground - pavH],
      ]),
    )
    const dw = pavW * 0.46
    out.push(
      ...toneFill(rectPts(px + (pavW - dw) / 2, ground - pavH * 0.62, dw, pavH * 0.62), 'T4'),
    )
  }
  return out
}

/**
 * Temple front with a podium (Garni type). The box is the whole front: podium 26%, columns 56%,
 * entablature 8%, pediment 10%. The columns stand lit in front of a T4 cella wall and its door; the
 * podium has T3 steps across the central `steps` (70%) width.
 */
export const temple: KitModule = ([x, y, w, h], p) => {
  const z = [
    num(p, 'podium', 0.26),
    num(p, 'columns', 0.56),
    num(p, 'entablature', 0.08),
    num(p, 'pediment', 0.1),
  ]
  const zt = z[0] + z[1] + z[2] + z[3]
  const [podH, colH, entH, pedH] = z.map((v) => (h * v) / zt)
  const yEnt = y + pedH
  const yCol = yEnt + entH
  const yPod = yCol + colH
  const ground = y + h
  const cx = x + w / 2
  const n = Math.max(2, Math.round(num(p, 'count', 6)))
  const span = w * num(p, 'colonnade', 0.84)
  const pitch = span / (n - 1 + 0.46)
  const colW = pitch * 0.46
  const xs = Array.from({ length: n }, (_, i) => cx - (span - colW) / 2 + pitch * i)
  const out: SvgNode[] = []
  // Cella wall and door, seen between the columns.
  const wallX = xs[0],
    wallW = xs[n - 1] - xs[0]
  out.push(...toneFill(rectPts(wallX, yCol, wallW, colH), 'T4'))
  const dw = wallW * 0.13
  out.push(fill(rectPts(cx - dw / 2, yCol + colH * 0.38, dw, colH * 0.62)))
  // Columns with a plain capital and one fine flute.
  const capH = Math.max(2.2, colW * 0.34)
  for (const c of xs) {
    out.push(...body(rectPts(c - colW / 2, yCol, colW, colH), 'hair'))
    out.push(vline('fine', c + colW * 0.16, yCol + capH + 1.5, yPod - 1.5))
    out.push(...body(rectPts(c - colW * 0.7, yCol, colW * 1.4, capH), 'hair'))
  }
  // Entablature and pediment.
  const entW = span + colW * 1.6
  out.push(...body(rectPts(cx - entW / 2, yEnt, entW, entH), 'hair'))
  out.push(
    stroke('bold', [
      [cx - entW / 2 - 1, yCol],
      [cx + entW / 2 + 1, yCol],
    ]),
  )
  const ped: [Pt, Pt, Pt] = [
    [cx - entW / 2 - 1.5, yEnt],
    [cx, y],
    [cx + entW / 2 + 1.5, yEnt],
  ]
  out.push(...body(ped, 'line'))
  out.push(stroke('hair', insetTriangle(ped, 2.4), true))
  out.push(
    stroke('line', [
      [cx - entW / 2 - 1.5, yEnt],
      [cx + entW / 2 + 1.5, yEnt],
    ]),
  )
  // Podium with steps.
  out.push(...body(rectPts(x, yPod, w, podH), 'line'))
  for (const f of [1 / 3, 2 / 3]) {
    out.push(hline('hair', x + 1, x + w * 0.15, yPod + podH * f))
    out.push(hline('hair', x + w * 0.85, x + w - 1, yPod + podH * f))
  }
  const sw = w * num(p, 'steps', 0.7)
  const stepCount = Math.max(2, Math.round(num(p, 'stepCount', 9)))
  out.push(
    ...toneFill(rectPts(cx - sw / 2, yPod, sw, podH), 'T3', {
      gap: podH / stepCount,
      ramp: [yPod, ground],
      weight: 'fine',
      phase: 1,
    }),
  )
  out.push(
    stroke('bold', [
      [x - 1.5, yPod],
      [x + w + 1.5, yPod],
    ]),
  )
  return out
}

/** Straight wall: lit band, merlon ticks every `merlon` units, one fine course line. */
export const rampart: KitModule = ([x, y, w, h], p) => {
  const gap = num(p, 'merlon', 4)
  const out: SvgNode[] = [...body(rectPts(x, y, w, h), 'line')]
  for (let tx = x + gap / 2; tx < x + w - 1; tx += gap) {
    out.push(vline('hair', tx, y - 1.8, y))
  }
  return out
}

/**
 * A wall climbing a slope in switchbacks to a small fort on top. The box is the fort top by the
 * foot of the climb; the route ends at `endX` (fraction of the box width). Each leg rises less than
 * the one below (`ratio`) at `angle` degrees. The wall is a white strip between two hair lines
 * `width` apart with merlon ticks every `merlon` units; the fort is a block with three merlons.
 */
export const switchbackWall: KitModule = ([x, y, w, h], p) => {
  const legs = Math.max(2, Math.round(num(p, 'legs', 5)))
  const ratio = num(p, 'ratio', 0.8)
  const angle = (num(p, 'angle', 40) * Math.PI) / 180
  const width = num(p, 'width', 2)
  const merlon = num(p, 'merlon', 4)
  const fortW = num(p, 'fortW', 10),
    fortH = num(p, 'fortH', 7)
  const endX = x + w * num(p, 'endX', 0.5)
  const climb = h - fortH
  const weights = Array.from({ length: legs }, (_, i) => ratio ** i)
  const sum = weights.reduce((a, b) => a + b, 0)
  const rises = weights.map((v) => (climb * v) / sum)
  const dirs = rises.map((_, i) => (i % 2 === 0 ? 1 : -1))
  const dxs = rises.map((r, i) => (dirs[i] * r) / Math.tan(angle))
  const net = dxs.reduce((a, b) => a + b, 0)
  const route: Pt[] = [[endX - net, y + h]]
  rises.forEach((r, i) => {
    const a = route[i]
    route.push([a[0] + dxs[i], a[1] - r])
  })
  const out: SvgNode[] = []
  for (let i = 0; i < legs; i++) {
    const a = route[i],
      b = route[i + 1]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    // Unit normal pointing up the page.
    let nx = -(b[1] - a[1]) / len,
      ny = (b[0] - a[0]) / len
    if (ny > 0) {
      nx = -nx
      ny = -ny
    }
    const hw = width / 2
    const strip: Pt[] = [
      [a[0] + nx * hw, a[1] + ny * hw],
      [b[0] + nx * hw, b[1] + ny * hw],
      [b[0] - nx * hw, b[1] - ny * hw],
      [a[0] - nx * hw, a[1] - ny * hw],
    ]
    out.push(occlude(strip, { halo: 2.2 }))
    out.push(stroke('hair', [strip[0], strip[1]]), stroke('hair', [strip[3], strip[2]]))
    const ticks = Math.max(1, Math.floor(len / merlon))
    for (let k = 0; k < ticks; k++) {
      const t = (k + 0.5) / ticks
      const px = a[0] + (b[0] - a[0]) * t + nx * hw,
        py = a[1] + (b[1] - a[1]) * t + ny * hw
      out.push(
        stroke('hair', [
          [px, py],
          [px + nx * 1.8, py + ny * 1.8],
        ]),
      )
    }
  }
  // Fort on the summit.
  const fx = endX - fortW / 2
  const m = fortW / 5
  const top = y
  const fort: Pt[] = [
    [fx, y + fortH],
    [fx, top + 1.8],
    [fx, top],
    [fx + m, top],
    [fx + m, top + 1.8],
    [fx + m * 2, top + 1.8],
    [fx + m * 2, top],
    [fx + m * 3, top],
    [fx + m * 3, top + 1.8],
    [fx + m * 4, top + 1.8],
    [fx + m * 4, top],
    [fx + fortW, top],
    [fx + fortW, y + fortH],
  ]
  out.push(...body(fort, 'line'))
  out.push(fill(rectPts(endX - 0.9, y + fortH * 0.45, 1.8, fortH * 0.4)))
  return out
}
