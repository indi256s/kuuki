// The Pitons of Saint Lucia: two steep rainforest cones standing in the sea, the greater (Gros)
// on the left with a blunt crown, the lesser (Petit) in front on the right with a sharp tip. The
// shaded right flank of each is dense vertical hatching, the lit flank carries sparse ridge ticks.
// The box bottom is the waterline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hatch, occlude, quad, stroke, vline } from '../grid'
import { type KitModule, num } from './util'

export const pitons: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 5)))
  const base = y + h
  const bx = x + w * num(p, 'bigX', 0.3)
  const sx = x + w * num(p, 'smallX', 0.74)
  const sy = y + h * (1 - num(p, 'ratio', 0.84))
  const sadX = x + w * num(p, 'saddleX', 0.55)
  const sadY = y + h * num(p, 'saddle', 0.6)
  const out: SvgNode[] = []
  const bump = 3.2
  // Greater Piton: blunt crown, nearly straight steep flanks.
  const gl = quad([x, base], [bx - (bx - x) * 0.3, base - h * 0.28], [bx - bump, y + 1], 12)
  const gr = quad([bx + bump, y + 1], [bx + (sadX - bx) * 0.35, sadY - h * 0.2], [sadX, sadY], 12)
  const gros: Pt[] = [...gl, [bx - bump * 0.4, y - 0.4], [bx + bump * 0.4, y - 0.4], ...gr]
  const grosPoly: Pt[] = [...gros, [sadX, base], [x, base]]
  out.push(occlude(grosPoly), stroke('line', gros))
  const rb = bx - (bx - x) * 0.1
  const shadeG: Pt[] = [[bx, y + 2], ...gr, [sadX, base], [rb, base]]
  out.push(...hatch(shadeG, 'v', 2.4, 'hair', 0.4))
  // Lit flank: ridge ticks running down the fall line.
  for (let tx = x + 4; tx < rb - 1; tx += 3.8) {
    const f = (tx - x) / (rb - x)
    const top = base - (base - y) * Math.pow(f, 0.75) + 6
    out.push(vline('fine', tx, top + rand() * 6, Math.min(base - 2, top + 14 + rand() * 18)))
  }
  // Lesser Piton: sharp tip, in front of the greater one.
  const sl = quad(
    [sadX, sadY + h * 0.06],
    [sx - (sx - sadX) * 0.35, sy + (base - sy) * 0.3],
    [sx - 1.6, sy + 1],
    10,
  )
  const sr = quad(
    [sx + 1.6, sy + 1],
    [sx + (x + w - sx) * 0.25, base - (base - sy) * 0.3],
    [x + w, base],
    12,
  )
  const small: Pt[] = [...sl, [sx, sy - 0.6], ...sr]
  const smallPoly: Pt[] = [...small, [x + w, base], [sadX, base]]
  out.push(occlude(smallPoly), stroke('line', small))
  const rbs = sx - (sx - sadX) * 0.15
  const shadeS: Pt[] = [[sx, sy + 2], ...sr, [rbs, base]]
  out.push(...hatch(shadeS, 'v', 2.4, 'hair', 0.4))
  for (let tx = sadX + 5; tx < rbs - 1; tx += 4.4) {
    const f = (tx - sadX) / (rbs - sadX)
    const top = base - (base - sy) * Math.pow(f, 0.8) + 5
    out.push(vline('fine', tx, top + rand() * 5, Math.min(base - 2, top + 10 + rand() * 14)))
  }
  return out
}
