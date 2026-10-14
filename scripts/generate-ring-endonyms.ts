/**
 * Resolves the ring text of every country: the name in its own script (top ring) and the English name (bottom
 * ring), into apps/next/src/lib/stamp-art/ring-endonyms.json. Derived from Intl (language by likely subtags,
 * name by Intl.DisplayNames in that language), then corrected by ring-endonyms.overrides.json. The resolved
 * table is committed so the stamp output never depends on the ICU build that runs the generator.
 * Run: pnpm generate:ring-endonyms
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import countries from '../packages/data/src/countries.json'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'apps', 'next', 'src', 'lib', 'stamp-art')

type Row = {
  endonym: string
  endonymShort?: string
  lang: string
  script: string
  english: string
  englishShort?: string
}
type Override = Partial<Omit<Row, 'script'>>

const overrides = JSON.parse(
  readFileSync(join(DIR, 'ring-endonyms.overrides.json'), 'utf8'),
) as Record<string, Override>

/** CLDR spellings that read badly on a ring: dashes, parenthesised qualifiers. */
const tidy = (s: string) => s.replace(/\s+-\s+/g, ' ').replace(/\s*\([^)]*\)\s*$/, '')

const SCRIPTS = [
  'Arabic',
  'Armenian',
  'Bengali',
  'Cyrillic',
  'Devanagari',
  'Ethiopic',
  'Georgian',
  'Greek',
  'Han',
  'Hangul',
  'Hebrew',
  'Hiragana',
  'Katakana',
  'Khmer',
  'Lao',
  'Latin',
  'Myanmar',
  'Sinhala',
  'Thaana',
  'Thai',
  'Tibetan',
] as const

/** Script of the first letter, by Unicode property. */
function scriptOf(text: string): string {
  for (const ch of text) {
    for (const s of SCRIPTS) {
      if (new RegExp(`\\p{Script=${s}}`, 'u').test(ch)) {
        return s === 'Hiragana' || s === 'Katakana' ? 'Han' : s
      }
    }
  }
  throw new Error(`no script for ${text}`)
}

const out: Record<string, Row> = {}
for (const iso2 of Object.keys(countries).sort()) {
  const o = overrides[iso2] ?? {}
  const lang = o.lang ?? new Intl.Locale(`und-${iso2}`).maximize().language
  const region = (l: string) => {
    try {
      const v = new Intl.DisplayNames([l], { type: 'region' }).of(iso2)
      return v && v !== iso2 ? v : null
    } catch {
      return null
    }
  }
  const english = tidy(o.english ?? region('en') ?? iso2)
  const endonym = tidy(o.endonym ?? region(lang) ?? english)
  const row: Row = { endonym, lang, script: scriptOf(endonym), english }
  if (o.endonymShort) row.endonymShort = o.endonymShort
  if (o.englishShort) row.englishShort = o.englishShort
  out[iso2] = row
}
const unknown = Object.keys(overrides).filter((k) => !(k in out))
if (unknown.length) throw new Error(`overrides for unknown codes: ${unknown.join(', ')}`)
writeFileSync(join(DIR, 'ring-endonyms.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(`ring-endonyms: ${Object.keys(out).length} rows`)
