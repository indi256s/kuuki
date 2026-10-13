import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ArcRidgeline } from './arc-ridgeline'
import { KuukiChart, type ChartPoint } from './kuuki-chart'
import { ridgeProfile } from '../sections/fleet/helpers'

type Sample = { family: string; x: number }

it('gives every ridge sample its own keyed target with the rounded minute, and nests no interactive groups', () => {
  const profile = ridgeProfile([90, 95, 100, 240])
  const samplePoints = profile.map((sample, i) => ({
    x: sample.x,
    point: {
      key: `a320:${i}`,
      datum: { family: 'A320', x: sample.x },
      label: `A320 · ${Math.round(sample.x)} min`,
    } satisfies ChartPoint<Sample>,
  }))
  const markup = renderToString(
    <KuukiChart
      points={samplePoints.map((sample) => sample.point)}
      height={200}
      ariaLabel="Ridge"
      inView
      table={{ caption: 'Ridge', columns: [], rows: [] }}
    >
      {(mark) => (
        <ArcRidgeline
          rows={[{ key: 'a320', label: 'A320', profile, samplePoints }]}
          mark={mark}
          height={200}
        />
      )}
    </KuukiChart>,
  )
  const targets = [...markup.matchAll(/data-chart-key="([^"]+)"/g)].map((match) => match[1])
  expect(targets).toEqual(samplePoints.map((sample) => sample.point.key))
  for (const sample of samplePoints) expect(markup).toContain(sample.point.label)
  expect(markup).not.toMatch(/role="button"[^>]*><g[^>]*role="button"/)
})
