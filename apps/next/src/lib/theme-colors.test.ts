import { describe, expect, it } from 'vitest'
import { recognizeAccent, resolveAccent } from './theme-colors'

describe('accent names', () => {
  it.each([
    ['shu', 'shu'],
    ['sakura', 'sakura'],
    ['terracotta', 'shu'],
    ['kincha', 'shu'],
    ['sumi', 'shu'],
    ['yellow', 'shu'],
    ['red', 'shu'],
    ['orange', 'shu'],
    ['blue', 'ai'],
    ['cyan', 'asagi'],
    ['teal', 'asagi'],
    ['purple', 'sakura'],
    ['coral', 'sakura'],
  ])('resolves %s to %s', (name, accent) => {
    expect(resolveAccent(name)).toBe(accent)
    expect(recognizeAccent(name)).toBe(accent)
  })

  it.each([null, undefined, '', 'Shu', 'toString', '__proto__', 7])(
    'does not recognize %j and falls back to shu',
    (value) => {
      expect(recognizeAccent(value)).toBeNull()
      expect(resolveAccent(value)).toBe('shu')
    },
  )
})
