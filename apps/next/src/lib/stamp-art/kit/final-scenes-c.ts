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
} from '../grid'
import type { KitModule } from './util'
import { tower } from './wall'
import { house } from './building'
import { outriggerA } from './outrigger-a'

export const greatWallC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const at = ([a, b]: Pt): Pt => [x + a * w, y + b * h]
  const path: Pt[] = [
    [0.06, 0.94],
    [0.26, 0.69],
    [0.42, 0.74],
    [0.58, 0.38],
    [0.72, 0.42],
    [0.84, 0.17],
    [0.93, 0.22],
  ]
  const top = path.map(at)
  const face: Pt[] = [...top, ...top.map(([px, py], i): Pt => [px, py + 12 - i * 1.4]).reverse()]
  out.push(...body(face, 'hair'), ...toneFill(face, 'T4', { gap: 4.4, weight: 'fine' }))
  const ribbon: Pt[] = [...top, ...top.map(([px, py], i): Pt => [px, py - 5 + i * 0.4]).reverse()]
  out.push(...body(ribbon, 'hair'))
  for (let i = 0; i + 1 < top.length; i++) {
    const a = top[i],
      b = top[i + 1]
    const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5))
    for (let k = 0; k < n; k++) {
      const px = a[0] + ((b[0] - a[0]) * k) / n,
        py = a[1] + ((b[1] - a[1]) * k) / n
      out.push(
        stroke('hair', [
          [px, py - 4],
          [px, py - 7],
        ]),
      )
    }
  }
  for (const [i, tw, th] of [
    [1, 24, 28],
    [3, 15, 18],
    [5, 9, 11],
  ]) {
    const [px, py] = top[i]
    out.push(
      ...tower([px - tw / 2, py - th, tw, th], {
        cap: 'battle',
        storeys: 1,
        openings: 1,
        shade: 0.3,
      }),
    )
  }
  return out
}

export const oceanMuseumC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const base = y + h,
    ledge = y + h * 0.39
  const cliff: Pt[] = [
    [x + 5, ledge],
    [x + w - 5, ledge],
    [x + w - 12, base],
    [x + w * 0.72, base - 4],
    [x + w * 0.43, base],
    [x + 12, base - 5],
  ]
  out.push(
    ...body(cliff, 'hair'),
    ...toneFill(cliff, 'T4', { angle: 78, gap: 4.2, weight: 'fine' }),
  )
  for (let i = 0; i < 4; i++)
    out.push(
      stroke('fine', [
        [x + 10, ledge + 12 + i * 10],
        [x + w * 0.45, ledge + 9 + i * 10],
        [x + w - 12, ledge + 13 + i * 10],
      ]),
    )
  const fy = y + h * 0.09,
    fh = ledge - fy
  out.push(...body(rectPts(x + 7, fy, w - 14, fh), 'line'))
  out.push(...toneFill(rectPts(x + w * 0.82, fy, w * 0.12, fh), 'T4', { gap: 2.4 }))
  for (const row of [0.27, 0.64])
    for (let i = 0; i < 7; i++) {
      const wx = x + 12 + (i * (w - 28)) / 7,
        wy = fy + fh * row
      out.push(
        fill([
          [wx, wy + 7],
          [wx, wy + 2],
          [wx + 2, wy],
          [wx + 4, wy + 2],
          [wx + 4, wy + 7],
        ]),
      )
    }
  out.push(
    hline('bold', x + 5, x + w - 5, fy),
    hline('line', x + 7, x + w - 7, fy + fh * 0.55),
    hline('bold', x + 4, x + w - 4, ledge),
  )
  for (const u of [0.08, 0.44, 0.79]) {
    const px = x + w * u,
      pw = w * 0.13
    out.push(...body(rectPts(px, fy - 4, pw, fh + 4), 'hair'))
    out.push(fill(rectPts(px + pw * 0.35, fy + 9, pw * 0.3, 8)))
    out.push(
      stroke('line', [
        [px - 1, fy - 4],
        [px + pw / 2, y],
        [px + pw + 1, fy - 4],
      ]),
    )
  }
  return out
}

export const potemkinC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const base = y + h,
    top = y + h * 0.2,
    cx = x + w / 2
  // Crescent buildings above the stair, without a statue.
  for (const side of [-1, 1]) {
    const bx = side < 0 ? x : x + w * 0.7,
      bw = w * 0.3
    const poly: Pt[] = [
      [bx, top],
      [bx + 2, y + 5],
      [bx + bw * 0.5, y],
      [bx + bw - 2, y + 5],
      [bx + bw, top],
    ]
    out.push(...body(poly, 'hair'), hline('bold', bx, bx + bw, y + 7))
    for (let i = 0; i < 3; i++) out.push(fill(rectPts(bx + 4 + i * 6, y + 11, 3, 5)))
  }
  const half = (t: number) => w * (0.18 + 0.28 * t)
  const stair: Pt[] = [
    [cx - half(0), top],
    [cx + half(0), top],
    [cx + half(1), base],
    [cx - half(1), base],
  ]
  out.push(...body(stair, 'line'))
  for (let i = 0; i < 10; i++) {
    const t = (i + 0.7) / 10
    const yy = top + (base - top) * t
    const hw = half(t) - 3
    out.push(hline('hair', cx - hw, cx + hw, yy))
    if (i > 3) out.push(hline('fine', cx - hw, cx + hw, yy - 2.4))
  }
  for (const side of [-1, 1])
    out.push(
      stroke('bold', [
        [cx + side * half(0), top],
        [cx + side * half(1), base],
      ]),
    )
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const px = cx + side * (w * 0.36 + i * 3),
        py = top + 14 + i * 14
      const crown: Pt[] = [
        [px - 7, py + 10],
        [px - 8, py + 2],
        [px - 4, py - 4],
        [px, py - 7],
        [px + 5, py - 3],
        [px + 8, py + 3],
        [px + 6, py + 10],
      ]
      out.push(...body(crown, 'hair'), ...toneFill(crown, 'T3', { gap: 4, weight: 'fine' }))
    }
  }
  return out
}

export const uBeinC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const deck = (t: number) => y + h * 0.3 + Math.sin(t * Math.PI) * h * 0.08
  const upper: Pt[] = [],
    lower: Pt[] = []
  for (let i = 0; i <= 32; i++) {
    const t = i / 32,
      px = x + w * t,
      py = deck(t)
    upper.push([px, py])
    lower.push([px, py + 3])
    out.push(
      stroke('hair', [
        [px, py],
        [px - 0.8, y + h * (0.78 - 0.08 * Math.sin(t * Math.PI))],
      ]),
    )
    out.push(
      stroke('fine', [
        [px, y + h * 0.81],
        [px + 1, y + h * 0.9],
      ]),
    )
  }
  out.push(...body([...upper, ...lower.reverse()], 'hair'))
  const px = x + w / 3,
    py = deck(1 / 3)
  out.push(
    stroke('hair', [
      [px - 7, py],
      [px - 7, py - 10],
    ]),
    stroke('hair', [
      [px + 7, py],
      [px + 7, py - 10],
    ]),
  )
  out.push(
    ...body(
      [
        [px - 11, py - 10],
        [px - 6, py - 15],
        [px - 5, py - 19],
        [px + 5, py - 19],
        [px + 6, py - 15],
        [px + 11, py - 10],
      ],
      'hair',
    ),
  )
  out.push(hline('bold', px - 11, px + 11, py - 10), hline('hair', px - 7, px + 7, py - 15))
  return out
}

export const beiroC: KitModule = (box, p) => outriggerA(box, { ...p, sail: false })

export const terracesC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  for (const side of [-1, 1]) {
    const ridge: Pt[] = []
    for (let i = 0; i <= 5; i++) {
      const t = i / 5,
        px = x + w / 2 + side * w * (0.48 - 0.25 * t),
        py = y + h * t
      ridge.push([px, py], [px - side * w * 0.07, py + h * 0.07])
    }
    const poly: Pt[] = [[side < 0 ? x : x + w, y], ...ridge, [side < 0 ? x : x + w, y + h]]
    out.push(
      occlude(poly),
      ...toneFill(poly, 'T3', { angle: 5, gap: 5.4, weight: 'fine' }),
      stroke('hair', ridge),
    )
    for (let i = 1; i < 5; i++)
      out.push(
        hline(
          'bold',
          side < 0 ? x : x + w * 0.73,
          side < 0 ? x + w * 0.27 : x + w,
          y + (h * i) / 5,
        ),
      )
  }
  out.push(
    ...house([x + w * 0.34, y + h * 0.55, w * 0.25, h * 0.45], { roof: 'gable', shade: 0.25 }),
  )
  return out
}

export const turfHouseC: KitModule = ([x, y, w, h]) => {
  const out = house([x, y, w, h], { roof: 'gable', roofH: 0.45, shade: 0.25 })
  const roof: Pt[] = [
    [x - 1, y + h * 0.45],
    [x + w / 2, y],
    [x + w + 1, y + h * 0.45],
  ]
  out.push(
    occlude(roof),
    ...toneFill(roof, 'T3', { angle: 15, gap: 2.6 }),
    stroke('hair', roof, true),
  )
  return out
}

export const passettoC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  out.push(...body(rectPts(x, y, w, h), 'line'))
  out.push(...toneFill(rectPts(x + w * 0.75, y, w * 0.25, h), 'T4', { gap: 2.4 }))
  out.push(hline('bold', x, x + w, y + h * 0.28))
  for (let i = 0; i < 7; i++) {
    const px = x + 3 + (i * (w - 6)) / 7,
      aw = ((w - 6) / 7) * 0.48,
      top = y + h * 0.4
    out.push(
      fill([
        [px, y + h],
        [px, top + 5],
        [px + aw / 2, top],
        [px + aw, top + 5],
        [px + aw, y + h],
      ]),
    )
    out.push(fill(rectPts(px, y + 3, 2.4, 4)))
  }
  return out
}

export const mirafloresC: KitModule = ([x, y, w, h]) => {
  const out: SvgNode[] = []
  const base = y + h,
    cx = x + w * 0.48,
    far = y + h * 0.33
  // Chamber walls converge toward the far gate; the vessel is viewed from its bow.
  for (const side of [-1, 1]) {
    const wall: Pt[] = [
      [cx + side * w * 0.15, far],
      [cx + side * w * 0.44, base],
      [cx + side * w * 0.54, base],
      [cx + side * w * 0.22, far - 8],
    ]
    out.push(...body(wall, 'line'), ...toneFill(wall, 'T4', { angle: 75, gap: 4, weight: 'fine' }))
    out.push(stroke('bold', wall.slice(0, 2)))
    for (let i = 0; i < 5; i++) {
      const t = i / 5,
        px = cx + side * w * (0.22 + 0.32 * t),
        py = far - 8 + (base - far + 8) * t
      out.push(
        stroke('hair', [
          [px, py],
          [px, py - 7],
        ]),
      )
    }
  }
  const gate: Pt[] = [
    [cx - w * 0.15, far],
    [cx, far + 5],
    [cx + w * 0.15, far],
    [cx + w * 0.15, far + 12],
    [cx, far + 17],
    [cx - w * 0.15, far + 12],
  ]
  out.push(...body(gate, 'hair'), ...toneFill(gate, 'T4', { angle: 90, gap: 2.4 }))
  out.push(
    stroke('bold', [
      [cx, far + 5],
      [cx, far + 17],
    ]),
  )
  const ship: Pt[] = [
    [cx - w * 0.18, y + h * 0.57],
    [cx + w * 0.18, y + h * 0.57],
    [cx + w * 0.13, y + h * 0.82],
    [cx, y + h * 0.96],
    [cx - w * 0.13, y + h * 0.82],
  ]
  out.push(...body(ship, 'line'), ...toneFill(ship, 'T4', { angle: 90, gap: 4, weight: 'fine' }))
  out.push(
    stroke('line', [
      [cx, y + h * 0.64],
      [cx, y + h * 0.96],
    ]),
  )
  out.push(...body(rectPts(cx - w * 0.12, y + h * 0.39, w * 0.24, h * 0.2), 'hair'))
  for (let i = 0; i < 3; i++)
    out.push(fill(rectPts(cx - w * 0.09 + i * w * 0.065, y + h * 0.43, w * 0.04, 4)))
  out.push(...body(rectPts(cx - w * 0.09, y + h * 0.27, w * 0.18, h * 0.12), 'hair'))
  out.push(hline('bold', cx - w * 0.14, cx + w * 0.14, y + h * 0.39))
  out.push(
    stroke('hair', [
      [cx, y + h * 0.27],
      [cx, y + h * 0.08],
    ]),
  )
  return out
}
