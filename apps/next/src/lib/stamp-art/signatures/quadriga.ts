// DE: the quadriga on the Brandenburg Gate's attic, as a solid silhouette. Four horses abreast,
// a chariot body behind them and a slim staff with a wreath ring above. No figures.
import { type Pt, type SvgNode, fill, rectPts, stroke } from '../grid'
import type { KitModule } from '../kit'
import { num } from '../kit/util'

export const quadriga: KitModule = ([x, y, w, h], p) => {
  const horses = Math.max(2, Math.round(num(p, 'horses', 4)))
  const cx = x + w / 2
  const bottom = y + h
  const out: SvgNode[] = []
  // Chariot body: low, wide, with a raised front.
  const bodyW = w * 0.5
  out.push(
    fill([
      [cx - bodyW / 2, bottom],
      [cx - bodyW / 2, bottom - h * 0.3],
      [cx + bodyW / 2, bottom - h * 0.3],
      [cx + bodyW / 2, bottom],
    ]),
  )
  // Wheels at the outer ends.
  for (const s of [-1, 1]) {
    const wx = cx + s * (w * 0.5 - h * 0.15)
    const r = h * 0.16
    out.push(
      fill(
        Array.from(
          { length: 12 },
          (_, i) =>
            [
              wx + r * Math.cos((i * Math.PI) / 6),
              bottom - r + r * Math.sin((i * Math.PI) / 6),
            ] as Pt,
        ),
      ),
    )
  }
  // Horses: chest, arching neck, head tipped forward, one raised foreleg.
  const span = w * 0.74
  const pitch = span / horses
  for (let i = 0; i < horses; i++) {
    const hx = cx - span / 2 + pitch * (i + 0.5)
    const lean = (i - (horses - 1) / 2) * 0.9
    const hw = pitch * 0.4
    const headTop = y + h * 0.1 + Math.abs(i - (horses - 1) / 2) * h * 0.05
    out.push(
      fill([
        [hx - hw, bottom],
        [hx - hw, bottom - h * 0.35],
        [hx - hw * 0.7 + lean * 0.3, bottom - h * 0.55],
        [hx - hw * 0.35 + lean, headTop + h * 0.12],
        [hx - hw * 0.1 + lean, headTop],
        [hx + hw * 0.55 + lean, headTop + h * 0.05],
        [hx + hw * 0.5 + lean, headTop + h * 0.2],
        [hx + hw * 0.4, bottom - h * 0.5],
        [hx + hw, bottom - h * 0.3],
        [hx + hw, bottom],
      ]),
    )
  }
  // Staff with a wreath ring, rising from the chariot centre.
  const top = y - h * 0.05
  out.push(
    stroke('line', [
      [cx, bottom - h * 0.3],
      [cx, top + 5],
    ]),
  )
  const r = Math.min(5, w * 0.1)
  out.push(
    stroke(
      'line',
      Array.from(
        { length: 14 },
        (_, i) =>
          [
            cx + r * Math.cos((i * Math.PI * 2) / 14),
            top + r + r * Math.sin((i * Math.PI * 2) / 14),
          ] as Pt,
      ),
      true,
    ),
  )
  out.push(fill(rectPts(cx - 1.4, bottom - h * 0.72, 2.8, h * 0.44)))
  return out
}
