import { expect, it } from 'vitest'
import type { SectionId } from '@kuuki/shared/overview/prefs'
import { packTiles } from './tiles'

const ids = (...names: string[]) => names as SectionId[]
const spans = (tiles: ReturnType<typeof packTiles>) => tiles.map(({ id, span }) => `${id}:${span}`)

it('pairs tiles as halves, widens an odd half tile to full and gives Aircraft a full row', () => {
  expect(spans(packTiles(ids('a', 'b', 'c', 'd')))).toEqual([
    'a:half',
    'b:half',
    'c:half',
    'd:half',
  ])
  expect(spans(packTiles(ids('a', 'b', 'c')))).toEqual(['a:half', 'b:half', 'c:full'])
  expect(spans(packTiles(ids('a', 'aircraft', 'b')))).toEqual(['a:full', 'aircraft:full', 'b:full'])
  expect(packTiles([])).toEqual([])
})
