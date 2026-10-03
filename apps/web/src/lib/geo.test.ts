import { describe, it, expect } from 'vitest'
import { calculateFlightDuration } from './geo'

describe('calculateFlightDuration', () => {
  it.each([
    // Depart JFK 18:00 EST (23:00 UTC), Arrive LHR 06:00 GMT next day (06:00 UTC)
    ['JFK→LHR (+5h offset)', '18:00', '06:00', '2025-06-15', 'America/New_York', 'Europe/London', 7 * 60],
    // Depart LHR 10:00 GMT (10:00 UTC), Arrive JFK 13:00 EST (18:00 UTC)
    ['LHR→JFK (eastbound to westbound)', '10:00', '13:00', '2025-06-15', 'Europe/London', 'America/New_York', 8 * 60],
    // Depart LAX 08:00, Arrive SFO 09:30 (both Pacific)
    ['same-timezone flight', '08:00', '09:30', '2025-06-15', 'America/Los_Angeles', 'America/Los_Angeles', 90],
    // Depart SVO 23:25 Moscow (20:25 UTC), Arrive LED 01:50 Moscow next day (22:50 UTC)
    ['cross-day flight (depart 23:25, arrive 01:50)', '23:25', '01:50', '2025-06-15', 'Europe/Moscow', 'Europe/Moscow', 145],
    // Depart NRT 22:00 JST (13:00 UTC), Arrive LAX 16:00 PDT (23:00 UTC)
    ['cross-day flight across timezones', '22:00', '16:00', '2025-06-15', 'Asia/Tokyo', 'America/Los_Angeles', 10 * 60],
    // Depart LAX 10:00 PDT (17:00 UTC), Arrive NRT 14:00 JST next day (05:00 UTC next day)
    ['eastbound flight that appears to go backwards in time', '10:00', '14:00', '2025-06-15', 'America/Los_Angeles', 'Asia/Tokyo', 12 * 60],
    // March 9, 2025: US springs forward. 01:00 EST = 06:00 UTC, 02:00 CST = 08:00 UTC
    ['DST boundary', '01:00', '02:00', '2025-03-09', 'America/New_York', 'America/Chicago', 120],
  ])('timezone-aware: %s', (_name, depart, arrive, date, depTz, arrTz, expected) => {
    expect(calculateFlightDuration(depart, arrive, date, depTz, arrTz)).toBe(expected)
  })

  it.each([
    ['same-day flight without timezones', '08:00', '10:30', 150],
    ['overnight flight without timezones', '23:00', '02:00', 180],
    ['invalid time format', 'invalid', '10:00', null],
    ['empty strings', '', '', null],
  ])('without timezone info: %s', (_name, depart, arrive, expected) => {
    expect(calculateFlightDuration(depart, arrive)).toBe(expected)
  })
})
