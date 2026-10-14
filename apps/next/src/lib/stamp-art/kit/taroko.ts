// Taroko Gorge (Taiwan): two near-vertical marble walls close together, flared at the rim, with a
// narrow river between. The left wall is lit and fluted by gullies, the right wall shaded; a road
// tunnel arch is cut into the lit wall low by the water, and a far ridge shows in the gap. The box
// bottom is the near bank.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, fill, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const taroko: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const floor = y + h * 0.84
  const cx = x + w * num(p, 'axis', 0.5)
  const foot = w * num(p, 'foot', 0.055)
  const rim = w * num(p, 'rim', 0.2)
  const half = (t: number) => foot + (rim - foot) * (1 - t) ** 2.4
  const edgeY = (i: number) => y + 3 + (floor - y - 3) * (i / 30)
  const inner = (s: -1 | 1): Pt[] => {
    const pts: Pt[] = []
    for (let i = 0; i <= 30; i++) pts.push([cx + s * half(i / 30), edgeY(i)])
    pts.push([cx + s * foot * 2.4, base])
    return pts
  }
  const out: SvgNode[] = []
  // Far ridge in the gap.
  const gapTopY = y + h * 0.4
  const gapL = inner(-1).filter((q) => q[1] >= gapTopY)
  const gapR = inner(1).filter((q) => q[1] >= gapTopY)
  const far: Pt[] = [
    [gapL[0][0], gapTopY + 2],
    [cx - rim * 0.35, gapTopY - 3],
    [cx + rim * 0.15, gapTopY + 1],
    [gapR[0][0], gapTopY - 2],
    ...gapR.reverse(),
    ...gapL.reverse(),
  ]
  out.push(occlude(far), ...toneFill(far, 'T2', { inset: 0.6 }))
  const wall = (s: -1 | 1) => {
    const outerX = s < 0 ? x : x + w
    const ie = inner(s)
    const ridge: Pt[] = []
    const pins = [0.12, 0.3, 0.52, 0.76].map((u) => u + (rand() - 0.5) * 0.06)
    for (let i = 0; i <= 40; i++) {
      const u = i / 40
      let ry = y + 3 + h * num(p, 'drop', 0.3) * u ** 1.2
      for (const c of pins) ry -= 6 * Math.max(0, 1 - Math.abs(u - c) / 0.04)
      ridge.push([ie[0][0] + (outerX - ie[0][0]) * u, ry + (rand() - 0.5) * 1.1])
    }
    const poly: Pt[] = [[outerX, base], ...ridge.slice().reverse(), ...ie]
    out.push(occlude(poly))
    return { ridge, ie, poly, outerX }
  }
  const L = wall(-1)
  const R = wall(1)
  // Lit left wall: gullies from the rim and marble strata ticks.
  const yOnRidge = (r: Pt[], px: number) => {
    for (let i = 0; i + 1 < r.length; i++) {
      const [a, b] = [r[i], r[i + 1]]
      if ((a[0] - px) * (b[0] - px) <= 0)
        return a[1] + ((px - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1])
    }
    return r[r.length - 1][1]
  }
  const innerX = (ie: Pt[], py: number) => {
    for (let i = 0; i + 1 < ie.length; i++) {
      const [a, b] = [ie[i], ie[i + 1]]
      if ((a[1] - py) * (b[1] - py) <= 0)
        return a[0] + ((py - a[1]) / (b[1] - a[1] || 1)) * (b[0] - a[0])
    }
    return ie[ie.length - 1][0]
  }
  for (let k = 0; k < 11; k++) {
    const u = 0.06 + k * 0.085
    const px = L.ie[0][0] + (L.outerX - L.ie[0][0]) * u
    const top = yOnRidge(L.ridge, px) + 2
    const len = (base - top) * (0.3 + rand() * 0.4)
    const xx = Math.max(px, 0)
    if (xx > innerX(L.ie, top + len) - 2) continue
    out.push(
      stroke('fine', [
        [xx, top],
        [xx + (rand() - 0.5) * 2, top + len],
      ]),
    )
  }
  for (let k = 0; k < 7; k++) {
    const yy = y + h * (0.3 + k * 0.08) + rand() * 3
    const x1 = L.outerX + 4 + rand() * 12
    const x2 = Math.min(x1 + 8 + rand() * 12, innerX(L.ie, yy) - 3)
    if (x2 > x1)
      out.push(
        stroke('fine', [
          [x1, yy],
          [x2, yy + (rand() - 0.5) * 1.2],
        ]),
      )
  }
  // Shaded right wall: dark from the gorge edge outward.
  const cut = 0.62
  const shade: Pt[] = [
    ...R.ie,
    [R.ie[R.ie.length - 1][0] + (R.outerX - cx) * cut * 0.9, base],
    ...R.ridge.filter((q) => q[0] <= R.ie[0][0] + (R.outerX - R.ie[0][0]) * cut).reverse(),
  ]
  out.push(...toneFill(shade, 'T4', { inset: 0.6, gap: [2.2, 2.2] }))
  // Outlines.
  out.push(stroke('line', [...L.ridge, ...L.ie]), stroke('line', [...R.ridge, ...R.ie]))
  // Tunnel arch low on the lit wall.
  const tw = w * 0.085
  const tx = cx - half(0.84) - tw * 1.5
  const tb = floor - 3
  const th = h * 0.15
  const arch: Pt[] = [[tx - tw / 2, tb]]
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (i / 8) * Math.PI
    arch.push([tx + (Math.cos(a) * tw) / 2, tb - th * 0.55 - Math.sin(a) * th * 0.45])
  }
  arch.push([tx + tw / 2, tb])
  out.push(fill(arch))
  out.push(
    stroke('bold', [
      [tx - tw * 1.3, tb + 1.5],
      [innerX(L.ie, tb + 1.5) + 1, tb + 1.5],
    ]),
  )
  // River: water lines widening toward the bank, boulders on the shore.
  const river: Pt[] = [
    ...inner(-1).filter((q) => q[1] >= floor),
    ...inner(1)
      .filter((q) => q[1] >= floor)
      .reverse(),
  ]
  out.push(...toneFill(river, 'T3', { inset: 0.5 }))
  out.push(hline('hair', x, x + w, base))
  return out
}
