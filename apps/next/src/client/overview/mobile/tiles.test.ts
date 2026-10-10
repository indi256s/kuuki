import { expect, it } from 'vitest'
import { DEFAULT_ORDER, type SectionId } from '@kuuki/shared/overview/prefs'
import { packTiles } from './tiles'

const order = [...DEFAULT_ORDER] as SectionId[]
const spans = (tiles: ReturnType<typeof packTiles>) => tiles.map(({ id, span }) => `${id}:${span}`)

it('pairs tiles as halves, gives Aircraft a full row and widens an odd tile out', () => {
  expect(spans(packTiles(order))).toEqual([
    'rankings:half',
    'routes:half',
    'records:half',
    'crossings:half',
    'rhythm:half',
    'clock:half',
    'aircraft:full',
  ])
  expect(spans(packTiles(order.filter((id) => id !== 'clock')))).toEqual([
    'rankings:half',
    'routes:half',
    'records:half',
    'crossings:half',
    'rhythm:full',
    'aircraft:full',
  ])
})

it('packs only the ids it is given, in their order', () => {
  expect(spans(packTiles(['crossings', 'rankings', 'aircraft']))).toEqual([
    'crossings:half',
    'rankings:half',
    'aircraft:full',
  ])
  expect(spans(packTiles(['rhythm', 'aircraft', 'routes']))).toEqual([
    'rhythm:full',
    'aircraft:full',
    'routes:full',
  ])
  expect(packTiles([])).toEqual([])
})
