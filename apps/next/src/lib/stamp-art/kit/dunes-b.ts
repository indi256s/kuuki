import { mulberry32 } from '../hash'
import { type Pt, type SvgNode, hatchPoly, occlude, stroke } from '../grid'
import { type KitModule, num } from './util'

type Ridge = {
  px: number
  foot: number
  h: number
  lw: number
  ls: number
  wet: boolean
}

function ridgesOf(p: Record<string, unknown>): Ridge[] {
  const raw = Array.isArray(p.ridges) ? p.ridges : []
  return raw
    .filter(
      (r): r is number[] =>
        Array.isArray(r) && r.length >= 5 && r.every((n) => typeof n === 'number'),
    )
    .map((r) => ({ px: r[0], foot: r[1], h: r[2], lw: r[3], ls: r[4], wet: r[5] === 1 }))
}

export const dunesB: KitModule = ([x, y, w, h], p) => {
  const ridges = ridgesOf(p)
  const q = num(p, 'slip', 0.28)
  const rand = mulberry32(Math.round(num(p, 'seed', 4)))
  const bottom = y + h
  const left = x - 8
  const right = x + w + 8
  const out: SvgNode[] = []
  const firstFoot = ridges.length ? y + h * Math.min(...ridges.map((r) => r.foot)) : y
  ridges.forEach((r, i) => {
    const t = ridges.length > 1 ? i / (ridges.length - 1) : 1
    const yb = y + h * r.foot
    const H = h * r.h
    const xp = x + w * r.px
    const xl = xp - w * r.lw
    const xr = xp + w * r.ls
    const lw = xp - xl
    const ls = xr - xp
    const ph = rand() * 6
    const ph2 = rand() * 6
    const ySil = (px: number): number => {
      if (px <= xl || px >= xr) return yb
      if (px <= xp) {
        const u = (px - xl) / lw
        const smooth = u * u * (3 - 2 * u)
        const wob =
          Math.sin(u * Math.PI * 2.3 + ph) * 0.05 + Math.sin(u * Math.PI * 5.1 + ph2) * 0.02
        return yb - H * (0.5 * smooth + 0.5 * Math.pow(u, 1.7) + wob * (1 - u) * Math.min(1, u * 5))
      }
      const v = (px - xp) / ls
      return yb - H * Math.pow(1 - v, 1.7)
    }
    const sil: Pt[] = []
    for (let px = left; px <= right; px += 1.5) sil.push([px, ySil(px)])
    sil.push([right, ySil(right)])
    const hull: Pt[] = [...sil, [right, bottom + 2], [left, bottom + 2]]
    out.push(occlude(hull, { halo: 2.4 }))

    const floor: Pt[] = [
      [left, yb],
      [right, yb],
      [right, bottom],
      [left, bottom],
    ]
    if (r.wet) {
      out.push(
        ...hatchPoly(floor, {
          angle: 0,
          gap: num(p, 'wetGap', 3.6),
          weight: p.wetGap === undefined ? 'fine' : 'line',
          ramp: [firstFoot, bottom],
        }),
      )
    } else {
      out.push(
        ...hatchPoly(floor, {
          angle: 0,
          gap: [3.4, 2.2],
          weight: t < 0.34 ? 'fine' : 'hair',
          ramp: [firstFoot, bottom],
          phase: 0.2,
        }),
      )
    }

    const qx = xp + ls * q
    const term: Pt[] = []
    const steps = 14
    for (let k = 0; k <= steps; k++) {
      const s = k / steps
      const sway = Math.sin(s * Math.PI * 1.6 + ph) * ls * 0.05 * s
      term.push([xp + (qx - xp) * Math.pow(s, 1.25) + sway, yb - H + H * s])
    }
    const slip: Pt[] = []
    for (let px = xp; px <= xr; px += 1.2) slip.push([px, ySil(px)])
    slip.push([xr, yb])
    const wedge: Pt[] = [...slip, [qx, yb], ...term.slice().reverse()]

    if (t >= 0.34) {
      const top = yb - H * 0.55
      const lit: Pt[] = [
        [xl, yb],
        ...sil.filter(([px]) => px > xl && px <= xp).map(([px, py]): Pt => [px, Math.max(py, top)]),
        ...term.map(([tx, ty]): Pt => [tx, Math.max(ty, top)]).reverse(),
        [qx, yb],
      ]
      out.push(...hatchPoly(lit, { angle: 0, gap: 4.4, weight: 'fine', phase: 0.35 }))
    }

    out.push(
      ...hatchPoly(wedge, {
        angle: t < 0.34 ? -58 : 90,
        gap: 2.9 - 0.7 * t,
        weight: t < 0.4 ? 'fine' : 'hair',
        phase: 0.3,
      }),
    )

    const crest = sil.filter(([px]) => px >= xl && px <= xr)
    out.push(stroke(t < 0.34 ? 'hair' : 'line', [[xl, yb], ...crest, [xr, yb]]))
    if (t >= 0.34) out.push(stroke('fine', term))
  })
  return out
}
