import { describe, it, expect } from 'vitest'
import { calculateFlightDuration } from './geo'

describe('calculateFlightDuration', () => {
  describe('timezone-aware calculation', () => {
    it('calculates JFK→LHR correctly (westbound to eastbound, +5h offset)', () => {
      // Depart JFK 18:00 EST (23:00 UTC), Arrive LHR 06:00 GMT next day (06:00 UTC)
      // Actual duration: 7 hours
      const result = calculateFlightDuration('18:00', '06:00', '2025-06-15', 'America/New_York', 'Europe/London')
      expect(result).toBe(7 * 60) // 420 minutes
    })

    it('calculates LHR→JFK correctly (eastbound to westbound)', () => {
      // Depart LHR 10:00 GMT (10:00 UTC), Arrive JFK 13:00 EST (18:00 UTC)
      // Actual duration: 8 hours
      const result = calculateFlightDuration('10:00', '13:00', '2025-06-15', 'Europe/London', 'America/New_York')
      expect(result).toBe(8 * 60) // 480 minutes
    })

    it('calculates same-timezone flight correctly', () => {
      // Depart LAX 08:00, Arrive SFO 09:30 (both Pacific)
      const result = calculateFlightDuration('08:00', '09:30', '2025-06-15', 'America/Los_Angeles', 'America/Los_Angeles')
      expect(result).toBe(90)
    })

    it('handles cross-day flight (depart 23:25, arrive 01:50)', () => {
      // Depart SVO 23:25 Moscow (20:25 UTC), Arrive LED 01:50 Moscow next day (22:50 UTC)
      // Duration: 2h 25m = 145 minutes
      const result = calculateFlightDuration('23:25', '01:50', '2025-06-15', 'Europe/Moscow', 'Europe/Moscow')
      expect(result).toBe(145)
    })

    it('handles cross-day flight across timezones', () => {
      // Depart NRT 22:00 JST (13:00 UTC), Arrive LAX 16:00 PDT (23:00 UTC)
      // Duration: 10 hours
      const result = calculateFlightDuration('22:00', '16:00', '2025-06-15', 'Asia/Tokyo', 'America/Los_Angeles')
      expect(result).toBe(10 * 60)
    })

    it('handles eastbound flight that appears to go backwards in time', () => {
      // Depart LAX 10:00 PDT (17:00 UTC), Arrive NRT 14:00 JST next day (05:00 UTC next day)
      // Duration: 12 hours
      const result = calculateFlightDuration('10:00', '14:00', '2025-06-15', 'America/Los_Angeles', 'Asia/Tokyo')
      expect(result).toBe(12 * 60)
    })

    it('handles DST boundary correctly', () => {
      // March 9, 2025: US springs forward. Depart JFK 01:00 EST, Arrive ORD 02:00 CST
      // EST = UTC-5, CST = UTC-6
      // 01:00 EST = 06:00 UTC, 02:00 CST = 08:00 UTC → 2 hours
      const result = calculateFlightDuration('01:00', '02:00', '2025-03-09', 'America/New_York', 'America/Chicago')
      expect(result).toBe(120)
    })
  })

  describe('fallback (no timezone info)', () => {
    it('calculates simple same-day flight without timezones', () => {
      const result = calculateFlightDuration('08:00', '10:30')
      expect(result).toBe(150)
    })

    it('handles overnight flight without timezones', () => {
      const result = calculateFlightDuration('23:00', '02:00')
      expect(result).toBe(180)
    })
  })

  describe('edge cases', () => {
    it('returns null for invalid time format', () => {
      const result = calculateFlightDuration('invalid', '10:00')
      expect(result).toBeNull()
    })

    it('returns null for empty strings', () => {
      const result = calculateFlightDuration('', '')
      expect(result).toBeNull()
    })
  })
})
