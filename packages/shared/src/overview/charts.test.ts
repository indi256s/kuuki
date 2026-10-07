import { expect, it } from 'vitest'
import { cell } from '@tanstack/charts/rect'
import { barY } from '@tanstack/charts/bar'
import { createChartScene, defineChart } from '@tanstack/charts/scene'
import { renderChartSvg } from '@tanstack/charts/svg'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import fixture from './__fixtures__/n10.json'
import { computeOverview } from './compute'
import type { OverviewPayload } from './model'

it('engine rows render without reshaping or a DOM', () => {
  expect(typeof document).toBe('undefined')
  const scope = computeOverview(fixture as OverviewPayload, {})
  if (scope.rhythm.status !== 'ready' || scope.clock.status !== 'ready' || scope.fleet.status !== 'ready') {
    throw new Error('The ten-flight fixture must satisfy chart section minimums')
  }
  const rhythm = scope.rhythm.value, clock = scope.clock.value, fleet = scope.fleet.value
  const scenes = [
    () => createChartScene(defineChart({ marks: [cell(rhythm.cells, { x: 'month', y: 'year', color: 'flights', key: 'key' })],
      scales: { x: { scale: scaleBand }, y: { scale: scaleBand } } }), { width: 600, height: 300 }),
    () => createChartScene(defineChart({ marks: [barY(clock.byHour, { x: 'key', y: 'flights' })],
      scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } } }), { width: 600, height: 300 }),
    () => createChartScene(defineChart({ marks: [barY(fleet.byBodyType, { x: 'key', y: 'flights' })],
      scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } } }), { width: 600, height: 300 }),
  ]
  for (const [index, scene] of scenes.entries()) {
    const render = () => renderChartSvg(scene(),
      { ariaLabel: `Overview fixture ${index}`, idPrefix: `overview-fixture-${index}` })
    const svg = render()
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain(`aria-label="Overview fixture ${index}"`)
    expect(render()).toBe(svg)
  }
})
