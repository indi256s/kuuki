// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { Section } from './section'

const context = vi.hoisted(() => ({ current: {} as ReturnType<typeof import('../../store/overview-context').useOverview> }))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))

it('gap and scope-hidden years keep decorative ghosts without selectable zero-flight actions', () => {
  const payload = fixture as OverviewPayload, all = computeOverview(payload, {}), setPeriod = vi.fn()
  if (all.crossings.status !== 'ready') throw new Error('Board must satisfy Crossings minimum')
  const year = all.crossings.value.shiftByYear.toSorted((a, b) => b.flights - a.flights)[0].year
  const scope = computeOverview(payload, { period: { years: [year] } })
  context.current = { scope, all, locale: 'en', isCurrent: () => true, actions: { setPeriod } } as unknown as typeof context.current
  render(<Section span="full" />)
  const chart = screen.getByRole('group', { name: 'Clock change per year · hours' })
  const marks = Array.from(chart.querySelectorAll('[data-kc-key]'))
  expect(marks).toHaveLength(1)
  expect(marks[0]).toHaveAttribute('data-kc-key', String(year))
  expect(chart).toHaveTextContent('2015')
  expect(chart).toHaveTextContent('–')
  fireEvent.click(marks[0])
  expect(setPeriod).toHaveBeenCalledExactlyOnceWith({ years: [year] })
})
