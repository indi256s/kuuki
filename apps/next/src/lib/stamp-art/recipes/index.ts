import { type Recipe, parseRecipe } from '../recipe'
import ad from './ad.json'
import ag from './ag.json'
import ai from './ai.json'
import al from './al.json'
import am from './am.json'
import ao from './ao.json'
import aq from './aq.json'
import ar from './ar.json'
import at from './at.json'
import aw from './aw.json'
import ba from './ba.json'
import bb from './bb.json'
import be from './be.json'
import bf from './bf.json'
import bg from './bg.json'
import bj from './bj.json'
import bl from './bl.json'
import bm from './bm.json'
import bo from './bo.json'
import br from './br.json'
import bs from './bs.json'
import bw from './bw.json'
import by from './by.json'
import bz from './bz.json'
import ca from './ca.json'
import cd from './cd.json'
import cf from './cf.json'
import cg from './cg.json'
import ch from './ch.json'
import ci from './ci.json'
import cl from './cl.json'
import cm from './cm.json'
import co from './co.json'
import cr from './cr.json'
import cu from './cu.json'
import cv from './cv.json'
import cw from './cw.json'
import cz from './cz.json'
import de from './de.json'
import dk from './dk.json'
import dm from './dm.json'
import do_ from './do.json'
import dz from './dz.json'
import ec from './ec.json'
import ee from './ee.json'
import eg from './eg.json'
import eh from './eh.json'
import es from './es.json'
import fi from './fi.json'
import fk from './fk.json'
import fo from './fo.json'
import fr from './fr.json'
import ga from './ga.json'
import gb from './gb.json'
import gd from './gd.json'
import ge from './ge.json'
import gf from './gf.json'
import gh from './gh.json'
import gi from './gi.json'
import gl from './gl.json'
import gm from './gm.json'
import gn from './gn.json'
import gp from './gp.json'
import gq from './gq.json'
import gr from './gr.json'
import gs from './gs.json'
import gt from './gt.json'
import gw from './gw.json'
import gy from './gy.json'
import hn from './hn.json'
import hr from './hr.json'
import ht from './ht.json'
import hu from './hu.json'
import it from './it.json'
import jm from './jm.json'
import jp from './jp.json'
import ke from './ke.json'
import kn from './kn.json'
import ky from './ky.json'
import lc from './lc.json'
import li from './li.json'
import lr from './lr.json'
import ls from './ls.json'
import lt from './lt.json'
import lu from './lu.json'
import lv from './lv.json'
import ly from './ly.json'
import ma from './ma.json'
import mc from './mc.json'
import md from './md.json'
import me from './me.json'
import mf from './mf.json'
import mk from './mk.json'
import ml from './ml.json'
import mq from './mq.json'
import mr from './mr.json'
import ms from './ms.json'
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
import ru from './ru.json'
import sd from './sd.json'
import sh from './sh.json'
import si from './si.json'
import sk from './sk.json'
import sl from './sl.json'
import sm from './sm.json'
import sn from './sn.json'
import sr from './sr.json'
import st from './st.json'
import sv from './sv.json'
import sz from './sz.json'
import td from './td.json'
import tg from './tg.json'
import th from './th.json'
import tn from './tn.json'
import tz from './tz.json'
import ua from './ua.json'
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
  ag,
  ai,
  al,
  am,
  ao,
  aq,
  ar,
  at,
  aw,
  ba,
  bb,
  be,
  bf,
  bg,
  bj,
  bl,
  bm,
  bo,
  br,
  bs,
  bw,
  by,
  bz,
  ca,
  cd,
  cf,
  cg,
  ch,
  ci,
  cl,
  cm,
  co,
  cr,
  cu,
  cv,
  cw,
  cz,
  de,
  dk,
  dm,
  do: do_,
  dz,
  ec,
  ee,
  eg,
  eh,
  es,
  fi,
  fk,
  fo,
  fr,
  ga,
  gb,
  gd,
  ge,
  gf,
  gh,
  gi,
  gl,
  gm,
  gn,
  gp,
  gq,
  gr,
  gs,
  gt,
  gw,
  gy,
  hn,
  hr,
  ht,
  hu,
  it,
  jm,
  jp,
  ke,
  kn,
  ky,
  lc,
  li,
  lr,
  ls,
  lt,
  lu,
  lv,
  ly,
  ma,
  mc,
  md,
  me,
  mf,
  mk,
  ml,
  mq,
  mr,
  ms,
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
  ru,
  sd,
  sh,
  si,
  sk,
  sl,
  sm,
  sn,
  sr,
  st,
  sv,
  sz,
  td,
  tg,
  th,
  tn,
  tz,
  ua,
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
