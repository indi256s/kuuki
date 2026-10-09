import { describe, expect, it } from 'vitest'
import { defaultSort, emptyFilters, type JournalViewState } from './model'
import { journalSearch, parseJournalUrl } from './url'

const now = new Date('2026-10-09T00:00:00Z')
const parse = (search: string, hash?: string) => parseJournalUrl(search, hash, now)
const view = (
  patch: Partial<Omit<JournalViewState, 'filters'>> & {
    filters?: Partial<JournalViewState['filters']>
  } = {},
): JournalViewState => ({
  sort: defaultSort,
  flight: null,
  review: false,
  ...patch,
  filters: { ...emptyFilters(), ...patch.filters },
})

describe('parseJournalUrl', () => {
  it('reads the default state from an empty query and writes it back as a bare /journal', () => {
    expect(parse('')).toEqual(view())
    expect(journalSearch(view())).toBe('')
  })

  it('maps legacy aliases through normalizeJournalQuery', () => {
    expect(
      parse(
        'search=tbilisi&airlineIata=tk&aircraftIcao=a359&year=2024&origin=tbs&destination=ist&sortField=duration_minutes&sortOrder=asc',
      ),
    ).toEqual(
      view({
        filters: {
          q: 'tbilisi',
          airlines: ['TK'],
          aircraft: ['A359'],
          years: [2024],
          airports: ['IST', 'TBS'],
        },
        sort: { key: 'duration', order: 'asc' },
      }),
    )
    expect(parse('period=2023').filters.years).toEqual([2023])
    expect(parse('isUpcoming=true').filters.status).toEqual(['upcoming'])
    expect(parse('isUpcoming=false').filters.status).toEqual([]) // legacy `completed`: the default contents
    expect(parse('status=completed').filters.status).toEqual([])
    expect(parse('sort=distance_km').sort).toEqual({ key: 'distance', order: 'desc' })
    for (const legacySort of ['origin', 'airline_iata', 'aircraft_icao', 'nonsense'])
      expect(parse(`sort=${legacySort}`).sort).toEqual(defaultSort)
  })

  it('reads current CSV facets, validates codes and drops invalid values', () => {
    expect(
      parse(
        'years=2024,1800,2019,2024&airport=ist,TBS,XX&country=ge,TUR,1&airline=TK,toolong&aircraft=B738,A35K&family=A320,A320&status=awaiting,flown,upcoming&missing=times,nope&alliance=star,none',
      ).filters,
    ).toEqual({
      ...emptyFilters(),
      years: [2019, 2024],
      airports: ['IST', 'TBS'],
      countries: ['GE'],
      airlines: ['TK'],
      aircraft: ['A35K', 'B738'],
      families: ['A320'],
      status: ['awaiting', 'upcoming'],
      missing: ['times'],
      alliances: ['star'],
    })
  })

  it('keeps a day range only when both ends are valid', () => {
    expect(parse('from=2024-02-29&to=2024-03-01').filters).toMatchObject({
      from: '2024-02-29',
      to: '2024-03-01',
    })
    for (const range of [
      'from=2024-02-29',
      'from=2025-02-29&to=2025-03-01',
      'from=2024-03-01&to=2024-02-29',
    ])
      expect(parse(range).filters).toMatchObject({ from: '', to: '' })
  })

  it('opens review mode for badge links and Passport arrival hashes', () => {
    expect(parse('queue=awaiting')).toMatchObject({ review: true, flight: null })
    expect(parse('review=1&flight=12')).toMatchObject({ review: true, flight: 12 })
    expect(parse('', '#arrival-42')).toMatchObject({ review: true, flight: 42 })
    expect(parse('flight=7', '#arrival-42')).toMatchObject({ review: true, flight: 7 })
    expect(parse('', '#arrival-x')).toMatchObject({ review: false, flight: null })
    expect(parse('flight=0').flight).toBeNull()
    expect(parse('flight=99999999999999999999').flight).toBeNull()
  })

  it('drops paging, batches and unknown keys', () => {
    expect(parse('page=3&batch=4a1f8f8e-1c43-4a35-9b9b-1d2c3e4f5a6b&limit=5&junk=1')).toEqual(
      view(),
    )
    expect(journalSearch(parse('page=3&airport=TBS&batch=nope'))).toBe('airport=TBS')
  })
})

describe('journalSearch', () => {
  it('omits defaults and writes a stable order with sorted, de-duplicated lists', () => {
    expect(journalSearch(view({ sort: { key: 'date', order: 'asc' } }))).toBe('order=asc')
    expect(
      journalSearch(
        view({
          filters: { airports: ['TBS', 'IST', 'TBS'], years: [2024, 2019], q: '  tk 381 ' },
          flight: 5,
        }),
      ),
    ).toBe('q=tk+381&years=2019,2024&airport=IST,TBS&flight=5')
  })

  it('round-trips every facet', () => {
    const states = [
      view(),
      view({
        filters: {
          q: 'Tbilisi, Istanbul & more',
          years: [2019, 2024],
          airports: ['IST', 'TBS'],
          countries: ['GE'],
          airlines: ['TK'],
          aircraft: ['A359', 'B738'],
          families: ['A320', 'Boeing 737'],
          status: ['awaiting', 'upcoming'],
          missing: ['aircraft', 'times'],
          alliances: ['oneworld', 'star'],
        },
        sort: { key: 'distance', order: 'asc' },
        flight: 12,
        review: true,
      }),
      view({
        filters: { from: '2024-02-29', to: '2024-03-01' },
        sort: { key: 'duration', order: 'desc' },
      }),
    ]
    for (const state of states) expect(parse(journalSearch(state))).toEqual(state)
  })

  it('is a fixed point for legacy input', () => {
    const once = journalSearch(
      parse('search=tbs&year=2024&page=2&queue=awaiting&sortField=distance_km'),
    )
    expect(once).toBe('q=tbs&years=2024&sort=distance&review=1')
    expect(journalSearch(parse(once))).toBe(once)
  })
})
