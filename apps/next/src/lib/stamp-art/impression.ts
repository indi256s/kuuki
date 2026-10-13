// Wear texture for the owner's impression layer (B1): one file per frame shape, because the broken
// edge has to follow that shape's outer rule. The component offsets and rotates it per country with
// `impressionTransform`.
//
// Convention: the rendered ALPHA is the mask. Opaque = ink kept, transparent = ink removed (the file
// is #fff, so `mask-mode: luminance` agrees with `alpha`). Composite it over the whole stamp with
// `mask-composite: intersect`. Inside the file the texture is built from an SVG <mask> (white keeps,
// black removes), which is why holes are real alpha holes in the rendered image.
//
// Anatomy: a pressure gradient across the shape's width (full ink over the strong 60%, falling toward the weak edge), paper
// grain that is mostly on the weak side, a few ink dropouts (one crossing the outer rule) and nicks
// along the outer rule. The strong side is +x; `impressionTransform` turns it toward the rest tilt.
//
// The viewBox is 300x300 centred on the 200x200 stamp (-50 -50 300 300) so a 180 degree rotation
// and the small offset still cover the stamp.
import { type ShapeName, outerPoly } from './frame'
import { hash32, mulberry32 } from './hash'
import type { Pt } from './grid'

export const IMPRESSION_VIEWBOX = '-50 -50 300 300'
export const impressionFileName = (shape: ShapeName) => `_impression-${shape}.svg`

/** Share of ink kept at the weak edge; the gradient reaches full ink 40% across the shape. */
const WEAK_KEEP = 0.59
const GRAIN_COUNT = 240
const NICK_COUNT = 24

const grey = (v: number) =>
  `#${Math.round(v * 255)
    .toString(16)
    .padStart(2, '0')
    .repeat(3)}`
const f = (v: number) => String(Math.round(v * 10) / 10)

/** Point and unit tangent at arc length `s` along a closed polygon. */
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

/** Inner markup (defs + masked rect) shared by the committed file and the raster linter. */
export function impressionInner(shape: ShapeName): string {
  const rand = mulberry32(hash32(`impression-art:${shape}`))
  const r = (a: number, b: number) => a + (b - a) * rand()

  // Paper grain: 1.2-2.4 unit specks at 0.7 strength, two thirds on the weak (-x) half.
  let grain = ''
  for (let i = 0; i < GRAIN_COUNT; i++) {
    const s = r(1.2, 2.4)
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

  // Dropouts: 3-5 blobs of 4-9 units; the first sits on the outer rule.
  let gaps = ''
  const blobs = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < blobs; i++) {
    const rad = r(2, 4.5)
    let cx: number, cy: number
    if (i === 0) {
      const { p } = along(poly, lengths, r(0, perimeter))
      ;[cx, cy] = p
    } else {
      cx = r(30, 170)
      cy = r(40, 160)
    }
    const sides = 9
    const pts = Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2 + r(-0.25, 0.25)
      const rr = rad * r(0.65, 1.15)
      return `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`
    })
    gaps += `M${pts.join('L')}Z`
  }

  // Nicks: 1.5 x 2-4 unit notches centred on the outer rule, long side across it.
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

  return (
    `<defs>` +
    `<linearGradient id="p" gradientUnits="userSpaceOnUse" x1="${f(left)}" y1="0" x2="${f(right)}" y2="0"><stop offset="0" stop-color="${grey(WEAK_KEEP)}"/><stop offset=".4" stop-color="#fff"/></linearGradient>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="-50" y="-50" width="300" height="300">` +
    `<rect x="-50" y="-50" width="300" height="300" fill="url(#p)"/>` +
    `<path d="${grain}" fill="#000" fill-opacity=".7"/>` +
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
  /** Offset of the texture in grid units (stamp is 200 wide). */
  dx: number
  dy: number
  /** CSS rotation of the texture in degrees: 0 or 180, so the nicks stay on the outer rule. */
  rotate: number
  /** Direction of the heavy-pressure side in the stamp frame, [0, 360); 0 = right, 180 = left. */
  pressureAngle: number
}

/**
 * Per-country placement of the shape's texture. The pressure side is the side that is pressed down
 * by the rest tilt: the right edge for a clockwise (positive) tilt, the left edge otherwise. The
 * texture is heavy on +x, so it is turned by 0 or 180 degrees only (every frame is point-symmetric
 * about the stamp centre), and the offset is small so the nicks stay on the outer rule.
 */
export function impressionTransform(iso2: string, tilt: number): ImpressionTransform {
  const rand = mulberry32(hash32(`impression:${iso2.toUpperCase()}`))
  const dx = Math.round((rand() * 2 - 1) * 1.5 * 10) / 10
  const dy = Math.round((rand() * 2 - 1) * 1.5 * 10) / 10
  const pressureAngle = tilt >= 0 ? 0 : 180
  return { dx, dy, rotate: pressureAngle, pressureAngle }
}
