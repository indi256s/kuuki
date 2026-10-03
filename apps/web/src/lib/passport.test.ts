import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getUserCountries, getCountryStats, getPassportStats } from './passport'

vi.mock('@/lib/apiClient', async () => await import('@/test/mocks/apiClient'))
import { api, resetApiMock } from '@/test/mocks/apiClient'

describe('passport', () => {
  beforeEach(resetApiMock)

  // ============================================================
  // getUserCountries - merges visits, claims, and ground visits
  // ============================================================

  describe('getUserCountries', () => {
    it('returns passport entries from flight visits', async () => {
      vi.mocked(api.get).mockResolvedValue({
        visits: [
          {
            country_code: 'JP',
            first_visit: '2023-01-15',
            last_visit: '2023-01-20',
            visit_count: 2,
            airport_iata: 'NRT',
          },
        ],
        claims: [],
        groundVisits: [],
      })

      const result = await getUserCountries('user-123')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        countryCode: 'JP',
        countryName: 'Japan',
        continent: 'asia',
        stampShape: 'circle',
        firstVisit: '2023-01-15',
        lastVisit: '2023-01-20',
        visitCount: 2,
        source: 'flight',
        airports: ['NRT'],
      })
    })

    it('returns passport entries from manual claims', async () => {
      vi.mocked(api.get).mockResolvedValue({
        visits: [],
        claims: [{ country_code: 'DE', claimed_at: '2022-06-01' }],
        groundVisits: [],
      })

      const result = await getUserCountries('user-123')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        countryCode: 'DE',
        countryName: 'Germany',
        continent: 'europe',
        stampShape: 'rectangle',
        firstVisit: '2022-06-01',
        lastVisit: '2022-06-01',
        visitCount: 1,
        source: 'claim',
        airports: [],
      })
    })

    it('marks country as "both" when visited by flight and claimed', async () => {
      vi.mocked(api.get).mockResolvedValue({
        visits: [
          {
            country_code: 'JP',
            first_visit: '2023-01-15',
            last_visit: '2023-01-20',
            visit_count: 2,
            airport_iata: 'NRT',
          },
        ],
        claims: [{ country_code: 'JP', claimed_at: '2022-05-01' }], // Earlier than flight
        groundVisits: [],
      })

      const result = await getUserCountries('user-123')

      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('both')
      // Should use the earlier date from claim
      expect(result[0].firstVisit).toBe('2022-05-01')
    })

    it('sorts entries by first visit date (oldest first)', async () => {
      vi.mocked(api.get).mockResolvedValue({
        visits: [
          {
            country_code: 'US',
            first_visit: '2023-06-01',
            last_visit: '2023-06-05',
            visit_count: 1,
            airport_iata: 'JFK',
          },
          {
            country_code: 'JP',
            first_visit: '2022-01-15',
            last_visit: '2022-01-20',
            visit_count: 1,
            airport_iata: 'NRT',
          },
        ],
        claims: [],
        groundVisits: [],
      })

      const result = await getUserCountries('user-123')

      expect(result).toHaveLength(2)
      expect(result[0].countryCode).toBe('JP') // 2022
      expect(result[1].countryCode).toBe('US') // 2023
    })

    it('counts ground visits toward a claimed country', async () => {
      vi.mocked(api.get).mockResolvedValue({
        visits: [],
        claims: [{ country_code: 'FR', claimed_at: '2021-03-01' }],
        groundVisits: [{ country_code: 'FR' }, { country_code: 'FR' }],
      })

      const result = await getUserCountries('user-123')

      expect(result).toHaveLength(1)
      expect(result[0].countryCode).toBe('FR')
      expect(result[0].visitCount).toBe(2)
    })

  })

  // ============================================================
  // getPassportStats (derived from getUserCountries)
  // ============================================================

  describe('getPassportStats', () => {
    it('calculates stats from passport entries', async () => {
      vi.mocked(api.get).mockResolvedValue({
        visits: [
          { country_code: 'JP', first_visit: '2022-01-15', last_visit: '2022-01-20', visit_count: 2, airport_iata: 'NRT' },
          { country_code: 'US', first_visit: '2023-06-01', last_visit: '2023-06-05', visit_count: 1, airport_iata: 'JFK' },
          { country_code: 'DE', first_visit: '2023-08-01', last_visit: '2023-08-10', visit_count: 1, airport_iata: 'FRA' },
        ],
        claims: [],
        groundVisits: [],
      })

      const stats = await getPassportStats('user-123')

      expect(stats.countriesCount).toBe(3)
      expect(stats.continentsCount).toBe(3) // asia, americas, europe
      expect(stats.flightCountries).toBe(3)
      expect(stats.groundCountries).toBe(0)
      expect(stats.newThisYear).toBe(0) // all entries are from 2022/2023
      expect(stats.lastStamp).toBeTruthy()
      expect(stats.lastStamp!.countryCode).toBe('DE') // latest lastVisit: 2023-08-10
    })

  })

  // ============================================================
  // getCountryStats
  // ============================================================

  describe('getCountryStats', () => {
    it('returns stats with ground visits for claimed country', async () => {
      vi.mocked(api.get).mockResolvedValue({
        countryCode: 'DE',
        countryName: '',
        firstVisit: '',
        lastVisit: '',
        totalVisits: 1,
        airports: [],
        isClaimed: true,
        groundVisits: [
          {
            id: 'gv-1',
            countryCode: 'DE',
            visitYear: 2022,
            entryMethod: 'land',
            note: 'Visited by train from France',
            createdAt: '2024-01-15T10:00:00Z',
          },
        ],
      })

      const stats = await getCountryStats('user-123', 'DE')

      expect(stats.countryCode).toBe('DE')
      expect(stats.countryName).toBe('Germany')
      expect(stats.isClaimed).toBe(true)
      expect(stats.groundVisits).toHaveLength(1)
      expect(stats.groundVisits[0]).toMatchObject({
        id: 'gv-1',
        countryCode: 'DE',
        visitYear: 2022,
        entryMethod: 'land',
        note: 'Visited by train from France',
      })
      // No flight dates but claimed -> fills current date and at least 1 visit
      expect(stats.firstVisit).not.toBe('')
      expect(stats.lastVisit).not.toBe('')
      expect(stats.totalVisits).toBe(1)
    })
  })
})
