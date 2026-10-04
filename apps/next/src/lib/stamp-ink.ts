import { contrast, oklchToRgb, parseHex, rgbToOklch, toHex, type Rgb } from './color'
import { NEUTRAL_INK, SURFACE_COLOR } from './theme-colors'

const TARGET = 3.1 // 3:1 required; a small margin survives 8-bit rounding
const MAX_CHROMA = 0.16

/**
 * Normalizes a flag-derived color into stamp ink for the given theme: OKLCH lightness is moved
 * (hue kept) until it reaches 3:1 against `--surface`, chroma is capped. Missing, near-black,
 * near-white and grey inputs get the neutral ink (`--text-muted` equivalent).
 */
export function stampInk(hex: string | null | undefined, theme: 'light' | 'dark'): string {
  const rgb = hex ? parseHex(hex) : null
  if (!rgb) return NEUTRAL_INK[theme]
  const { l, c, h } = rgbToOklch(rgb)
  if (l < 0.2 || l > 0.96 || c < 0.02) return NEUTRAL_INK[theme]
  const surface = parseHex(SURFACE_COLOR[theme]) as Rgb
  const chroma = Math.min(c, MAX_CHROMA)
  // Light surface: ink can only get darker. Dark surface: only lighter.
  const step = theme === 'light' ? -0.005 : 0.005
  let lightness = theme === 'light' ? Math.min(l, 0.62) : Math.max(l, 0.62)
  for (let i = 0; i < 200; i++) {
    const ink = toHex(oklchToRgb({ l: lightness, c: chroma, h }))
    if (contrast(parseHex(ink) as Rgb, surface) >= TARGET) return ink
    lightness += step
  }
  return NEUTRAL_INK[theme]
}
