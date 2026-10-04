// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal canvas stand-in: accepts only #rrggbb fill styles and keeps the previous style otherwise (like a real canvas).
function fakeContext() {
  let style = '#000000', pixel = [0, 0, 0, 255]
  const ctx = {
    get fillStyle() { return style },
    set fillStyle(value: string) {
      const m = value.match(/^#([\da-f]{6})$/i)
      if (m) { style = value; pixel = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).concat(255) }
    },
    clearRect() {},
    fillRect() {},
    getImageData: () => ({ data: pixel }),
  }
  return ctx
}

async function load() {
  vi.resetModules()
  return (await import('./resolve-color')).resolveColor
}

describe('resolveColor', () => {
  beforeEach(() => { document.documentElement.style.removeProperty('--map-land') })
  afterEach(() => { vi.restoreAllMocks() })

  it('resolves parseable values to rgba()', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext() as never)
    expect(await (await load())('#336699')).toBe('rgba(51,102,153,1)')
  })

  it('falls back to the resolved --map-land when the value cannot be parsed', async () => {
    document.documentElement.style.setProperty('--map-land', '#f2f0ed')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext() as never)
    const resolved = (await load())('color-mix(in oklch,#a94e35 24%,#f2f0ed)')
    expect(resolved).toBe('rgba(242,240,237,1)')
    expect(resolved).not.toContain('color-mix')
  })

  it('falls back to transparent without canvas support, never raw CSS', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect((await load())('color-mix(in oklch,red 50%,blue)')).toBe('rgba(0,0,0,0)')
  })
})
