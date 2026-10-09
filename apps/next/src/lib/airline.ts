import airlines from '@kuuki/data/airlines'

const byIata = new Map(airlines.map((row) => [row.iata.toUpperCase(), row]))

export function airlineIdentity(iata: string) {
  return byIata.get(iata.toUpperCase())
}

export function airlineBrand(iata: string): string | undefined {
  return airlineIdentity(iata)?.primaryColor ?? undefined
}

/** Keeps the brand hue but clamps lightness per theme (`--brand-l-*` in styles.css) so every mark holds 3:1 on the surface. */
export function airlineColor(iata: string): string {
  const brand = airlineBrand(iata)
  // oxlint-disable kuuki/design-tokens -- airline colour is data; the theme bounds come from styles.css tokens
  return brand
    ? `oklch(from ${brand} clamp(var(--brand-l-min), l, var(--brand-l-max)) min(c, .19) h)`
    : 'var(--mark-ghost)'
  // oxlint-enable kuuki/design-tokens
}
