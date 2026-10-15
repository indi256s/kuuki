import { describe, expect, it } from 'vitest'
import { mrzLines } from './mrz'
import { REMARKS_CORPUS, REMARKS_MAX, remarksLine, remarksTrigger } from './remarks'
import { profileViewState } from './view'

describe('profileViewState', () => {
  it('splits the five pages by visibility and viewer', () => {
    const open = { id: 'p', is_public: true }
    const hidden = { id: 'p', is_public: false }
    expect(profileViewState(null, 'v')).toEqual({ kind: 'not-found' })
    expect(profileViewState(open, null)).toEqual({ kind: 'public' })
    expect(profileViewState(open, 'p')).toEqual({ kind: 'owner', visibility: 'public' })
    expect(profileViewState(hidden, 'p')).toEqual({ kind: 'owner', visibility: 'private' })
    expect(profileViewState(hidden, null)).toEqual({ kind: 'closed', viewer: 'guest' })
    expect(profileViewState(hidden, 'v')).toEqual({ kind: 'closed', viewer: 'member' })
  })
})

describe('mrzLines', () => {
  it('matches the holder page board and keeps both lines at 30 characters', () => {
    expect(
      mrzLines({
        name: 'Mira Sato',
        handle: 'mirasato',
        flights: 142,
        countries: 31,
        issued: '2024-03-09',
      }),
    ).toEqual(['P<KUU<SATO<<MIRA<<<<<<<<<<<<<<', 'MIRASATO<<0142FL<31CC<<<<<2403'])
  })
  it('transliterates Cyrillic by ICAO 9303 and fits long names and handles', () => {
    const [first, second] = mrzLines({
      name: 'Александра Константинопольская',
      handle: 'sasha_k',
      flights: 3,
      countries: 1,
      issued: '2026-03-01',
    })
    expect(first).toBe('P<KUU<KONSTANTINOPOLSKAIA<<ALE')
    expect(second).toBe('SASHAK<<0003FL<01CC<<<<<<<2603')
    const long = mrzLines({
      name: 'X',
      handle: 'a'.repeat(30),
      flights: 123456,
      countries: 246,
      issued: null,
    })
    expect(long.map((line) => line.length)).toEqual([30, 30])
    expect(long[1].endsWith('<<9999FL<246CC<<<<<')).toBe(true)
  })
})

describe('remarks', () => {
  const stats = {
    total_flights: 142,
    total_duration_minutes: 618 * 60,
    countries_count: 31,
    airlines_count: 20,
    has_night_departure: true,
  }
  it('picks by priority and stays stable per owner', () => {
    expect(remarksTrigger({ ...stats, total_flights: 0 }).id).toBe('zero')
    expect(remarksTrigger({ ...stats, total_flights: 3 }).id).toBe('few')
    expect(remarksTrigger(stats)).toEqual({ id: 'airborne', params: { days: 25 } })
    expect(remarksTrigger({ ...stats, total_duration_minutes: 0 }).id).toBe('countries')
    expect(remarksLine('owner', stats, 'en')).toBe(remarksLine('owner', stats, 'en'))
  })
  it('fits two lines on the holder page with the widest numbers in both languages', () => {
    const wide = { flights: '12 345', days: '1 234', countries: '246', airlines: '1 234' }
    for (const triple of Object.values(REMARKS_CORPUS))
      for (const line of triple)
        for (const text of [line.en, line.ru]) {
          const filled = text.replace(/\{(\w+)\}/g, (_, key: keyof typeof wide) => wide[key])
          expect(filled.length, filled).toBeLessThanOrEqual(REMARKS_MAX)
          expect(text, 'numbers come only from params').not.toMatch(/\d/)
        }
  })
})
