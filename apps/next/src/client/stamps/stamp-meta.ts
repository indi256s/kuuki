// What the component needs to know about a country without importing the engraver: frame shape,
// ink, tier and ISO3. Recipes override the catalog defaults. The registry is already in the bundle through inks.ts.
import { type ShapeName, shapeFor } from '../../lib/stamp-art/frame'
import { type InkName, inkMap } from '../../lib/stamp-art/inks'
import registry from '../../lib/stamp-art/registry.json'
import { RECIPE_FILES } from '../../lib/stamp-art/recipes'

export type StampTier = 'engraved' | 'fallback'
export type StampMeta = {
  iso2: string
  iso3: string
  shape: ShapeName
  ink: InkName
  tier: StampTier
  cluster: string | null
}

type RawRecipe = {
  iso2: string
  tier?: StampTier
  shape?: ShapeName
  ink?: InkName
  cluster?: string
}
const rawRecipes = Object.values(RECIPE_FILES) as RawRecipe[]
const recipeOf = new Map(rawRecipes.map((r) => [r.iso2, r]))
const iso3Of = new Map((registry as { iso2: string; iso3: string }[]).map((r) => [r.iso2, r.iso3]))
const clusterOf = new Map(
  (registry as { iso2: string; cluster: string | null }[]).map((r) => [r.iso2, r.cluster]),
)

let inks: Map<string, InkName> | undefined
const inkOf = (iso2: string): InkName => {
  inks ??= inkMap(
    Object.fromEntries(rawRecipes.map((r) => [r.iso2, { ink: r.ink, cluster: r.cluster }])),
  )
  return inks.get(iso2) ?? 'indigo'
}

/** Recipe countries: the ones with committed engraving files. */
export const recipeCodes = (): string[] => rawRecipes.map((r) => r.iso2).sort()

export function stampMeta(iso2: string): StampMeta {
  const code = iso2.toUpperCase()
  const recipe = recipeOf.get(code)
  return {
    iso2: code,
    iso3: iso3Of.get(code) ?? code,
    shape: shapeFor(code, recipe?.shape),
    ink: inkOf(code),
    tier: recipe?.tier ?? 'fallback',
    cluster: recipe?.cluster ?? clusterOf.get(code) ?? null,
  }
}
