// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { computeOverview } from '@kuuki/shared/overview/compute'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/board.json'
import { OverviewProvider } from '../store/overview-context'
import { CORPUS } from './corpus'
import { canonicalFilter, pickLine } from './pick'
import { TRIGGERS, type NarratorSlot } from './triggers'
import { Narrator } from './narrator'

const payload = fixture as OverviewPayload
const all = computeOverview(payload, {})
const scope = (filter: OverviewFilter = {}) => computeOverview(payload, filter)
const gates = ['records', 'crossings', 'manufacturers', 'fleet', 'clock', 'rhythm'] as const
const gateKeys = ['records', 'crossings', 'makers', 'fleet', 'clock', 'rhythm'] as const
afterEach(cleanup)

it('keeps seed selection stable across key, facet value and nested year insertion order without mutation', () => {
  const filter: OverviewFilter = { airlines: ['QR', 'TK'], period: { years: [2025, 2024] }, depHours: [7, 12] }
  const reversed: OverviewFilter = { depHours: [12, 7], period: { years: [2024, 2025] }, airlines: ['TK', 'QR'] }
  const before = structuredClone(filter)
  expect(canonicalFilter(filter)).toBe('{"airlines":["QR","TK"],"depHours":[12,7],"period":{"years":[2024,2025]}}')
  expect(canonicalFilter(reversed)).toBe(canonicalFilter(filter))
  for (let i = 0; i < 30; i++) {
    expect(pickLine('globe', scope(filter), all, `owner${i}`, 'en')).toBe(pickLine('globe', scope(reversed), all, `owner${i}`, 'en'))
  }
  expect(filter).toEqual(before)
  expect(canonicalFilter({ period: { to: '2025-12', from: '2024-01' } })).toBe(canonicalFilter({ period: { from: '2024-01', to: '2025-12' } }))
  expect(canonicalFilter({ period: { from: '2024-01', to: '2025-12' } })).not.toBe(canonicalFilter({ period: { from: '2025-01', to: '2025-12' } }))
})

it('spreads thirty seeds over three variants while locale changes only presentation', () => {
  const seen = new Set<string | null>()
  for (let i = 0; i < 30; i++) {
    const en = pickLine('globe', all, all, `owner${i}`, 'en')!
    const ru = pickLine('globe', all, all, `owner${i}`, 'ru')!
    const variant = CORPUS.globe.findIndex(line => line.en.replace('{flights}', String(all.figures.flights)) === en)
    expect(variant).toBeGreaterThanOrEqual(0)
    expect(ru).toBe(CORPUS.globe[variant].ru.replace('{flights}', String(all.figures.flights)))
    seen.add(en)
  }
  expect(seen.size).toBe(3)
  // FNV1a32('owner2|globe|{}') = 3047448297; unsigned modulo three is zero.
  expect(pickLine('globe', all, all, 'owner2', 'en')).toBe(CORPUS.globe[0].en.replace('{flights}', String(all.figures.flights)))
})

it('fills RU numbers with Unicode grouping and EN numbers with comma grouping', () => {
  const large = { ...all, figures: { ...all.figures, flights: 14535 } }
  expect(pickLine('globe', large, all, 'owner', 'ru')).toMatch(/14[\u00a0\u202f]535/)
  expect(pickLine('globe', large, all, 'owner', 'en')).toContain('14,535')
})

it.each(gates)('%s uses its actual below gate and admits normal copy only when ready', slot => {
  const index = gates.indexOf(slot), key = gateKeys[index]
  const below = { ...all, [key]: { status: 'below', have: 17, need: 23 } }
  const normal = TRIGGERS.find(trigger => trigger.id === slot)!
  const fallback = TRIGGERS.find(trigger => trigger.id === `below:${slot}`)!
  expect(normal.when(below, all)).toBeNull()
  expect(fallback.when(below, all)).toEqual({ have: 17, need: 23 })
  const line = pickLine(slot, below, all, 'owner', 'en')!
  expect(line).toContain('17')
  expect(line).toContain('23')
  expect(all[key].status).toBe('ready')
  expect(normal.when(all, all)).not.toBeNull()
  expect(fallback.when(all, all)).toBeNull()
  const actual = scope({ airlines: ['ZZ'] })
  const gate = actual[key]
  expect(gate.status).toBe('below')
  if (gate.status === 'below') expect(fallback.when(actual, all)).toEqual({ have: gate.have, need: gate.need })
})

it('keeps rankings ungated even without flights', () => {
  const empty = scope({ airlines: ['ZZ'] })
  expect(pickLine('rankings', empty, all, 'owner', 'en')).not.toBeNull()
  expect(TRIGGERS.find(trigger => trigger.id === 'below:rankings')).toBeUndefined()
})

it('first-run and zero-result slots are exclusive and use semantic filter emptiness', () => {
  const emptyPayload = { ...payload, rows: [] }
  for (const filter of [{}, { airlines: [], period: { years: [] } }] satisfies OverviewFilter[]) {
    const empty = computeOverview(emptyPayload, filter)
    expect(pickLine('firstRun', empty, all, 'owner', 'en')).not.toBeNull()
    expect(pickLine('zero', empty, all, 'owner', 'en')).toBeNull()
  }
  const zero = scope({ airlines: ['ZZ'] })
  expect(pickLine('firstRun', zero, all, 'owner', 'en')).toBeNull()
  expect(pickLine('zero', zero, all, 'owner', 'en')).not.toBeNull()
  expect(pickLine('firstRun', all, all, 'owner', 'en')).toBeNull()
  expect(pickLine('zero', all, all, 'owner', 'en')).toBeNull()
})

it('selects descending priority, skips null matches and keeps declared-order ties', () => {
  const original = [...TRIGGERS]
  const base = TRIGGERS.find(trigger => trigger.id === 'globe')!
  try {
    TRIGGERS.splice(0, TRIGGERS.length,
      { ...base, id: 'zero', priority: 1, when: () => ({}) },
      { ...base, id: 'firstRun', priority: 20, when: () => null },
      { ...base, id: 'firstRun', priority: 10, when: () => ({}) },
      { ...base, id: 'zero', priority: 10, when: () => ({}) })
    expect(CORPUS.firstRun.map(line => line.en)).toContain(pickLine('globe', all, all, 'owner', 'en'))
    expect(TRIGGERS.map(trigger => trigger.priority)).toEqual([1, 20, 10, 10])
    TRIGGERS[2] = { ...base, priority: 10, when: () => ({ flights: 'TBS–DOH' }) }
    expect(pickLine('globe', all, all, 'owner', 'ru')).toContain('TBS–DOH')
  } finally { TRIGGERS.splice(0, TRIGGERS.length, ...original) }
})

it('pairs three distinct factual EN/RU variants with exactly their applicable trigger params', () => {
  const empty = computeOverview({ ...payload, rows: [] }, {})
  const zero = scope({ airlines: ['ZZ'] })
  for (const trigger of TRIGGERS) {
    const params = [all, empty, zero].map(value => trigger.when(value, all)).find(value => value !== null)
    expect(params, trigger.id).toBeDefined()
    const lines = CORPUS[trigger.id]
    expect(lines, trigger.id).toHaveLength(3)
    for (const locale of ['en', 'ru'] as const) {
      expect(new Set(lines.map(line => line[locale])).size).toBe(3)
      for (const line of lines) {
        const placeholders = [...line[locale].matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
        expect(placeholders, `${trigger.id}:${locale}`).toEqual(Object.keys(params!).sort())
        expect(line[locale]).not.toMatch(/\d/)
      }
    }
  }
})

it('renders only a paragraph through the actual provider and omits unavailable or inapplicable data', () => {
  const saver = async (prefs: typeof DEFAULT_PREFS) => prefs
  const view = (locale: 'en' | 'ru', slot: NarratorSlot = 'globe', data: OverviewPayload | null = payload) =>
    <OverviewProvider payload={data} prefs={DEFAULT_PREFS} ownerKey="owner" locale={locale} live={false} saver={saver}><Narrator slot={slot} /></OverviewProvider>
  const { container, rerender, unmount } = render(view('en'))
  expect(container.children).toHaveLength(1)
  expect(container.firstElementChild?.tagName).toBe('P')
  expect(container.firstElementChild?.className).toBe('narrator')
  expect(container.textContent).toBe(pickLine('globe', all, all, 'owner', 'en'))
  rerender(view('ru'))
  expect(container.textContent).toBe(pickLine('globe', all, all, 'owner', 'ru'))
  rerender(view('en', 'firstRun'))
  expect(container).toBeEmptyDOMElement()
  unmount()
  const unavailable = render(view('en', 'globe', null))
  expect(unavailable.container).toBeEmptyDOMElement()
})
