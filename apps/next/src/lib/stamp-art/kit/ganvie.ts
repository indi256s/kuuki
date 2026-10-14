// Ganvie: thatched huts on posts above a lake, with a dugout canoe in front. Each hut is a steep
// thatch roof (hatched along the fall line, solid ridge), a small lit wall with a dark doorway,
// a deck line and a row of thin posts to the waterline. The box bottom is the waterline.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hline, quad, rectPts, stroke, vline } from '../grid'
import { type KitModule, num } from './util'

function hut(cx: number, base: number, s: number, rand: () => number): SvgNode[] {
  const out: SvgNode[] = []
  const postH = 9 * s
  const wallH = 9 * s
  const roofH = 17 * s
  const wallW = 24 * s
  const deckY = base - postH
  const wallTop = deckY - wallH
  const roofW = wallW + 12 * s
  // Posts, thin and uneven.
  const n = 4
  for (let i = 0; i < n; i++) {
    const px = cx - wallW / 2 + 1 + ((wallW - 2) * i) / (n - 1)
    out.push(
      stroke('hair', [
        [px, deckY],
        [px + (rand() - 0.5) * 0.8, base + 1],
      ]),
    )
  }
  out.push(...body(rectPts(cx - wallW / 2 - 1.5, deckY - 1.6, wallW + 3, 1.6), 'hair'))
  out.push(...body(rectPts(cx - wallW / 2, wallTop, wallW, wallH - 1.6), 'line'))
  out.push(fill(rectPts(cx - 2 * s, wallTop + 3 * s, 4 * s, wallH - 1.6 - 3 * s)))
  out.push(fill(rectPts(cx - wallW / 2 + 2 * s, wallTop + 3.4 * s, 2.4 * s, 2.4 * s)))
  out.push(fill(rectPts(cx + wallW / 2 - 4.4 * s, wallTop + 3.4 * s, 2.4 * s, 2.4 * s)))
  // Thatch: a solid-edged gable with fall-line hatching and a lit left face.
  const apex: Pt = [cx, wallTop - roofH]
  const L: Pt = [cx - roofW / 2, wallTop + 1.2]
  const R: Pt = [cx + roofW / 2, wallTop + 1.2]
  out.push(...body([L, apex, R], 'line'))
  const lines = Math.round(roofW / 3.4)
  for (let i = 1; i < lines; i++) {
    const t = i / lines
    if (t < 0.6) continue
    const ex = L[0] + (R[0] - L[0]) * t
    const ax = apex[0] + (ex - apex[0]) * 0.1
    out.push(
      stroke('hair', [
        [ax, apex[1] + roofH * 0.22],
        [ex, L[1] - 0.8],
      ]),
    )
  }
  out.push(
    fill([
      [apex[0] - 1.1, apex[1] - 0.5],
      [apex[0] + 1.1, apex[1] - 0.5],
      [apex[0] + 2.4, apex[1] + roofH * 0.2],
      [apex[0] - 2.4, apex[1] + roofH * 0.2],
    ]),
  )
  out.push(hline('bold', L[0] - 1, R[0] + 1, L[1]))
  return out
}

function canoe(x: number, y: number, w: number, h: number): SvgNode[] {
  const top = quad([x, y], [x + w / 2, y + h * 0.5], [x + w, y - h * 0.15], 14)
  const bot = quad([x + w, y - h * 0.15], [x + w / 2, y + h * 1.35], [x, y], 14)
  const out: SvgNode[] = [fill([...top, ...bot.slice(1)])]
  out.push(hline('line', x - 3, x + w + 3, y + h * 0.9))
  return out
}

export const ganvie: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 9)))
  const base = y + h
  const out: SvgNode[] = []
  const huts: [number, number, number][] = [
    [0.2, 1.1, 0.0],
    [0.74, 1.3, 1],
  ]
  for (const [f, s, dy] of huts) out.push(...hut(x + w * f, base - 4 + dy, s * (h / 60), rand))
  out.push(...canoe(x + w * 0.34, base + 1, w * 0.3, 3.4))
  out.push(vline('hair', x + w * 0.52, base - 4, base + 1.5))
  return out
}
