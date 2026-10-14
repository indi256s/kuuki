import { ImageResponse, cache } from '@cf-wasm/og/workerd'
import type { OverviewScope } from '../../../packages/shared/src/overview/figures'
import {
  recognizeAccentKey,
  SURFACES,
  THEMES,
  type AccentKey,
  type Mode,
} from '../../../packages/shared/src/theme/palette'

cache.disable()

export interface ShareCardTheme {
  mode: Mode
  accent: AccentKey
}

// New writes store canonical names only; legacy rows may still hold the pre-v1 names.
/** Canonical accent for a stored profile `theme_color`; unknown or missing values fall back to shu. */
export function resolveShareAccent(stored: string | null | undefined): AccentKey {
  return recognizeAccentKey(stored) ?? 'shu'
}

/** The one color snapshot the card background, text and chart SVG all draw from. */
export function shareCardSnapshot({ mode, accent }: ShareCardTheme) {
  const surfaces = SURFACES[mode]
  const { markPeak, markRest } = THEMES[accent][mode]
  return {
    background: surfaces.background,
    text: surfaces.text,
    muted: surfaces.muted,
    // Same roles as the Clock dial: the peak hour takes `--mark-peak`, every other hour `--mark-rest`.
    peak: markPeak,
    bar: markRest,
  }
}

/** Temporary renderer fixture; the design thread owns the card's visual layout. */
export function shareCardTree(
  scope: OverviewScope,
  theme: ShareCardTheme = { mode: 'light', accent: 'shu' },
) {
  const colors = shareCardSnapshot(theme)
  const peakHour = scope.clock.status === 'ready' ? scope.clock.value.peakHour?.hour : undefined
  const rows = scope.clock.status === 'ready' ? scope.clock.value.byHour : []
  const max = Math.max(1, ...rows.map((row) => row.flights))
  const left = 40,
    top = 10,
    width = 556,
    height = 267
  const step = width / Math.max(1, rows.length)
  const bars = rows
    .map((row, index) => {
      const x = left + index * step,
        barHeight = (row.flights / max) * height
      // An hour without flights draws no bar; only the label marks it.
      const bar =
        row.flights > 0
          ? `<rect x="${x}" y="${top + height - barHeight}" width="${step}" height="${barHeight}" fill="${row.hour === peakHour ? colors.peak : colors.bar}"/>`
          : ''
      return `<g data-hour="${row.hour}" data-flights="${row.flights}">${bar}<text x="${x + step / 2}" y="294" text-anchor="middle">${String(row.hour).padStart(2, '0')}</text></g>`
    })
    .join('')
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (ratio) =>
        `<text x="32" y="${top + height - ratio * height}" text-anchor="end" dominant-baseline="middle">${Number((ratio * max).toFixed(2))}</text>`,
    )
    .join('')
  // Keep this existing static share-card fixture DOM-free; the application dial owns radial rendering.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300" role="img" aria-label="Clock" font-family="sans-serif" font-size="11" fill="${colors.muted}"><path d="M40,10V277H596" fill="none" stroke="${colors.text}" opacity=".28"/>${bars}${ticks}</svg>`
  const figures = scope.figures
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: 1200,
        height: 1500,
        backgroundColor: colors.background,
        color: colors.text,
      },
      children: [
        ...[
          figures.flights,
          figures.distanceKm,
          figures.durationMinutes,
          figures.countries.value,
        ].map((value) => ({ type: 'div', props: { children: String(value) } })),
        {
          type: 'img',
          props: { width: 600, height: 300, src: `data:image/svg+xml,${encodeURIComponent(svg)}` },
        },
      ],
    },
  }
}

export async function renderShareCard(
  scope: OverviewScope,
  context: { waitUntil(promise: Promise<unknown>): void },
  theme: ShareCardTheme,
): Promise<Response> {
  cache.setExecutionContext(context)
  return ImageResponse.async(shareCardTree(scope, theme), {
    width: 1200,
    height: 1500,
    headers: { 'Cache-Control': 'no-store' },
  })
}
