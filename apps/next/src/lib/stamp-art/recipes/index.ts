import { type Recipe, parseRecipe } from '../recipe'
import am from './am.json'
import eg from './eg.json'
import de from './de.json'
import fr from './fr.json'
import ge from './ge.json'
import gr from './gr.json'
import it from './it.json'
import jp from './jp.json'
import mx from './mx.json'
import me from './me.json'
import th from './th.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = { am, de, eg, fr, ge, gr, it, jp, me, mx, th }

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
