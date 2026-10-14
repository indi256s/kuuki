// A whitewashed hill town of cubes stepping down a slope toward the bay: two depth rows of flat-roofed
// blocks, lit left, T4 right face, dark windows and arched doors, plus one small tower on the crest.
// `dir` 1 climbs to the left (crest left, sea right), -1 mirrors it. The box bottom is the shore.
import { mulberry32 } from '../hash'
import { type SvgNode, body, fill, hline, rectPts, toneFill } from '../grid'
import { type KitModule, num } from './util'

function cube(
  x: number,
  base: number,
  w: number,
  h: number,
  door: boolean,
  shade = true,
): SvgNode[] {
  const top = base - h
  const out = body(rectPts(x, top, w, h), 'line')
  if (shade)
    out.push(
      ...toneFill(rectPts(x + w * 0.72, top + 1, w * 0.28, h - 1), 'T4', {
        gap: 2.2,
        weight: 'fine',
      }),
    )
  out.push(hline('hair', x - 0.8, x + w + 0.8, top))
  if (h > 8) out.push(fill(rectPts(x + w * 0.2, top + 3, 1.8, 2.8)))
  if (door) {
    const dw = Math.min(3.4, w * 0.3)
    const dx = x + w * 0.35
    out.push(
      fill([
        [dx, base],
        [dx, base - 4],
        [dx + dw / 2, base - 5.4],
        [dx + dw, base - 4],
        [dx + dw, base],
      ]),
    )
  }
  return out
}

export const cubeTown: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 11)))
  const dir = num(p, 'dir', 1) >= 0 ? 1 : -1
  const base = y + h
  const cols = Math.round(num(p, 'cols', 12))
  const bw = w / cols
  const slopeTop = (c: number) => y + h * (0.12 + 0.62 * Math.pow(c / (cols - 1), 0.9))
  const out: SvgNode[] = []
  const fx = (c: number, off = 0) => (dir === 1 ? x + bw * c + off : x + w - bw * (c + 1) - off)
  for (const row of [0, 1]) {
    for (let c = 0; c < cols; c++) {
      const lift = row === 0 ? 7 : 0
      const baseY = base - lift
      const topY = Math.min(baseY - 6, slopeTop(c) + (row ? 8 : 0) + (rand() - 0.5) * 4)
      const tall = baseY - topY
      const stepped = tall > 18
      if (stepped) {
        out.push(
          ...cube(fx(c, row ? bw * 0.25 : 0), baseY, bw - 1.2, tall * 0.55, row === 1, row === 1),
        )
        out.push(
          ...cube(
            fx(c, row ? bw * 0.25 : 0) + (dir === 1 ? 0 : 1.5),
            baseY - tall * 0.5,
            bw - 2.6,
            tall * 0.5,
            false,
            false,
          ),
        )
      } else
        out.push(...cube(fx(c, row ? bw * 0.25 : 0), baseY, bw - 1.2, tall, row === 1, row === 1))
    }
  }
  // Crest tower.
  const tx = fx(0, 1)
  const tw = bw * 0.72
  out.push(...cube(tx + tw * 0.1, slopeTop(0) - 8, tw * 0.8, 9, false))
  return out
}
