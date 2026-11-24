import { SHAPE_NAMES } from './frame'
import { impressionFileName, impressionSvg } from './impression'
import { loadRecipes } from './recipes'
import { renderEngraving } from './render'
import { bakeRing, initRingBake } from './ring-bake'
import { buildStampIndex } from './stamp-index'

export const ringFileName = (iso2: string) => `ring/${iso2.toLowerCase()}.svg`

export async function stampFiles(): Promise<Record<string, string>> {
  await initRingBake()
  const files: Record<string, string> = {}
  for (const shape of SHAPE_NAMES) files[impressionFileName(shape)] = impressionSvg(shape)
  for (const recipe of loadRecipes()) {
    if (recipe.tier === 'engraved')
      files[`${recipe.iso2.toLowerCase()}.svg`] = renderEngraving(recipe)
  }
  for (const [iso2, entry] of Object.entries(buildStampIndex()))
    files[ringFileName(iso2)] = bakeRing(iso2, entry.shape).svg
  return files
}
