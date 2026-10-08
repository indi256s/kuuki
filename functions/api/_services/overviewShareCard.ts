import { barY } from '@tanstack/charts/bar'
import { createChartScene, defineChart } from '@tanstack/charts/scene'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { renderChartSvg } from '@tanstack/charts/svg'
import { ImageResponse, cache } from '@cf-wasm/og/workerd'
import type { OverviewScope } from '../../../packages/shared/src/overview/figures'

cache.disable()

/** Temporary renderer fixture; the design thread owns the card's visual layout. */
export function shareCardTree(scope: OverviewScope) {
  const rows = scope.clock.status === 'ready' ? scope.clock.value.byHour : []
  const definition = defineChart({ marks: [barY(rows, { x: 'key', y: 'flights' })],
    scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } } })
  const svg = renderChartSvg(createChartScene(definition, { width: 600, height: 300 }),
    { ariaLabel: 'Clock', idPrefix: 'overview-share-clock' })
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
