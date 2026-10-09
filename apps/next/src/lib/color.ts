// Pure sRGB / OKLCH helpers shared by stamp ink and the token contrast test.
// Math follows CSS Color 4 (OKLab via Björn Ottosson's matrices, WCAG 2.x contrast).

export type Rgb = [number, number, number] // 0..1 sRGB, gamma-encoded
export type Oklch = { l: number; c: number; h: number }

export function parseHex(hex: string): Rgb | null {
  const m = hex.trim().match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)
  if (!m) return null
  let h = m[1]
  if (h.length <= 4) h = [...h].map((ch) => ch + ch).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb
}

export function toHex(rgb: Rgb): string {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)

export function rgbToOklch(rgb: Rgb): Oklch {
  const [r, g, b] = rgb.map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.hypot(A, B)
  return { l: L, c, h: c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180),
    b = c * Math.sin((h * Math.PI) / 180)
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6)

/** Converts to gamma-encoded sRGB, reducing chroma (keeping L and hue) until it fits the gamut. */
export function oklchToRgb(color: Oklch): Rgb {
  let lo = 0,
    hi = color.c
  let linear = oklchToLinear(color)
  if (!inGamut(linear)) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid
      else hi = mid
    }
    linear = oklchToLinear({ ...color, c: lo })
  }
  return linear.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb
}

export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: Rgb, b: Rgb): number {
  const x = luminance(a),
    y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** `color-mix(in oklch, a p%, b)`: p is the share of `a` (0..1); hue takes the shorter arc. */
export function mixOklch(a: Oklch, b: Oklch, p: number): Oklch {
  const hueA = a.c < 1e-4 ? b.h : a.h,
    hueB = b.c < 1e-4 ? a.h : b.h
  let delta = hueA - hueB
  if (delta > 180) delta -= 360
  else if (delta < -180) delta += 360
  return {
    l: a.l * p + b.l * (1 - p),
    c: a.c * p + b.c * (1 - p),
    h: (((hueB + delta * p) % 360) + 360) % 360,
  }
}
