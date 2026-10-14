// Basotho hut under a mokorotlo roof: a conical thatch with a concave, flared profile and a knob
// on the apex, over a short round wall with an arched door. Thatch is hatched along the fall line,
// dense on the right, sparse on the left, with two binding rings and a fringed eave. Box bottom is
// the wall foot.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, occlude, rectPts, stroke, toneFill } from '../grid'
import { type KitModule, num } from './util'

export const mokorotlo: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const cx = x + w / 2
  const knob = h * 0.085
  const roofTop = y + knob * 1.5
  const wallTop = y + h * num(p, 'wallTop', 0.62)
  const base = y + h
  const half = w / 2
  const prof = (f: number) => Math.pow(f, 1.12) * half
  const right: Pt[] = []
  for (let i = 0; i <= 14; i++) {
    const f = i / 14
    right.push([cx + prof(f), roofTop + (wallTop - roofTop) * f])
  }
  const left: Pt[] = right.map(([px, py]) => [2 * cx - px, py] as Pt).reverse()
  const roof: Pt[] = [...left, ...right]
  const out: SvgNode[] = []
  // Wall.
  const ww = w * 0.72
  out.push(...body(rectPts(cx - ww / 2, wallTop - 1, ww, base - wallTop + 1), 'line'))
  out.push(
    ...toneFill(rectPts(cx + ww * 0.22, wallTop, ww * 0.28, base - wallTop), 'T4', { inset: 0.4 }),
  )
  const dw = ww * 0.2
  out.push(
    fill([
      [cx - ww * 0.18 - dw / 2, base],
      [cx - ww * 0.18 - dw / 2, base - h * 0.2],
      [cx - ww * 0.18, base - h * 0.24],
      [cx - ww * 0.18 + dw / 2, base - h * 0.2],
      [cx - ww * 0.18 + dw / 2, base],
    ]),
  )
  // Roof.
  out.push(occlude(roof))
  for (let f = 0.04; f < 1; f += 0.06) {
    const px = cx + (f - 0.5) * 2 * half * 0.98
    const side = px - cx
    const top = roofTop + 2 + (rand() - 0.5) * 1.2
    const eaveY = wallTop - (rand() < 0.4 ? rand() * 3 : 0)
    if ((side < 0 && Math.round(f / 0.06) % 2) || (side > 0 && Math.round(f / 0.06) % 3 === 0))
      continue
    const t = Math.abs(side) / half
    const xTop = cx + side * 0.04
    const pts: Pt[] = [
      [xTop, top + t * 6],
      [px, eaveY - 1.2],
    ]
    out.push(stroke(side > 0 ? 'hair' : 'fine', pts))
  }
  for (const rf of [0.62]) {
    const ry = roofTop + (wallTop - roofTop) * rf
    const rw = prof(rf)
    out.push(
      stroke('line', [
        [cx - rw, ry],
        [cx - rw / 2, ry + 1.6],
        [cx, ry + 2],
        [cx + rw / 2, ry + 1.6],
        [cx + rw, ry],
      ]),
    )
  }
  out.push(stroke('line', roof))
  out.push(
    stroke('bold', [
      [cx - half - 0.5, wallTop],
      [cx + half + 0.5, wallTop],
    ]),
  )
  // Knob and finial.
  out.push(
    fill(
      Array.from(
        { length: 10 },
        (_, k) =>
          [
            cx + Math.cos((k / 10) * Math.PI * 2) * knob * 0.95,
            y + knob * 0.8 + Math.sin((k / 10) * Math.PI * 2) * knob * 0.95,
          ] as Pt,
      ),
    ),
  )
  return out
}
