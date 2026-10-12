// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it } from 'vitest'
import { ChapterContext } from './chapter-context'
import { useReading } from './use-reading'

afterEach(cleanup)

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
