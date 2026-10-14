import { SHAPE_NAMES } from './frame'
import { impressionFileName, impressionSvg } from './impression'
import { loadRecipes } from './recipes'
import { renderEngraving } from './render'
import { bakeRing, initRingBake } from './ring-bake'
import { buildStampIndex } from './stamp-index'

/** Path of a country's baked ring text, relative to apps/next/public/stamps. */
export const ringFileName = (iso2: string) => `ring/${iso2.toLowerCase()}.svg`

/** Every generated file as `name -> content` (names relative to apps/next/public/stamps). */
export async function stampFiles(): Promise<Record<string, string>> {
  await initRingBake()
  const files: Record<string, string> = {}
  for (const shape of SHAPE_NAMES) files[impressionFileName(shape)] = impressionSvg(shape)
  for (const recipe of loadRecipes()) {
    if (recipe.tier === 'engraved')
      files[`${recipe.iso2.toLowerCase()}.svg`] = renderEngraving(recipe)
  }
  // The ring is separate from the engraving so fallback-tier countries have one too, and so regenerating an
  // engraving never touches the ring file.
  for (const [iso2, entry] of Object.entries(buildStampIndex()))
    files[ringFileName(iso2)] = bakeRing(iso2, entry.shape).svg
  return files
}
