import { transliterate } from '@kuuki/shared/address'

const LENGTH = 30

/** A–Z only; Cyrillic goes through the ICAO 9303 table, accents are stripped, everything else is a filler. */
function mrzText(value: string) {
  return transliterate(value)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<')
    .replace(/^<+|<+$/g, '')
}

const pad = (value: string) => value.padEnd(LENGTH, '<').slice(0, LENGTH)

/**
 * The holder page's machine-readable zone, decorative (`aria-hidden`): `P<KUU<SURNAME<<GIVEN` and
 * `HANDLE<<0142FL<31CC<<<<<YYMM`, both 30 characters. Figures are the same public totals the page prints.
 */
export function mrzLines({
  name,
  handle,
  flights,
  countries,
  issued,
}: {
  name: string
  handle: string
  flights: number
  countries: number
  issued: string | null
}): [string, string] {
  const words = name.trim().split(/\s+/).map(mrzText).filter(Boolean)
  const surname = words.at(-1) ?? ''
  const given = words.slice(0, -1).join('<')
  const first = pad(`P<KUU<${surname}${given ? `<<${given}` : ''}`)
  const tail = `${String(Math.min(Math.max(0, Math.round(flights)), 9999)).padStart(4, '0')}FL<${String(
    Math.min(Math.max(0, Math.round(countries)), 999),
  ).padStart(2, '0')}CC`
  const date =
    issued && /^\d{4}-\d{2}/.test(issued) ? `${issued.slice(2, 4)}${issued.slice(5, 7)}` : '<<<<'
  const id = mrzText(handle)
    .replaceAll('<', '')
    .slice(0, LENGTH - tail.length - date.length - 3)
  const second = `${`${id}<<${tail}`.padEnd(LENGTH - date.length, '<')}${date}`
  return [first, second]
}
