// Shared parts for domed, arched buildings (Taj Mahal, Ahsan Manzil, Alamgiri Gate): pointed arch,
// onion dome profile, kiosk (chhatri) and merlon row. Not a recipe module.
import { type Pt, type SvgNode, body, fill, quad, rectPts, stroke, toneFill } from '../grid'

/** Pointed arch outline: straight jambs to `spring`, two arcs meeting at the apex `top`. */
export function pointedArch(x: number, top: number, w: number, bottom: number): Pt[] {
  const spring = top + (bottom - top) * 0.35
  const left = quad([x, spring], [x + w * 0.04, top + (spring - top) * 0.45], [x + w / 2, top], 6)
  const right = quad(
    [x + w / 2, top],
    [x + w * 0.96, top + (spring - top) * 0.45],
    [x + w, spring],
    6,
  ).slice(1)
  return [[x, bottom], ...left, ...right, [x + w, bottom]]
}

/** Onion dome outline: base width 2r at `base`, bulging to ~1.1r, ending in a point `h` above. */
export function onionPts(
  cx: number,
  base: number,
  r: number,
  h: number,
): { all: Pt[]; right: Pt[] } {
  const right = quad(
    [cx + r, base],
    [cx + r * 1.75, base - h * 0.32],
    [cx + r * 0.04, base - h],
    14,
  )
  const left: Pt[] = right.map(([px, py]) => [2 * cx - px, py])
  return { all: [...left, ...right.slice().reverse()], right }
}

/** Solid-outlined onion dome with a shaded right side and a finial pole. */
export function onionDome(
  cx: number,
  base: number,
  r: number,
  h: number,
  finial: number,
  shade = true,
): SvgNode[] {
  const { all, right } = onionPts(cx, base, r, h)
  const out: SvgNode[] = [...body(all, 'line')]
  if (shade)
    out.push(
      ...toneFill([[cx + r * 0.3, base], ...right], 'T4', {
        inset: 0.3,
        gap: [3, 3],
        weight: 'hair',
      }),
    )
  const tipY = base - h
  out.push(
    stroke('line', [
      [cx, tipY + 0.5],
      [cx, tipY - finial],
    ]),
  )
  out.push(fill(rectPts(cx - 1.1, tipY - finial - 1.2, 2.2, 2.2)))
  return out
}

/** Small open kiosk: a dark opening between posts under a flat roof slab and a small onion dome. */
export function kiosk(cx: number, base: number, w: number, h: number): SvgNode[] {
  const out: SvgNode[] = []
  const postsH = h * 0.42
  out.push(...body(rectPts(cx - w / 2, base - postsH, w, postsH), 'hair'))
  out.push(fill(rectPts(cx - w / 2 + w * 0.22, base - postsH + 1, w * 0.56, postsH - 1)))
  out.push(...body(rectPts(cx - w / 2 - 0.8, base - postsH - 1.6, w + 1.6, 1.8), 'hair'))
  out.push(...onionDome(cx, base - postsH - 1.6, w * 0.4, h * 0.46, h * 0.12, false))
  return out
}

/** A row of merlons along a wall top at `y`, from x0 to x1. */
export function merlons(x0: number, x1: number, y: number, mw = 3, gap = 2.4, mh = 2.6): SvgNode[] {
  const out: SvgNode[] = []
  for (let px = x0; px + mw <= x1 + 0.01; px += mw + gap)
    out.push(fill(rectPts(px, y - mh, mw, mh + 0.4)))
  return out
}
