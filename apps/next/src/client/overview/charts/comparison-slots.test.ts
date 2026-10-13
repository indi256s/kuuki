// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { SLOT_CUES, slotCue, slotStorageKey, useComparisonSlots } from './comparison-slots'

const seedOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.accent
})

it('keeps rendered keys on their slot and cue through reorder, filters, new entities, reload and exhaustion', () => {
  const view = renderHook(
    (visibleKeys: string[]) =>
      useComparisonSlots({ analysis: 'airports', ownerId: 'me', visibleKeys, seedOrder }),
    { initialProps: ['A', 'B', 'C'] },
  )
  const at = (keys: string[]) => {
    view.rerender(keys)
    return new Map(view.result.current)
  }
  const first = new Map(view.result.current)
  expect(Object.fromEntries(first)).toEqual({ A: 0, B: 1, C: 2 })
  expect(Object.fromEntries(at(['C', 'A', 'B']))).toEqual({ C: 2, A: 0, B: 1 })
  expect(Object.fromEntries(at(['D', 'B']))).toEqual({ D: 3, B: 1 })
  expect(Object.fromEntries(at(['E', 'A', 'D']))).toEqual({ E: 4, A: 0, D: 3 })
  expect(at(['F', 'A', 'C', 'D', 'E']).get('F')).toBe(1)
  const before = at(['A', 'B', 'C', 'D', 'E', 'F'])
  const exhausted = at(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  expect(exhausted.get('G')).toBe(0)
  for (const key of 'ABCDEF') expect(exhausted.get(key)).toBe(before.get(key))
  document.documentElement.dataset.accent = 'ai'
  expect([...at(['A', 'B', 'C', 'D', 'E', 'F', 'G'])]).toEqual([...exhausted])
  for (const key of 'ABCDEF')
    expect(slotCue(view.result.current.get(key)!)).toEqual(slotCue(before.get(key)!))
  view.unmount()
  const reloaded = renderHook(() =>
    useComparisonSlots({
      analysis: 'airports',
      ownerId: 'me',
      visibleKeys: ['G', 'F', 'E', 'D', 'C', 'B', 'A'],
      seedOrder: [...seedOrder].reverse(),
    }),
  )
  expect(Object.fromEntries(reloaded.result.current)).toEqual({
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    E: 4,
    F: 1,
    G: 0,
  })
  // Color alone must never be the only distinction between comparison series.
  expect(new Set(SLOT_CUES.map((cue) => `${cue.dash}|${cue.marker}`)).size).toBe(5)
  for (const cue of SLOT_CUES) expect(cue.color).toMatch(/^var\(--cmp-[1-5]\)$/)
})

it.each(['corrupt', 'blocked'])(
  '%s storage falls back to the seed without crashing a chart',
  (ownerId) => {
    if (ownerId === 'corrupt')
      localStorage.setItem(slotStorageKey(ownerId, 'airports'), '{"A":9,"B":"x"')
    else {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked')
      })
    }
    const { result } = renderHook(() =>
      useComparisonSlots({ analysis: 'airports', ownerId, visibleKeys: ['A', 'B'], seedOrder }),
    )
    expect(Object.fromEntries(result.current)).toEqual({ A: 0, B: 1 })
  },
)

it('keeps rendered slots stable when storage refuses writes', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  const view = renderHook(
    (visibleKeys: string[]) =>
      useComparisonSlots({ analysis: 'airports', ownerId: 'quota', visibleKeys, seedOrder }),
    { initialProps: ['F', 'G'] },
  )
  const first = new Map(view.result.current)
  view.rerender(['G'])
  expect(view.result.current.get('G')).toBe(first.get('G'))
  view.rerender(['G', 'F'])
  expect(view.result.current.get('F')).toBe(first.get('F'))
})

it('hydrates from the seed, then stores new keys beside the keys already stored', async () => {
  localStorage.setItem(slotStorageKey('hydrate', 'airports'), '{"X":0}')
  const Probe = () => {
    const slots = useComparisonSlots({
      analysis: 'airports',
      ownerId: 'hydrate',
      visibleKeys: ['X', 'A'],
      seedOrder: ['A', 'B', 'X'],
    })
    return createElement('p', null, JSON.stringify([...slots]))
  }
  const container = document.createElement('div')
  container.innerHTML = renderToString(createElement(Probe))
  expect(container.textContent).toBe('[["X",2],["A",0]]')
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, createElement(Probe))
  })
  expect(container.textContent).toBe('[["X",0],["A",1]]')
  expect(JSON.parse(localStorage.getItem(slotStorageKey('hydrate', 'airports'))!)).toEqual({
    X: 0,
    A: 1,
  })
  act(() => root?.unmount())
})
