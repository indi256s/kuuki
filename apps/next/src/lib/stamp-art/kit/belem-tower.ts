// PT: the Tower of Belem in front elevation. A low bulwark terrace on the water (merlons, dark
// gun ports, a battered foot) carries a stout four-storey tower: a loggia of three arches on the
// first storey, round domed corner turrets (garitas) at two levels, narrowing storeys with slit
// windows, a crenellated terrace and a small domed lantern. The box is bulwark plus tower; its
// bottom is the waterline. `at` is the tower's centre as a fraction of the width.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  hline,
  quad,
  rectPts,
  stroke,
  toneFill,
  vline,
} from '../grid'
import { type KitModule, num } from './util'

const arch = (cx: number, yb: number, w: number, h: number): Pt[] => {
  const r = w / 2
  const pts: Pt[] = [[cx - r, yb]]
  const n = 8
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (Math.PI * i) / n
    pts.push([cx + r * Math.cos(a), yb - (h - r) - r * Math.sin(a)])
  }
  pts.push([cx + r, yb])
  return pts
}

export const belemTower: KitModule = ([x, y, w, h], p) => {
  const base = y + h
  const out: SvgNode[] = []
  const platH = h * 0.17
  const py = base - platH
  const tcx = x + w * num(p, 'at', 0.4)
  const tw = w * num(p, 'towerWidth', 0.31)
  const T = h - platH
  const cord = (cx: number, wid: number, yy: number) =>
    out.push(hline('bold', cx - wid / 2 - 1.4, cx + wid / 2 + 1.4, yy))

  // storey blocks, bottom to top
  const s1 = { w: tw, y0: py + 3, h: T * 0.36 + 3 }
  const s2 = { w: tw * 0.88, y0: s1.y0 - s1.h, h: T * 0.3 }
  const s3 = { w: tw * 0.76, y0: s2.y0 - s2.h, h: T * 0.2 }
  const storey = (s: { w: number; y0: number; h: number }, shade = true) => {
    out.push(...body(rectPts(tcx - s.w / 2, s.y0 - s.h, s.w, s.h), 'line'))
    if (shade)
      out.push(
        ...toneFill(rectPts(tcx + s.w * 0.28, s.y0 - s.h, s.w * 0.2, s.h), 'T4', {
          gap: 2.4,
          inset: 0.2,
        }),
      )
    if (p.towerWidth === undefined) cord(tcx, s.w, s.y0 - s.h)
    else out.push(hline('hair', tcx - s.w / 2, tcx + s.w / 2, s.y0 - s.h))
  }
  storey(s1)
  storey(s2)
  storey(s3, false)

  // first storey: a loggia of three round arches
  const archW = tw * 0.17
  const archH = s1.h * 0.52
  for (const f of [-0.28, 0, 0.28]) {
    const a = arch(tcx + tw * f, s1.y0 - s1.h * 0.1, archW, archH)
    out.push(fill(a))
  }
  out.push(hline('hair', tcx - tw / 2, tcx + tw / 2, s1.y0 - s1.h * 0.1 - archH - 3))
  // second storey: one tall window and two shield nubs; third: twin slits
  out.push(fill(arch(tcx - s2.w * 0.08, s2.y0 - s2.h * 0.2, tw * 0.13, s2.h * 0.55)))
  for (const f of [-0.3, 0.3])
    out.push(...body(rectPts(tcx + s2.w * f - 2.2, s2.y0 - s2.h * 0.82, 4.4, 5), 'hair'))
  for (const f of [-0.17, 0.17])
    out.push(fill(rectPts(tcx + s3.w * f - 1.3, s3.y0 - s3.h * 0.72, 2.6, s3.h * 0.46)))

  // crenellated terrace and lantern
  const topY = s3.y0 - s3.h
  for (let mx = tcx - s3.w / 2 + 0.6; mx < tcx + s3.w / 2 - 3.2; mx += 5.6)
    out.push(...body(rectPts(mx, topY - 3.4, 3.2, 3.4), 'hair'))
  const lw = tw * 0.3
  const lh = T * 0.1
  out.push(...body(rectPts(tcx - lw / 2, topY - 3.4 - lh, lw, lh + 0.4), 'line'))
  out.push(fill(rectPts(tcx - 1.1, topY - 3.4 - lh * 0.8, 2.2, lh * 0.5)))
  const dome: Pt[] = [
    ...quad(
      [tcx - lw / 2 - 1, topY - 3.4 - lh],
      [tcx - lw * 0.5, topY - 3.4 - lh - lw * 0.36],
      [tcx, topY - 3.4 - lh - lw * 0.38],
      8,
    ),
    ...quad(
      [tcx, topY - 3.4 - lh - lw * 0.38],
      [tcx + lw * 0.5, topY - 3.4 - lh - lw * 0.36],
      [tcx + lw / 2 + 1, topY - 3.4 - lh],
      8,
    ).slice(1),
  ]
  out.push(...body(dome, 'line'), ...toneFill(dome, 'T4', { gap: 2, inset: 0.2 }))
  out.push(vline('line', tcx, topY - 3.4 - lh - lw * 0.38, topY - 3.4 - lh - lw * 0.38 - 3))

  // round corner turrets with domed caps
  const garita = (cx: number, yb: number, gw: number, gh: number) => {
    out.push(...body(rectPts(cx - gw / 2, yb - gh, gw, gh), 'line'))
    out.push(
      ...toneFill(rectPts(cx + gw * 0.12, yb - gh, gw * 0.38, gh), 'T4', { gap: 2, inset: 0.2 }),
    )
    out.push(fill(rectPts(cx - 0.9, yb - gh * 0.72, 1.8, gh * 0.4)))
    const cap: Pt[] = [
      ...quad(
        [cx - gw / 2 - 1, yb - gh],
        [cx - gw * 0.5, yb - gh - gw * 0.8],
        [cx, yb - gh - gw * 0.85],
        7,
      ),
      ...quad(
        [cx, yb - gh - gw * 0.85],
        [cx + gw * 0.5, yb - gh - gw * 0.8],
        [cx + gw / 2 + 1, yb - gh],
        7,
      ).slice(1),
    ]
    out.push(
      ...body(cap, 'line'),
      ...toneFill(cap.slice(Math.floor(cap.length / 2) - 1), 'T4', { gap: 1.8, inset: 0.2 }),
    )
    out.push(hline('bold', cx - gw / 2 - 1.2, cx + gw / 2 + 1.2, yb - gh))
  }
  const gw1 = tw * 0.2
  for (const sgn of [-1, 1]) {
    garita(tcx + sgn * (tw / 2 + gw1 * 0.1), s1.y0 - s1.h + 1, gw1, T * 0.2)
    garita(tcx + sgn * (s3.w / 2 + 0.4), topY + 1, gw1 * 0.82, T * 0.14)
  }

  // bulwark terrace in front: plumb wall, merlons, gun ports, a corner turret
  const bw = w * num(p, 'bulwarkWidth', 0.88)
  const bx0 = tcx - bw / 2
  const bx1 = tcx + bw / 2
  out.push(...body(rectPts(bx0, py, bx1 - bx0, base - py), 'line'))
  for (let mx = bx0 + 3; mx < bx1 - 9; mx += 7.2)
    out.push(...body(rectPts(mx, py - 3.6, 4.2, 3.8), 'hair'))
  out.push(hline('bold', bx0 - 1.4, bx1 + 1.4, py))
  for (let gx = bx0 + 9; gx < bx1 - 10; gx += 13)
    out.push(fill(rectPts(gx, py + platH * 0.22, 4.4, platH * 0.3)))
  garita(bx1 - 5, py + 1, tw * 0.15, T * 0.12)
  out.push(hline('bold', x - 1, x + w + 1, base))
  out.push(
    stroke('hair', [
      [x + 6, base + 2.6],
      [x + w - 6, base + 2.6],
    ]),
  )
  return p.towerWidth === undefined
    ? out
    : out.map((n) => (n.kind === 'stroke' && n.weight === 'line' ? { ...n, weight: 'hair' } : n))
}
