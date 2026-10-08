import { expect, it } from 'vitest'
import { DEFAULT_PREFS } from '@kuuki/shared/overview/prefs'
import { packTiles } from './tiles'

it('default mobile order and spans', () => {
  expect(packTiles(DEFAULT_PREFS.layout.order, [])).toEqual([
    { id: 'rankings', span: 'half' }, { id: 'records', span: 'half' },
    { id: 'manufacturers', span: 'full' }, { id: 'fleet', span: 'half' },
    { id: 'clock', span: 'half' }, { id: 'rhythm', span: 'half' }, { id: 'crossings', span: 'half' },
  ])
})
it('orphan half becomes full before manufacturers and at the end without changing inputs', () => {
  const order = [...DEFAULT_PREFS.layout.order], hidden = ['records', 'crossings'] as const
  expect(packTiles(order, [...hidden])).toEqual([
    { id: 'rankings', span: 'full' }, { id: 'manufacturers', span: 'full' },
    { id: 'fleet', span: 'half' }, { id: 'clock', span: 'half' }, { id: 'rhythm', span: 'full' },
  ])
  expect(order).toEqual(DEFAULT_PREFS.layout.order)
  expect(hidden).toEqual(['records', 'crossings'])
  expect(packTiles(['clock', 'fleet', 'manufacturers', 'records'], [])).toEqual([
    { id: 'clock', span: 'half' }, { id: 'fleet', span: 'half' }, { id: 'manufacturers', span: 'full' }, { id: 'records', span: 'full' },
  ])
})
