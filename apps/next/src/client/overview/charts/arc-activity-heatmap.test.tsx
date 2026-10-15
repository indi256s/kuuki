import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  ArcActivityHeatmap,
  activityPoints,
  calendarColumns,
  calendarWidth,
  dailyLevel,
  heatIsWeak,
} from './arc-activity-heatmap'

it('maps flights per day onto fixed levels 0 / 1 / 2 / 3 / 4+', () => {
  expect([0, 1, 2, 3, 4, 5, 12].map(dailyLevel)).toEqual([0, 1, 2, 3, 4, 4, 4])
  expect([0, 1, 2, 3, 4].map(heatIsWeak)).toEqual([false, true, true, true, false])
})

it('draws a known zero filled without contour, a missing day as an empty dashed outline, weak levels contoured and strong levels without contour', () => {
  const known = { from: '2024-01-03', to: '2024-12-30' }
  const points = activityPoints(
    2024,
    [
      { date: '2024-01-03', count: 4 },
      { date: '2024-01-04', count: 9 },
      { date: '2024-01-05', count: 1 },
    ],
    'en',
    known,
  )
  const byDate = new Map(points.map((point) => [point.key, point.datum]))
  expect(byDate.get('2024-01-01')).toMatchObject({ count: 0, missing: true })
  expect(byDate.get('2024-01-03')).toMatchObject({ count: 4, missing: false })
  expect(byDate.get('2024-06-01')).toMatchObject({ count: 0, missing: false })
  expect(byDate.get('2024-12-31')).toMatchObject({ missing: true })
  expect(points.find((point) => point.key === '2024-01-04')?.label).toContain('9')
  expect(points.find((point) => point.key === '2024-01-01')?.label).toContain('no data')

  const markup = renderToString(
    <svg>
      <ArcActivityHeatmap
        points={points}
        locale="en"
        width={calendarWidth(calendarColumns(points, 'en'), 900)}
        mark={() => ({})}
      />
    </svg>,
  )
  expect(markup).toContain('fill="transparent" stroke="var(--missing)" stroke-dasharray="2 2"')
  expect(markup).toMatch(/fill="var\(--heat-0\)"(?! stroke)/)
  expect(markup).not.toContain('fill="var(--heat-0)" stroke=')
  expect(markup).toMatch(/fill="var\(--heat-4\)"(?! stroke)/)
  expect(markup).toContain('fill="var(--heat-1)" stroke="var(--heat-contour)"')
})

it('never marks a day with a completed flight as missing, even outside the known range', () => {
  const [first] = activityPoints(2024, [{ date: '2024-01-01', count: 1 }], 'en', null)
  expect(first.datum).toMatchObject({ count: 1, missing: false })
})
