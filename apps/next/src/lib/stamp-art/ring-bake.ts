// Build-time only (generate:stamps, check:stamps, tests): bakes the ring text of a stamp into glyph outlines.
// The top ring is the country name in its own script, the bottom ring the English name (left empty when both
// are the same name). harfbuzz shapes the text, the outlines are placed one by one along the frame's ring
// path, and the result is one SVG path used as a CSS mask, so the browser loads no font and every device
// draws the same letters. Node-only: never import this from client code.
//
// Size. Latin, Cyrillic and Greek take the base size (cap height RING_CAP). Every other script is sized by a
// core glyph (the body of a letter, SIZING) to a multiple of RING_CAP, so a caseless script reads as heavy as
// the Latin caps next to it; tall marks and stacks may then use the whole band (minus 2 units) and only an
// overflow shrinks the line.
//
// Fitting follows the rule the live text used (plan A5), now with real glyph advances:
//   1. letter-spacing from the preferred value down to LS_MIN at the base size;
//   2. font size from the base down to the floor at LS_MIN;
//   3. next candidate (the short form). A name that fits none of them throws: add a short form to
//      ring-endonyms.overrides.json instead of cutting it.
// Scripts that join letters or hang them from a headline (Arabic, Devanagari, Bengali, ...) take no letter-spacing
// and shrink instead. The budget is a share of the ring path length: 82% on the straight rectangle rules, 76% on
// round rings, where glyphs near the horizon stand sideways and stay readable only while the line is kept off
// the last stretch of the arc. On the octagon the line never bends round a corner: its budget is the flat edge
// plus OCTAGON_OVERHANG on each end.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import type * as HB from 'harfbuzzjs'
import { RING_CAP, frames, type RingPath, type ShapeName } from './frame'
import endonyms from './ring-endonyms.json'

/** Cap height of the Latin face as a share of the font size (Commissioner SemiBold). */
export const CAP_EM = 0.713
/** Base font size: the one whose cap height is exactly RING_CAP. */
export const RING_FONT_SIZE = Math.round((RING_CAP / CAP_EM) * 100) / 100
export const FS_FLOOR = 10.5
export const LS_MIN = 0.3
export const BUDGET = { rectangle: 0.82, circle: 0.76 } as const
const LS_TOP = 1.8
const LS_BOTTOM = 2.4

type Row = {
  endonym: string
  endonymShort?: string
  lang: string
  script: string
  english: string
  englishShort?: string
}
const rows = endonyms as Record<string, Row>

// ---------------------------------------------------------------------------------------------------------------
// Fonts. Commissioner (the UI face) for Latin, Cyrillic and Greek; Noto Sans at weight 600 for every other script.
// All come from devDependencies, except the CJK ones: those are committed subsets (see ring-fonts/README.md).

type FontKey = keyof typeof FONT_FILES
const NPM = (pkg: string, file: string) => ({ pkg, file })
const FONT_FILES = {
  latin: NPM('commissioner', 'Commissioner_600SemiBold.ttf'),
  arabic: NPM('noto-sans-arabic', 'NotoSansArabic_600SemiBold.ttf'),
  armenian: NPM('noto-sans-armenian', 'NotoSansArmenian_600SemiBold.ttf'),
  bengali: NPM('noto-sans-bengali', 'NotoSansBengali_600SemiBold.ttf'),
  devanagari: NPM('noto-sans-devanagari', 'NotoSansDevanagari_600SemiBold.ttf'),
  ethiopic: NPM('noto-sans-ethiopic', 'NotoSansEthiopic_600SemiBold.ttf'),
  georgian: NPM('noto-sans-georgian', 'NotoSansGeorgian_600SemiBold.ttf'),
  hebrew: NPM('noto-sans-hebrew', 'NotoSansHebrew_600SemiBold.ttf'),
  khmer: NPM('noto-sans-khmer', 'NotoSansKhmer_600SemiBold.ttf'),
  lao: NPM('noto-sans-lao', 'NotoSansLao_600SemiBold.ttf'),
  myanmar: NPM('noto-sans-myanmar', 'NotoSansMyanmar_600SemiBold.ttf'),
  sinhala: NPM('noto-sans-sinhala', 'NotoSansSinhala_600SemiBold.ttf'),
  thaana: NPM('noto-sans-thaana', 'NotoSansThaana_600SemiBold.ttf'),
  thai: NPM('noto-sans-thai', 'NotoSansThai_600SemiBold.ttf'),
  tibetan: NPM('noto-serif-tibetan', 'NotoSerifTibetan_600SemiBold.ttf'),
  cjkSc: null,
  cjkTc: null,
  cjkJp: null,
  cjkKr: null,
} as const
const SUBSETS: Partial<Record<FontKey, string>> = {
  cjkSc: 'NotoSansSC-SemiBold-subset.ttf',
  cjkTc: 'NotoSansTC-SemiBold-subset.ttf',
  cjkJp: 'NotoSansJP-SemiBold-subset.ttf',
  cjkKr: 'NotoSansKR-SemiBold-subset.ttf',
}

// harfbuzzjs initialises its wasm with a top-level await, which a CommonJS script cannot require: load it lazily.
let hb: typeof HB
/** Loads harfbuzz. Call (and await) once before `bakeRing`. */
export async function initRingBake(): Promise<void> {
  hb ??= await import('harfbuzzjs')
}

const nodeRequire = createRequire(import.meta.url)
const fonts = new Map<FontKey, { font: HB.Font; upem: number }>()

function loadFont(key: FontKey) {
  const cached = fonts.get(key)
  if (cached) return cached
  const npm = FONT_FILES[key]
  const path = npm
    ? nodeRequire.resolve(`@expo-google-fonts/${npm.pkg}/600SemiBold/${npm.file}`)
    : fileURLToPath(new URL(`./ring-fonts/${SUBSETS[key]}`, import.meta.url))
  const face = new hb.Face(new hb.Blob(readFileSync(path)))
  const entry = { font: new hb.Font(face), upem: face.upem }
  fonts.set(key, entry)
  return entry
}

/** Which font draws a script. Han follows the language: Japanese, Simplified (mainland) or Traditional. */
function fontFor(script: string, lang: string, iso2: string): FontKey {
  switch (script) {
    case 'Latin':
    case 'Cyrillic':
    case 'Greek':
      return 'latin'
    case 'Han':
      return lang === 'ja' ? 'cjkJp' : iso2 === 'CN' ? 'cjkSc' : 'cjkTc'
    case 'Hangul':
      return 'cjkKr'
    default:
      return script.toLowerCase() as FontKey
  }
}

/** Scripts whose letters are free-standing, so letter-spacing opens the line without breaking a join or a headline. */
const SPACED = new Set([
  'Latin',
  'Cyrillic',
  'Greek',
  'Armenian',
  'Georgian',
  'Hebrew',
  'Han',
  'Hangul',
  'Ethiopic',
])
/**
 * Scripts that are also opened up, but only for a short name (SHORT_CLUSTERS or fewer letters), and only lightly:
 * their letters carry vowels and marks that must stay with them, so a wide gap reads as separate letters. Arabic,
 * Thaana and the headline scripts are never spaced.
 */
const SPACED_WHEN_SHORT = new Set(['Lao', 'Tibetan', 'Thai', 'Khmer', 'Myanmar', 'Sinhala'])
const SHORT_CLUSTERS = 4
/** Share of the ring arc a tracked short name aims to fill (the Latin names sit at 35-45%). */
const SHORT_FILL = 0.4
/** A tracked name never opens wider than this many font sizes between two letters (light tracking: LIGHT_GAP_EM). */
const SHORT_GAP_EM = 2.5
const LIGHT_GAP_EM = 0.5
/** Scripts with capitals: their line sits on the baseline with the cap height centred in the band. */
const CASED = new Set(['Latin', 'Cyrillic', 'Greek'])

/**
 * How a script without capitals is sized: the core glyph is measured in the script's own font (`ref`, or the full
 * ink box of the line for `ink`) and scaled to `mult` times RING_CAP times SIZE_CALIBRATION. The multiples are the
 * art director's, except where a rendered check found the script still too small (Lao, Thai, Khmer, Sinhala,
 * Thaana) or its core glyph is not what the multiple assumed: Noto Serif Tibetan's ཀ is 1.16 em tall because
 * Tibetan letters hang from the headline, so Tibetan is sized to fill the band instead.
 */
type Sizing = { ref: string | 'ink'; mult: number }
const SIZING: Record<string, Sizing> = {
  // Square ideographs and syllable blocks: the full ink box.
  Han: { ref: 'ink', mult: 1.15 },
  Hangul: { ref: 'ink', mult: 1.15 },
  // Headline to base.
  Devanagari: { ref: 'न', mult: 0.95 },
  Bengali: { ref: 'ব', mult: 0.95 },
  Ethiopic: { ref: 'አ', mult: 0.9 },
  Armenian: { ref: 'Ա', mult: 0.9 },
  Georgian: { ref: 'ს', mult: 0.9 },
  Hebrew: { ref: 'ש', mult: 0.9 },
  // x-height of the first consonant.
  Thai: { ref: 'ก', mult: 0.85 },
  Lao: { ref: 'ກ', mult: 0.9 },
  Khmer: { ref: 'ក', mult: 0.8 },
  Myanmar: { ref: 'က', mult: 0.75 },
  Sinhala: { ref: 'ක', mult: 0.85 },
  Tibetan: { ref: 'ཀ', mult: 1.65 },
  // Tooth and body of a joined letter.
  Arabic: { ref: 'سـ', mult: 0.65 },
  Thaana: { ref: 'ވ', mult: 0.75 },
}
/** Calibration of SIZING against GE and AM, which read right at the base size before core sizing existed. */
const SIZE_CALIBRATION = 1.1
/** Band the ring text sits in, grid units (frame.ts: ROUND_BAND; CAP_BAND minus INNER_INSET). */
const BAND = { circle: 19, rectangle: 17.5 } as const
/** Ink keeps this far from the rules: the full ink of a line stops at the band minus this. */
const BAND_MARGIN = 2
/** A line shrinks to this share of its target size before the next candidate is tried. */
const SHRINK_FLOOR = 0.8
/** How far the octagon's line may run past each end of the flat edge, grid units. */
const OCTAGON_OVERHANG = 2

// ---------------------------------------------------------------------------------------------------------------
// Shaping

type Glyph = {
  gid: number
  /** Pen position from the line start, em. */
  x: number
  advance: number
  dx: number
  dy: number
  /** Starts a new letter (cluster) after the previous glyph. */
  breaks: boolean
}
type Shaped = {
  glyphs: Glyph[]
  width: number
  clusters: number
  key: FontKey
  ymin: number
  ymax: number
}

const shapedCache = new Map<string, Shaped>()

function shapeLine(text: string, script: string, lang: string, iso2: string): Shaped {
  const cacheKey = `${text}|${script}|${lang}|${iso2}`
  const hit = shapedCache.get(cacheKey)
  if (hit) return hit
  const key = fontFor(script, lang, iso2)
  const { font, upem } = loadFont(key)
  const buffer = new hb.Buffer()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  buffer.setLanguage(lang)
  hb.shape(font, buffer)
  const infos = buffer.getGlyphInfos()
  const positions = buffer.getGlyphPositions()
  const glyphs: Glyph[] = []
  let pen = 0
  let ymin = Infinity
  let ymax = -Infinity
  for (const [i, info] of infos.entries()) {
    const p = positions[i]
    if (info.codepoint === 0)
      throw new Error(`ring text "${text}" has a glyph its font does not cover`)
    glyphs.push({
      gid: info.codepoint,
      x: pen / upem,
      advance: p.xAdvance / upem,
      dx: p.xOffset / upem,
      dy: p.yOffset / upem,
      breaks: i === 0 || info.cluster !== infos[i - 1].cluster,
    })
    pen += p.xAdvance
    const ext = font.glyphExtents(info.codepoint)
    if (ext && ext.width !== 0) {
      ymin = Math.min(ymin, (ext.yBearing + ext.height + p.yOffset) / upem)
      ymax = Math.max(ymax, (ext.yBearing + p.yOffset) / upem)
    }
  }
  const shaped = {
    glyphs,
    width: pen / upem,
    clusters: glyphs.filter((g) => g.breaks).length,
    key,
    ymin,
    ymax,
  }
  shapedCache.set(cacheKey, shaped)
  return shaped
}

// ---------------------------------------------------------------------------------------------------------------
// Fitting

export type RingFit = {
  text: string
  fontSize: number
  letterSpacing: number
  /** Rendered width, grid units. */
  width: number
  /** Which candidate was used: 0 is the full name. */
  candidate: number
  /** Whether the line is the short form. */
  short: boolean
  /** Smallest font size this line's script may shrink to. */
  floor: number
}
type Line = { fit: RingFit; shaped: Shaped; script: string; spaced: boolean }

/** Where a line may run: its anchor length, the width it may use and the band it sits in (grid units). */
type Arc = { length: number; budget: number; band: number }

const floor1 = (v: number) => Math.floor(v * 10) / 10

/** Height of a script's core glyph per em, in the font the line is set in. */
function coreEm(shaped: Shaped, script: string, lang: string, iso2: string): number {
  const { ref } = SIZING[script]
  if (ref === 'ink') return shaped.ymax - shaped.ymin
  const glyph = shapeLine(ref, script, lang, iso2)
  return glyph.ymax - glyph.ymin
}

/**
 * Size and letter-spacing of one candidate, or null when it does not fit: letter-spacing down to LS_MIN at the base
 * size, then the font size down to the floor.
 */
function fitOne(
  shaped: Shaped,
  script: string,
  lang: string,
  iso2: string,
  arc: Arc,
  lsPreferred: number,
) {
  let base = RING_FONT_SIZE
  let floor = FS_FLOOR
  if (!CASED.has(script)) {
    const { mult } = SIZING[script]
    const target = (SIZE_CALIBRATION * mult * RING_CAP) / coreEm(shaped, script, lang, iso2)
    // Tall marks and stacks may use the band, but never touch the rules.
    const inkLimit = (arc.band - BAND_MARGIN) / (shaped.ymax - shaped.ymin)
    base = floor1(Math.min(target, inkLimit))
    floor = floor1(Math.min(target * SHRINK_FLOOR, base))
  }
  const em = shaped.width
  const short = shaped.clusters <= SHORT_CLUSTERS
  const spaced = SPACED.has(script) || (SPACED_WHEN_SHORT.has(script) && short)
  const tracked = spaced && short && !CASED.has(script)
  const gapEm = SPACED_WHEN_SHORT.has(script) ? LIGHT_GAP_EM : SHORT_GAP_EM
  const gaps = spaced ? Math.max(1, shaped.clusters - 1) : 0
  if (gaps === 0) {
    const fs = Math.min(base, arc.budget / em)
    return fs >= floor ? { fontSize: floor1(fs), letterSpacing: 0, floor, spaced } : null
  }
  const room = (arc.budget - em * base) / gaps
  if (room >= LS_MIN) {
    // A short name opens up to fill its share of the arc, like a Latin name does.
    const open = tracked
      ? Math.max(lsPreferred, Math.min((SHORT_FILL * arc.length - em * base) / gaps, gapEm * base))
      : lsPreferred
    return { fontSize: base, letterSpacing: floor1(Math.min(room, open)), floor, spaced }
  }
  const fs = (arc.budget - LS_MIN * gaps) / em
  return fs >= floor ? { fontSize: floor1(fs), letterSpacing: LS_MIN, floor, spaced } : null
}

function fitLine(
  candidates: { text: string; script: string; lang: string }[],
  iso2: string,
  arc: Arc,
  lsPreferred: number,
): Line {
  for (const [i, c] of candidates.entries()) {
    const shaped = shapeLine(c.text, c.script, c.lang, iso2)
    const fit = fitOne(shaped, c.script, c.lang, iso2, arc, lsPreferred)
    if (!fit) continue
    const gaps = fit.spaced ? Math.max(0, shaped.clusters - 1) : 0
    const width = shaped.width * fit.fontSize + fit.letterSpacing * gaps
    const { spaced, ...rest } = fit
    return {
      fit: { text: c.text, ...rest, width, candidate: i, short: i > 0 },
      shaped,
      script: c.script,
      spaced,
    }
  }
  throw new Error(`${iso2}: "${candidates[0].text}" does not fit its ring; add a short form`)
}

// ---------------------------------------------------------------------------------------------------------------
// Ring path sampling

type Sampler = { length: number; at: (t: number) => { x: number; y: number; angle: number } }

const num = (s: string) => Number.parseFloat(s)

/** A ring made of straight cuts and a flat edge (the octagon): `M` and `L` only. */
const isPolyRing = (ring: RingPath) => !/[AH]/.test(ring.d)

/**
 * Samples a ring path (`M x y` followed by `A` arcs of an ellipse centred on y=100, or `L`/`H` segments) by arc length.
 * The octagon's line stays on its flat edge and carries on straight past either end: text never bends round a corner.
 */
function sampler(ring: RingPath): Sampler {
  const cmds = ring.d.match(/[MALH][^MALH]*/g) ?? []
  const pts: [number, number][] = []
  let cur: [number, number] = [0, 0]
  for (const cmd of cmds) {
    const v = cmd
      .slice(1)
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(num)
    if (cmd[0] === 'M') {
      cur = [v[0], v[1]]
      pts.push(cur)
    } else if (cmd[0] === 'L') {
      cur = [v[0], v[1]]
      pts.push(cur)
    } else if (cmd[0] === 'H') {
      cur = [v[0], cur[1]]
      pts.push(cur)
    } else {
      // A rx ry rot large sweep x y: a half ellipse between two points on the horizontal diameter.
      const [rx, ry, , , sweep, x, y] = v
      const cx = (cur[0] + x) / 2
      const steps = 2400
      for (let i = 1; i <= steps; i++) {
        const a = Math.PI - (i / steps) * Math.PI
        pts.push([cx + rx * Math.cos(a), y + (sweep === 1 ? -1 : 1) * ry * Math.sin(a)])
      }
      cur = [x, y]
    }
  }
  if (isPolyRing(ring) && pts.length === 4) {
    const [[x0, y0], [x1, y1]] = [pts[1], pts[2]]
    const length = Math.hypot(x1 - x0, y1 - y0)
    const [ux, uy] = [(x1 - x0) / length, (y1 - y0) / length]
    return {
      length,
      at: (t) => ({ x: x0 + ux * t, y: y0 + uy * t, angle: Math.atan2(uy, ux) }),
    }
  }
  const route = pts
  const cum = [0]
  for (let i = 1; i < route.length; i++)
    cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]))
  const length = cum[cum.length - 1]
  const at = (t: number) => {
    const s = Math.min(length, Math.max(0, t))
    let lo = 0
    let hi = cum.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (cum[mid] <= s) lo = mid
      else hi = mid
    }
    const seg = cum[hi] - cum[lo] || 1
    const f = (s - cum[lo]) / seg
    const [x0, y0] = route[lo]
    const [x1, y1] = route[hi]
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, angle: Math.atan2(y1 - y0, x1 - x0) }
  }
  return { length, at }
}

// ---------------------------------------------------------------------------------------------------------------
// Outline placement

const r2 = (v: number) => Math.round(v * 100) / 100

/** Number as short path text: no leading zero, no negative zero. */
function short(v: number): string {
  const t = String(v === 0 ? 0 : v)
  return t.replace(/^(-?)0\./, '$1.')
}

type Seg = { cmd: 'm' | 'l' | 'q' | 'c' | 'z'; pts: [number, number][] }

/** Relative path data from absolute rounded points (offsets are taken from the rounded previous point, so rounding never drifts). */
function serialize(segs: Seg[]): string {
  let out = ''
  let last = ''
  // Last number written, to know whether the next one needs a separator.
  let prevNum: string | null = null
  let cur: [number, number] = [0, 0]
  let start: [number, number] = [0, 0]
  for (const seg of segs) {
    if (seg.cmd === 'z') {
      out += 'z'
      last = 'z'
      prevNum = null
      cur = start
      continue
    }
    // `m` repeats as an implicit `l`, so it always keeps its letter.
    if (seg.cmd !== last || seg.cmd === 'm') {
      out += seg.cmd
      prevNum = null
    }
    // Every point of a segment is relative to where the segment starts.
    for (const [x, y] of seg.pts) {
      for (const n of [r2(x - cur[0]), r2(y - cur[1])]) {
        const t = short(n)
        const sep =
          prevNum !== null && !t.startsWith('-') && !(t.startsWith('.') && prevNum.includes('.'))
        out += (sep ? ' ' : '') + t
        prevNum = t
      }
    }
    cur = seg.pts[seg.pts.length - 1]
    last = seg.cmd
    if (seg.cmd === 'm') start = cur
  }
  return out
}

/**
 * Glyph outlines of a fitted line, placed along the ring path like a text path: each glyph's advance midpoint
 * sits on the path, the glyph turns to the tangent there, the baseline lies on the path, and the line is
 * centred on the path.
 */
function lineSegs(line: Line, ring: RingPath): Seg[] {
  const { fit, shaped, script, spaced } = line
  const { font } = loadFont(shaped.key)
  const path = sampler(ring)
  const s = fit.fontSize
  // Lift of the glyph space off the baseline path: cased scripts centre their cap height in the band, other
  // scripts centre their ink.
  const lift = CASED.has(script)
    ? (RING_CAP - s * CAP_EM) / 2
    : RING_CAP / 2 - ((shaped.ymin + shaped.ymax) / 2) * s
  const start = (path.length - fit.width) / 2
  let spacing = 0
  const segs: Seg[] = []
  for (const g of shaped.glyphs) {
    if (g.breaks && spaced && g !== shaped.glyphs[0]) spacing += fit.letterSpacing
    const mid = start + g.x * s + spacing + (g.advance * s) / 2
    const p = path.at(mid)
    // The glyph turns to the chord of its own footprint, not to the tangent at its midpoint, so a glyph on a
    // curve takes the average angle across its width.
    const half = Math.max(g.advance * s, 1.5) / 2
    const a = path.at(mid - half)
    const b = path.at(mid + half)
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // u runs along the tangent, v is the glyph's up direction, to the left of travel.
    const place = (gx: number, gy: number): [number, number] => {
      const u = (gx + g.dx - g.advance / 2) * s
      const v = (gy + g.dy) * s + lift
      return [p.x + u * cos + v * sin, p.y + u * sin - v * cos]
    }
    const upem = loadFont(shaped.key).upem
    const pts = (v: number[]) =>
      Array.from({ length: v.length / 2 }, (_, i): [number, number] => {
        const [px, py] = place(v[i * 2] / upem, v[i * 2 + 1] / upem)
        return [r2(px), r2(py)]
      })
    for (const c of font.glyphToJson(g.gid)) {
      if (c.type === 'Z') segs.push({ cmd: 'z', pts: [] })
      else segs.push({ cmd: c.type.toLowerCase() as Seg['cmd'], pts: pts(c.values) })
    }
  }
  return segs
}

// ---------------------------------------------------------------------------------------------------------------
// Public API

/** Uppercase for scripts with capitals. Georgian stays in Mkhedruli: its capital forms (Mtavruli) are for display lettering and not what readers know the name by. */
const upper = (text: string, lang: string) => (lang === 'ka' ? text : text.toLocaleUpperCase(lang))

export type BakedRing = {
  top: RingFit
  /** `null` when the bottom ring stays empty: the endonym already is the English name. */
  bottom: RingFit | null
  /** Complete SVG document (viewBox 0 0 200 200), used as a CSS mask. */
  svg: string
}

/** Where a ring's text may run: the octagon keeps to its flat edge, the other shapes use a share of the path. */
function arcOf(shape: ShapeName, ring: RingPath): Arc {
  const { family } = frames[shape]
  if (isPolyRing(ring)) {
    const flat = sampler(ring).length
    return { length: flat, budget: flat + 2 * OCTAGON_OVERHANG, band: BAND[family] }
  }
  return { length: ring.length, budget: ring.length * BUDGET[family], band: BAND[family] }
}

/** Width a line of `ring` may take, grid units (what the fit tests hold every baked line to). */
export const ringBudget = (shape: ShapeName, ring: RingPath) => arcOf(shape, ring).budget

/** Spelling of a name stripped of what differs between a country's two names: accents, SAINT/ST, "and", ISLANDS. */
function nameKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .map((w) => (w === 'SAINT' ? 'ST' : w))
    .filter((w) => !['&', 'ET', 'E', 'OG', 'I', 'Y', 'ISLANDS', 'IS'].includes(w))
    .join(' ')
}

/** One edit apart: a vowel the other language adds (GUINÉ-BISSAU, GUINEA-BISSAU). Only for long names. */
function oneEditApart(a: string, b: string): boolean {
  if (a.length < 10 || b.length < 10 || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const [x, y] = [a.slice(i), b.slice(i)]
  return x.slice(1) === y || x === y.slice(1) || x.slice(1) === y.slice(1)
}

/** Whether two sets of spellings name the same place, so the second ring would only repeat the first. */
function sameName(top: string[], english: string[]): boolean {
  const [a, b] = [top.map(nameKey), english.map(nameKey)]
  return a.some((x) => b.some((y) => x === y || oneEditApart(x, y)))
}

/** The ring text of a country as fitted text and as baked outlines, on the ring paths of `shape`. */
export function bakeRing(iso2: string, shape: ShapeName): BakedRing {
  const row = rows[iso2]
  if (!row) throw new Error(`no ring names for ${iso2}`)
  const f = frames[shape]
  const top = [row.endonym, row.endonymShort]
    .filter((t): t is string => !!t)
    .map((t) => ({ text: upper(t, row.lang), script: row.script, lang: row.lang }))
  const english = [row.english, row.englishShort]
    .filter((t): t is string => !!t)
    .map((t) => ({ text: upper(t, 'en'), script: 'Latin', lang: 'en' }))
  const topLine = fitLine(top, iso2, arcOf(shape, f.ring.top), LS_TOP)
  // The bottom ring stays empty when it would only say the same name again.
  const repeats = sameName(
    top.map((c) => c.text),
    english.map((c) => c.text),
  )
  const bottomLine = repeats ? null : fitLine(english, iso2, arcOf(shape, f.ring.bottom), LS_BOTTOM)
  const d = serialize([
    ...lineSegs(topLine, f.ring.top),
    ...(bottomLine ? lineSegs(bottomLine, f.ring.bottom) : []),
  ])
  return {
    top: topLine.fit,
    bottom: bottomLine?.fit ?? null,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="${d}"/></svg>`,
  }
}
