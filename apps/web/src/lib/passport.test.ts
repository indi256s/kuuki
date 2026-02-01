import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getUserCountries,
  getUserClaims,
  claimCountry,
  updateClaim,
  unclaimCountry,
  getCountryStats,
  getPassportStats,
  isCountryClaimed,
  getAllCountries,
  getCountryByCode,
} from './passport'

// Mock the supabase module
const mockFrom = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// Helper to create chainable mock
function createChainMock(result: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    order: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    // For terminal operations that return promise directly
    then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
  }
  return chain
}

describe('passport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // Pure functions (no mocking needed)
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
  // getUserCountries - combines visits and claims
  // ============================================================

  describe('getUserCountries', () => {
    it('returns empty array when user has no visits or claims', async () => {
      const visitsChain = createChainMock({ data: [], error: null })
      const claimsChain = createChainMock({ data: [], error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const result = await getUserCountries('user-123')

      expect(result).toEqual([])
      expect(mockFrom).toHaveBeenCalledWith('visits')
      expect(mockFrom).toHaveBeenCalledWith('country_claims')
    })

    it('returns passport entries from flight visits', async () => {
      const visitsChain = createChainMock({
        data: [
          {
            country_code: 'JP',
            first_visit: '2023-01-15',
            last_visit: '2023-01-20',
            visit_count: 2,
            airport_iata: 'NRT',
          },
        ],
        error: null,
      })
      const claimsChain = createChainMock({ data: [], error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
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
      const visitsChain = createChainMock({ data: [], error: null })
      const claimsChain = createChainMock({
        data: [
          {
            country_code: 'DE',
            claimed_at: '2022-06-01',
          },
        ],
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
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
      const visitsChain = createChainMock({
        data: [
          {
            country_code: 'JP',
            first_visit: '2023-01-15',
            last_visit: '2023-01-20',
            visit_count: 2,
            airport_iata: 'NRT',
          },
        ],
        error: null,
      })
      const claimsChain = createChainMock({
        data: [
          {
            country_code: 'JP',
            claimed_at: '2022-05-01', // Earlier than flight
          },
        ],
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const result = await getUserCountries('user-123')

      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('both')
      // Should use the earlier date from claim
      expect(result[0].firstVisit).toBe('2022-05-01')
    })

    it('sorts entries by first visit date (oldest first)', async () => {
      const visitsChain = createChainMock({
        data: [
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
        error: null,
      })
      const claimsChain = createChainMock({ data: [], error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const result = await getUserCountries('user-123')

      expect(result).toHaveLength(2)
      expect(result[0].countryCode).toBe('JP') // 2022
      expect(result[1].countryCode).toBe('US') // 2023
    })

    it('throws error when visits query fails', async () => {
      const visitsChain = createChainMock({ data: null, error: { message: 'Database error' } })
      const claimsChain = createChainMock({ data: [], error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      await expect(getUserCountries('user-123')).rejects.toThrow('Failed to fetch visits: Database error')
    })

    it('throws error when claims query fails', async () => {
      const visitsChain = createChainMock({ data: [], error: null })
      const claimsChain = createChainMock({ data: null, error: { message: 'Claims error' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      await expect(getUserCountries('user-123')).rejects.toThrow('Failed to fetch claims: Claims error')
    })
  })

  // ============================================================
  // claimCountry
  // ============================================================

  describe('claimCountry', () => {
    it('creates a country claim with minimal data', async () => {
      const mockClaim = {
        id: 'claim-123',
        user_id: 'user-123',
        country_code: 'DE',
        claimed_at: '2024-01-15T10:00:00Z',
        visit_year: null,
        note: null,
        entry_method: null,
      }

      const chain = createChainMock({ data: mockClaim, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await claimCountry('user-123', 'DE')

      expect(result).toEqual(mockClaim)
      expect(mockFrom).toHaveBeenCalledWith('country_claims')
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        country_code: 'DE',
        visit_year: null,
        note: null,
        entry_method: null,
      })
    })

    it('creates a country claim with optional data', async () => {
      const mockClaim = {
        id: 'claim-123',
        user_id: 'user-123',
        country_code: 'FR',
        claimed_at: '2024-01-15T10:00:00Z',
        visit_year: 2019,
        note: 'Road trip through Provence',
        entry_method: 'land',
      }

      const chain = createChainMock({ data: mockClaim, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await claimCountry('user-123', 'FR', {
        visitYear: 2019,
        note: 'Road trip through Provence',
        entryMethod: 'land',
      })

      expect(result).toEqual(mockClaim)
      expect(chain.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        country_code: 'FR',
        visit_year: 2019,
        note: 'Road trip through Provence',
        entry_method: 'land',
      })
    })

    it('throws specific error for duplicate claim', async () => {
      const chain = createChainMock({
        data: null,
        error: { message: 'duplicate key', code: '23505' }
      })
      mockFrom.mockReturnValue(chain)

      await expect(claimCountry('user-123', 'DE')).rejects.toThrow('You have already claimed this country')
    })

    it('throws generic error for other failures', async () => {
      const chain = createChainMock({
        data: null,
        error: { message: 'Connection failed' }
      })
      mockFrom.mockReturnValue(chain)

      await expect(claimCountry('user-123', 'DE')).rejects.toThrow('Failed to claim country: Connection failed')
    })
  })

  // ============================================================
  // unclaimCountry
  // ============================================================

  describe('unclaimCountry', () => {
    it('deletes a country claim', async () => {
      const chain = createChainMock({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      await unclaimCountry('user-123', 'DE')

      expect(mockFrom).toHaveBeenCalledWith('country_claims')
      expect(chain.delete).toHaveBeenCalled()
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(chain.eq).toHaveBeenCalledWith('country_code', 'DE')
    })

    it('throws error when delete fails', async () => {
      const chain = createChainMock({
        data: null,
        error: { message: 'Delete failed' }
      })
      mockFrom.mockReturnValue(chain)

      await expect(unclaimCountry('user-123', 'DE')).rejects.toThrow('Failed to unclaim country: Delete failed')
    })
  })

  // ============================================================
  // isCountryClaimed
  // ============================================================

  describe('isCountryClaimed', () => {
    it('returns true when country is claimed', async () => {
      const chain = createChainMock({ data: { id: 'claim-123' }, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await isCountryClaimed('user-123', 'JP')

      expect(result).toBe(true)
      expect(mockFrom).toHaveBeenCalledWith('country_claims')
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(chain.eq).toHaveBeenCalledWith('country_code', 'JP')
    })

    it('returns false when country is not claimed', async () => {
      const chain = createChainMock({ data: null, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await isCountryClaimed('user-123', 'JP')

      expect(result).toBe(false)
    })

    it('throws error when query fails', async () => {
      const chain = createChainMock({
        data: null,
        error: { message: 'Query failed' }
      })
      mockFrom.mockReturnValue(chain)

      await expect(isCountryClaimed('user-123', 'JP')).rejects.toThrow('Failed to check claim: Query failed')
    })
  })

  // ============================================================
  // getPassportStats
  // ============================================================

  describe('getPassportStats', () => {
    it('calculates stats from passport entries', async () => {
      const visitsChain = createChainMock({
        data: [
          { country_code: 'JP', first_visit: '2022-01-15', last_visit: '2022-01-20', visit_count: 2, airport_iata: 'NRT' },
          { country_code: 'US', first_visit: '2023-06-01', last_visit: '2023-06-05', visit_count: 1, airport_iata: 'JFK' },
          { country_code: 'DE', first_visit: '2023-08-01', last_visit: '2023-08-10', visit_count: 1, airport_iata: 'FRA' },
        ],
        error: null,
      })
      const claimsChain = createChainMock({ data: [], error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const stats = await getPassportStats('user-123')

      expect(stats.countriesCount).toBe(3)
      expect(stats.continentsCount).toBe(3) // asia, americas, europe
      expect(stats.worldCompletion).toBeCloseTo(1.2, 1) // 3/249 * 100
    })

    it('returns zero stats for new user', async () => {
      const visitsChain = createChainMock({ data: [], error: null })
      const claimsChain = createChainMock({ data: [], error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const stats = await getPassportStats('user-123')

      expect(stats.countriesCount).toBe(0)
      expect(stats.continentsCount).toBe(0)
      expect(stats.worldCompletion).toBe(0)
    })
  })

  // ============================================================
  // getCountryStats
  // ============================================================

  describe('getCountryStats', () => {
    it('throws error for unknown country code', async () => {
      await expect(getCountryStats('user-123', 'XX')).rejects.toThrow('Unknown country code: XX')
    })

    it('returns stats from flight visits', async () => {
      const visitsChain = createChainMock({
        data: [
          {
            first_visit: '2022-01-15',
            last_visit: '2022-01-20',
            visit_count: 3,
            airport_iata: 'NRT',
            city: 'Tokyo',
          },
          {
            first_visit: '2023-06-01',
            last_visit: '2023-06-05',
            visit_count: 2,
            airport_iata: 'KIX',
            city: 'Osaka',
          },
        ],
        error: null,
      })
      const claimsChain = createChainMock({ data: null, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const stats = await getCountryStats('user-123', 'JP')

      expect(stats.countryCode).toBe('JP')
      expect(stats.countryName).toBe('Japan')
      expect(stats.totalVisits).toBe(5)
      expect(stats.firstVisit).toBe('2022-01-15')
      expect(stats.lastVisit).toBe('2023-06-05')
      expect(stats.airports).toHaveLength(2)
      expect(stats.airports[0]).toMatchObject({ iata: 'NRT', city: 'Tokyo', visitCount: 3 })
      expect(stats.note).toBeNull()
      expect(stats.entryMethod).toBeNull()
    })

    it('returns stats with claim note and entry method', async () => {
      const visitsChain = createChainMock({ data: [], error: null })
      const claimsChain = createChainMock({
        data: { note: 'Visited by train from France', entry_method: 'land' },
        error: null,
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'visits') return visitsChain
        if (table === 'country_claims') return claimsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const stats = await getCountryStats('user-123', 'DE')

      expect(stats.countryCode).toBe('DE')
      expect(stats.totalVisits).toBe(1)
      expect(stats.note).toBe('Visited by train from France')
      expect(stats.entryMethod).toBe('land')
    })
  })

  // ============================================================
  // getUserClaims
  // ============================================================

  describe('getUserClaims', () => {
    it('returns all claims for a user ordered by date', async () => {
      const mockClaims = [
        { id: 'claim-2', user_id: 'user-123', country_code: 'FR', claimed_at: '2024-01-15', visit_year: 2023, note: null, entry_method: null },
        { id: 'claim-1', user_id: 'user-123', country_code: 'DE', claimed_at: '2023-06-01', visit_year: 2022, note: 'Berlin trip', entry_method: 'land' },
      ]

      const chain = createChainMock({ data: mockClaims, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await getUserClaims('user-123')

      expect(result).toEqual(mockClaims)
      expect(mockFrom).toHaveBeenCalledWith('country_claims')
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(chain.order).toHaveBeenCalledWith('claimed_at', { ascending: false })
    })

    it('returns empty array when user has no claims', async () => {
      const chain = createChainMock({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const result = await getUserClaims('user-123')

      expect(result).toEqual([])
    })

    it('throws error when query fails', async () => {
      const chain = createChainMock({ data: null, error: { message: 'Query failed' } })
      mockFrom.mockReturnValue(chain)

      await expect(getUserClaims('user-123')).rejects.toThrow('Failed to fetch claims: Query failed')
    })
  })

  // ============================================================
  // updateClaim
  // ============================================================

  describe('updateClaim', () => {
    it('updates a claim with new data', async () => {
      const updatedClaim = {
        id: 'claim-123',
        user_id: 'user-123',
        country_code: 'DE',
        claimed_at: '2023-06-01',
        visit_year: 2020,
        note: 'Updated note',
        entry_method: 'sea',
      }

      const chain = createChainMock({ data: updatedClaim, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await updateClaim('claim-123', {
        visitYear: 2020,
        note: 'Updated note',
        entryMethod: 'sea',
      })

      expect(result).toEqual(updatedClaim)
      expect(mockFrom).toHaveBeenCalledWith('country_claims')
      expect(chain.update).toHaveBeenCalledWith({
        visit_year: 2020,
        note: 'Updated note',
        entry_method: 'sea',
      })
      expect(chain.eq).toHaveBeenCalledWith('id', 'claim-123')
    })

    it('throws error when update fails', async () => {
      const chain = createChainMock({ data: null, error: { message: 'Update failed' } })
      mockFrom.mockReturnValue(chain)

      await expect(updateClaim('claim-123', { note: 'test' })).rejects.toThrow('Failed to update claim: Update failed')
    })
  })
})
