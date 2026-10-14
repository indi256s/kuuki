import { type Recipe, parseRecipe } from '../recipe'
import am from './am.json'
import ch from './ch.json'
import eh from './eh.json'
import dz from './dz.json'
import ma from './ma.json'
import sz from './sz.json'
import ls from './ls.json'
import eg from './eg.json'
import de from './de.json'
import fr from './fr.json'
import ge from './ge.json'
import gr from './gr.json'
import it from './it.json'
import jp from './jp.json'
import ly from './ly.json'
import mx from './mx.json'
import me from './me.json'
import ph from './ph.json'
import sd from './sd.json'
import th from './th.json'
import tz from './tz.json'
import vn from './vn.json'
import za from './za.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = {
  am,
  ch,
  de,
  eg,
  eh,
  sz,
  ma,
  ls,
  dz,
  fr,
  ge,
  gr,
  it,
  jp,
  ly,
  me,
  mx,
  ph,
  sd,
  th,
  tz,
  vn,
  za,
}

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
