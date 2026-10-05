import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../../web/src/lib/apiClient'
import { flightErrorMessage, validateFlightValues } from './flight-messages'

const valid = { date: '2026-10-05', origin: 'TBS', destination: 'IST', airline: '', aircraft: '', number: '', departure: '', arrival: '' }

describe.each(['en', 'ru'] as const)('field validation (%s)', locale => {
  const say = (en: string, ru: string) => locale === 'ru' ? ru : en
  it('accepts a minimal flight and leap days', () => {
    expect(validateFlightValues(valid, locale)).toEqual({})
    expect(validateFlightValues({ ...valid, date: '2024-02-29' }, locale)).toEqual({})
  })
  it('names the date format for an empty or malformed date, following the locale', () => {
    const format = say('Enter a date as MM/DD/YYYY.', 'Введите дату в формате ДД.ММ.ГГГГ.')
    expect(validateFlightValues({ ...valid, date: '' }, locale).date).toBe(format)
    expect(validateFlightValues({ ...valid, date: '5 Oct' }, locale).date).toBe(format)
  })
  it('says an impossible calendar day does not exist', () => {
    const missing = say('This date does not exist. Check the day and month.', 'Такой даты нет. Проверьте день и месяц.')
    for (const date of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-00-10']) expect(validateFlightValues({ ...valid, date }, locale).date, date).toBe(missing)
  })
  it('asks for an airport from the list when it is empty, malformed or not in the catalog', () => {
    const choose = say('Choose an airport from the list.', 'Выберите аэропорт из списка.')
    for (const origin of ['', 'TB', 'TBILISI', 'ZZZ']) expect(validateFlightValues({ ...valid, origin }, locale).origin, origin).toBe(choose)
    expect(validateFlightValues({ ...valid, destination: 'ZZZ' }, locale).destination).toBe(choose)
  })
  it('rejects the same origin and destination on the destination field', () => {
    expect(validateFlightValues({ ...valid, destination: 'TBS' }, locale)).toEqual({ destination: say('Choose a different airport.', 'Выберите другой аэропорт.') })
  })
  it('flags a bad time, airline, aircraft and flight number with their own messages', () => {
    const result = validateFlightValues({ ...valid, departure: '25:00', arrival: '9am', airline: 'X', aircraft: 'ZZZZ', number: 'T'.repeat(21) }, locale)
    expect(result.departure).toBe(say('Use HH:MM, for example 14:30.', 'Формат ЧЧ:ММ, например 14:30.'))
    expect(result.arrival).toBe(say('Use HH:MM, for example 14:30.', 'Формат ЧЧ:ММ, например 14:30.'))
    expect(result.airline).toBe(say('Choose from the list or leave empty.', 'Выберите из списка или оставьте пустым.'))
    expect(result.aircraft).toBe(say('Choose from the list or leave empty.', 'Выберите из списка или оставьте пустым.'))
    expect(result.number).toBe(say('Use at most 20 characters.', 'Не больше 20 символов.'))
  })
  it('never returns the generic copy', () => {
    const all = validateFlightValues({ date: '', origin: '', destination: '', airline: 'X', aircraft: 'Q', number: 'T'.repeat(30), departure: 'x', arrival: 'y' }, locale)
    for (const message of Object.values(all)) expect(message).not.toMatch(/Check this field|Проверьте значение поля/)
    expect(new Set(Object.values(all)).size).toBeGreaterThan(4)
  })
})

describe.each(['en', 'ru'] as const)('error copy (%s)', locale => {
  const say = (en: string, ru: string) => locale === 'ru' ? ru : en
  const api = (status: number, message: string, code?: string) => new ApiError(status, message, code)
  it('maps structured codes and never echoes developer text', () => {
    expect(flightErrorMessage(api(400, 'origin airport does not exist', 'UNKNOWN_AIRPORT'), locale, 'save')).toBe(say('Choose an airport from the list.', 'Выберите аэропорт из списка.'))
    expect(flightErrorMessage(api(400, 'aircraft_icao does not exist', 'UNKNOWN_AIRCRAFT'), locale, 'save')).toBe(say('Choose an aircraft from the list or leave it empty.', 'Выберите самолёт из списка или оставьте поле пустым.'))
    expect(flightErrorMessage(api(400, 'origin must be a three-letter IATA code', 'INVALID_FLIGHT'), locale, 'save')).toBe(say('Check the flight details and try again.', 'Проверьте данные перелёта и повторите.'))
    expect(flightErrorMessage(api(410, 'gone', 'IDEMPOTENCY_GONE'), locale, 'save')).toBe(say('Safe retry expired. Check the journal before a new save.', 'Срок безопасного повтора истёк. Проверьте журнал.'))
    expect(flightErrorMessage(api(409, 'conflict', 'IDEMPOTENCY_CONFLICT'), locale, 'save')).toBe(say('This save was already sent with different details. Check the journal, then save again.', 'Это сохранение уже отправлялось с другими данными. Проверьте журнал и сохраните снова.'))
    expect(flightErrorMessage(api(404, 'Flight not found', 'NOT_FOUND'), locale, 'load')).toBe(say('Flight not found.', 'Перелёт не найден.'))
    expect(flightErrorMessage(api(401, 'Unauthorized'), locale, 'save')).toBe(say('Your session has ended. Sign in again.', 'Сессия закончилась. Войдите снова.'))
    expect(flightErrorMessage(api(429, 'rate'), locale, 'save')).toBe(say('Too many attempts. Wait a minute and try again.', 'Слишком много попыток. Подождите минуту и повторите.'))
  })
  it('uses calm connection copy for network, server and unknown failures per action', () => {
    for (const cause of [new TypeError('Failed to fetch'), api(500, 'Internal server error', 'INTERNAL'), new Error('Lookup unavailable'), 'ApiError: boom', undefined]) {
      expect(flightErrorMessage(cause, locale, 'save')).toBe(say('Could not save. Check your connection and try again.', 'Не удалось сохранить. Проверьте соединение и повторите.'))
      expect(flightErrorMessage(cause, locale, 'delete')).toBe(say('Could not delete. Check your connection and try again.', 'Не удалось удалить. Проверьте соединение и повторите.'))
      expect(flightErrorMessage(cause, locale, 'load')).toBe(say('Could not load the flight. Check your connection and try again.', 'Не удалось загрузить перелёт. Проверьте соединение и повторите.'))
    }
  })
})
