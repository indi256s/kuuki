// Tata Somba (Koutammakou): squat mud houses, each a flat-roofed block with a tall round turret
// at either end and a smaller one behind, every turret capped by a conical thatch. Houses are
// listed as [x fraction, scale]; the box bottom is the ground and a low earth wall joins them.
import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, body, fill, hatch, hline, rectPts, stroke } from '../grid'
import { type KitModule, num } from './util'

/** A conical thatch cap: solid tip, fall-line strokes, a bold eave. Lit on the left. */
export function thatchCone(cx: number, eaveY: number, w: number, h: number): SvgNode[] {
  const L: Pt = [cx - w / 2, eaveY]
  const R: Pt = [cx + w / 2, eaveY]
  const apex: Pt = [cx, eaveY - h]
  const out: SvgNode[] = [...body([L, apex, R], 'line')]
  const n = Math.max(2, Math.round(w / 2.6))
  for (let i = 1; i < n; i++) {
    const t = i / n
    if (t < 0.38) continue
    out.push(
      stroke('hair', [
        [cx + (L[0] + w * t - cx) * 0.12, apex[1] + h * 0.2],
        [L[0] + w * t, eaveY - 0.8],
      ]),
    )
  }
  out.push(
    fill([
      [cx - 0.9, apex[1]],
      [cx + 0.9, apex[1]],
      [cx + 2, apex[1] + h * 0.22],
      [cx - 2, apex[1] + h * 0.22],
    ]),
  )
  out.push(hline('bold', L[0] - 0.8, R[0] + 0.8, eaveY))
  return out
}

function turret(
  cx: number,
  base: number,
  w: number,
  h: number,
  capH: number,
  capW: number,
): SvgNode[] {
  const out: SvgNode[] = [...body(rectPts(cx - w / 2, base - h, w, h), 'line')]
  out.push(...hatch(rectPts(cx + w * 0.12, base - h + 1, w * 0.38, h - 1), 'v', 2.4, 'hair', 0.6))
  out.push(...thatchCone(cx, base - h, capW, capH))
  return out
}

function house(cx: number, base: number, s: number, rand: () => number): SvgNode[] {
  const out: SvgNode[] = []
  const bw = 40 * s
  const bh = 13 * s
  // Rear turret first, then the block, then the two front turrets over its ends.
  out.push(...turret(cx, base - bh, 8 * s, 12 * s, 9 * s, 12 * s))
  out.push(...body(rectPts(cx - bw / 2, base - bh, bw, bh), 'line'))
  out.push(
    ...hatch(rectPts(cx + bw * 0.28, base - bh + 1, bw * 0.22, bh - 1), 'v', 2.4, 'hair', 0.6),
  )
  out.push(fill(rectPts(cx - 2 * s, base - 6.5 * s, 4 * s, 6.5 * s)))
  out.push(fill(rectPts(cx - bw * 0.3, base - bh * 0.7, 2.4 * s, 3 * s)))
  out.push(hline('bold', cx - bw / 2 - 1, cx + bw / 2 + 1, base - bh))
  for (const sg of [-1, 1]) {
    out.push(...turret(cx + sg * (bw / 2 - 5 * s), base, 10 * s, 25 * s, 13 * s, 15 * s))
  }
  void rand
  return out
}

export const tataSomba: KitModule = ([x, y, w, h], p) => {
  const rand = mulberry32(Math.round(num(p, 'seed', 3)))
  const base = y + h
  const list = (Array.isArray(p.houses) ? p.houses : [[0.3, 1]]) as [number, number][]
  const out: SvgNode[] = []
  // Low wall between houses, drawn first so the houses overlap it.
  const wallH = num(p, 'wallH', 6)
  out.push(...body(rectPts(x, base - wallH, w, wallH), 'line'))
  for (let wx = x + 4; wx < x + w - 2; wx += 3.2)
    out.push(
      stroke('hair', [
        [wx, base - wallH + 1.2],
        [wx, base - 0.6],
      ]),
    )
  for (const [f, s] of list) out.push(...house(x + w * f, base, s * (h / 52), rand))
  out.push(hline('bold', x, x + w, base))
  return out
}
