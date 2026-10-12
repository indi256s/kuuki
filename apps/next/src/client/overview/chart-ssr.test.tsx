import { expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { computeOverview } from '@kuuki/shared/overview/compute'
import { overviewSeries } from '@kuuki/shared/overview/series'
import { dayToEpoch } from '@kuuki/shared/overview/range'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { ArcLine } from './charts/arc-line'
import { ArcRidgeline } from './charts/arc-ridgeline'
import { KuukiChart } from './charts/kuuki-chart'
import { ridgeProfile } from './sections/fleet/helpers'

// Rendering proof lives with the client renderer; the shared engine remains DOM-free.
it('engine rows server-render deterministic local Arc SVG without a DOM or browser data reads', () => {
  expect(typeof document).toBe('undefined')
  const payload = fixture as OverviewPayload,
    scope = computeOverview(payload, {})
  if (scope.rhythm.status !== 'ready' || scope.fleet.status !== 'ready')
    throw new Error('The fixture must satisfy chart minimums')
  const series = overviewSeries(payload, {})
  const points = series.cumulative.map((row) => ({
    key: row.key,
    datum: row,
    label: row.date,
    x: dayToEpoch(row.date)!,
    y: row.km,
  }))
  const from = points[0].x,
    to = points.at(-1)!.x,
    max = points.at(-1)!.y
  const chart = (
    <KuukiChart
      points={points}
      height={180}
      inView={false}
      ariaLabel="Cumulative distance"
      table={{
        caption: 'Cumulative distance',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'km', label: 'Km', numeric: true },
        ],
        rows: series.cumulative.map((row) => ({ date: row.date, km: row.km })),
      }}
    >
      {(mark) => (
        <ArcLine
          points={points}
          xDomain={[from, to]}
          yDomain={[0, max]}
          height={180}
          stepAfter
          area
          mark={mark}
        />
      )}
    </KuukiChart>
  )
  const markup = renderToString(chart)
  expect(markup).toContain('<svg')
  expect(markup).toContain('aria-label="Cumulative distance"')
  expect(markup).toContain(points[0].key)
  expect(markup).not.toMatch(/NaN|Infinity/)
  expect(renderToString(chart)).toBe(markup)
  const ridge = renderToString(
    <svg>
      <ArcRidgeline
        rows={[
          {
            key: 'sample',
            label: 'Sample',
            profile: ridgeProfile([60, 120, 240]),
            point: { key: 'sample', label: 'Sample', datum: null },
          },
        ]}
        mark={() => ({})}
      />
    </svg>,
  )
  expect(ridge).not.toMatch(/NaN|Infinity/)
  expect(ridge).toContain('<path')
})
