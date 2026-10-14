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
import bg from './bg.json'
import bj from './bj.json'
import bm from './bm.json'
import bo from './bo.json'
import br from './br.json'
import bw from './bw.json'
import by from './by.json'
import bz from './bz.json'
import ca from './ca.json'
import ch from './ch.json'
import ci from './ci.json'
import cl from './cl.json'
import co from './co.json'
import cr from './cr.json'
import cv from './cv.json'
import cz from './cz.json'
import de from './de.json'
import dz from './dz.json'
import ec from './ec.json'
import eg from './eg.json'
import eh from './eh.json'
import es from './es.json'
import fk from './fk.json'
import fr from './fr.json'
import ge from './ge.json'
import gf from './gf.json'
import gh from './gh.json'
import gi from './gi.json'
import gl from './gl.json'
import gm from './gm.json'
import gn from './gn.json'
import gr from './gr.json'
import gs from './gs.json'
import gt from './gt.json'
import gw from './gw.json'
import gy from './gy.json'
import hn from './hn.json'
import hr from './hr.json'
import hu from './hu.json'
import it from './it.json'
import jp from './jp.json'
import li from './li.json'
import lr from './lr.json'
import ls from './ls.json'
import lu from './lu.json'
import ly from './ly.json'
import ma from './ma.json'
import mc from './mc.json'
import md from './md.json'
import me from './me.json'
import mk from './mk.json'
import ml from './ml.json'
import mr from './mr.json'
import mt from './mt.json'
import mx from './mx.json'
import na from './na.json'
import ne from './ne.json'
import ng from './ng.json'
import ni from './ni.json'
import nl from './nl.json'
import pa from './pa.json'
import pe from './pe.json'
import ph from './ph.json'
import pl from './pl.json'
import pm from './pm.json'
import py from './py.json'
import ro from './ro.json'
import rs from './rs.json'
import sd from './sd.json'
import sh from './sh.json'
import si from './si.json'
import sl from './sl.json'
import sm from './sm.json'
import sn from './sn.json'
import sr from './sr.json'
import sv from './sv.json'
import sz from './sz.json'
import tg from './tg.json'
import th from './th.json'
import tn from './tn.json'
import tz from './tz.json'
import us from './us.json'
import uy from './uy.json'
import va from './va.json'
import ve from './ve.json'
import vn from './vn.json'
import xk from './xk.json'
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
  bg,
  bj,
  bm,
  bo,
  br,
  bw,
  by,
  bz,
  ca,
  ch,
  ci,
  cl,
  co,
  cr,
  cv,
  cz,
  de,
  dz,
  ec,
  eg,
  eh,
  es,
  fk,
  fr,
  ge,
  gf,
  gh,
  gi,
  gl,
  gm,
  gn,
  gr,
  gs,
  gt,
  gw,
  gy,
  hn,
  hr,
  hu,
  it,
  jp,
  li,
  lr,
  ls,
  lu,
  ly,
  ma,
  mc,
  md,
  me,
  mk,
  ml,
  mr,
  mt,
  mx,
  na,
  ne,
  ng,
  ni,
  nl,
  pa,
  pe,
  ph,
  pl,
  pm,
  py,
  ro,
  rs,
  sd,
  sh,
  si,
  sl,
  sm,
  sn,
  sr,
  sv,
  sz,
  tg,
  th,
  tn,
  tz,
  us,
  uy,
  va,
  ve,
  vn,
  xk,
  za,
}

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
