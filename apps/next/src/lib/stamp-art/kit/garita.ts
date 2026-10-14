// El Morro (San Juan), close up: a tall bastion corner in front of the sea. A lit left face and a
// shaded right face meet at a vertical edge; a cordon and a flat parapet band run along both, and
// a big domed sentry box (garita) on corbels overhangs the corner. A small garita closes the right
// wall. The foot is a sea-cut rock band hatched along the fall line. The box is wall plus rock;
// its bottom is the bottom of the rock.
import {
  type Pt,
  type SvgNode,
  body,
  fill,
  occlude,
  rectPts,
  stroke,
  toneFill,
  vline,
} from '../grid'
import { type KitModule, num } from './util'

const garitaBox = (cx: number, base: number, s: number): SvgNode[] => {
  const hw = 5.2 * s
  const bodyH = 11 * s
  const top = base - bodyH
  const cap: Pt[] = [
    [cx - hw - 1.2 * s, top],
    [cx - hw * 0.55, top - 4 * s],
    [cx, top - 8 * s],
    [cx + hw * 0.55, top - 4 * s],
    [cx + hw + 1.2 * s, top],
  ]
  const corbel: Pt[] = [
    [cx - hw, base],
    [cx + hw, base],
    [cx + hw * 0.55, base + 3 * s],
    [cx - hw * 0.55, base + 3 * s],
  ]
  return [
    ...body(corbel, 'hair'),
    ...body(rectPts(cx - hw, top, hw * 2, bodyH), 'line'),
    ...toneFill(rectPts(cx + hw * 0.1, top + 0.8, hw * 0.9, bodyH - 1.6), 'T4', { inset: 0.4 }),
    fill(rectPts(cx - hw * 0.62, top + bodyH * 0.22, hw * 0.55, bodyH * 0.4)),
    occlude(cap),
    fill(cap),
  ]
}

export const garita: KitModule = ([x, y, w, h], p) => {
  const bottom = y + h
  const base = y + h * num(p, 'base', 0.86)
  const wallTop = y + h * num(p, 'top', 0.4)
  const sx = x + w * num(p, 'salient', 0.46)
  const right = x + w
  const scale = num(p, 'scale', 2)
  const out: SvgNode[] = []
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u
  const dipL = h * num(p, 'dipL', 0.16)
  const dipR = h * num(p, 'dipR', 0.08)
  const par = h * 0.075

  // Sea-cut rock band under the walls: ragged top edge, fall-line hatching.
  const rock: Pt[] = [[x, bottom]]
  for (let i = 0; i <= 24; i++) {
    const u = i / 24
    rock.push([x + u * w, base + 1 + Math.sin(u * 17) * 1.6 + Math.sin(u * 41 + 1) * 1.1])
  }
  rock.push([x + w, bottom])
  out.push(occlude(rock, { halo: 1 }), ...toneFill(rock, 'T4', { angle: 70, gap: [2.6, 2.6] }))
  out.push(stroke('hair', rock.slice(1, -1)))

  // Faces: nearly flat tops, a slight fall away from the salient.
  const lTop = wallTop + dipL
  const rTop = wallTop + dipR
  const left: Pt[] = [
    [x, lTop],
    [sx, wallTop],
    [sx, base],
    [x, base],
  ]
  const rightFace: Pt[] = [
    [sx, wallTop],
    [right, rTop],
    [right, base],
    [sx, base],
  ]
  out.push(...body(left, 'line'), ...body(rightFace, 'line'))
  const shade: Pt[] = [
    [sx, wallTop + par],
    [right, rTop + par],
    [right, base],
    [sx, base],
  ]
  out.push(...toneFill(shade, 'T4', { inset: 0.5, gap: [3.5, 3.5] }))
  // Parapet band and cordon on both faces.
  out.push(
    stroke('bold', [
      [x, lTop],
      [sx, wallTop],
      [right, rTop],
    ]),
    stroke('bold', [
      [x, lTop + par],
      [sx, wallTop + par],
      [right, rTop + par],
    ]),
  )
  // Embrasure slots in the parapet band of the lit face.
  for (let i = 0; i < 3; i++) {
    const u = (i + 0.5) / 3.2
    const ex = lerp(x, sx - 14 * scale * 0.4, u)
    const et = lerp(lTop, wallTop, (ex - x) / (sx - x))
    out.push(fill(rectPts(ex - 1.6, et + 1.6, 3.2, par - 3)))
  }
  // Masonry courses and the battered foot on the lit face.
  for (const f of [0.35, 0.6, 0.82]) {
    const ya = lerp(lTop + par, base, f)
    const yb = lerp(wallTop + par, base, f)
    out.push(
      stroke(f > 0.8 ? 'hair' : 'fine', [
        [x + 3, ya],
        [sx - 2, yb],
      ]),
    )
  }
  out.push(vline('bold', sx, wallTop, base))

  // Sentry boxes: the big one on the salient, a small one at the end of the right wall.
  out.push(...garitaBox(sx, wallTop + 1.5, scale))
  out.push(...garitaBox(right - 9, rTop + 1.5, scale * 0.45))
  return out
}
