import { expect, it } from 'vitest'
import { DEFAULT_ORDER, type SectionId } from '@kuuki/shared/overview/prefs'
import { packBento } from './bento'

it('packs default visible adjacency without mutating order', () => {
  const order = [...DEFAULT_ORDER], hidden: SectionId[] = []
  expect(packBento(order, hidden)).toEqual([
    { kind: 'full', id: 'rankings' }, { kind: 'full', id: 'records' },
    { kind: 'pair', narrow: 'manufacturers', wide: 'fleet', narrowFirst: true },
    { kind: 'pair', narrow: 'clock', wide: 'rhythm', narrowFirst: true }, { kind: 'full', id: 'crossings' },
  ])
  expect(order).toEqual(DEFAULT_ORDER); expect(hidden).toEqual([])
})
it('keeps reversed pairs in visible order', () => {
  expect(packBento(['fleet', 'manufacturers'], [])).toEqual([{ kind: 'pair', narrow: 'manufacturers', wide: 'fleet', narrowFirst: false }])
})
it.each([['clock', 'manufacturers'], ['fleet', 'rhythm'], ['clock'], ['fleet']] as SectionId[][])('ordinary orphans remain full width: %j', (...order) => {
  expect(packBento(order, [])).toEqual(order.map(id => ({ kind: 'full', id })))
})
it('skips hidden before pairing; full rows interrupt adjacency', () => {
  expect(packBento(['clock', 'records', 'fleet', 'crossings', 'manufacturers'], ['records'])).toEqual([
    { kind: 'pair', narrow: 'clock', wide: 'fleet', narrowFirst: true }, { kind: 'full', id: 'crossings' }, { kind: 'full', id: 'manufacturers' },
  ])
  expect(packBento([...DEFAULT_ORDER], [...DEFAULT_ORDER])).toEqual([])
})
