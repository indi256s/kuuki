import { type Recipe, parseRecipe } from '../recipe'
import am from './am.json'
import ch from './ch.json'
import de from './de.json'
import ge from './ge.json'
import jp from './jp.json'
import me from './me.json'
import ph from './ph.json'
import th from './th.json'
import tz from './tz.json'
import vn from './vn.json'
import za from './za.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = { am, ch, de, ge, jp, me, ph, th, tz, vn, za }

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
