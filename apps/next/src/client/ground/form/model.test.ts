import { describe, expect, it } from 'vitest'
import type { GroundJourneyDto, RailLegDto } from '@kuuki/shared/groundTravel'
import {
  blankState,
  buildCommandBody,
  emptyLeg,
  stateFromDto,
  toJourneyInput,
  validateState,
} from './model'
import { addSuggested, chooseNone, toggleCountry } from './countries-fieldset'

const place = (id: string, countryCode: string) => ({
  source: 'geonames' as const,
  id,
  name: id,
  nameRu: null,
  nameEn: null,
  countryCode,
  region: null,
  lat: 41,
  lon: 44,
  timezone: 'Asia/Tbilisi',
  catalogVersion: 'v1',
})

function railState() {
  const state = blankState('rail', 'completed')
  state.legs = [{ ...emptyLeg(place('1', 'GE')), to: place('2', 'TR') }]
  return state
}

const leg = (
  durationSource: RailLegDto['durationSource'],
  durationMinutes: number | null,
): RailLegDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  from: place('1', 'GE'),
  to: place('2', 'TR'),
  fromStation: null,
  toStation: null,
  trainNumber: null,
  operator: null,
  departureDate: null,
  departureTime: null,
  arrivalDate: null,
  arrivalTime: null,
  durationMinutes,
  durationSource,
  distanceKm: null,
})
const dto = (legs: RailLegDto[]): GroundJourneyDto => ({
  id: '00000000-0000-4000-8000-0000000000aa',
  mode: 'rail',
  status: 'planned',
  version: 3,
  title: null,
  note: null,
  startDate: null,
  endDate: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  confirmedAt: null,
  countries: [],
  metrics: {
    distanceKm: null,
    distanceCoverage: { known: 0, total: 1 },
    trainMinutes: null,
    trainMinutesCoverage: null,
    uniqueCities: null,
  },
  legs,
})

describe('schedule duration echo', () => {
  it('sends a duration back only when the owner typed it', () => {
    const manual = stateFromDto(dto([leg('manual', 95)]), false)
    expect(manual.legs[0].durationManual).toBe('95')
    const derived = stateFromDto(dto([leg('schedule', 240)]), false)
    expect(derived.legs[0].durationManual).toBe('')
    const input = toJourneyInput(derived)
    expect(input?.mode === 'rail' && input.legs[0].durationMinutes).toBeNull()
    const typed = toJourneyInput(manual)
    expect(typed?.mode === 'rail' && typed.legs[0].durationMinutes).toBe(95)
  })

  it('rejects a duration that is not whole minutes', () => {
    const state = railState()
    state.legs[0].durationManual = '1.5'
    expect(validateState(state)[`leg:${state.legs[0].id}:durationManual`]).toBe('duration')
  })
})

describe('countries answer', () => {
  const target = { journeyId: '00000000-0000-4000-8000-0000000000bb' }

  it('treats an empty list as no answer until "None of these" is chosen', () => {
    const state = railState()
    expect(validateState(state).countries).toBe('countries')
    expect(buildCommandBody(state, target)).toBeNull()

    const none = { ...state, ...chooseNone(state, true) }
    expect(validateState(none).countries).toBeUndefined()
    const body = buildCommandBody(none, target)
    expect(body?.action === 'create' && body.countries).toEqual([])
  })

  it('keeps "None of these" and ticked countries mutually exclusive, and never ticks suggestions itself', () => {
    const empty = { countries: [], noCountries: false }
    expect(addSuggested(empty, ['GE', 'TR'])).toEqual({
      countries: ['GE', 'TR'],
      noCountries: false,
    })
    const none = chooseNone({ countries: ['GE'], noCountries: false }, true)
    expect(none).toEqual({ countries: [], noCountries: true })
    expect(toggleCountry(none, 'TR', true)).toEqual({ countries: ['TR'], noCountries: false })
  })

  it('sends no countries for a plan and starts a plan being completed unanswered', () => {
    const plan = blankState('rail', 'planned')
    plan.legs = railState().legs
    const body = buildCommandBody(plan, target)
    expect(body && 'countries' in body).toBe(false)
    const completing = stateFromDto(dto([leg(null, null)]), true)
    expect(completing.status).toBe('completed')
    expect(completing.noCountries).toBe(false)
    expect(validateState(completing).countries).toBe('countries')
  })

  it('treats a stored empty list of a completed journey as a deliberate answer', () => {
    const stored = { ...dto([leg(null, null)]), status: 'completed' as const, countries: [] }
    expect(stateFromDto(stored, false).noCountries).toBe(true)
  })
})
