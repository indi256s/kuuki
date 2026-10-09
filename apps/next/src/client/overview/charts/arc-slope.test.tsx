// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ArcSlope } from './arc-slope'

afterEach(cleanup)

it.each([248, 288, 390, 600])(
  'keeps ordered comparison columns and separate mobile period headings at %spx',
  (width) => {
    const view = render(
      <svg width={width}>
        <ArcSlope
          width={width}
          rows={[
            {
              point: { key: 'AA', label: 'AA', datum: null },
              label: 'AA',
              start: 3,
              end: 5,
              color: 'var(--accent)',
            },
          ]}
          mark={() => ({})}
          maxValue={5}
          startLabel="Прошлый период"
          endLabel="Выбранный период"
          formatValue={String}
        />
      </svg>,
    )
    const dots = view.container.querySelectorAll('circle')
    const left = Number(dots[0].getAttribute('cx')),
      right = Number(dots[1].getAttribute('cx'))
    expect(right - left).toBeGreaterThanOrEqual(width * 0.4)
    expect(left).toBeGreaterThan(0)
    expect(right).toBeLessThan(width)
    const headings = view.container.querySelectorAll('text')
    expect(headings[0]).toHaveTextContent('Прошлый период')
    expect(headings[1]).toHaveTextContent('Выбранный период')
    if (width < 400) {
      expect(headings[0].querySelectorAll('tspan')).toHaveLength(2)
      expect(headings[1].querySelectorAll('tspan')).toHaveLength(2)
    }
  },
)
