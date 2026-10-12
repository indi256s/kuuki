// Profile name and public address (username) rules shared by the client and the API.

export const NAME_MAX = 40
export const ADDRESS_PATTERN = /^[a-z0-9_][a-z0-9_-]{2,29}$/

const ADDRESS_MAX = 30

/** Russian passport (ICAO 9303) transliteration plus the Ukrainian extras. */
const TRANSLITERATION: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: 'ie',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'iu',
  я: 'ia',
  і: 'i',
  ї: 'i',
  є: 'ie',
  ґ: 'g',
}

/** Trim and collapse every inner whitespace run to one space. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase()
}

function cut(value: string): string {
  return value.slice(0, ADDRESS_MAX).replace(/-+$/, '')
}

function pilotAddress(random: () => number): string {
  let tail = ''
  while (tail.length < 4) tail += Math.floor(random() * 36).toString(36)
  return `pilot-${tail}`
}

/** Lowercase Latin spelling of a name: Cyrillic by the ICAO 9303 table, Latin left as typed. */
export function transliterate(name: string): string {
  return Array.from(name.toLowerCase(), (char) => TRANSLITERATION[char] ?? char).join('')
}

/** Derive a public address from a display name; always matches ADDRESS_PATTERN. */
export function deriveAddress(name: string, random: () => number = Math.random): string {
  const latin = transliterate(name)
  const base = cut(
    latin
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  )
  return base.length < 3 ? pilotAddress(random) : base
}

/** `base-n`, with the base cut so the whole address fits 30 characters. */
export function withSuffix(base: string, n: number): string {
  const tail = `-${n}`
  return `${base.slice(0, ADDRESS_MAX - tail.length).replace(/-+$/, '')}${tail}`
}
