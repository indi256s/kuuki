import { describe, expect, it } from 'vitest'
import { draft } from './fixtures'
import type { Draft } from './import-types'
import { answerAirport, answerFlown, answerNoAirline, answerNotFlown, answerYear, buildQuestions, openCauses, suggestedYears } from './questions'

const TODAY = '2026-10-07'
const noYear = (id: string, monthDay: string, over: Partial<Draft> = {}) => draft({ id, ordinal: Number(id.replace(/\D/g, '')) || 0, selected: false, yearExplicit: false,
  confidence: 0.5, fieldConfidence: { date: 0, origin: 1, destination: 1, airline_iata: 1 },
  fields: { date: '', date_month_day: monthDay, origin: 'BEG', destination: 'SVO', airline_iata: 'JU' }, ...over })

describe('buildQuestions', () => {
  it('asks once for the year of every boarding pass that shows only the day and month', () => {
    const questions = buildQuestions([noYear('d1', '03-26'), noYear('d2', '03-27'), draft({ id: 'ok' })], TODAY)
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({ kind: 'year', years: [2026, 2025] })
    expect(questions[0].kind === 'year' && questions[0].drafts.map(row => row.id)).toEqual(['d1', 'd2'])
  })

  it('never suggests a year that puts a flight in the future, and splits a trip across New Year', () => {
    expect(suggestedYears([{ month: 11, day: 20 }], TODAY)).toEqual([2025, 2024])
    expect(suggestedYears([{ month: 10, day: 8 }], TODAY)).toEqual([2026, 2025]) // a pass issued the day before
    const questions = buildQuestions([noYear('d1', '12-28'), noYear('d2', '12-30'), noYear('d3', '01-03'), noYear('d4', '01-05')], TODAY)
    expect(questions.map(question => question.kind === 'year' && question.years)).toEqual([[2025, 2024], [2026, 2025]])
  })

  it('asks a single boarding pass for its year too, and nothing when the year or airline is known', () => {
    expect(buildQuestions([noYear('d1', '08-15')], TODAY).map(question => question.kind === 'year' && question.years)).toEqual([[2026, 2025]])
    expect(buildQuestions([draft({ id: 'zz', selected: false, fields: { date: '2020-01-01', origin: 'ROV', destination: 'EVN', airline_iata: 'ZZ', airline_was_placeholder: true } })], TODAY).map(question => question.kind)).toEqual(['airline'])
    expect(buildQuestions([draft({ id: 'ok' }), draft({ id: 'nomd', selected: false, yearExplicit: false, fields: { date: '', origin: 'BEG', destination: 'SVO', airline_iata: 'JU' } })], TODAY)).toEqual([])
  })

  it('groups ambiguous airports by their candidate set and keeps each row-endpoint as its own answer', () => {
    const moscow = ['DME', 'SVO', 'VKO']
    const rows = [
      draft({ id: 'a', selected: false, fields: { date: '2015-05-21', origin: 'ROV', destination: '', destination_options: moscow, airline_iata: 'ZZ', airline_was_placeholder: true } }),
      draft({ id: 'b', ordinal: 1, selected: false, fields: { date: '2021-06-14', origin: '', origin_options: ['VKO', 'SVO', 'DME'], destination: 'ROV', airline_iata: 'ZZ', airline_was_placeholder: true } }),
    ]
    const questions = buildQuestions(rows, TODAY)
    const airport = questions.find(question => question.kind === 'airport')
    expect(airport?.kind === 'airport' && airport.items.map(item => `${item.draft.id}:${item.endpoint}`)).toEqual(['a:destination', 'b:origin'])
    expect(questions.find(question => question.kind === 'airline')?.kind).toBe('airline')
  })

  it('asks about uncertain status only while the member has not chosen the row, and ignores saved, skipped and duplicate rows', () => {
    const flagged = (id: string, over: Partial<Draft> = {}) => draft({ id, selected: false, fields: { date: '2023-01-31', origin: 'TBS', destination: 'SAW', airline_iata: 'PC', review_required: true }, ...over })
    const questions = buildQuestions([flagged('s1'), flagged('s2', { selected: true }), flagged('s3', { status: 'dismissed' }), flagged('s4', { status: 'converted' }), flagged('s5', { duplicateFlightId: 9 })], TODAY)
    expect(questions).toHaveLength(1)
    expect(questions[0].kind === 'status' && questions[0].drafts.map(row => row.id)).toEqual(['s1'])
  })
})

describe('answers', () => {
  it('a year answer fills the printed day, confirms the year and selects a row that is now complete', () => {
    expect(answerYear(noYear('d1', '03-26'), 2026)).toEqual({ fields: { date: '2026-03-26' }, yearConfirmed: true, selected: true })
  })

  it('does not select a row that still has an open question or a field the source was unsure of', () => {
    const alsoAirline = noYear('d1', '03-26', { fields: { date: '', date_month_day: '03-26', origin: 'BEG', destination: 'SVO', airline_iata: 'ZZ', airline_was_placeholder: true } })
    expect(answerYear(alsoAirline, 2026)).toEqual({ fields: { date: '2026-03-26' }, yearConfirmed: true })
    const unsureRoute = noYear('d2', '03-26', { fieldConfidence: { date: 0, origin: 0.4, destination: 1, airline_iata: 1 } })
    expect(answerYear(unsureRoute, 2026)).not.toHaveProperty('selected')
    expect(answerYear(noYear('d3', '02-29'), 2025)).toBeNull()
  })

  it('saves without an airline by clearing the placeholder, and fills an airport from its candidates', () => {
    const zz = draft({ id: 'zz', selected: false, fields: { date: '2020-01-01', origin: 'ROV', destination: 'EVN', airline_iata: 'ZZ', airline_was_placeholder: true } })
    expect(answerNoAirline(zz)).toEqual({ fields: { airline_iata: null }, selected: true })
    const city = draft({ id: 'c', selected: false, fields: { date: '2015-05-21', origin: 'ROV', destination: '', destination_options: ['DME', 'SVO'], airline_iata: 'SU' } })
    expect(answerAirport(city, 'destination', 'DME')).toEqual({ fields: { destination: 'DME' }, selected: true })
    expect(openCauses({ ...city, fields: { ...city.fields, destination: 'DME' } })).toEqual([])
  })

  it('«Летал» chooses the row and «Не летал» skips it', () => {
    expect(answerFlown()).toEqual({ selected: true })
    expect(answerNotFlown()).toEqual({ dismissed: true })
  })
})
