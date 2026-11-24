import airlines from '@kuuki/data/airlines' with { type: 'json' }

const byIata = new Map(airlines.map((row) => [row.iata.toUpperCase(), row]))

export function airlineIdentity(iata: string) {
  return byIata.get(iata.toUpperCase())
}

export function airlineBrand(iata: string): string | undefined {
  return airlineIdentity(iata)?.primaryColor ?? undefined
}

export function airlineColor(iata: string): string {
  const brand = airlineBrand(iata)
  // oxlint-disable kuuki/design-tokens -- airline colour is data; the theme bounds come from styles.css tokens
  return brand
    ? `oklch(from ${brand} clamp(var(--brand-l-min), l, var(--brand-l-max)) min(c, var(--brand-c-max)) h)`
    : 'var(--brand-neutral)'
  // oxlint-enable kuuki/design-tokens
}
