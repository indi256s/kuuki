import { SHAPE_NAMES } from './frame'
import { impressionFileName, impressionSvg } from './impression'
import { loadRecipes } from './recipes'
import { renderEngraving } from './render'

/** Every generated file as `name -> content` (names relative to apps/next/public/stamps). */
export function stampFiles(): Record<string, string> {
  const files: Record<string, string> = {}
  for (const shape of SHAPE_NAMES) files[impressionFileName(shape)] = impressionSvg(shape)
  for (const recipe of loadRecipes()) {
    if (recipe.tier === 'engraved')
      files[`${recipe.iso2.toLowerCase()}.svg`] = renderEngraving(recipe)
  }
  return files
}
