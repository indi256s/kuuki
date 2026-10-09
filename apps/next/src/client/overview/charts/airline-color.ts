import airlines from '@kuuki/data/airlines'

// The seed data gives this navy to every airline whose colour was never researched, so it carries no identity.
// eslint-disable-next-line no-restricted-syntax -- seed-data value to filter out, not a UI colour
const PLACEHOLDER = '#003876'

let byIata: Map<string, string> | undefined
export function airlineBrand(iata: string): string | undefined {
  byIata ??= new Map(airlines.filter(row => row.iata && row.primaryColor && row.primaryColor.toUpperCase() !== PLACEHOLDER).map(row => [row.iata.toUpperCase(), row.primaryColor]))
  return byIata.get(iata.toUpperCase())
}

/** Keeps the brand hue but clamps lightness per theme (`--brand-l-*` in styles.css) so every mark holds 3:1 on the surface. */
export function airlineColor(iata: string): string {
  const brand = airlineBrand(iata)
  // eslint-disable-next-line no-restricted-syntax -- airline colour is data; the theme bounds come from styles.css tokens
  return brand ? `oklch(from ${brand} clamp(var(--brand-l-min), l, var(--brand-l-max)) min(c, .19) h)` : 'var(--mark-ghost)'
}
