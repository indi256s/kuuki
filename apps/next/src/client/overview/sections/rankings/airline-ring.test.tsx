// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ArcDotRing, planDotRing, type DotRingSegment } from '../../charts/arc-dot-ring'

const segmentsOf = (counts: number[]): DotRingSegment<number>[] =>
  counts.map((count, index) => ({
    point: { key: `s${index}`, datum: count, label: `s${index}` },
    count,
    kind: index === counts.length - 1 ? 'unknown' : 'marked',
    color: 'var(--cmp-1)',
    marker: 'circle',
  }))

it('gives each segment its apportioned dots and draws every dot exactly once', () => {
  const fits = [92, 38, 21, 11, 7, 11, 4],
    overflows = [400, 120, 1, 1, 1, 90, 2]
  for (const counts of [fits, overflows]) {
    const plan = planDotRing(counts, 'full')
    const total = counts.reduce((sum, count) => sum + count, 0)
    // One dot a flight while they fit; past the capacity the smallest k that fits, and no segment loses its dot.
    const dotted = plan.dots.reduce((sum, dots) => sum + dots, 0)
    if (plan.k === 1) expect(plan.dots).toEqual(counts)
    else {
      // Independent of the planner: the dots represent the flights at k a dot, and every airline keeps a dot.
      expect(dotted).toBe(Math.ceil(total / plan.k))
      expect(plan.dots.every((dots) => dots >= 1)).toBe(true)
      // Every segment but the largest (which lends the minimum-one dots) stays within one dot of its exact share.
      const donor = counts.indexOf(Math.max(...counts))
      counts.forEach((count, index) => {
        if (index !== donor)
          expect(Math.abs(plan.dots[index] - (count * dotted) / total)).toBeLessThanOrEqual(1)
      })
    }
    const { container } = render(
      <svg>
        <ArcDotRing segments={segmentsOf(counts)} plan={plan} mark={() => ({})} />
      </svg>,
    )
    const groups = Array.from(container.querySelectorAll('svg > g > g'))
    expect(groups.map((group) => group.querySelectorAll('[data-dot]').length)).toEqual(plan.dots)
    expect(container.querySelectorAll('[data-dot]')).toHaveLength(
      plan.dots.reduce((sum, dots) => sum + dots, 0),
    )
  }
  expect(planDotRing(fits, 'full').k).toBe(1)
  expect(planDotRing(overflows, 'full').k).toBeGreaterThan(1)
})

it('never draws more dots than there are flights when weights are fractional', () => {
  const plan = planDotRing([0.3, 0.3, 0.4], 'full')
  expect(plan.dots.reduce((sum, dots) => sum + dots, 0)).toBe(1)
})
