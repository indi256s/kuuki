import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ArcRidgeline } from './arc-ridgeline'
import { KuukiChart, type ChartPoint } from './kuuki-chart'
import { ridgeProfile } from '../sections/fleet/helpers'

type Sample = { family: string; x: number }

it('gives every ridge sample its own keyed target with the rounded minute, and nests no interactive groups', () => {
  const profile = ridgeProfile([90, 95, 100, 240])
  const samplePoints = profile.map((sample, i) => ({ x: sample.x, point: { key: `a320:${i}`, datum: { family: 'A320', x: sample.x }, label: `A320 · ${Math.round(sample.x)} min` } satisfies ChartPoint<Sample> }))
  const markup = renderToString(<KuukiChart points={samplePoints.map(sample => sample.point)} height={200} ariaLabel="Ridge" inView table={{ caption: 'Ridge', columns: [], rows: [] }}>
    {mark => <ArcRidgeline rows={[{ key: 'a320', label: 'A320', profile, samplePoints }]} mark={mark} height={200} />}
  </KuukiChart>)
  expect(markup.match(/data-chart-key="a320:\d+"/g)).toHaveLength(128)
  expect(markup).toContain('data-chart-key="a320:127"')
  expect(markup).toContain(`A320 · ${Math.round(profile[127]!.x)} min`)
  expect(markup).not.toMatch(/role="button"[^>]*><g[^>]*role="button"/)
})
