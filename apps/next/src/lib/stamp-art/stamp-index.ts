// Build-time only (generate:stamps, check:stamps, dev sheet server): derives stamp-index.generated.json, the one
// file client code reads. Names come from Node's Intl.DisplayNames at generation time, so the browser never
// formats them and SSR cannot disagree with the client.
import countries from '@kuuki/data/countries.json'
import { type ShapeName, shapeFor } from './frame'
import { type InkName, inkMap } from './inks'
import { loadRecipes } from './recipes'
import registryRows from './registry.json'
import overrides from './ring-names.overrides.json'

export type StampIndexEntry = {
  cluster: string | null
  ink: InkName
  iso3: string
  name: { en: string; ru: string }
  shape: ShapeName
  short: { en: string; ru: string }
  tier: 'engraved' | 'fallback'
}
export type StampIndex = Record<string, StampIndexEntry>

/** Territories whose Intl name varies by ICU build or carries a disputed alternate: the catalog name rules in English. */
const CONTESTED = new Set(['EH', 'PS', 'XK', 'IO', 'FK', 'YT'])
const LOCALES = ['en', 'ru'] as const
type Catalog = Record<string, { name: string }>
type Overrides = Record<
  string,
  { name?: Partial<Record<'en' | 'ru', string>>; short?: Partial<Record<'en' | 'ru', string>> }
>

const stripAlternate = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '')

function names(iso2: string, locale: (typeof LOCALES)[number]) {
  const catalogName = (countries as Catalog)[iso2].name
  const of = (style: 'long' | 'short') => {
    try {
      const v = new Intl.DisplayNames([locale], { type: 'region', style }).of(iso2)
      return v && v !== iso2 ? v : catalogName
    } catch {
      return catalogName
    }
  }
  let name = of('long')
  let short = of('short')
  if (CONTESTED.has(iso2)) {
    name = stripAlternate(name)
    short = stripAlternate(short)
    if (locale === 'en') name = short = catalogName
  }
  const o = (overrides as Overrides)[iso2]
  return { name: o?.name?.[locale] ?? name, short: o?.short?.[locale] ?? short }
}

export function buildStampIndex(): StampIndex {
  const recipes = new Map(loadRecipes().map((r) => [r.iso2, r]))
  const inks = inkMap(
    Object.fromEntries(
      [...recipes.values()].map((r) => [r.iso2, { ink: r.ink, cluster: r.cluster }]),
    ),
  )
  const registry = new Map(
    (registryRows as { iso2: string; iso3: string; cluster: string | null }[]).map((r) => [
      r.iso2,
      r,
    ]),
  )
  const out: StampIndex = {}
  for (const iso2 of Object.keys(countries).sort()) {
    const recipe = recipes.get(iso2)
    const reg = registry.get(iso2)
    const en = names(iso2, 'en')
    const ru = names(iso2, 'ru')
    out[iso2] = {
      cluster: recipe?.cluster ?? reg?.cluster ?? null,
      ink: inks.get(iso2) ?? 'indigo',
      iso3: reg?.iso3 ?? iso2,
      name: { en: en.name, ru: ru.name },
      shape: shapeFor(iso2, recipe?.shape),
      short: { en: en.short, ru: ru.short },
      tier: recipe?.tier ?? 'fallback',
    }
  }
  return out
}

/** The committed file's exact text: sorted keys, 2-space JSON, trailing newline. */
export function stampIndexJson(): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v
  return `${JSON.stringify(sort(buildStampIndex()), null, 2)}\n`
}
