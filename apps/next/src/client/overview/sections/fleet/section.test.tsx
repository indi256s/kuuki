// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { Section } from './section'
import { ridgeProfile } from './helpers'

const context = vi.hoisted(() => ({
  current: {} as ReturnType<typeof import('../../store/overview-context').useOverview>,
}))
vi.mock('../../store/overview-context', () => ({ useOverview: () => context.current }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each(['en', 'ru'] as const)(
  'withholds absent duration targets, reports partial coverage, and keeps family filtering in %s',
  (locale) => {
    expect(ridgeProfile([])).toEqual([])
    vi.stubGlobal('IntersectionObserver', undefined)
    const payload = structuredClone(fixture) as OverviewPayload
    payload.rows = payload.rows.map((row) => ({ ...row, durationSource: 'estimate' }))
    const add = vi.fn()
    const admit = () => {
      const all = computeOverview(payload, {})
      context.current = {
        scope: all,
        all,
        locale,
        ownerKey: 'dev',
        actions: { add },
        isCurrent: () => true,
      } as unknown as typeof context.current
    }
    admit()
    const view = render(<Section span="full" />)
    const caption = locale === 'en' ? 'Flight length by type' : 'Длительность по типам'
    expect(screen.queryByRole('group', { name: caption })).toBeNull()
    expect(
      screen.getByText(
        locale === 'en'
          ? 'Exact flight durations are unavailable.'
          : 'Точная длительность перелётов неизвестна.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        locale === 'en'
          ? 'Exact duration recorded: 0 of 4 flights'
          : 'Точная длительность указана: 0 из 4',
      ),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: locale === 'en' ? 'Add filter · A320' : 'Добавить фильтр · A320',
      }),
    )
    expect(add).toHaveBeenCalledExactlyOnceWith('families', 'A320')

    payload.rows[3].durationSource = 'times'
    admit()
    view.rerender(<Section span="full" />)
    expect(
      screen.getByText(
        locale === 'en'
          ? 'Exact duration recorded: 1 of 4 flights'
          : 'Точная длительность указана: 1 из 4',
      ),
    ).toBeInTheDocument()
    const chart = screen.getByRole('group', { name: caption })
    const targets = Array.from(chart.querySelectorAll('[data-chart-key]'))
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.every((target) => target.getAttribute('aria-label')?.startsWith('A320 ·'))).toBe(
      true,
    )
    expect(
      screen.getByRole('button', {
        name: locale === 'en' ? 'Add filter · 737' : 'Добавить фильтр · 737',
      }),
    ).toBeInTheDocument()
  },
)

it('keeps zero-only recorded durations distinct from missing data and preserves family filters', () => {
  const payload = structuredClone(fixture) as OverviewPayload
  payload.rows = payload.rows.map((row) => ({
    ...row,
    durationSource: 'times',
    durationMinutes: 0,
  }))
  const all = computeOverview(payload, {}),
    add = vi.fn()
  context.current = {
    scope: all,
    all,
    locale: 'en',
    ownerKey: 'dev',
    actions: { add },
    isCurrent: () => true,
  } as unknown as typeof context.current
  render(<Section span="full" />)
  expect(screen.getByText('Flight duration distribution is unavailable.')).toBeInTheDocument()
  expect(screen.queryByText('Exact flight durations are unavailable.')).not.toBeInTheDocument()
  expect(screen.getByText('Exact duration recorded: 4 of 4 flights')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add filter · A320' }))
  expect(add).toHaveBeenCalledExactlyOnceWith('families', 'A320')
})
