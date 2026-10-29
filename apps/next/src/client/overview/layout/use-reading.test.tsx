// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { OverviewFilter } from '@kuuki/shared/overview/model'
import { ChapterContext } from './chapter-context'
import { useReading } from './use-reading'

const store = vi.hoisted(() => ({ filter: {} as OverviewFilter }))
vi.mock('../store/overview-context', () => ({ useOverview: () => store }))

afterEach(() => {
  cleanup()
  store.filter = {}
})

const harness = (active: boolean) => ({
  wrapper: ({ children }: { children: ReactNode }) => (
    <ChapterContext.Provider value={{ span: 'sheet', active }}>{children}</ChapterContext.Provider>
  ),
})

it('goes back to the headline, unpicked, when the chapter stops being the open one', () => {
  let active = true
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChapterContext.Provider value={{ span: 'sheet', active }}>{children}</ChapterContext.Provider>
  )
  const keys = ['a', 'b', 'c']
  const { result, rerender } = renderHook(() => useReading(keys, 'a'), { wrapper })
  act(() => result.current.pick('c'))
  expect(result.current).toMatchObject({ reading: 'c', isHeadline: false, picked: true })
  active = false
  rerender()
  expect(result.current).toMatchObject({ reading: 'a', isHeadline: true, picked: false })
})

it('goes back to the headline when the picked key leaves the list', () => {
  const { result, rerender } = renderHook(({ keys }: { keys: string[] }) => useReading(keys, 'a'), {
    initialProps: { keys: ['a', 'b', 'c'] },
    ...harness(true),
  })
  act(() => result.current.pick('c'))
  rerender({ keys: ['a', 'b'] })
  expect(result.current).toMatchObject({ reading: 'a', picked: false })
})

it('steps through the keys in order and wraps', () => {
  const { result } = renderHook(() => useReading(['a', 'b', 'c'], 'b'), harness(true))
  act(() => result.current.next())
  expect(result.current.reading).toBe('c')
  act(() => result.current.next())
  expect(result.current.reading).toBe('a')
  expect(result.current.picked).toBe(true)
})

it('goes back to the headline, unpicked, when the filter changes even if the reading survives it', () => {
  const { result, rerender } = renderHook(() => useReading(['a', 'b', 'c'], 'a'), harness(true))
  act(() => result.current.pick('c'))
  store.filter = { period: { years: [2024] } }
  rerender()
  expect(result.current).toMatchObject({ reading: 'a', picked: false })
  store.filter = { period: { years: [2024] } }
  act(() => result.current.pick('b'))
  rerender()
  expect(result.current).toMatchObject({ reading: 'b', picked: true })
})

it('restores an initial reading only in the active chapter and keeps normal filter resets', () => {
  let active = false
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ChapterContext.Provider value={{ span: 'sheet', active }}>{children}</ChapterContext.Provider>
  )
  const { result, rerender } = renderHook(
    () => useReading(['a', 'b'], 'a', { key: 'b', token: 'return' }),
    { wrapper },
  )
  expect(result.current.reading).toBe('a')
  active = true
  rerender()
  expect(result.current).toMatchObject({ reading: 'b', picked: false })
  store.filter = { months: [3] }
  rerender()
  expect(result.current.reading).toBe('a')
  rerender()
  expect(result.current.reading).toBe('a')
})
