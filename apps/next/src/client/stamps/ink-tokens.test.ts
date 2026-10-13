import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { INKS, INK_NAMES } from '../../lib/stamp-art/inks'

const css = readFileSync(
  fileURLToPath(new URL('../../app/styles.css', import.meta.url)),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '')

/** `--stamp-ink-*` declarations of the rule whose selector is exactly `selector`. */
function inkTokens(selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [, raw, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (raw.replace(/\s+/g, '').replace(/"/g, "'") !== selector) continue
    for (const [, name, value] of body.matchAll(/--stamp-ink-([\w-]+)\s*:\s*([^;]+)/g))
      out[name] = value.trim().toLowerCase()
  }
  return out
}

describe('stamp ink tokens', () => {
  it('match lib/stamp-art/inks.ts in both themes, so the mask colours cannot drift from the CSS', () => {
    const light = inkTokens(':root')
    const dark = inkTokens(":root[data-theme='dark']")
    expect(Object.keys(light).sort()).toEqual([...INK_NAMES].sort())
    expect(Object.keys(dark).sort()).toEqual([...INK_NAMES].sort())
    for (const name of INK_NAMES) {
      expect(light[name]).toBe(INKS[name].light)
      expect(dark[name]).toBe(INKS[name].dark)
    }
  })
})
