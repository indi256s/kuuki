import { type Recipe, parseRecipe } from '../recipe'
import ad from './ad.json'
import al from './al.json'
import am from './am.json'
import aq from './aq.json'
import ar from './ar.json'
import at from './at.json'
import ba from './ba.json'
import be from './be.json'
import bf from './bf.json'
import bj from './bj.json'
import bm from './bm.json'
import bo from './bo.json'
import br from './br.json'
import bw from './bw.json'
import bz from './bz.json'
import ca from './ca.json'
import ch from './ch.json'
import ci from './ci.json'
import cl from './cl.json'
import co from './co.json'
import cr from './cr.json'
import cv from './cv.json'
import de from './de.json'
import dz from './dz.json'
import eg from './eg.json'
import eh from './eh.json'
import es from './es.json'
import fr from './fr.json'
import ge from './ge.json'
import gh from './gh.json'
import gi from './gi.json'
import gl from './gl.json'
import gm from './gm.json'
import gn from './gn.json'
import gr from './gr.json'
import gt from './gt.json'
import hn from './hn.json'
import hr from './hr.json'
import it from './it.json'
import jp from './jp.json'
import li from './li.json'
import ls from './ls.json'
import lu from './lu.json'
import ly from './ly.json'
import ma from './ma.json'
import mc from './mc.json'
import me from './me.json'
import mk from './mk.json'
import mt from './mt.json'
import mx from './mx.json'
import na from './na.json'
import ni from './ni.json'
import nl from './nl.json'
import pa from './pa.json'
import ph from './ph.json'
import pm from './pm.json'
import sd from './sd.json'
import sm from './sm.json'
import sv from './sv.json'
import sz from './sz.json'
import th from './th.json'
import tn from './tn.json'
import tz from './tz.json'
import us from './us.json'
import va from './va.json'
import vn from './vn.json'
import za from './za.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = {
  ad,
  al,
  am,
  aq,
  ar,
  at,
  ba,
  be,
  bf,
  bj,
  bm,
  bo,
  br,
  bw,
  bz,
  ca,
  ch,
  ci,
  cl,
  co,
  cr,
  cv,
  de,
  dz,
  eg,
  eh,
  es,
  fr,
  ge,
  gh,
  gi,
  gl,
  gm,
  gn,
  gr,
  gt,
  hn,
  hr,
  it,
  jp,
  li,
  ls,
  lu,
  ly,
  ma,
  mc,
  me,
  mk,
  mt,
  mx,
  na,
  ni,
  nl,
  pa,
  ph,
  pm,
  sd,
  sm,
  sv,
  sz,
  th,
  tn,
  tz,
  us,
  va,
  vn,
  za,
}

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
