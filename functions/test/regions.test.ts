// T08 / ADR 0001 §4: the six-region catalog policy is explicit, versioned and in parity with the catalog.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { ROOT } from '../../scripts/_cli'
import { OUTPUT, render } from '../../scripts/generate-country-regions'
import { COUNTRY_REGION, REGION_IDS, REGION_TOTALS } from '../api/_lib/countryRegions.generated'
import { catalogRegionOf, regionCount, regionProgress, REGION_POLICY } from '../api/_lib/regions'

const catalog = JSON.parse(
  readFileSync(join(ROOT, 'packages', 'data', 'src', 'countries.json'), 'utf8'),
) as Record<string, { continent: string }>

it('matches the catalog exactly: every country, every region, every total', () => {
  expect(Object.keys(COUNTRY_REGION).sort()).toEqual(Object.keys(catalog).sort())
  for (const [code, country] of Object.entries(catalog))
    expect(COUNTRY_REGION[code], code).toBe(country.continent)
  expect(REGION_TOTALS).toEqual({
    africa: 58,
    americas: 54,
    antarctica: 3,
    asia: 52,
    europe: 51,
    oceania: 28,
  })
  expect(Object.values(REGION_TOTALS).reduce((sum, n) => sum + n, 0)).toBe(
    Object.keys(catalog).length,
  )
  expect(REGION_IDS).toHaveLength(6)
})

it('is the checked-in output of the generator, so a catalog change cannot go unnoticed', () => {
  expect(readFileSync(OUTPUT, 'utf8')).toBe(render(catalog))
})

it('exposes an explicit versioned policy and counts distinct collection regions', () => {
  expect(REGION_POLICY).toMatchObject({ version: 1, id: 'catalog-regions-v1' })
  expect(REGION_POLICY.regions).toEqual([...REGION_IDS])
  expect(catalogRegionOf('GE')).toBe('asia')
  expect(catalogRegionOf('TR')).toBe('asia')
  expect(catalogRegionOf('US')).toBe('americas')
  expect(catalogRegionOf('AQ')).toBe('antarctica')
  expect(catalogRegionOf('ZZ')).toBeNull()
  expect(catalogRegionOf(null)).toBeNull()
  expect(regionCount(['GE', 'TR', 'US', 'ZZ', ''])).toBe(2)
  expect(regionCount([])).toBe(0)
})

it('reports progress for all six regions with pressed and pending kept apart', () => {
  const progress = regionProgress(['GE', 'US', 'ZZ'], ['TR', 'GB'])
  expect(progress.map((row) => row.id)).toEqual([...REGION_IDS])
  expect(progress.find((row) => row.id === 'asia')).toEqual({
    id: 'asia',
    total: 52,
    pressed: 1,
    pending: 1,
  })
  expect(progress.find((row) => row.id === 'americas')).toEqual({
    id: 'americas',
    total: 54,
    pressed: 1,
    pending: 0,
  })
  expect(progress.find((row) => row.id === 'europe')).toEqual({
    id: 'europe',
    total: 51,
    pressed: 0,
    pending: 1,
  })
  expect(progress.find((row) => row.id === 'africa')).toEqual({
    id: 'africa',
    total: 58,
    pressed: 0,
    pending: 0,
  })
})

// Moving a country between regions changes what Overview and Passport report for existing accounts, so it is a
// policy change: bump REGION_POLICY.version (and `id`) together with this pin, never the pin alone.
const MAPPING_HASH_BY_VERSION: Record<number, string> = {
  1: '45318207958008cb5a864ce91833c54db446a5ded3d2c9aadf45ca4cb2707a66',
}

it('pins the country-to-region mapping to the policy version', () => {
  const mapping = Object.entries(COUNTRY_REGION).sort(([a], [b]) => (a < b ? -1 : 1))
  const hash = createHash('sha256').update(JSON.stringify(mapping)).digest('hex')
  expect(
    hash,
    `the mapping changed: bump REGION_POLICY.version (${REGION_POLICY.version}) and pin ${hash}`,
  ).toBe(MAPPING_HASH_BY_VERSION[REGION_POLICY.version])
})
