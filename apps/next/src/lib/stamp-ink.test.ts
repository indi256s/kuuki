import { describe, expect, it } from 'vitest'
import { contrast, parseHex, rgbToOklch, type Rgb } from './color'
import { NEUTRAL_INK, SURFACE_COLOR } from './theme-colors'
import { stampInk } from './stamp-ink'

const flags = ['#000000', '#ffffff', '#ffcc00', '#0033a0', '#e41e20', '#006633', '#6b7280', '#ce1126']
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

describe('stampInk', () => {
  it.each(['light', 'dark'] as const)('reaches 3:1 against the %s surface for every flag color', theme => {
    for (const flag of flags) {
      const ink = stampInk(flag, theme)
      expect(contrast(parseHex(ink) as Rgb, parseHex(SURFACE_COLOR[theme]) as Rgb), `${flag} -> ${ink}`).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(['light', 'dark'] as const)('uses neutral ink for missing, black and white input (%s)', theme => {
    for (const flag of [null, undefined, '#000000', '#ffffff', 'not-a-color']) expect(stampInk(flag, theme)).toBe(NEUTRAL_INK[theme])
  })

  it.each(['light', 'dark'] as const)('keeps the hue of chromatic colors (%s)', theme => {
    for (const flag of ['#ffcc00', '#0033a0', '#e41e20', '#006633']) {
      const before = rgbToOklch(parseHex(flag) as Rgb), after = rgbToOklch(parseHex(stampInk(flag, theme)) as Rgb)
      expect(hueDistance(before.h, after.h), flag).toBeLessThan(12)
    }
  })

  it('moves light ink darker and dark ink lighter without touching already readable colors much', () => {
    expect(rgbToOklch(parseHex(stampInk('#ffcc00', 'light')) as Rgb).l).toBeLessThan(0.7)
    expect(rgbToOklch(parseHex(stampInk('#0033a0', 'dark')) as Rgb).l).toBeGreaterThan(0.6)
  })
})
