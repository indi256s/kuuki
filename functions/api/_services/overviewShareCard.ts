import { ImageResponse, cache } from '@cf-wasm/og/workerd'
import type { OverviewScope } from '../../../packages/shared/src/overview/figures'

cache.disable()

/** Temporary renderer fixture; the design thread owns the card's visual layout. */
export function shareCardTree(scope: OverviewScope) {
  const rows = scope.clock.status === 'ready' ? scope.clock.value.byHour : []
  const max = Math.max(1, ...rows.map(row => row.flights))
  const left = 40, top = 10, width = 556, height = 267
  const step = width / Math.max(1, rows.length)
  const bars = rows.map((row, index) => {
    const x = left + index * step, barHeight = row.flights / max * height
    return `<g><rect data-hour="${row.hour}" data-flights="${row.flights}" x="${x}" y="${top + height - barHeight}" width="${step}" height="${barHeight}" fill="#2563eb"/><text x="${x + step / 2}" y="294" text-anchor="middle">${String(row.hour).padStart(2, '0')}</text></g>`
  }).join('')
  const ticks = [0, .25, .5, .75, 1].map(ratio => `<text x="32" y="${top + height - ratio * height}" text-anchor="end" dominant-baseline="middle">${Number((ratio * max).toFixed(2))}</text>`).join('')
  // Keep this existing static share-card fixture DOM-free; the application dial owns radial rendering.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300" role="img" aria-label="Clock" font-family="sans-serif" font-size="11" fill="#000"><path d="M40,10V277H596" fill="none" stroke="#000" opacity=".28"/>${bars}${ticks}</svg>`
  const figures = scope.figures
  return { type: 'div', props: {
    style: { display: 'flex', flexDirection: 'column', width: 1200, height: 1500, backgroundColor: '#fbfaf8' },
    children: [
      ...[figures.flights, figures.distanceKm, figures.durationMinutes, figures.countries.value]
        .map(value => ({ type: 'div', props: { children: String(value) } })),
      { type: 'img', props: { width: 600, height: 300, src: `data:image/svg+xml,${encodeURIComponent(svg)}` } },
    ],
  } }
}

export async function renderShareCard(scope: OverviewScope, context: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
  cache.setExecutionContext(context)
  return ImageResponse.async(shareCardTree(scope), { width: 1200, height: 1500, headers: { 'Cache-Control': 'no-store' } })
}
