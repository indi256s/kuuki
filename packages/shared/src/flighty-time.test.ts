import { describe, expect, it } from 'vitest'
import { minutesBetween, parseLocalTimestamp, resolveLocalTimestamp } from './flighty-time'

const resolve = (value: string, zone: string | null) =>
  resolveLocalTimestamp(parseLocalTimestamp(value)!, zone)

describe('airport-local timestamps', () => {
  it('crosses the date line backwards: HND 00:30 → HNL 12:30 the previous day is 420 minutes', () => {
    const departure = resolve('2026-03-11T00:30', 'Asia/Tokyo')
    const arrival = resolve('2026-03-10T12:30', 'Pacific/Honolulu')
    expect(departure).toEqual({ kind: 'unique', utc: '2026-03-10T15:30:00.000Z', offset: 540 })
    expect(arrival).toEqual({ kind: 'unique', utc: '2026-03-10T22:30:00.000Z', offset: -600 })
    expect(minutesBetween('2026-03-10T15:30:00.000Z', '2026-03-10T22:30:00.000Z')).toBe(420)
  })

  it('reports both instants of a DST fold, earlier first, instead of picking one', () => {
    expect(resolve('2026-11-01T01:30', 'America/New_York')).toEqual({
      kind: 'ambiguous',
      options: [
        { utc: '2026-11-01T05:30:00.000Z', offset: -240 },
        { utc: '2026-11-01T06:30:00.000Z', offset: -300 },
      ],
    })
  })

  it('reports a wall-clock time inside a DST gap as nonexistent', () => {
    expect(resolve('2026-03-29T02:30', 'Europe/Berlin')).toEqual({ kind: 'nonexistent' })
  })

  it('checks a written offset against the zone instead of trusting it', () => {
    expect(resolve('2026-03-11T00:30+09:00', 'Asia/Tokyo')).toMatchObject({
      kind: 'unique',
      utc: '2026-03-10T15:30:00.000Z',
    })
    expect(resolve('2026-03-11T00:30Z', 'Asia/Tokyo')).toMatchObject({
      kind: 'offset_mismatch',
      zoneOffset: 540,
    })
  })

  it('does not invent UTC for an unknown zone and rejects shapes outside the accepted forms', () => {
    expect(resolve('2026-03-11T00:30', null)).toEqual({ kind: 'unresolved' })
    expect(resolve('2026-03-11T00:30', 'Mars/Olympus')).toEqual({ kind: 'unresolved' })
    for (const value of [
      '2026-02-30T10:00',
      '03/11/2026 10:00',
      '2026-03-11 10:00',
      '2026-03-11T24:00',
    ])
      expect(parseLocalTimestamp(value)).toBeNull()
  })
})
