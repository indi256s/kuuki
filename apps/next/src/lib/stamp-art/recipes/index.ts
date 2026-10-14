import { type Recipe, parseRecipe } from '../recipe'
import am from './am.json'
import ch from './ch.json'
import eg from './eg.json'
import de from './de.json'
import fr from './fr.json'
import ge from './ge.json'
import gr from './gr.json'
import va from './va.json'
import mt from './mt.json'
import ad from './ad.json'
import sm from './sm.json'
import li from './li.json'
import gi from './gi.json'
import it from './it.json'
import jp from './jp.json'
import mx from './mx.json'
import me from './me.json'
import ph from './ph.json'
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
  fr,
  ge,
  gr,
  ad,
  mt,
  va,
  gi,
  li,
  sm,
  it,
  jp,
  me,
  mx,
  ph,
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
