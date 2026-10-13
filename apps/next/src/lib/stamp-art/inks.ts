// Eight stamp inks with light/dark values. Every value is at least 4.5:1 against `--surface`
// (SURFACE_COLOR) in its theme, because the ring text is small type. Checked by lint.test.ts.
import { hash32 } from './hash'
import registry from './registry.json'

/* oxlint-disable kuuki/design-tokens -- stamp inks are canvas/mask colours that cannot read CSS variables; contrast against SURFACE_COLOR is checked by lint.test.ts */
export const INKS = {
  indigo: { light: '#344c99', dark: '#a2bcff' },
  oxblood: { light: '#90272d', dark: '#ffa09c' },
  slate: { light: '#3d556a', dark: '#a6c1d9' },
  moss: { light: '#365f19', dark: '#9fce85' },
  plum: { light: '#79346c', dark: '#eea0dc' },
  teal: { light: '#005f5f', dark: '#72d0d0' },
  umber: { light: '#744624', dark: '#e7b18c' },
  'ochre-dark': { light: '#6d4c00', dark: '#e0b771' },
} as const
/* oxlint-enable kuuki/design-tokens */

export type InkName = keyof typeof INKS
export const INK_NAMES = Object.keys(INKS) as InkName[]
export const isInkName = (v: string): v is InkName => Object.hasOwn(INKS, v)

export type InkRequest = { iso2: string; cluster?: string | null; ink?: InkName }

/**
 * Assigns an ink per country. Explicit `ink` wins. Countries without a cluster take a stable hash
 * pick. Countries in one cluster walk the palette from a cluster-specific start in ISO order, skipping
 * inks already taken by an explicit pick, so members differ (up to eight members).
 */
export function resolveInks(requests: InkRequest[]): Map<string, InkName> {
  const out = new Map<string, InkName>()
  const byCluster = new Map<string, InkRequest[]>()
  for (const r of requests) {
    if (r.ink) out.set(r.iso2, r.ink)
    else if (!r.cluster) out.set(r.iso2, INK_NAMES[hash32(`ink:${r.iso2}`) % INK_NAMES.length])
    else byCluster.set(r.cluster, [...(byCluster.get(r.cluster) ?? []), r])
  }
  for (const [cluster, members] of byCluster) {
    const all = requests.filter((r) => r.cluster === cluster)
    const taken = new Set(all.flatMap((r) => (r.ink ? [r.ink] : [])))
    let cursor = hash32(`cluster:${cluster}`) % INK_NAMES.length
    for (const m of [...members].sort((a, b) => a.iso2.localeCompare(b.iso2))) {
      let guard = 0
      while (taken.has(INK_NAMES[cursor]) && guard++ < INK_NAMES.length)
        cursor = (cursor + 1) % INK_NAMES.length
      out.set(m.iso2, INK_NAMES[cursor])
      taken.add(INK_NAMES[cursor])
      cursor = (cursor + 1) % INK_NAMES.length
    }
  }
  return out
}

type RegistryRow = { iso2: string; cluster: string | null }
const registryRows = registry as RegistryRow[]

/**
 * Inks for the whole catalog: the registry clusters decide who must differ, recipe `ink` and
 * `cluster` values override the registry for their country.
 */
export function inkMap(overrides: Record<string, { ink?: InkName; cluster?: string | null }> = {}) {
  return resolveInks(
    registryRows.map((row) => {
      const o = overrides[row.iso2]
      return {
        iso2: row.iso2,
        cluster: o?.cluster !== undefined ? o.cluster : row.cluster,
        ink: o?.ink,
      }
    }),
  )
}
