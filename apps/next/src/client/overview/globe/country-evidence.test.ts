import { expect, it } from 'vitest'
import type { OverviewPayload } from '@kuuki/shared/overview/model'
import fixture from '../../../../../../packages/shared/src/overview/__fixtures__/n10.json'
import { countryEvidence, regionKey } from './country-evidence'

it('counts weighted logged country evidence with transit suppression, domestic dedupe, scope, and an unnamed region as Unknown', () => {
  const base = (fixture as OverviewPayload).rows[0]
  const payload: OverviewPayload = {
    ...(fixture as OverviewPayload),
    refs: {
      aircraft: {},
      regions: { GE: 'asia', FR: 'europe', ZZ: 'unknown' },
      airports: {
        AAA: { lat: null, lon: null, city: null, name: 'A', country: 'GE' },
        BBB: { lat: null, lon: null, city: null, name: 'B', country: 'FR' },
        CCC: { lat: null, lon: null, city: null, name: 'C', country: 'ZZ' },
      },
    },
    rows: [
      {
        ...base,
        state: 'logged',
        origin: 'AAA',
        destination: 'BBB',
        weight: 3,
        suppressed: 0,
        airline: 'AA',
      },
      {
        ...base,
        state: 'logged',
        origin: 'AAA',
        destination: 'AAA',
        weight: 2,
        suppressed: 0,
        airline: 'AA',
      },
      {
        ...base,
        state: 'logged',
        origin: 'AAA',
        destination: 'BBB',
        weight: 5,
        suppressed: 2,
        airline: 'AA',
      },
      {
        ...base,
        state: 'logged',
        origin: 'CCC',
        destination: 'MISSING',
        weight: 9,
        suppressed: 0,
        airline: 'AA',
      },
      {
        ...base,
        state: 'awaiting',
        origin: 'AAA',
        destination: 'BBB',
        weight: 50,
        suppressed: 0,
        airline: 'AA',
      },
      {
        ...base,
        state: 'upcoming',
        origin: 'AAA',
        destination: 'BBB',
        weight: 50,
        suppressed: 0,
        airline: 'AA',
      },
      {
        ...base,
        state: 'logged',
        origin: 'AAA',
        destination: 'BBB',
        weight: 40,
        suppressed: 0,
        airline: 'BB',
      },
    ],
  }
  expect(countryEvidence(payload, { airlines: ['AA'] })).toEqual([
    { region: 'asia', value: 10, countries: [{ code: 'GE', value: 10 }] },
    { region: 'unknown', value: 9, countries: [{ code: 'ZZ', value: 9 }] },
    { region: 'europe', value: 3, countries: [{ code: 'FR', value: 3 }] },
  ])
})

it('maps region codes onto the six palette regions; every Americas variant is americas and the rest is Unknown, not Other', () => {
  expect(
    ['africa', 'americas', 'antarctica', 'asia', 'europe', 'oceania', ' Europe '].map(regionKey),
  ).toEqual(['africa', 'americas', 'antarctica', 'asia', 'europe', 'oceania', 'europe'])
  expect(['north-america', 'south-america', 'central-america', 'Caribbean'].map(regionKey)).toEqual(
    ['americas', 'americas', 'americas', 'americas'],
  )
  expect(['other', 'unknown', '', undefined, null].map(regionKey)).toEqual([
    'unknown',
    'unknown',
    'unknown',
    'unknown',
    'unknown',
  ])
})
