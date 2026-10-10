// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { aggregateRows } from '@kuuki/shared/overview/aggregate'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { Section } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))

it('keeps the latest reading and segment selection aligned through filtering and data restoration', () => {
  const payload = structuredClone(fixture) as OverviewPayload
  payload.rows = [365, 370, 375, 378, 380, 1385].map((depMinute, i) => ({
    ...payload.rows[0],
    id: i + 1,
    weight: 1,
    state: 'logged',
    origin: 'IST',
    destination: ['CDG', 'LHR', 'CDG', 'LHR', 'FRA', 'NRT'][i],
    date: '2025-01-03',
    depMinute,
  }))
  const admit = (data: OverviewPayload, filter: OverviewFilter = {}) => {
    context.current = {
      scope: computeOverview(data, filter),
      all: computeOverview(data, {}),
      locale: 'en',
      actions: { add: vi.fn() },
      isCurrent: () => true,
    } as unknown as typeof context.current
  }
  admit(payload)
  const view = render(<Section span="full" />)
  const expectReading = (time: string, description: string, latest: boolean | null) => {
    expect(view.container.querySelector('.ov3-cookie-value')).toHaveTextContent(time)
    expect(view.container.querySelector('.ov3-cookie-sub')).toHaveTextContent(description)
    const toggle = screen.queryByRole('button', { name: 'Show latest departure' })
    if (latest === null) {
      expect(toggle).toBeNull()
      expect(view.container.querySelector('[data-part="lit-b"] path')).toBeNull()
      expect(view.container.querySelector('[data-part="lit-a"] path')).toBeNull()
    } else {
      expect(toggle).toHaveAttribute('aria-pressed', String(latest))
      // This selector owns the CSS swap between the two segment readings.
      expect(view.container.querySelector('.ov3-clock-toggle[aria-pressed="true"]')).toBe(
        latest ? toggle : null,
      )
      expect(toggle?.querySelector('[data-part="lit-b"] path')).not.toBeNull()
      expect(toggle?.querySelector('[data-part="lit-a"] path')).not.toBeNull()
    }
    expect(view.container.querySelector('.iso-clock [data-part="lit-both"] path')).not.toBeNull()
  }
  expectReading('06:05', 'Earliest departure · IST → CDG', false)
  fireEvent.click(screen.getByRole('button', { name: 'Show latest departure' }))
  expectReading('23:05', 'Latest departure · IST → NRT', true)
  const latestSegments = view.container.querySelector('[data-part="lit-b"] path')!.getAttribute('d')

  admit(payload, { depHours: [6] })
  view.rerender(<Section span="full" />)
  expectReading('06:20', 'Latest departure · IST → FRA', true)
  expect(view.container.querySelector('[data-part="lit-b"] path')).not.toHaveAttribute(
    'd',
    latestSegments,
  )

  admit({ ...payload, mode: 'aggregate', rows: aggregateRows(payload.rows) }, { depHours: [6] })
  view.rerender(<Section span="full" />)
  expectReading('06:05', 'Earliest departure · IST → CDG', null)

  admit(payload)
  view.rerender(<Section span="full" />)
  expectReading('23:05', 'Latest departure · IST → NRT', true)
  expect(view.container.querySelector('[data-part="lit-b"] path')).toHaveAttribute(
    'd',
    latestSegments,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show latest departure' }))
  expectReading('06:05', 'Earliest departure · IST → CDG', false)
})
