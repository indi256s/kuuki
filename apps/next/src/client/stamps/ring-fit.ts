// Advance table of the UI face (Commissioner SemiBold, em fractions measured from public/fonts/Commissioner-SemiBold.woff2).
// Only the live ISO3 code of the fallback tier and the dev sheet read it; the ring text is baked at generation time
// (lib/stamp-art/ring-bake.ts).
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

const advance = (ch: string): number => {
  const direct = ADVANCE[ch]
  if (direct !== undefined) return direct
  // Accented capitals use their base letter's advance.
  return ADVANCE[ch.normalize('NFD')[0]] ?? UNKNOWN
}

/** Sum of glyph advances in em. */
export const emWidth = (text: string): number => [...text].reduce((s, ch) => s + advance(ch), 0)
