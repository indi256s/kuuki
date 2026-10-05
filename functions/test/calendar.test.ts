import { describe, expect, it } from 'vitest'
import { addDays, canonicalTimeZone, localToday, startOfLocalDay } from '../../packages/shared/src/calendar'

describe('calendar labels', () => {
  it('adds calendar days as label arithmetic across months, leap days and years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-10-28', 8)).toBe('2026-11-05')
  })

  it('reads today in the captured zone, including ±14h extremes', () => {
    const now = new Date('2026-10-04T10:30:00.000Z')
    expect(localToday('UTC', now)).toBe('2026-10-04')
    expect(localToday('Pacific/Kiritimati', now)).toBe('2026-10-05') // +14
    expect(localToday('Etc/GMT+12', now)).toBe('2026-10-03') // -12
    expect(localToday('Asia/Tbilisi', new Date('2026-10-04T20:00:00.000Z'))).toBe('2026-10-05')
    expect(localToday('Asia/Tbilisi', new Date('2026-10-04T19:59:59.999Z'))).toBe('2026-10-04')
    expect(localToday('America/New_York', new Date('2026-10-05T03:59:59.999Z'))).toBe('2026-10-04')
  })

  it('returns local midnight as a canonical UTC instant for positive and negative offsets', () => {
    expect(startOfLocalDay('2026-10-05', 'UTC')).toBe('2026-10-05T00:00:00.000Z')
    expect(startOfLocalDay('2026-10-05', 'Asia/Tbilisi')).toBe('2026-10-04T20:00:00.000Z')
    expect(startOfLocalDay('2026-10-05', 'Pacific/Kiritimati')).toBe('2026-10-04T10:00:00.000Z')
    expect(startOfLocalDay('2026-10-05', 'Etc/GMT+12')).toBe('2026-10-05T12:00:00.000Z')
    expect(startOfLocalDay('2026-10-05', 'America/New_York')).toBe('2026-10-05T04:00:00.000Z')
    expect(startOfLocalDay('2026-12-05', 'America/New_York')).toBe('2026-12-05T05:00:00.000Z')
    expect(startOfLocalDay('2026-10-05', 'Asia/Kolkata')).toBe('2026-10-04T18:30:00.000Z')
  })

  it('uses the first existing instant when midnight falls in a DST gap', () => {
    // Santiago and Havana spring forward at local midnight, so 00:00 never exists that day.
    expect(startOfLocalDay('2026-09-06', 'America/Santiago')).toBe('2026-09-06T04:00:00.000Z')
    expect(startOfLocalDay('2026-03-08', 'America/Havana')).toBe('2026-03-08T05:00:00.000Z')
    // The day before and after keep their ordinary offsets.
    expect(startOfLocalDay('2026-09-05', 'America/Santiago')).toBe('2026-09-05T04:00:00.000Z')
    expect(startOfLocalDay('2026-09-07', 'America/Santiago')).toBe('2026-09-07T03:00:00.000Z')
  })

  it('uses the earlier instant when midnight repeats and keeps a single midnight after a fall-back', () => {
    // Havana falls back 01:00 -> 00:00 on 2026-11-01, so local midnight occurs twice.
    expect(startOfLocalDay('2026-11-01', 'America/Havana')).toBe('2026-11-01T04:00:00.000Z')
    // Santiago falls back 00:00 -> 23:00 on 2026-04-05; that day's midnight exists only at -04.
    expect(startOfLocalDay('2026-04-05', 'America/Santiago')).toBe('2026-04-05T04:00:00.000Z')
  })

  it('canonicalizes valid IANA zones and rejects invalid ones', () => {
    expect(canonicalTimeZone('UTC')).toBe('UTC')
    expect(canonicalTimeZone('asia/tbilisi')).toBe('Asia/Tbilisi')
    expect(canonicalTimeZone('Europe/Moscow')).toBe('Europe/Moscow')
    expect(canonicalTimeZone('Mars/Olympus')).toBeNull()
    expect(canonicalTimeZone('')).toBeNull()
    expect(canonicalTimeZone('x'.repeat(65))).toBeNull()
    expect(canonicalTimeZone(42)).toBeNull()
    expect(canonicalTimeZone(null)).toBeNull()
  })
})
