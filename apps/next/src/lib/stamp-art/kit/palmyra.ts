// Palmyra, the Great Colonnade: one row of tall columns receding toward a vanishing point on the
// right, so near columns are large and far ones small. Capitals are dark bands, lintels span only
// some bays, two columns are broken and a drum lies on the sand. The box is the whole scene; the
// bottom of the nearest column sits on the box bottom.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, hline, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const palmyra: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 6)))
  const n = 9
  const ratio = num(p, 'ratio', 0.86)
  const vpx = x + w * 1.3
  const vpy = y + h * 0.82
  const nearBase = y + h
  const x0 = x + w * num(p, 'x0', 0.2)
  const scale = (i: number) => Math.pow(ratio, i)
  const cols = Array.from({ length: n }, (_, i) => {
    const s = scale(i)
    const xc = vpx - (vpx - x0) * s
    const base = vpy + (nearBase - vpy) * s
    const H = h * num(p, 'tall', 0.9) * s
    return { xc, base, H, s }
  })
  const broken = new Map<number, number>([
    [4, 0.42],
    [6, 0.7],
  ])
  const gaps = new Set([2, 5, 7])
  const out: SvgNode[] = []
  // Stylobate along the column feet.
  const feet: Pt[] = cols.map((c) => [c.xc, c.base + 1.5])
  const colAt = (i: number): SvgNode[] => {
    const c = cols[i]
    const full = c.H
    const wc = Math.max(3, full * 0.075)
    const brk = broken.get(i)
    const capH = full * 0.06
    const lintelH = full * 0.1
    const shaftTop = c.base - full + lintelH + capH
    const top = brk ? c.base - (c.base - shaftTop) * brk : shaftTop
    const wt = wc * 0.84
    const poly: Pt[] = [
      [c.xc - wc / 2, c.base],
      [c.xc - wt / 2, top],
      ...(brk
        ? ([
            [c.xc, top - 2],
            [c.xc + wt / 2 - 0.4, top + 1],
          ] as Pt[])
        : []),
      [c.xc + wt / 2, brk ? top + 2 : top],
      [c.xc + wc / 2, c.base],
    ]
    const o: SvgNode[] = body(poly, 'line')
    o.push(
      ...toneFill(
        [
          [c.xc + wc * 0.12, c.base],
          [c.xc + wt * 0.12, top + 1],
          [c.xc + wt / 2, top + 1],
          [c.xc + wc / 2, c.base],
        ],
        'T4',
        { gap: 1.9, weight: 'fine', inset: 0.3 },
      ),
    )
    // Plinth.
    o.push(
      ...body(
        [
          [c.xc - wc * 0.75, c.base],
          [c.xc - wc * 0.75, c.base - 2],
          [c.xc + wc * 0.75, c.base - 2],
          [c.xc + wc * 0.75, c.base],
        ],
        'hair',
      ),
    )
    if (!brk) {
      const cw = wc * 1.4
      const cap: Pt[] = [
        [c.xc - wt / 2, top],
        [c.xc - cw / 2, top - capH],
        [c.xc + cw / 2, top - capH],
        [c.xc + wt / 2, top],
      ]
      o.push(...body(cap, 'line'))
      o.push(...toneFill(cap, 'T4', { gap: 1.5, weight: 'hair', inset: 0.2 }))
      // Console bracket jutting from the shaft, a Palmyrene signature.
      const by = top + (c.base - top) * 0.3
      o.push(
        ...body(
          [
            [c.xc - wc * 0.3, by],
            [c.xc + wc * 0.3, by],
            [c.xc + wc * 0.15, by + 4 * c.s + 1],
            [c.xc - wc * 0.15, by + 4 * c.s + 1],
          ],
          'hair',
        ),
      )
    }
    return o
  }
  for (let i = n - 1; i >= 0; i--) {
    out.push(...colAt(i))
    // Lintel spanning the bay between column i and the next one in front of it (i - 1).
    if (i >= 1 && !gaps.has(i) && !broken.has(i) && !broken.has(i - 1)) {
      const a = cols[i - 1],
        b = cols[i]
      const hl = (c: { H: number }) => c.H * 0.1
      const ta = (c: { base: number; H: number }) => c.base - c.H + hl(c)
      const lintel: Pt[] = [
        [a.xc, ta(a) - hl(a)],
        [b.xc, ta(b) - hl(b)],
        [b.xc, ta(b)],
        [a.xc, ta(a)],
      ]
      out.push(...body(lintel, 'line'))
      out.push(...toneFill(lintel, 'T4', { gap: 2.4, weight: 'fine', inset: 0.3, angle: 0 }))
    }
  }
  out.push(stroke('bold', feet))
  // A fallen drum in the sand at the left foot.
  const dx = x + w * 0.26,
    dy = y + h - 1
  out.push(
    ...body(
      [
        [dx, dy],
        [dx, dy - 6],
        [dx + 20, dy - 6],
        [dx + 20, dy],
      ],
      'line',
    ),
  )
  out.push(hline('hair', dx + 4, dx + 4, dy))
  for (const k of [6, 12])
    out.push(
      stroke('hair', [
        [dx + k, dy - 6],
        [dx + k, dy],
      ]),
    )
  void rand
  return out
}
