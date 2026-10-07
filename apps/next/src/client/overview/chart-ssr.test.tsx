import { expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { defineChart } from '@tanstack/charts/scene'
import { barY } from '@tanstack/charts/bar'
import { Chart } from '@tanstack/charts/react'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../packages/shared/src/overview/__fixtures__/n10.json'

it('Chart server-renders svg', () => {
  const scope = computeOverview(fixture as OverviewPayload, {})
  if (scope.clock.status !== 'ready') throw new Error('The ten-flight fixture must satisfy the Clock minimum')
  const definition = defineChart({ marks: [barY(scope.clock.value.byHour, { x: 'key', y: 'flights' })],
    scales: { x: { scale: scaleBand }, y: { scale: scaleLinear } } })
  const markup = renderToString(<Chart definition={definition} height={320} ariaLabel="Clock" />)
  expect(markup).toContain('<svg')
  expect(markup).toContain('Clock')
})
