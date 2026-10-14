import { type Recipe, parseRecipe } from '../recipe'
import ad from './ad.json'
import ae from './ae.json'
import af from './af.json'
import ag from './ag.json'
import ai from './ai.json'
import al from './al.json'
import am from './am.json'
import ao from './ao.json'
import aq from './aq.json'
import ar from './ar.json'
import at from './at.json'
import au from './au.json'
import aw from './aw.json'
import az from './az.json'
import ba from './ba.json'
import bb from './bb.json'
import bd from './bd.json'
import be from './be.json'
import bf from './bf.json'
import bg from './bg.json'
import bh from './bh.json'
import bi from './bi.json'
import bj from './bj.json'
import bl from './bl.json'
import bm from './bm.json'
import bn from './bn.json'
import bo from './bo.json'
import br from './br.json'
import bs from './bs.json'
import bt from './bt.json'
import bw from './bw.json'
import by from './by.json'
import bz from './bz.json'
import ca from './ca.json'
import cc from './cc.json'
import cd from './cd.json'
import cf from './cf.json'
import cg from './cg.json'
import ch from './ch.json'
import ci from './ci.json'
import cl from './cl.json'
import cm from './cm.json'
import cn from './cn.json'
import co from './co.json'
import cr from './cr.json'
import cu from './cu.json'
import cv from './cv.json'
import cw from './cw.json'
import cx from './cx.json'
import cy from './cy.json'
import cz from './cz.json'
import de from './de.json'
import dj from './dj.json'
import dk from './dk.json'
import dm from './dm.json'
import do_ from './do.json'
import dz from './dz.json'
import ec from './ec.json'
import ee from './ee.json'
import eg from './eg.json'
import eh from './eh.json'
import er from './er.json'
import es from './es.json'
import et from './et.json'
import fi from './fi.json'
import fk from './fk.json'
import fo from './fo.json'
import fr from './fr.json'
import ga from './ga.json'
import gb from './gb.json'
import gd from './gd.json'
import ge from './ge.json'
import gf from './gf.json'
import gg from './gg.json'
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
import hk from './hk.json'
import hn from './hn.json'
import hr from './hr.json'
import ht from './ht.json'
import hu from './hu.json'
import ie from './ie.json'
import il from './il.json'
import im from './im.json'
import in_ from './in.json'
import io from './io.json'
import iq from './iq.json'
import ir from './ir.json'
import is from './is.json'
import it from './it.json'
import je from './je.json'
import jm from './jm.json'
import jo from './jo.json'
import jp from './jp.json'
import ke from './ke.json'
import kg from './kg.json'
import km from './km.json'
import kn from './kn.json'
import kp from './kp.json'
import kr from './kr.json'
import kw from './kw.json'
import ky from './ky.json'
import kz from './kz.json'
import lb from './lb.json'
import lc from './lc.json'
import li from './li.json'
import lk from './lk.json'
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
import mg from './mg.json'
import mk from './mk.json'
import ml from './ml.json'
import mn from './mn.json'
import mo from './mo.json'
import mq from './mq.json'
import mr from './mr.json'
import ms from './ms.json'
import mt from './mt.json'
import mu from './mu.json'
import mv from './mv.json'
import mw from './mw.json'
import mx from './mx.json'
import mz from './mz.json'
import na from './na.json'
import ne from './ne.json'
import ng from './ng.json'
import ni from './ni.json'
import nl from './nl.json'
import no from './no.json'
import np from './np.json'
import om from './om.json'
import pa from './pa.json'
import pe from './pe.json'
import ph from './ph.json'
import pk from './pk.json'
import pl from './pl.json'
import pm from './pm.json'
import pr from './pr.json'
import py from './py.json'
import re from './re.json'
import ro from './ro.json'
import rs from './rs.json'
import ru from './ru.json'
import rw from './rw.json'
import sc from './sc.json'
import sd from './sd.json'
import se from './se.json'
import sh from './sh.json'
import si from './si.json'
import sj from './sj.json'
import sk from './sk.json'
import sl from './sl.json'
import sm from './sm.json'
import sn from './sn.json'
import so from './so.json'
import sr from './sr.json'
import ss from './ss.json'
import st from './st.json'
import sv from './sv.json'
import sx from './sx.json'
import sz from './sz.json'
import tc from './tc.json'
import td from './td.json'
import tf from './tf.json'
import tg from './tg.json'
import th from './th.json'
import tj from './tj.json'
import tm from './tm.json'
import tn from './tn.json'
import tt from './tt.json'
import tw from './tw.json'
import tz from './tz.json'
import ua from './ua.json'
import ug from './ug.json'
import us from './us.json'
import uy from './uy.json'
import uz from './uz.json'
import va from './va.json'
import vc from './vc.json'
import ve from './ve.json'
import vg from './vg.json'
import vi from './vi.json'
import vn from './vn.json'
import xk from './xk.json'
import yt from './yt.json'
import za from './za.json'
import zm from './zm.json'
import zw from './zw.json'

/** Raw recipes by lowercase iso2. check:stamps fails when a recipes/*.json file is missing here. */
export const RECIPE_FILES: Record<string, unknown> = {
  ad,
  ae,
  af,
  ag,
  ai,
  al,
  am,
  ao,
  aq,
  ar,
  at,
  au,
  aw,
  az,
  ba,
  bb,
  bd,
  be,
  bf,
  bg,
  bh,
  bi,
  bj,
  bl,
  bm,
  bn,
  bo,
  br,
  bs,
  bt,
  bw,
  by,
  bz,
  ca,
  cc,
  cd,
  cf,
  cg,
  ch,
  ci,
  cl,
  cm,
  cn,
  co,
  cr,
  cu,
  cv,
  cw,
  cx,
  cy,
  cz,
  de,
  dj,
  dk,
  dm,
  do: do_,
  dz,
  ec,
  ee,
  eg,
  eh,
  er,
  es,
  et,
  fi,
  fk,
  fo,
  fr,
  ga,
  gb,
  gd,
  ge,
  gf,
  gg,
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
  hk,
  hn,
  hr,
  ht,
  hu,
  ie,
  il,
  im,
  in: in_,
  io,
  iq,
  ir,
  is,
  it,
  je,
  jm,
  jo,
  jp,
  ke,
  kg,
  km,
  kn,
  kp,
  kr,
  kw,
  ky,
  kz,
  lb,
  lc,
  li,
  lk,
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
  mg,
  mk,
  ml,
  mn,
  mo,
  mq,
  mr,
  ms,
  mt,
  mu,
  mv,
  mw,
  mx,
  mz,
  na,
  ne,
  ng,
  ni,
  nl,
  no,
  np,
  om,
  pa,
  pe,
  ph,
  pk,
  pl,
  pm,
  pr,
  py,
  re,
  ro,
  rs,
  ru,
  rw,
  sc,
  sd,
  se,
  sh,
  si,
  sj,
  sk,
  sl,
  sm,
  sn,
  so,
  sr,
  ss,
  st,
  sv,
  sx,
  sz,
  tc,
  td,
  tf,
  tg,
  th,
  tj,
  tm,
  tn,
  tt,
  tw,
  tz,
  ua,
  ug,
  us,
  uy,
  uz,
  va,
  vc,
  ve,
  vg,
  vi,
  vn,
  xk,
  yt,
  za,
  zm,
  zw,
}

export function loadRecipes(): Recipe[] {
  return Object.keys(RECIPE_FILES)
    .sort()
    .map((key) => parseRecipe(RECIPE_FILES[key]))
}
