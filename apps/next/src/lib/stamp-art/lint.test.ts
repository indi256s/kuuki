import { describe, expect, it } from 'vitest'
import { contrast, parseHex } from '../color'
import { SURFACE_COLOR } from '../theme-colors'
import { INKS } from './inks'
import { lintGeometry, lintRaw } from './lint'
import { SHAPE_NAMES } from './frame'
import { measureImpression, measureRaster } from './lint-raster'
import { parseRecipe } from './recipe'
import { loadRecipes, RECIPE_FILES } from './recipes'

const recipes = loadRecipes()

describe('stamp lint', () => {
  it('passes every engraved recipe, geometric and raster', async () => {
    expect(recipes.map((r) => r.iso2)).toEqual([
      'AM',
      'CH',
      'DE',
      'GE',
      'JP',
      'ME',
      'PH',
      'TH',
      'TZ',
      'VN',
      'ZA',
    ])
    for (const recipe of recipes) {
      expect(lintGeometry(recipe), recipe.iso2).toEqual([])
      expect((await measureRaster(recipe)).issues, recipe.iso2).toEqual([])
    }
  })

  const base = RECIPE_FILES.th as { layers: unknown[] }

  it('rejects a subject outside the window inset', () => {
    const bad = { ...base, layers: [{ module: 'tower', box: [150, 60, 40, 80] }] }
    expect(lintRaw(bad).some((i) => i.rule === 'frame')).toBe(true)
  })

  it('keeps the wear texture inside its removal band on every shape', async () => {
    for (const shape of SHAPE_NAMES) {
      expect((await measureImpression(shape)).issues, shape).toEqual([])
    }
  })

  it('rejects a near-empty recipe', async () => {
    const bad = parseRecipe({
      iso2: 'TH',
      tier: 'engraved',
      layers: [{ module: 'water', box: [60, 100, 80, 6], params: { rows: 1 } }],
    })
    const report = await measureRaster(bad)
    expect(report.issues.length).toBeGreaterThan(0)
  })

  it('rejects an unknown module', () => {
    const bad = { ...base, layers: [{ module: 'spaceship', box: [60, 60, 40, 40] }] }
    expect(lintRaw(bad).some((i) => i.rule === 'schema' && i.message.includes('spaceship'))).toBe(
      true,
    )
  })

  it('keeps every ink at 4.5:1 on the surface in both themes', () => {
    for (const [name, ink] of Object.entries(INKS)) {
      for (const theme of ['light', 'dark'] as const) {
        const ratio = contrast(parseHex(ink[theme])!, parseHex(SURFACE_COLOR[theme])!)
        expect(ratio, `${name} ${theme}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
