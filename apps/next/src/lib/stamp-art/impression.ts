import { type ShapeName, outerPoly, windowPoly } from './frame'
import { pointInPoly } from './geom'
import { hash32, mulberry32 } from './hash'
import type { Pt } from './grid'

export const IMPRESSION_VIEWBOX = '-50 -50 300 300'
export const impressionFileName = (shape: ShapeName) => `_impression-${shape}.svg`

const WEAK_KEEP = 0.8
const GRAIN_COUNT = 340
const NICK_COUNT = 24

const grey = (v: number) =>
  `#${Math.round(v * 255)
    .toString(16)
    .padStart(2, '0')
    .repeat(3)}`
const f = (v: number) => String(Math.round(v * 10) / 10)

function along(poly: Pt[], lengths: number[], s: number): { p: Pt; t: Pt } {
  let i = 0
  while (i < poly.length - 1 && lengths[i + 1] < s) i++
  const a = poly[i],
    b = poly[(i + 1) % poly.length]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const k = (s - lengths[i]) / len
  return {
    p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k],
    t: [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
  }
}

const RULE_GAP_MAX = 3

export function impressionGaps(
  shape: ShapeName,
  rand: () => number,
  poly: Pt[],
  lengths: number[],
  perimeter: number,
): Pt[][] {
  const r = (a: number, b: number) => a + (b - a) * rand()
  const win = windowPoly(shape)
  const blobs = 3 + Math.floor(rand() * 3)
  const out: Pt[][] = []
  for (let i = 0; i < blobs; i++) {
    let rad = r(2, 4.5)
    let cx = 0,
      cy = 0
    if (i === 0) {
      rad = Math.min(rad, RULE_GAP_MAX)
      const { p, t } = along(poly, lengths, r(0, perimeter))
      const flip = (-t[1] * (p[0] - 100) + t[0] * (p[1] - 100) < 0 ? -1 : 1) * rad * 0.5
      cx = p[0] - t[1] * flip
      cy = p[1] + t[0] * flip
    }
    const sides = 9
    const shapeAt = () =>
      Array.from({ length: sides }, (_, k) => {
        const a = (k / sides) * Math.PI * 2 + r(-0.25, 0.25)
        const rr = rad * r(0.65, 1.15)
        return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as Pt
      })
    if (i === 0) {
      out.push(shapeAt())
      continue
    }
    let pts: Pt[] = []
    for (let tries = 0; tries < 40; tries++) {
      cx = r(30, 170)
      cy = r(40, 160)
      pts = shapeAt()
      if (pts.every((q) => pointInPoly(q, win))) break
    }
    out.push(pts)
  }
  return out
}

function texture(shape: ShapeName) {
  const rand = mulberry32(hash32(`impression-art:${shape}`))
  const r = (a: number, b: number) => a + (b - a) * rand()

  let grain = ''
  for (let i = 0; i < GRAIN_COUNT; i++) {
    const s = r(2.2, 3.5)
    const x = rand() < 2 / 3 ? r(0, 100) : r(100, 200)
    grain += `M${f(x)} ${f(r(0, 200))}h${f(s)}v${f(s * r(0.6, 1.2))}h-${f(s)}z`
  }

  const poly = outerPoly(shape)
  const lengths = [0]
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length]
    lengths.push(lengths[i] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const perimeter = lengths[poly.length]
  const xs = poly.map((q) => q[0])
  const left = Math.min(...xs),
    right = Math.max(...xs)

  const gapPolys = impressionGaps(shape, rand, poly, lengths, perimeter)

  let nicks = ''
  for (let i = 0; i < NICK_COUNT; i++) {
    const { p, t } = along(poly, lengths, ((i + r(0.1, 0.9)) / NICK_COUNT) * perimeter)
    const nx = -t[1],
      ny = t[0]
    const hw = 0.75,
      hl = r(2, 4) / 2
    const c = (u: number, v: number) =>
      `${f(p[0] + t[0] * u + nx * v)} ${f(p[1] + t[1] * u + ny * v)}`
    nicks += `M${c(-hw, -hl)}L${c(hw, -hl)}L${c(hw, hl)}L${c(-hw, hl)}Z`
  }

  return { grain, gapPolys, nicks, left, right }
}

export const impressionGapPolys = (shape: ShapeName): Pt[][] => texture(shape).gapPolys

export function impressionInner(shape: ShapeName): string {
  const { grain, gapPolys, nicks, left, right } = texture(shape)
  const gaps = gapPolys
    .map((pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`)
    .join('')
  return (
    `<defs>` +
    `<linearGradient id="p" gradientUnits="userSpaceOnUse" x1="${f(left)}" y1="0" x2="${f(right)}" y2="0"><stop offset="0" stop-color="${grey(WEAK_KEEP)}"/><stop offset=".4" stop-color="#fff"/></linearGradient>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="-50" y="-50" width="300" height="300">` +
    `<rect x="-50" y="-50" width="300" height="300" fill="url(#p)"/>` +
    `<path d="${grain}" fill="#000"/>` +
    `<path d="${gaps}" fill="#000"/>` +
    `<path d="${nicks}" fill="#000"/>` +
    `</mask></defs>` +
    `<rect x="-50" y="-50" width="300" height="300" fill="#fff" mask="url(#m)"/>`
  )
}

export function impressionSvg(shape: ShapeName): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${IMPRESSION_VIEWBOX}">${impressionInner(shape)}</svg>\n`
}

export type ImpressionTransform = {
  dx: number
  dy: number
  rotate: number
  pressureAngle: number
}

export function impressionTransform(iso2: string, tilt: number): ImpressionTransform {
  const rand = mulberry32(hash32(`impression:${iso2.toUpperCase()}`))
  const dx = Math.round((rand() * 2 - 1) * 1.5 * 10) / 10
  const dy = Math.round((rand() * 2 - 1) * 1.5 * 10) / 10
  const pressureAngle = tilt >= 0 ? 0 : 180
  return { dx, dy, rotate: pressureAngle, pressureAngle }
}
