import { afterEach, expect, it, vi } from 'vitest'
import * as recipes from '../../../lib/stamp-art/recipes'
import type { Recipe } from '../../../lib/stamp-art/recipe'
import type { Row } from './stamps'
import { emWidth } from '../../../client/stamps/ring-fit'
import { SHAPE_NAMES } from '../../../lib/stamp-art/frame'
import StampsPage from './page'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})
it('refreshes art, frame, ink and tier together from current recipes', async () => {
  vi.stubEnv('NODE_ENV', 'development')
  const all = recipes.loadRecipes()
  let recipe: Recipe = structuredClone(all.find((r) => r.iso2 === 'JP')!)
  vi.spyOn(recipes, 'loadRecipes').mockImplementation(() =>
    all.map((r) => (r.iso2 === 'JP' ? recipe : r)),
  )
  const current = async () => {
    const page = await StampsPage({ searchParams: Promise.resolve({}) })
    const rows = page.props.rows as Row[]
    for (const locale of ['en', 'ru'] as const) {
      const width = (row: Row) => emWidth(row.names[locale].toLocaleUpperCase(locale))
      for (const row of [...rows].sort((a, b) => width(b) - width(a)).slice(0, 3)) {
        for (const shape of SHAPE_NAMES)
          expect(row.preview.rings[shape]).toMatch(/^data:image\/svg\+xml,/)
      }
    }
    return rows.find((r) => r.iso2 === 'JP')!
  }
  const before = await current()
  recipe = { ...recipe, shape: 'circle', ink: 'indigo', horizon: 0.6 }
  const changed = await current()
  expect(changed.preview.meta).toMatchObject({ shape: 'circle', ink: 'indigo', tier: 'engraved' })
  expect(changed.preview.engraving).toMatch(/^data:image\/svg\+xml,/)
  expect(changed.preview.engraving).not.toBe(before.preview.engraving)
  expect(changed.preview.rings.circle).not.toBe(before.preview.rings.oval)
  recipe = { ...recipe, tier: 'fallback' }
  const fallback = await current()
  expect(fallback.preview.meta.tier).toBe('fallback')
  expect(fallback.preview.engraving).toBeUndefined()
}, 30000)
