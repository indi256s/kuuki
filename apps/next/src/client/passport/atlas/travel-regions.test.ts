import catalog from '@kuuki/data/countries.json'
import { expect, it } from 'vitest'
import { travelRegionOf } from './travel-regions'

// A catalog country without a travel region would vanish from every phone page but the world cover.
it('places every catalog country on a travel-region page', () => {
  const unplaced = Object.keys(catalog).filter((code) => !travelRegionOf(code))
  expect(unplaced).toEqual([])
})
