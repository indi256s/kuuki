import { validateFlightInput } from '@kuuki/shared'
import { describe, expect, it } from 'vitest'
import { draft } from './fixtures'
import { changedFields, emptyValues, isChosen, lowFields, partition, readiness, rowConfidence, toValues, validateValues, withUnsent } from './review-model'

const values = (over: Partial<ReturnType<typeof emptyValues>> = {}) => ({ ...emptyValues(), date: '2026-03-01', origin: 'JFK', destination: 'BOS', ...over })

describe('validateValues', () => {
  it('accepts a complete row and an optional-only gap', () => {
    expect(validateValues(values({ airline_iata: 'aa', flight_number: 'AA 10', departure_time: '09:30' }))).toEqual({})
  })
  it('names each failing field with a code the copy maps', () => {
    expect(validateValues(values({ date: '' })).date).toBe('dateRequired')
    expect(validateValues(values({ date: '2026-02-30' })).date).toBe('dateInvalid')
    expect(validateValues(values({ origin: 'JF' })).origin).toBe('iata')
    expect(validateValues(values({ origin: 'ZZQ' })).origin).toBe('unknownAirport')
    expect(validateValues(values({ destination: 'JFK' })).destination).toBe('sameAirport')
    expect(validateValues(values({ airline_iata: 'A' })).airline_iata).toBe('airline')
    expect(validateValues(values({ aircraft_icao: 'ZZZZ' })).aircraft_icao).toBe('unknownAircraft')
    expect(validateValues(values({ aircraft_icao: 'B7' })).aircraft_icao).toBe('unknownAircraft')
    expect(validateValues(values({ aircraft_icao: 'B-7' })).aircraft_icao).toBe('aircraft')
    expect(validateValues(values({ arrival_time: '25:00' })).arrival_time).toBe('time')
    expect(validateValues(values({ flight_number: 'x'.repeat(21) })).flight_number).toBe('flightNumber')
  })
  it('agrees with the shared flight validator on syntax', () => {
    const samples = [values(), values({ date: '2026-13-01' }), values({ origin: 'jfk' }), values({ airline_iata: 'A1' }), values({ departure_time: '9:30' }), values({ departure_time: '09:30:15' })]
    for (const sample of samples) {
      const mine = Object.keys(validateValues(sample)).length === 0
      let shared = true
      try {
        validateFlightInput({ date: sample.date, origin: sample.origin, destination: sample.destination, ...(sample.airline_iata ? { airline_iata: sample.airline_iata } : {}), ...(sample.departure_time ? { departure_time: sample.departure_time } : {}) }, 'create')
      } catch { shared = false }
      expect(mine).toBe(shared)
    }
  })
})

describe('changedFields', () => {
  it('sends only what changed and clears an emptied optional field with null', () => {
    const fields = { date: '2026-03-01', origin: 'JFK', destination: 'BOS', airline_iata: 'AA', flight_number: '10' }
    expect(changedFields(fields, toValues({ ...fields, destination: 'bos', flight_number: '' }))).toEqual({ flight_number: null })
    expect(changedFields(fields, toValues({ ...fields, destination: 'LAX' }))).toEqual({ destination: 'LAX' })
  })
})

describe('readiness and selection', () => {
  it('blocks a blank date, an unconfirmed year and a server issue', () => {
    expect(readiness(draft({ id: 'a', yearExplicit: false, fields: { date: '', origin: 'JFK', destination: 'BOS', airline_iata: 'AA' } }))).toEqual(['date'])
    expect(readiness(draft({ id: 'a', yearExplicit: false }))).toEqual(['year'])
    expect(readiness(draft({ id: 'a', yearExplicit: false, yearConfirmed: true }))).toEqual([])
    expect(readiness(draft({ id: 'a', issue: { code: 'UNKNOWN_AIRPORT', message: 'x' } }))).toEqual(['issue'])
  })
  it('counts a selected duplicate only after it was acknowledged', () => {
    const duplicate = draft({ id: 'd', duplicateFlightId: 4, selected: true })
    expect(isChosen(duplicate)).toBe(false)
    expect(isChosen({ ...duplicate, duplicateAcknowledged: true })).toBe(true)
  })
  it('does not choose a row that is not selected or already saved', () => {
    expect(isChosen(draft({ id: 'a', selected: false }))).toBe(false)
    expect(isChosen(draft({ id: 'a', status: 'converted' }))).toBe(false)
  })
})

describe('partition', () => {
  it('puts duplicates after the active rows and keeps source order', () => {
    const result = partition([
      draft({ id: 'dup', ordinal: 0, duplicateFlightId: 9 }), draft({ id: 'b', ordinal: 2 }), draft({ id: 'a', ordinal: 1 }),
      draft({ id: 'saved', ordinal: 3, status: 'converted' }), draft({ id: 'gone', ordinal: 4, status: 'dismissed' }),
    ])
    expect(result.active.map(row => row.id)).toEqual(['a', 'b'])
    expect(result.duplicates.map(row => row.id)).toEqual(['dup'])
    expect(result.saved.map(row => row.id)).toEqual(['saved'])
    expect(result.skipped.map(row => row.id)).toEqual(['gone'])
  })
})

describe('confidence', () => {
  it('reads row confidence and lists only low fields that hold a value', () => {
    expect(rowConfidence(draft({ id: 'a', confidence: 0.5 }))).toBe('check')
    expect(rowConfidence(draft({ id: 'a', confidence: 0.95 }))).toBe('high')
    expect(rowConfidence(draft({ id: 'a', confidence: null }))).toBe('unknown')
    expect(lowFields(draft({ id: 'a', fieldConfidence: { date: 0.4, origin: 0.95, flight_number: 0.2 } }))).toEqual(['date'])
  })
})

describe('withUnsent', () => {
  it('lays the unsent change over the stored row without touching the original', () => {
    const base = draft({ id: 'a', selected: true })
    const shown = withUnsent(base, { fields: { destination: 'LAX', flight_number: null }, selected: false })
    expect(shown.fields.destination).toBe('LAX')
    expect(shown.selected).toBe(false)
    expect(shown.edited).toBe(true)
    expect(base.fields.destination).toBe('BOS')
  })
})
