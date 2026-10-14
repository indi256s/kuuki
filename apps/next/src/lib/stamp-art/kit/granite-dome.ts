// A broad bald granite dome (Sibebe Rock). The box bottom is the foot. The crown stays bare paper;
// the shaded right flank takes curved fall lines, the lit left flank a few fine streaks.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'

export const graniteDome: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 41)))
  const base = y + h
  const cx = x + w * num(p, 'axis', 0.48)
  const prof = (t: number) => y + h * (1 - (1 - Math.abs(2 * t - 1) ** 2.4) ** 0.6)
  const sil: Pt[] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    sil.push([x + w * t, prof(t) + (i > 0 && i < 40 ? (rand() - 0.5) * 0.5 : 0)])
  }
  const poly: Pt[] = [...sil, [x + w, base], [x, base]]
  const out: SvgNode[] = [occlude(poly)]
  const topAt = (px: number) => {
    const t = (px - x) / w
    return prof(Math.min(1, Math.max(0, t)))
  }
  const crown = num(p, 'crown', 0.26) * h
  // Right flank: curved fall lines from below the bare crown to the foot.
  for (let px = cx + 3; px < x + w - 8; px += 2.1) {
    const top = Math.max(topAt(px) + 2, y + crown * (1 - (px - cx) / (w * 0.55)) + 4)
    const bow = (px - cx) * 0.12
    const pts: Pt[] = []
    for (let k = 0; k <= 6; k++) {
      const f = k / 6
      pts.push([px + bow * f * f, top + (base - top) * f])
    }
    if (rand() < 0.2) continue
    out.push(stroke('hair', pts))
  }
  // Lit flank: a few short fine streaks.
  for (let px = x + 4; px < cx - 2; px += 4.2 + rand() * 3) {
    const top = topAt(px) + 5 + rand() * 12
    out.push(
      stroke('fine', [
        [px, top],
        [px - (cx - px) * 0.05, top + 6 + rand() * 14],
      ]),
    )
  }
  // Slab joints across the crown.
  out.push(
    stroke('hair', [
      [cx - w * 0.22, y + h * 0.3],
      [cx - w * 0.08, y + h * 0.26],
      [cx + w * 0.06, y + h * 0.29],
    ]),
  )
  out.push(stroke('line', sil))
  return out
}
