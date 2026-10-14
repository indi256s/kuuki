// A forested islet seen at eye level (lane A, `-a` until consolidated): a low mound whose crown is
// a row of rounded tree clumps, filled with one tone from the ladder (T2 far diagonals, T3 near
// ground hatching, T4 dense verticals). The far islets are not outlined; near ones get a hair crest.
// The box bottom is the waterline and `clumps` sets the number of tree masses along the top.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hline, occlude, stroke, toneFill } from '../grid'
import { type KitModule, num, str } from './util'

export const forestIsletA: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const base = y + h
  const clumps = Math.max(2, Math.round(num(p, 'clumps', 5)))
  const tone = str(p, 'tone', ['T2', 'T3', 'T4'] as const, 'T3')
  const phase = rand() * 3
  const top: Pt[] = []
  const n = 36
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const env = Math.pow(Math.sin(Math.PI * u), 0.75)
    const bump = 0.84 + 0.16 * Math.abs(Math.sin(u * clumps * Math.PI + phase))
    top.push([x + w * u, base - h * env * bump])
  }
  const poly: Pt[] = [...top, [x + w, base], [x, base]]
  const out: SvgNode[] = [occlude(poly)]
  out.push(
    ...toneFill(poly, tone, {
      inset: 0.4,
      gap: num(p, 'gap', tone === 'T2' ? 3 : 3.2),
      weight: 'fine',
    }),
  )
  if (num(p, 'crest', 1)) out.push(stroke('hair', top))
  out.push(hline('hair', x - 2, x + w + 2, base))
  return out
}
