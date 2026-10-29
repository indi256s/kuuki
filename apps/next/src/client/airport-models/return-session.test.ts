// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import {
  airportOverviewBack,
  captureAirportReturn,
  clearAirportReturns,
  getOverviewReturn,
  markAirportVisit,
  updateOverviewReturn,
} from './return-session'

const ui = {
  category: 'airports' as const,
  airport: 'TBS',
  mobileChapter: 'rankings' as const,
  pageY: 420,
  sheetY: 120,
}
afterEach(() => {
  clearAirportReturns()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

it('binds restoration to its owner and source entry while preserving Next state', () => {
  history.replaceState({ __NA: true, nextField: 'preserve' }, '', '/overview')
  const item = captureAirportReturn('a', { months: [3], airlines: ['TK'] }, ui)
  const source = history.state
  expect(source.nextField).toBe('preserve')
  expect(getOverviewReturn('a')).toBeNull()
  history.pushState({ __NA: true }, '', '/airports/TBS')
  markAirportVisit('a', item.token)
  const back = vi.spyOn(history, 'back').mockImplementation(() => {})
  expect(airportOverviewBack('b', item.token)).toBe(false)
  expect(airportOverviewBack('a', item.token)).toBe(true)
  expect(back).toHaveBeenCalledTimes(1)
  history.replaceState(source, '', '/overview')
  expect(getOverviewReturn('a')).toMatchObject({ filter: { months: [3], airlines: ['TK'] }, ...ui })
  expect(getOverviewReturn('b')).toBeNull()
  updateOverviewReturn('a', { airport: 'BER', filter: { months: [4] } })
  expect(getOverviewReturn('a')).toMatchObject({ airport: 'BER', filter: { months: [4] } })
  history.replaceState({ __NA: true }, '', '/overview')
  expect(getOverviewReturn('a')).toBeNull()
})

it('keeps same-tab restoration when storage is blocked and expires old snapshots', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  history.replaceState({}, '', '/overview')
  const item = captureAirportReturn('a', {}, ui)
  const source = history.state
  history.replaceState({}, '', '/airports/TBS')
  markAirportVisit('a', item.token)
  history.replaceState(source, '', '/overview')
  expect(getOverviewReturn('a')?.token).toBe(item.token)
  vi.spyOn(Date, 'now').mockReturnValue(item.createdAt + 24 * 60 * 60 * 1000)
  expect(getOverviewReturn('a')).toBeNull()
})

it('retains only ten transitions and clears all owner records on identity retirement', () => {
  history.replaceState({}, '', '/overview')
  const first = captureAirportReturn('a', {}, ui)
  const source = history.state
  for (let n = 0; n < 10; n++) captureAirportReturn('a', {}, ui)
  history.replaceState({}, '', '/airports/TBS')
  markAirportVisit('a', first.token)
  expect(airportOverviewBack('a', first.token)).toBe(false)
  history.replaceState(source, '', '/overview')
  expect(getOverviewReturn('a')).toBeNull()
  const current = captureAirportReturn('a', {}, ui)
  const currentSource = history.state
  history.replaceState({}, '', '/airports/TBS')
  markAirportVisit('a', current.token)
  clearAirportReturns()
  history.replaceState(currentSource, '', '/overview')
  expect(getOverviewReturn('a')).toBeNull()
})
