import airlines from '@kuuki/data/airlines' with { type: 'json' }

const byIata = new Map(airlines.map((row) => [row.iata.toUpperCase(), row]))

export function airlineIdentity(iata: string) {
  return byIata.get(iata.toUpperCase())
}

export function airlineBrand(iata: string): string | undefined {
  return airlineIdentity(iata)?.primaryColor ?? undefined
}

/**
 * Keeps the brand hue but bounds lightness and chroma per theme (`--brand-l-min`, `--brand-l-max`,
 * `--brand-c-max` in styles.css) so every catalog mark holds 3:1 on the background, surface and
 * inset (src/app/tokens.test.ts evaluates this exact formula over the whole catalog). An airline
 * without a catalog colour gets the neutral role, never a guessed hue.
 */
export function airlineColor(iata: string): string {
  const brand = airlineBrand(iata)
  // oxlint-disable kuuki/design-tokens -- airline colour is data; the theme bounds come from styles.css tokens
  return brand
    ? `oklch(from ${brand} clamp(var(--brand-l-min), l, var(--brand-l-max)) min(c, var(--brand-c-max)) h)`
    : 'var(--brand-neutral)'
  // oxlint-enable kuuki/design-tokens
}
