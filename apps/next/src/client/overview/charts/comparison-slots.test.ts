// @vitest-environment jsdom
import { act } from '@testing-library/react'
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, it } from 'vitest'
import {
  SLOT_CUES,
  assignSlots,
  slotCue,
  slotStorageKey,
  useComparisonSlots,
  type SlotStorage,
} from './comparison-slots'

function memoryStorage(): SlotStorage & { dump: () => string | null } {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    dump: () => items.get(slotStorageKey('me', 'airports')) ?? null,
  }
}

it('keeps a key on its slot and cue through reorder, filter, new entities, reload, exhaustion and accent changes', () => {
  const storage = memoryStorage()
  const seedOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  const at = (visibleKeys: string[], store: SlotStorage | null = storage) =>
    assignSlots({ analysis: 'airports', ownerId: 'me', visibleKeys, seedOrder, storage: store })
  const cues = (slots: Map<string, number>, key: string) => JSON.stringify(slotCue(slots.get(key)!))

  // Without storage the server and the first client render both come from the seed.
  expect([...at(['A', 'B', 'C'], null)]).toEqual([
    ['A', 0],
    ['B', 1],
    ['C', 2],
  ])
  expect(storage.dump()).toBeNull()

  const first = at(['A', 'B', 'C'])
  expect([...first]).toEqual([
    ['A', 0],
    ['B', 1],
    ['C', 2],
  ])
  // Reorder and top-N change nothing.
  const reordered = at(['C', 'A', 'B'])
  for (const key of 'ABC') expect(reordered.get(key)).toBe(first.get(key))
  // A different visible set (filter/year): the new key takes a slot no stored key uses.
  const filtered = at(['D', 'B'])
  expect(filtered.get('B')).toBe(1)
  expect(filtered.get('D')).toBe(3)
  // New entity: the last free slot, and nobody moves.
  const grown = at(['E', 'A', 'D'])
  expect(grown.get('E')).toBe(4)
  expect(grown.get('A')).toBe(0)
  expect(grown.get('D')).toBe(3)
  // A sixth entity finds every stored slot taken and avoids the slots on screen.
  expect(at(['F', 'A', 'C', 'D', 'E']).get('F')).toBe(1)

  // Reload: a fresh call over the same storage returns the same assignments, ignoring the seed.
  const reloaded = assignSlots({
    analysis: 'airports',
    ownerId: 'me',
    visibleKeys: ['F', 'E', 'D', 'C', 'B', 'A'],
    seedOrder: ['G', 'F', 'E', 'D', 'C', 'B', 'A'],
    storage,
  })
  expect(Object.fromEntries(reloaded)).toMatchObject({ A: 0, B: 1, C: 2, D: 3, E: 4, F: 1 })

  // Exhaustion: a seventh key repeats the least-used slot; earlier keys keep slot and cue.
  const before = at(['A', 'B', 'C', 'D', 'E', 'F'])
  const exhausted = at(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  expect(exhausted.get('G')).toBe(0)
  for (const key of 'ABCDEF') {
    expect(exhausted.get(key)).toBe(before.get(key))
    expect(cues(exhausted, key)).toBe(cues(before, key))
  }

  // Accent: the slot index is untouched and the colour is a token, never a cached value.
  document.documentElement.dataset.accent = 'ai'
  const accented = at(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  expect([...accented]).toEqual([...exhausted])
  for (const cue of SLOT_CUES) expect(cue.color).toMatch(/^var\(--cmp-[1-5]\)$/)
  expect(new Set(SLOT_CUES.map((cue) => `${cue.dash}|${cue.marker}`)).size).toBe(5)
  delete document.documentElement.dataset.accent

  // Unavailable or corrupt storage falls back to the seed instead of throwing.
  const corrupt: SlotStorage = { getItem: () => '{"A":9,"B":"x"', setItem: () => {} }
  expect(at(['A', 'B'], corrupt).get('B')).toBe(1)
  const blocked: SlotStorage = {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
  }
  expect(at(['A', 'B'], blocked).get('A')).toBe(0)
})

it('gives a new key the first slot the stored keys leave free, never the seed slot', () => {
  const storage = memoryStorage()
  const key = slotStorageKey('stored', 'airports')
  storage.setItem(key, '{"X":0}')
  const slots = assignSlots({
    analysis: 'airports',
    ownerId: 'stored',
    visibleKeys: ['X', 'A'],
    seedOrder: ['A', 'B', 'X'],
    storage,
  })
  expect([...slots]).toEqual([
    ['X', 0],
    ['A', 1],
  ])
  expect(JSON.parse(storage.getItem(key)!)).toEqual({ X: 0, A: 1 })
})

it('keeps slots stable when storage refuses writes', () => {
  const refusing: SlotStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota')
    },
  }
  const at = (visibleKeys: string[]) =>
    assignSlots({
      analysis: 'airports',
      ownerId: 'quota',
      visibleKeys,
      seedOrder: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      storage: refusing,
    })
  const first = at(['F', 'G'])
  expect(at(['G']).get('G')).toBe(first.get('G'))
  expect(at(['G', 'F']).get('F')).toBe(first.get('F'))
})

afterEach(() => localStorage.clear())

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
  // The server render knows only the seed.
  expect(container.textContent).toBe('[["X",2],["A",0]]')
  await act(async () => {
    hydrateRoot(container, createElement(Probe))
  })
  expect(container.textContent).toBe('[["X",0],["A",1]]')
  expect(JSON.parse(localStorage.getItem(slotStorageKey('hydrate', 'airports'))!)).toEqual({
    X: 0,
    A: 1,
  })
})
