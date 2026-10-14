// Pico Cao Grande: a narrow, near-vertical volcanic needle rising out of a forested mound. The
// spire is a lit left face and a fluted shaded right face under a rounded crown; the mound is a
// dark scalloped treeline with a few paler crowns. The box bottom is the foot of the forest.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, quad, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const volcanicPlug: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const base = y + h
  const cx = x + w * num(p, 'axis', 0.46)
  const lean = num(p, 'lean', 2.2)
  const forestTop = y + h * num(p, 'forest', 0.72)
  const topW = w * num(p, 'topW', 0.1)
  const footW = w * num(p, 'footW', 0.2)
  const N = 12
  const left: Pt[] = [],
    right: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const half = (topW + (footW - topW) * t ** 1.5) / 2
    const c = cx + lean * (1 - t) + Math.sin(t * 5) * 0.6
    left.push([c - half + (rand() - 0.5) * 0.6, y + 5 + (forestTop + 4 - y - 5) * t])
    right.push([c + half + (rand() - 0.5) * 0.6, y + 5 + (forestTop + 4 - y - 5) * t])
  }
  const crown = quad(left[0], [cx + lean, y - 1.5], right[0], 8)
  const spire: Pt[] = [...left.slice().reverse(), ...crown.slice(1), ...right.slice(1)]
  // Mound outline.
  const mound: Pt[] = [[x, base]]
  for (let i = 0; i <= 28; i++) {
    const t = i / 28
    const prof = (1 - Math.abs(2 * t - 1) ** 2.2) ** 0.6
    mound.push([
      x + w * t,
      base - (base - forestTop) * (0.25 + 0.75 * prof) + (i % 2 ? 0.8 : -0.4) + rand() * 0.8,
    ])
  }
  mound.push([x + w, base])
  const out: SvgNode[] = [occlude([...spire]), occlude(mound)]
  out.push(stroke('line', spire))
  // Shaded right face with fall-line hatching, left stays lit with a few flutes.
  const shade: Pt[] = [
    [cx + lean * 0.9 + 0.4, y + 3],
    ...right,
    right[N],
    [cx + lean * 0.5 + footW * 0.12, forestTop + 4],
  ]
  out.push(...toneFill(shade, 'T4', { angle: 88, gap: 1.6, weight: 'fine', inset: 0.6 }))
  for (let k = 0; k < 5; k++) {
    const f = 0.16 + 0.15 * k
    const t0 = 0.08 + rand() * 0.2
    out.push(
      stroke('fine', [
        [
          left[0][0] + (left[N][0] - left[0][0]) * t0 + (right[0][0] - left[0][0]) * f * 0.4,
          y + 8 + t0 * h * 0.3,
        ],
        [left[N][0] + (right[N][0] - left[N][0]) * f * 0.8, forestTop - rand() * 8],
      ]),
    )
  }
  out.push(hline('hair', left[1][0] + 1, right[1][0] - 1, y + 11))
  // Forest mound: hatched along the fall, dark.
  out.push(
    ...toneFill(
      [
        ...mound
          .slice(0, -1)
          .map(([px, py], i) => (i === 0 ? [px, py] : [px, Math.min(base, py + 6)]) as Pt),
        mound[mound.length - 1],
      ],
      'T4',
      { angle: 80, gap: num(p, 'moundGap', 2.6), weight: 'fine' },
    ),
  )
  out.push(stroke('line', mound.slice(1, -1)))
  for (let cxm = x + 22; cxm < x + w - 18; cxm += 11 + rand() * 4) {
    if (Math.abs(cxm - cx) < 10) continue
    const tp = mound.reduce(
      (m, q) => (Math.abs(q[0] - cxm) < Math.abs(m[0] - cxm) ? q : m),
      mound[1],
    )
    const r = 5 + rand() * 2
    const cr: Pt[] = Array.from({ length: 12 }, (_, i) => [
      cxm + Math.cos((i / 12) * Math.PI * 2) * r * (i % 2 ? 1 : 0.88),
      tp[1] + 5 + Math.sin((i / 12) * Math.PI * 2) * r * 0.8,
    ])
    out.push(occlude(cr), stroke('hair', cr, true))
    out.push(
      ...toneFill(
        cr.filter(([qx, qy]) => qx > cxm - 1 && qy > tp[1] + 5),
        'T4',
        { gap: 1.8, weight: 'fine', inset: 0.4 },
      ),
    )
  }
  for (let sx = x + 4; sx < x + w - 4; sx += 5 + rand() * 5) {
    const tp = mound.reduce((m, q) => (Math.abs(q[0] - sx) < Math.abs(m[0] - sx) ? q : m), mound[1])
    out.push(
      stroke('fine', [
        [sx - 2, tp[1] + 4],
        [sx, tp[1] + 2.4],
        [sx + 2, tp[1] + 4],
      ]),
    )
  }
  return out
}
