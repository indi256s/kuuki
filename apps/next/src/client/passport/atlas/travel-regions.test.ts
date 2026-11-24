import catalog from '@kuuki/data/countries.json'
import { expect, it } from 'vitest'
import { travelRegionOf } from './travel-regions'

it('places every catalog country on a travel-region page', () => {
  const unplaced = Object.keys(catalog).filter((code) => !travelRegionOf(code))
  expect(unplaced).toEqual([])
})
