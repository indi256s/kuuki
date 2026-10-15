import { expect, it } from 'vitest'
import { clearAll, removeLast, setScope } from './filter-actions'

it('keeps the page scope when facets are reset', () => {
  expect(clearAll({ scope: 'ground', airlines: ['BA'], period: { years: [2024] } })).toEqual({
    scope: 'ground',
  })
  expect(clearAll({ airlines: ['BA'] })).toEqual({})
})

it('never removes the scope as the last filter', () => {
  expect(removeLast({ airlines: ['BA'], scope: 'ground' })).toEqual({
    scope: 'ground',
  })
  const onlyScope = { scope: 'flights' } as const
  expect(removeLast(onlyScope)).toBe(onlyScope)
})

it('writes the scope and drops it for Всё', () => {
  expect(setScope({ airlines: ['BA'] }, 'ground')).toEqual({
    airlines: ['BA'],
    scope: 'ground',
  })
  expect(setScope({ scope: 'ground', airlines: ['BA'] }, null)).toEqual({
    airlines: ['BA'],
  })
})
