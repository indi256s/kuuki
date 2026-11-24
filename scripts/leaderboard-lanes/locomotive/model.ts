import { profile } from '../car/model'
import type { Surface, V3 } from '../airliner/surface'

export const LENGTH = 18.98
export const RAIL = 0.7175
export const MID = LENGTH / 2
export const HW = 1.5
export const ROOF = 4.05
export const WHEEL_R = 0.625
export const WHEEL_Y = RAIL + 0.03
export const TREAD = 0.135
export const BOGIES = [MID - 4.75, MID + 4.75] as const
export const AXLE_OFF = 1.5
export const BUF = 0.62
export const BODY0 = BUF
export const BODY1 = LENGTH - BUF
export const Z0 = 1.5
export const RS = 0.55

export const at = (a: number, y: number, z: number): V3 => [a - LENGTH, y, z]

const roofE = profile([
  [0, 2.62],
  [0.18, 3.08],
  [0.45, 3.55],
  [0.8, 3.88],
  [1.2, 4.0],
  [1.6, ROOF],
])
export const roofAt = (a: number) => roofE(Math.min(a - BODY0, BODY1 - a))

export function sectionYZ(a: number, v: number): [number, number] {
  const zt = roofAt(a)
  const wall = zt - RS - Z0
  const arc = (Math.PI / 2) * RS
  const top = 2 * (HW - RS)
  const segs = [HW, wall, arc, top, arc, wall, HW]
  const total = segs.reduce((n, s) => n + s, 0)
  let s = (((v % 1) + 1) % 1) * total
  const k = (i: number) => segs[i]
  if (s <= k(0)) return [s, Z0]
  s -= k(0)
  if (s <= k(1)) return [HW, Z0 + s]
  s -= k(1)
  if (s <= k(2)) {
    const t = s / RS
    return [HW - RS + RS * Math.cos(t), zt - RS + RS * Math.sin(t)]
  }
  s -= k(2)
  if (s <= k(3)) return [HW - RS - s, zt]
  s -= k(3)
  if (s <= k(4)) {
    const t = s / RS
    return [-(HW - RS) - RS * Math.sin(t), zt - RS + RS * Math.cos(t)]
  }
  s -= k(4)
  if (s <= k(5)) return [-HW, zt - RS - s]
  s -= k(5)
  return [-HW + s, Z0]
}
const vGrid = Array.from({ length: 145 }, (_, i) => i / 144)
const uGrid = (() => {
  const out: number[] = []
  const a0 = BODY0,
    a1 = BODY1
  const span = a1 - a0
  const add = (a: number) => out.push((a - a0) / span)
  for (let a = a0; a < a0 + 1.8; a += 0.06) add(a)
  for (let a = a0 + 1.8; a < a1 - 1.8; a += 0.35) add(a)
  for (let a = a1 - 1.8; a <= a1 + 1e-9; a += 0.06) add(a)
  return out
})()
export function roofV(a: number): [number, number] {
  const zt = roofAt(a)
  const segs = [
    HW,
    zt - RS - Z0,
    (Math.PI / 2) * RS,
    2 * (HW - RS),
    (Math.PI / 2) * RS,
    zt - RS - Z0,
    HW,
  ]
  const total = segs.reduce((n, s) => n + s, 0)
  return [(segs[0] + segs[1]) / total, (total - segs[5] - segs[6]) / total]
}
export const bodyU = (a: number) => (a - BODY0) / (BODY1 - BODY0)
export const bodyAt = (a: number, v: number): V3 => {
  const [y, z] = sectionYZ(a, v)
  return at(a, y, z)
}
export const body: Surface = {
  at: (u, v) => bodyAt(BODY0 + u * (BODY1 - BODY0), v),
  u: uGrid,
  v: vGrid,
  closed: true,
  flip: true,
}

const topOfY = (zt: number, y: number) => {
  const ay = Math.abs(y)
  if (ay <= HW - RS) return zt
  const dy = ay - (HW - RS)
  return zt - RS + Math.sqrt(Math.max(0, RS * RS - dy * dy))
}
const capY = (() => {
  const out: number[] = []
  const n = 60
  for (let i = 0; i <= n; i++) out.push(i / n)
  return out
})()
export const cap = (nose: boolean): Surface => {
  const a = nose ? BODY1 : BODY0
  const zt = roofAt(a)
  return {
    at: (u, v) => {
      const y = -HW + 2 * HW * u
      return at(a, y, Z0 + (topOfY(zt, y) - Z0) * v)
    },
    u: capY,
    v: 6,
    closed: false,
    flip: !nose,
  }
}
export { topOfY }
