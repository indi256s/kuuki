// Build-time only (generate:stamps, check:stamps, tests): bakes the ring text of a stamp into glyph outlines.
// The top ring is the country name in its own script, the bottom ring the English name (or three dots when
// both are the same word). harfbuzz shapes the text, the outlines are placed one by one along the frame's ring
// path, and the result is one SVG path used as a CSS mask, so the browser loads no font and every device
// draws the same letters. Node-only: never import this from client code.
//
// Fitting follows the rule the live text used (plan A5), now with real glyph advances:
//   1. letter-spacing from the preferred value down to LS_MIN at the base size;
//   2. font size from the base down to FS_FLOOR at LS_MIN;
//   3. next candidate (the short form). A name that fits none of them throws: add a short form to
//      ring-endonyms.overrides.json instead of cutting it.
// Scripts that join letters or hang them from a headline (Arabic, Devanagari, Bengali, ...) take no letter-spacing
// and shrink instead. The budget is a share of the ring path length: 82% on the straight rectangle rules, 76% on
// round rings, where glyphs near the horizon stand sideways and stay readable only while the line is kept off
// the last stretch of the arc.
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
/** Scripts with capitals: their line sits on the baseline with the cap height centred in the band. */
const CASED = new Set(['Latin', 'Cyrillic', 'Greek'])
/** Nominal size adjustments for scripts that sit small or large next to Latin capitals at the same font size. */
const SIZE_SCALE: Record<string, number> = { Arabic: 1.15, Hebrew: 1.1, Sinhala: 1.1 }
/** Tallest ink of a line in a script without capitals (grid units): tall marks and stacks must stay inside the band. */
const MAX_INK = 14

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
type Line = { fit: RingFit; shaped: Shaped; script: string }

const floor1 = (v: number) => Math.floor(v * 10) / 10

function fitOne(shaped: Shaped, script: string, budget: number, lsPreferred: number) {
  let base = RING_FONT_SIZE * (SIZE_SCALE[script] ?? 1)
  if (!CASED.has(script)) base = Math.min(base, floor1(MAX_INK / (shaped.ymax - shaped.ymin)))
  // The floor keeps the share of the nominal size that the Latin ring has (10.5 of 13.32), so a script whose
  // nominal size is held down by its tall marks still shrinks no further than the same proportion.
  const floor = floor1((FS_FLOOR / RING_FONT_SIZE) * base)
  const em = shaped.width
  const gaps = SPACED.has(script) ? Math.max(1, shaped.clusters - 1) : 0
  if (gaps === 0) {
    const fs = Math.min(base, budget / em)
    return fs >= floor ? { fontSize: floor1(fs), letterSpacing: 0, floor } : null
  }
  const ls = (budget - em * base) / gaps
  if (ls >= LS_MIN)
    return { fontSize: base, letterSpacing: floor1(Math.min(ls, lsPreferred)), floor }
  const fs = (budget - LS_MIN * gaps) / em
  return fs >= floor ? { fontSize: floor1(fs), letterSpacing: LS_MIN, floor } : null
}

function fitLine(
  candidates: { text: string; script: string; lang: string }[],
  iso2: string,
  ring: RingPath,
  family: keyof typeof BUDGET,
  lsPreferred: number,
): Line {
  const budget = ring.length * BUDGET[family]
  for (const [i, c] of candidates.entries()) {
    const shaped = shapeLine(c.text, c.script, c.lang, iso2)
    const fit = fitOne(shaped, c.script, budget, lsPreferred)
    if (!fit) continue
    const gaps = SPACED.has(c.script) ? Math.max(0, shaped.clusters - 1) : 0
    const width = shaped.width * fit.fontSize + fit.letterSpacing * gaps
    return {
      fit: { text: c.text, ...fit, width, candidate: i, short: i > 0 },
      shaped,
      script: c.script,
    }
  }
  throw new Error(`${iso2}: "${candidates[0].text}" does not fit its ring; add a short form`)
}

// ---------------------------------------------------------------------------------------------------------------
// Ring path sampling

type Sampler = { length: number; at: (t: number) => { x: number; y: number; angle: number } }

const num = (s: string) => Number.parseFloat(s)

/** How far a polyline corner is rounded off, measured along each side of the corner (grid units). */
const CORNER = 12

/**
 * Rounds the bends of a polyline with quadratic curves. Rigid glyphs on a sharp bend open a gap on the outer side
 * and collide on the inner one; on a short curve they turn gradually.
 */
function roundCorners(pts: [number, number][]): [number, number][] {
  if (pts.length < 3) return pts
  const out: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const [v, a, b] = [pts[i], pts[i - 1], pts[i + 1]]
    const la = Math.hypot(a[0] - v[0], a[1] - v[1])
    const lb = Math.hypot(b[0] - v[0], b[1] - v[1])
    const t = Math.min(CORNER, la / 2, lb / 2)
    const p0: [number, number] = [v[0] + ((a[0] - v[0]) / la) * t, v[1] + ((a[1] - v[1]) / la) * t]
    const p2: [number, number] = [v[0] + ((b[0] - v[0]) / lb) * t, v[1] + ((b[1] - v[1]) / lb) * t]
    for (let k = 0; k <= 16; k++) {
      const u = k / 16
      out.push([
        (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * v[0] + u * u * p2[0],
        (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * v[1] + u * u * p2[1],
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Samples a ring path (`M x y` followed by `A` arcs of an ellipse centred on y=100, or `L`/`H` segments) by arc length. */
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
  const route = cmds.some((c) => c[0] === 'A') ? pts : roundCorners(pts)
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
  const { fit, shaped, script } = line
  const { font } = loadFont(shaped.key)
  const path = sampler(ring)
  const s = fit.fontSize
  const spaced = SPACED.has(script)
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
    // The glyph turns to the chord of its own footprint, not to the tangent at its midpoint: where the path bends
    // (octagon corners) a glyph straddling the bend then takes the average angle instead of jumping a whole one.
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
  /** `null` when the bottom ring is the ornament: the endonym already is the English name. */
  bottom: RingFit | null
  /** Complete SVG document (viewBox 0 0 200 200), used as a CSS mask. */
  svg: string
}

/** The ring text of a country as fitted text and as baked outlines, on the ring paths of `shape`. */
export function bakeRing(iso2: string, shape: ShapeName): BakedRing {
  const row = rows[iso2]
  if (!row) throw new Error(`no ring names for ${iso2}`)
  const f = frames[shape]
  const top = [row.endonym, row.endonymShort]
    .filter((t): t is string => !!t)
    .map((t) => ({ text: upper(t, row.lang), script: row.script, lang: row.lang }))
  const sameName = upper(row.endonym, 'en') === upper(row.english, 'en')
  const english = [row.english, row.englishShort]
    .filter((t): t is string => !!t)
    .map((t) => ({ text: upper(t, 'en'), script: 'Latin', lang: 'en' }))
  const topLine = fitLine(top, iso2, f.ring.top, f.family, LS_TOP)
  const bottomLine = sameName
    ? fitLine(
        [{ text: '· · ·', script: 'Latin', lang: 'en' }],
        iso2,
        f.ring.bottom,
        f.family,
        LS_BOTTOM,
      )
    : fitLine(english, iso2, f.ring.bottom, f.family, LS_BOTTOM)
  const d = serialize([...lineSegs(topLine, f.ring.top), ...lineSegs(bottomLine, f.ring.bottom)])
  return {
    top: topLine.fit,
    bottom: sameName ? null : bottomLine.fit,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="${d}"/></svg>`,
  }
}
