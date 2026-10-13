// Deterministic ring text fitting. No layout reads: widths come from the Commissioner SemiBold
// advance table below (em fractions, measured from public/fonts/Commissioner-SemiBold.woff2).
//
// Rule (plan A5), per candidate name, longest first (full name, then the short catalog name):
//   1. letter-spacing from the preferred value down to LS_MIN at the base size;
//   2. font size from the base down to FS_FLOOR at LS_MIN;
//   3. next candidate; after the last one, the full name is cut with an ellipsis at the floor size.
// The budget is a share of the ring path length: 82% on the straight rectangle rules, 76% on round rings, where glyphs
// near the horizon stand sideways and stay readable only while the line is kept off the last stretch of the arc.
import { RING_CAP } from '../../lib/stamp-art/frame'

const ADVANCE: Record<string, number> = {
  ' ': 0.191,
  "'": 0.218,
  '’': 0.243,
  ',': 0.243,
  '-': 0.425,
  '.': 0.255,
  '·': 0.255,
  '…': 0.9,
  A: 0.709,
  B: 0.656,
  C: 0.684,
  D: 0.735,
  E: 0.596,
  F: 0.576,
  G: 0.731,
  H: 0.75,
  I: 0.303,
  J: 0.31,
  K: 0.69,
  L: 0.578,
  M: 0.962,
  N: 0.751,
  O: 0.815,
  P: 0.642,
  Q: 0.815,
  R: 0.684,
  S: 0.596,
  T: 0.644,
  U: 0.729,
  V: 0.703,
  W: 1.038,
  X: 0.7,
  Y: 0.671,
  Z: 0.681,
  А: 0.709,
  Б: 0.642,
  В: 0.657,
  Г: 0.573,
  Д: 0.799,
  Е: 0.596,
  Ж: 1.052,
  З: 0.585,
  И: 0.751,
  Й: 0.751,
  К: 0.69,
  Л: 0.756,
  М: 0.962,
  Н: 0.75,
  О: 0.815,
  П: 0.747,
  Р: 0.642,
  С: 0.684,
  Т: 0.644,
  У: 0.691,
  Ф: 0.88,
  Х: 0.7,
  Ц: 0.774,
  Ч: 0.689,
  Ш: 1.054,
  Щ: 1.091,
  Ъ: 0.805,
  Ы: 0.93,
  Ь: 0.642,
  Э: 0.688,
  Ю: 1.097,
  Я: 0.681,
  Ё: 0.596,
}
const UNKNOWN = 0.7

/** Cap height of the face as a share of the font size. */
export const CAP_EM = 0.713
/** Base font size: the one whose cap height is exactly RING_CAP. */
export const RING_FONT_SIZE = Math.round((RING_CAP / CAP_EM) * 100) / 100
export const FS_FLOOR = 9
export const LS_MIN = 0.3
export const BUDGET = { rectangle: 0.82, circle: 0.76 } as const

const advance = (ch: string): number => {
  const direct = ADVANCE[ch]
  if (direct !== undefined) return direct
  // Accented capitals use their base letter's advance.
  return ADVANCE[ch.normalize('NFD')[0]] ?? UNKNOWN
}

/** Sum of glyph advances in em. */
export const emWidth = (text: string): number => [...text].reduce((s, ch) => s + advance(ch), 0)

/** Estimated rendered width in grid units (letter-spacing between glyphs). */
export function textWidth(text: string, fontSize: number, letterSpacing: number): number {
  return emWidth(text) * fontSize + letterSpacing * Math.max(0, [...text].length - 1)
}

export type RingFit = {
  text: string
  fontSize: number
  letterSpacing: number
  /** Estimated width, grid units. */
  width: number
  /** 'full' / 'short' candidate fitted untouched; 'truncated' ends in an ellipsis. */
  source: 'full' | 'short' | 'truncated'
  /** Baseline shift that keeps a shrunk line centred in the band (grid units; negative = outward). */
  dy: number
}

const round1 = (v: number) => Math.round(v * 10) / 10
const floor1 = (v: number) => Math.floor(v * 10) / 10

function fitOne(text: string, budget: number, lsPreferred: number) {
  const gaps = Math.max(1, [...text].length - 1)
  const ls = (budget - emWidth(text) * RING_FONT_SIZE) / gaps
  if (ls >= LS_MIN)
    return { fontSize: RING_FONT_SIZE, letterSpacing: floor1(Math.min(ls, lsPreferred)) }
  const fs = (budget - LS_MIN * gaps) / emWidth(text)
  if (fs >= FS_FLOOR) return { fontSize: floor1(fs), letterSpacing: LS_MIN }
  return null
}

const dyFor = (fontSize: number) => round1(-(RING_CAP - fontSize * CAP_EM) / 2)

/**
 * Fits one ring line. `candidates` are in preference order and already uppercased
 * (`[fullName, shortName?]`). `lsPreferred` is the airy spacing used when there is room.
 */
export function fitRing(
  candidates: string[],
  ringLength: number,
  family: keyof typeof BUDGET,
  lsPreferred = 1.8,
): RingFit {
  const budget = ringLength * BUDGET[family]
  for (const [i, text] of candidates.entries()) {
    const fit = fitOne(text, budget, lsPreferred)
    if (fit) {
      const width = textWidth(text, fit.fontSize, fit.letterSpacing)
      return { text, ...fit, width, source: i === 0 ? 'full' : 'short', dy: dyFor(fit.fontSize) }
    }
  }
  const chars = [...candidates[0]]
  const at = (k: number) => `${chars.slice(0, k).join('').trimEnd()}…`
  let cut = chars.length
  while (cut > 1 && textWidth(at(cut), FS_FLOOR, LS_MIN) > budget) cut--
  const text = at(cut)
  return {
    text,
    fontSize: FS_FLOOR,
    letterSpacing: LS_MIN,
    width: textWidth(text, FS_FLOOR, LS_MIN),
    source: 'truncated',
    dy: dyFor(FS_FLOOR),
  }
}
