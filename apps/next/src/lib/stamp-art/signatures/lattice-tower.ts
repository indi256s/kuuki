import { type Pt, type SvgNode, body, fill, hline, occlude, stroke } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

const PROFILE: [number, number][] = [
  [0, 1],
  [0.08, 0.86],
  [0.17, 0.66],
  [0.26, 0.5],
  [0.35, 0.38],
  [0.5, 0.26],
  [0.65, 0.19],
  [0.84, 0.12],
  [0.9, 0.07],
  [1, 0.025],
]
const widthAt = (t: number): number => {
  for (let i = 0; i + 1 < PROFILE.length; i++) {
    const [t0, w0] = PROFILE[i],
      [t1, w1] = PROFILE[i + 1]
    if (t >= t0 && t <= t1) return w0 + ((w1 - w0) * (t - t0)) / (t1 - t0)
  }
  return PROFILE[PROFILE.length - 1][1]
}

export const latticeTower: KitModule = ([x, y, w, h], p) => {
  const cx = x + w / 2
  const base = y + h
  const hwBase = w / 2
  const yOf = (t: number) => base - h * t
  const hw = (t: number) => hwBase * widthAt(t)
  const archT = num(p, 'arch', 0.13)
  const archRx = hwBase * 0.56
  const archRy = h * archT
  const p1 = 0.2,
    p2 = 0.37,
    p3 = 0.84
  const out: SvgNode[] = []

  const left: Pt[] = [],
    right: Pt[] = []
  const N = 48
  for (let i = 0; i <= N; i++) {
    const t = i / N
    left.push([cx - hw(t), yOf(t)])
    right.push([cx + hw(t), yOf(t)])
  }
  const arch: Pt[] = Array.from({ length: 17 }, (_, i): Pt => {
    const a = (Math.PI * i) / 16
    return [cx + archRx * Math.cos(a), base - archRy * Math.sin(a)]
  })
  const sil: Pt[] = [...left, ...right.slice().reverse(), ...arch]
  out.push(occlude(sil))

  const brace = (a: [Pt, Pt], b: [Pt, Pt]) => {
    out.push(stroke('fine', [a[0], b[1]]), stroke('fine', [a[1], b[0]]))
  }
  const archXAt = (yy: number) => {
    const k = Math.min(1, (base - yy) / archRy)
    return archRx * Math.sqrt(Math.max(0, 1 - k * k))
  }
  const legPanels = Math.max(2, Math.round(num(p, 'legPanels', 4)))
  for (let i = 0; i < legPanels; i++) {
    const t0 = (archT * i) / legPanels,
      t1 = (archT * (i + 1)) / legPanels
    for (const s of [-1, 1]) {
      const lo: [Pt, Pt] = [
        [cx + s * hw(t0), yOf(t0)],
        [cx + s * archXAt(yOf(t0)), yOf(t0)],
      ]
      const hi: [Pt, Pt] = [
        [cx + s * hw(t1), yOf(t1)],
        [cx + s * archXAt(yOf(t1)), yOf(t1)],
      ]
      brace(lo, hi)
    }
  }
  out.push(
    fill([
      [cx - hw(archT), yOf(archT)],
      [cx + hw(archT), yOf(archT)],
      [cx + hw(archT + 0.012), yOf(archT + 0.012)],
      [cx - hw(archT + 0.012), yOf(archT + 0.012)],
    ]),
  )
  const bands: [number, number, number][] = [
    [p1, p2, Math.round(num(p, 'lower', 4))],
    [p2, p3, Math.round(num(p, 'upper', 7))],
  ]
  for (const [ta, tb, n] of bands) {
    for (let i = 0; i < n; i++) {
      const t0 = ta + ((tb - ta) * i) / n,
        t1 = ta + ((tb - ta) * (i + 1)) / n
      brace(
        [
          [cx - hw(t0), yOf(t0)],
          [cx + hw(t0), yOf(t0)],
        ],
        [
          [cx - hw(t1), yOf(t1)],
          [cx + hw(t1), yOf(t1)],
        ],
      )
    }
  }
  out.push(
    stroke('line', [
      [cx, yOf(p3)],
      [cx, y],
    ]),
  )
  out.push(stroke('line', left), stroke('line', right))
  out.push(stroke('hair', arch))
  for (const [t, over, thick] of [
    [p1, 4, 3],
    [p2, 3, 2.6],
    [p3, 2.4, 2.2],
  ] as const) {
    const yy = yOf(t)
    out.push(
      ...body(
        [
          [cx - hw(t) - over, yy - thick],
          [cx + hw(t) + over, yy - thick],
          [cx + hw(t) + over, yy],
          [cx - hw(t) - over, yy],
        ],
        'line',
      ),
    )
  }
  out.push(hline('bold', cx - hwBase - 3, cx + hwBase + 3, base))
  return out
}
