import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getUserCountries,
  getUserClaims,
  claimCountry,
  addGroundVisit,
  getGroundVisits,
  deleteGroundVisit,
  unclaimCountry,
  getCountryStats,
  getPassportStats,
  isCountryClaimed,
  getAllCountries,
  getCountryByCode,
} from './passport'

vi.mock('@/lib/apiClient', async () => await import('@/test/mocks/apiClient'))
import { api, resetApiMock } from '@/test/mocks/apiClient'

describe('passport', () => {
  beforeEach(resetApiMock)

  // ============================================================
  // Pure functions (no API needed)
  // ============================================================

  describe('getAllCountries', () => {
    it('returns the countries data object', () => {
      const countries = getAllCountries()

      expect(countries).toBeDefined()
      expect(typeof countries).toBe('object')
      // Spot check some known countries
      expect(countries['US']).toBeDefined()
      expect(countries['US'].name).toBe('United States')
      expect(countries['JP']).toBeDefined()
      expect(countries['JP'].name).toBe('Japan')
    })

    it('contains country data for all supported territories', () => {
      const countries = getAllCountries()
      // The data file contains 246 countries/territories
      expect(Object.keys(countries).length).toBe(246)
    })
  })

  describe('getCountryByCode', () => {
    it('returns country data for valid code', () => {
      const usa = getCountryByCode('US')

      expect(usa).not.toBeNull()
      expect(usa?.name).toBe('United States')
      expect(usa?.continent).toBe('americas')
      expect(usa?.stampShape).toBe('rectangle')
    })

    it('returns null for invalid code', () => {
      const invalid = getCountryByCode('XX')
      expect(invalid).toBeNull()
    })

    it('returns correct stamp shapes by region', () => {
      // Asia should have circle stamps
      const japan = getCountryByCode('JP')
      expect(japan?.stampShape).toBe('circle')

      // Europe should have rectangle stamps
      const germany = getCountryByCode('DE')
      expect(germany?.stampShape).toBe('rectangle')
    })
  })

  // ============================================================
  // getUserCountries - merges visits, claims, and ground visits
  // ============================================================

  describe('getUserCountries', () => {
    it('returns empty array when user has no visits or claims', async () => {
      vi.mocked(api.get).mockResolvedValue({ visits: [], claims: [], groundVisits: [] })

      const result = await getUserCountries('user-123')

      expect(result).toEqual([])
      expect(api.get).toHaveBeenCalledWith('/api/passport/countries')
    })

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

    it('propagates errors from the API', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Database error'))

      await expect(getUserCountries('user-123')).rejects.toThrow('Database error')
    })
  })

  // ============================================================
  // claimCountry (PUT /claims/:cc)
  // ============================================================

  describe('claimCountry', () => {
    it('claims a country and refills user_id', async () => {
      vi.mocked(api.put).mockResolvedValue({
        id: 'claim-123',
        country_code: 'DE',
        claimed_at: '2024-01-15T10:00:00Z',
      })

      const result = await claimCountry('user-123', 'DE')

      expect(result).toEqual({
        id: 'claim-123',
        user_id: 'user-123',
        country_code: 'DE',
        claimed_at: '2024-01-15T10:00:00Z',
      })
      expect(api.put).toHaveBeenCalledWith('/api/passport/claims/DE')
    })

    it('propagates errors on failure', async () => {
      vi.mocked(api.put).mockRejectedValue(new Error('Connection failed'))

      await expect(claimCountry('user-123', 'DE')).rejects.toThrow('Connection failed')
    })
  })

  // ============================================================
  // addGroundVisit
  // ============================================================

  describe('addGroundVisit', () => {
    it('creates a ground visit with details', async () => {
      vi.mocked(api.post).mockResolvedValue({
        id: 'visit-123',
        countryCode: 'FR',
        visitYear: 2019,
        entryMethod: 'land',
        note: 'Road trip through Provence',
        createdAt: '2024-01-15T10:00:00Z',
      })

      const result = await addGroundVisit('user-123', 'FR', {
        visitYear: 2019,
        note: 'Road trip through Provence',
        entryMethod: 'land',
      })

      expect(result).toMatchObject({
        id: 'visit-123',
        countryCode: 'FR',
        visitYear: 2019,
        entryMethod: 'land',
        note: 'Road trip through Provence',
        createdAt: '2024-01-15T10:00:00Z',
      })
      expect(api.post).toHaveBeenCalledWith('/api/passport/ground-visits', {
        countryCode: 'FR',
        visitYear: 2019,
        note: 'Road trip through Provence',
        entryMethod: 'land',
      })
    })

    it('defaults optional fields to null', async () => {
      vi.mocked(api.post).mockResolvedValue({
        id: 'visit-456',
        countryCode: 'FR',
        visitYear: null,
        entryMethod: null,
        note: null,
        createdAt: '2024-01-15T10:00:00Z',
      })

      await addGroundVisit('user-123', 'FR')

      expect(api.post).toHaveBeenCalledWith('/api/passport/ground-visits', {
        countryCode: 'FR',
        visitYear: null,
        note: null,
        entryMethod: null,
      })
    })

    it('propagates errors on failure', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('Insert failed'))

      await expect(addGroundVisit('user-123', 'FR')).rejects.toThrow('Insert failed')
    })
  })

  // ============================================================
  // getGroundVisits
  // ============================================================

  describe('getGroundVisits', () => {
    it('returns ground visits mapped to the frontend shape', async () => {
      vi.mocked(api.get).mockResolvedValue([
        {
          id: 'gv-1',
          countryCode: 'DE',
          visitYear: 2022,
          entryMethod: 'land',
          note: 'Train from France',
          createdAt: '2024-01-15T10:00:00Z',
        },
      ])

      const result = await getGroundVisits('user-123', 'DE')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'gv-1',
        userId: 'user-123',
        countryCode: 'DE',
        visitYear: 2022,
        entryMethod: 'land',
        note: 'Train from France',
        createdAt: '2024-01-15T10:00:00Z',
      })
      expect(api.get).toHaveBeenCalledWith('/api/passport/ground-visits', { countryCode: 'DE' })
    })

    it('returns empty array when there are no ground visits', async () => {
      vi.mocked(api.get).mockResolvedValue([])

      const result = await getGroundVisits('user-123', 'DE')

      expect(result).toEqual([])
    })
  })

  // ============================================================
  // deleteGroundVisit
  // ============================================================

  describe('deleteGroundVisit', () => {
    it('deletes a ground visit by id', async () => {
      vi.mocked(api.delete).mockResolvedValue({ ok: true })

      await deleteGroundVisit('user-123', 'visit-123')

      expect(api.delete).toHaveBeenCalledWith('/api/passport/ground-visits/visit-123')
    })

    it('propagates errors when delete fails', async () => {
      vi.mocked(api.delete).mockRejectedValue(new Error('Delete failed'))

      await expect(deleteGroundVisit('user-123', 'visit-123')).rejects.toThrow('Delete failed')
    })
  })

  // ============================================================
  // unclaimCountry
  // ============================================================

  describe('unclaimCountry', () => {
    it('deletes the claim (server cascades ground visits)', async () => {
      vi.mocked(api.delete).mockResolvedValue({ ok: true })

      await unclaimCountry('user-123', 'DE')

      expect(api.delete).toHaveBeenCalledWith('/api/passport/claims/DE')
    })

    it('propagates errors when delete fails', async () => {
      vi.mocked(api.delete).mockRejectedValue(new Error('Delete failed'))

      await expect(unclaimCountry('user-123', 'DE')).rejects.toThrow('Delete failed')
    })
  })

  // ============================================================
  // isCountryClaimed
  // ============================================================

  describe('isCountryClaimed', () => {
    it('returns true when country is claimed', async () => {
      vi.mocked(api.get).mockResolvedValue({ exists: true })

      const result = await isCountryClaimed('user-123', 'JP')

      expect(result).toBe(true)
      expect(api.get).toHaveBeenCalledWith('/api/passport/claims/JP/exists')
    })

    it('returns false when country is not claimed', async () => {
      vi.mocked(api.get).mockResolvedValue({ exists: false })

      const result = await isCountryClaimed('user-123', 'JP')

      expect(result).toBe(false)
    })

    it('propagates errors when query fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Query failed'))

      await expect(isCountryClaimed('user-123', 'JP')).rejects.toThrow('Query failed')
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

    it('returns zero stats for new user', async () => {
      vi.mocked(api.get).mockResolvedValue({ visits: [], claims: [], groundVisits: [] })

      const stats = await getPassportStats('user-123')

      expect(stats.countriesCount).toBe(0)
      expect(stats.continentsCount).toBe(0)
      expect(stats.flightCountries).toBe(0)
      expect(stats.groundCountries).toBe(0)
      expect(stats.newThisYear).toBe(0)
      expect(stats.lastStamp).toBeNull()
    })
  })

  // ============================================================
  // getCountryStats
  // ============================================================

  describe('getCountryStats', () => {
    it('throws error for unknown country code', async () => {
      await expect(getCountryStats('user-123', 'XX')).rejects.toThrow('Unknown country code: XX')
    })

    it('returns stats from flight visits and fills countryName from countries.json', async () => {
      vi.mocked(api.get).mockResolvedValue({
        countryCode: 'JP',
        countryName: '',
        firstVisit: '2022-01-15',
        lastVisit: '2023-06-05',
        totalVisits: 5,
        airports: [
          { iata: 'NRT', name: 'NRT', city: 'Tokyo', visitCount: 3 },
          { iata: 'KIX', name: 'KIX', city: 'Osaka', visitCount: 2 },
        ],
        isClaimed: false,
        groundVisits: [],
      })

      const stats = await getCountryStats('user-123', 'JP')

      expect(stats.countryCode).toBe('JP')
      expect(stats.countryName).toBe('Japan')
      expect(stats.totalVisits).toBe(5)
      expect(stats.firstVisit).toBe('2022-01-15')
      expect(stats.lastVisit).toBe('2023-06-05')
      expect(stats.airports).toHaveLength(2)
      expect(stats.airports[0]).toMatchObject({ iata: 'NRT', city: 'Tokyo', visitCount: 3 })
      expect(stats.isClaimed).toBe(false)
      expect(stats.groundVisits).toEqual([])
      expect(api.get).toHaveBeenCalledWith('/api/passport/countries/JP/stats')
    })

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

  // ============================================================
  // getUserClaims
  // ============================================================

  describe('getUserClaims', () => {
    it('returns all claims for a user with user_id refilled', async () => {
      vi.mocked(api.get).mockResolvedValue([
        { id: 'claim-2', country_code: 'FR', claimed_at: '2024-01-15' },
        { id: 'claim-1', country_code: 'DE', claimed_at: '2023-06-01' },
      ])

      const result = await getUserClaims('user-123')

      expect(result).toEqual([
        { id: 'claim-2', user_id: 'user-123', country_code: 'FR', claimed_at: '2024-01-15' },
        { id: 'claim-1', user_id: 'user-123', country_code: 'DE', claimed_at: '2023-06-01' },
      ])
      expect(api.get).toHaveBeenCalledWith('/api/passport/claims')
    })

    it('returns empty array when user has no claims', async () => {
      vi.mocked(api.get).mockResolvedValue([])

      const result = await getUserClaims('user-123')

      expect(result).toEqual([])
    })

    it('propagates errors when query fails', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('Query failed'))

      await expect(getUserClaims('user-123')).rejects.toThrow('Query failed')
    })
  })
})
