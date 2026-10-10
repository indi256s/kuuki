// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import { dayToEpoch } from '@kuuki/shared/overview/range'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { TimelineContent } from './section'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
vi.mock('../../store/open-flight', () => ({ useOpenFlight: () => vi.fn() }))
afterEach(() => vi.unstubAllGlobals())
function admit(payload: OverviewPayload, ownerKey = 'owner-a') {
  const setPeriod = vi.fn()
  context.current = {
    payload,
    scope: computeOverview(payload, {}),
    all: computeOverview(payload, {}),
    filter: {},
    aggregate: payload.mode === 'aggregate',
    ownerKey,
    locale: 'en',
    actions: { setPeriod },
    isCurrent: () => true,
  } as unknown as typeof context.current
  return setPeriod
}

it('brush stages a UTC day range until release and discards the draft when its owner changes', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const payload = structuredClone(fixture) as OverviewPayload
  const firstWrite = admit(payload)
  const view = render(<TimelineContent span="full" />)
  const start = screen.getByRole('slider', { name: 'Range start' })
  const day = '2020-02-29'
  fireEvent.change(start, { target: { value: dayToEpoch(day) } })
  expect(start).toHaveAttribute('aria-valuetext', day)
  expect(firstWrite).not.toHaveBeenCalled()
  fireEvent.pointerUp(start)
  expect(firstWrite).toHaveBeenCalledTimes(1)
  expect(firstWrite.mock.calls[0][0].from).toBe(day)
  fireEvent.blur(start)
  expect(firstWrite).toHaveBeenCalledTimes(1)
  fireEvent.change(start, { target: { value: dayToEpoch('2020-03-01') } })
  const secondWrite = admit(payload, 'owner-b')
  view.rerender(<TimelineContent span="full" />)
  const replacement = screen.getByRole('slider', { name: 'Range start' })
  expect(replacement).not.toBe(start)
  expect(replacement).toHaveAttribute('aria-valuetext', '2020-01-01')
  fireEvent.pointerUp(replacement)
  expect(secondWrite).not.toHaveBeenCalled()
})
