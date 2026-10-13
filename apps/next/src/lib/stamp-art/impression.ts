// Shared "wear" texture for the owner's impression layer (B1). One file for every country; the
// component offsets and rotates it per country with `impressionTransform`.
//
// Convention: the rendered ALPHA is the mask. Opaque = ink kept, transparent = ink removed
// (the file is #fff, so `mask-mode: luminance` agrees with `alpha`). Composite it over the whole
// stamp with `mask-composite: intersect`. Inside the file the texture is built from an SVG <mask>
// (white keeps, black removes), which is why holes are real alpha holes in the rendered image.
//
// The viewBox is 300x300 centred on the 200x200 stamp (-50 -50 300 300) so any offset up to
// +-12 units and any rotation still covers the stamp. The pressure gradient is heavy on +x.
import { hash32, mulberry32 } from './hash'

export const IMPRESSION_VIEWBOX = '-50 -50 300 300'

const f = (v: number) => String(Math.round(v * 10) / 10)

/** Inner markup (defs + masked rect) shared by the committed file and the raster linter. */
export function impressionInner(): string {
  const rand = mulberry32(0x57a4b1e5)
  const r = (a: number, b: number) => a + (b - a) * rand()

  // Paper grain: tiny squares knocked out at partial strength.
  let grain = ''
  for (let i = 0; i < 520; i++) {
    const s = r(0.4, 1.1)
    grain += `M${f(r(-40, 240))} ${f(r(-40, 240))}h${f(s)}v${f(s)}h-${f(s)}z`
  }

  // Ink gaps: a few small irregular holes.
  let gaps = ''
  for (let i = 0; i < 7; i++) {
    const cx = r(25, 175),
      cy = r(30, 170),
      rad = r(1.4, 3.1)
    const sides = 7
    const pts = Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2 + r(-0.3, 0.3)
      const rr = rad * r(0.6, 1.2)
      return `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`
    })
    gaps += `M${pts.join('L')}Z`
  }

  // Broken edges: nicks near a circular border and near a rectangular border.
  let nicks = ''
  for (let i = 0; i < 34; i++) {
    const a = r(0, Math.PI * 2),
      rad = r(88, 98),
      s = r(0.9, 2.2)
    nicks += `M${f(100 + rad * Math.cos(a))} ${f(100 + rad * Math.sin(a))}h${f(s)}v${f(s)}h-${f(s)}z`
  }
  for (let i = 0; i < 34; i++) {
    const side = Math.floor(r(0, 4)),
      t = r(0, 1),
      s = r(0.9, 2.2)
    const x = side === 0 ? 6 + 188 * t : side === 1 ? 194 : side === 2 ? 6 + 188 * t : 6
    const y = side === 0 ? 24 : side === 1 ? 24 + 152 * t : side === 2 ? 176 : 24 + 152 * t
    nicks += `M${f(x + r(-1.5, 1.5))} ${f(y + r(-1.5, 1.5))}h${f(s)}v${f(s)}h-${f(s)}z`
  }

  return (
    `<defs>` +
    `<linearGradient id="p" gradientUnits="userSpaceOnUse" x1="-50" y1="0" x2="250" y2="0"><stop offset="0" stop-color="#bdbdbd"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
    `<radialGradient id="v" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="150"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>` +
    `<mask id="m" maskUnits="userSpaceOnUse" x="-50" y="-50" width="300" height="300">` +
    `<rect x="-50" y="-50" width="300" height="300" fill="url(#p)"/>` +
    `<rect x="-50" y="-50" width="300" height="300" fill="url(#v)"/>` +
    `<path d="${grain}" fill="#000" fill-opacity=".55"/>` +
    `<path d="${gaps}" fill="#000"/>` +
    `<path d="${nicks}" fill="#000"/>` +
    `</mask></defs>` +
    `<rect x="-50" y="-50" width="300" height="300" fill="#fff" mask="url(#m)"/>`
  )
}

export function impressionSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${IMPRESSION_VIEWBOX}">${impressionInner()}</svg>\n`
}

export type ImpressionTransform = {
  /** Offset of the texture in grid units (stamp is 200 wide). */
  dx: number
  dy: number
  /** CSS rotation of the texture in degrees, (-180, 180]. */
  rotate: number
  /** Direction of the heavy-pressure side in the stamp frame, [0, 360); 0 = right, 90 = down. */
  pressureAngle: number
}

/**
 * Per-country placement of the shared texture. The pressure side is the side that is pressed down
 * by the rest tilt: the right edge for a clockwise (positive) tilt, the left edge otherwise, with a
 * small hashed deviation. Texture is heavy on +x, so rotating it by `pressureAngle` points it there.
 */
export function impressionTransform(iso2: string, tilt: number): ImpressionTransform {
  const rand = mulberry32(hash32(`impression:${iso2.toUpperCase()}`))
  const dx = Math.round((rand() * 2 - 1) * 12 * 10) / 10
  const dy = Math.round((rand() * 2 - 1) * 12 * 10) / 10
  const jitter = (rand() * 2 - 1) * 16
  const pressureAngle = ((((tilt >= 0 ? 0 : 180) + jitter) % 360) + 360) % 360
  const rotate = pressureAngle > 180 ? pressureAngle - 360 : pressureAngle
  return {
    dx,
    dy,
    rotate: Math.round(rotate * 10) / 10,
    pressureAngle: Math.round(pressureAngle * 10) / 10,
  }
}
