import { type Recipe, parseRecipe } from '../recipe'
import am from './am.json'
import de from './de.json'
import ge from './ge.json'
import jp from './jp.json'
import me from './me.json'
import th from './th.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = { am, de, ge, jp, me, th }

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
