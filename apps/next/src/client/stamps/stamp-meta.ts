// What the component needs to know about a country without importing the engraver: frame shape, ink, tier,
// ISO3 and ring names. Reads only the committed stamp-index.generated.json (pnpm generate:stamps), so the
// recipes, the engraving kit and zod stay out of the client bundle and names are identical on server and client.
import type { Locale } from '../../lib/format'
import { type ShapeName, shapeFor } from '../../lib/stamp-art/frame'
import type { InkName } from '../../lib/stamp-art/inks'
import index from '../../lib/stamp-art/stamp-index.generated.json'

export type StampTier = 'engraved' | 'fallback'
export type StampMeta = {
  iso2: string
  iso3: string
  shape: ShapeName
  ink: InkName
  tier: StampTier
  cluster: string | null
}

type Entry = {
  cluster: string | null
  ink: string
  iso3: string
  name: Record<Locale, string>
  shape: string
  short: Record<Locale, string>
  tier: string
}
const entries = index as Record<string, Entry>

/** Every catalog code, sorted. */
export const stampCodes = (): string[] => Object.keys(entries)

export function stampMeta(iso2: string): StampMeta {
  const code = iso2.toUpperCase()
  const e = entries[code]
  return {
    iso2: code,
    iso3: e?.iso3 ?? code,
    shape: (e?.shape as ShapeName | undefined) ?? shapeFor(code),
    ink: (e?.ink as InkName | undefined) ?? 'indigo',
    tier: e?.tier === 'engraved' ? 'engraved' : 'fallback',
    cluster: e?.cluster ?? null,
  }
}

/** Ring names as generated: the full name and the short form, not yet uppercased. */
export function stampNames(iso2: string, locale: Locale): { name: string; short: string } {
  const code = iso2.toUpperCase()
  const e = entries[code]
  return { name: e?.name[locale] ?? code, short: e?.short[locale] ?? code }
}
