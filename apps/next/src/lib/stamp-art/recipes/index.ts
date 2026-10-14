import { type Recipe, parseRecipe } from '../recipe'
import am from './am.json'
import aq from './aq.json'
import bm from './bm.json'
import bz from './bz.json'
import ch from './ch.json'
import cr from './cr.json'
import de from './de.json'
import eg from './eg.json'
import fr from './fr.json'
import ge from './ge.json'
import gl from './gl.json'
import gr from './gr.json'
import gt from './gt.json'
import hn from './hn.json'
import it from './it.json'
import jp from './jp.json'
import me from './me.json'
import mx from './mx.json'
import ph from './ph.json'
import pm from './pm.json'
import th from './th.json'
import tz from './tz.json'
import vn from './vn.json'
import za from './za.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = {
  am,
  aq,
  bm,
  bz,
  ch,
  cr,
  de,
  eg,
  fr,
  ge,
  gl,
  gr,
  gt,
  hn,
  it,
  jp,
  me,
  mx,
  ph,
  pm,
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
