import { type Recipe, parseRecipe } from '../recipe'
import ad from './ad.json'
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
import gi from './gi.json'
import gl from './gl.json'
import gr from './gr.json'
import gt from './gt.json'
import hn from './hn.json'
import it from './it.json'
import jp from './jp.json'
import li from './li.json'
import me from './me.json'
import mt from './mt.json'
import mx from './mx.json'
import ph from './ph.json'
import pm from './pm.json'
import sm from './sm.json'
import th from './th.json'
import tz from './tz.json'
import va from './va.json'
import vn from './vn.json'
import za from './za.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = {
  ad,
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
  gi,
  gl,
  gr,
  gt,
  hn,
  it,
  jp,
  li,
  me,
  mt,
  mx,
  ph,
  pm,
  sm,
  th,
  tz,
  va,
  vn,
  za,
}

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
