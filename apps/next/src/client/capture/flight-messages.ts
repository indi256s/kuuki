import { findAirport } from '@kuuki/data/airport-lookup'
import { findAircraft } from '@kuuki/data/aircraft-lookup'
import { ApiError } from '@kuuki/client/apiClient'
import { SettledFlightOperationError } from '@kuuki/client/flightCreateOperations'
import type { Locale } from '../../lib/format'

export type FlightValues = {
  date: string
  origin: string
  destination: string
  airline: string
  aircraft: string
  number: string
  departure: string
  arrival: string
}
export type FlightField = keyof FlightValues

const say = (locale: Locale, en: string, ru: string) => (locale === 'ru' ? ru : en)

function realDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return 'malformed' as const
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
    ? ('ok' as const)
    : ('missing' as const)
}

/** One specific, localized message per invalid field. Empty optional fields are valid. */
export function validateFlightValues(
  values: FlightValues,
  locale: Locale,
): Partial<Record<FlightField, string>> {
  const errors: Partial<Record<FlightField, string>> = {}
  const date = realDate(values.date)
  if (date === 'malformed')
    errors.date = say(locale, 'Enter a date as MM/DD/YYYY.', 'Введите дату в формате ДД.ММ.ГГГГ.')
  else if (date === 'missing')
    errors.date = say(
      locale,
      'This date does not exist. Check the day and month.',
      'Такой даты нет. Проверьте день и месяц.',
    )
  const airport = say(locale, 'Choose an airport from the list.', 'Выберите аэропорт из списка.')
  for (const field of ['origin', 'destination'] as const)
    if (!/^[A-Z]{3}$/.test(values[field]) || !findAirport(values[field])) errors[field] = airport
  if (!errors.origin && !errors.destination && values.origin === values.destination)
    errors.destination = say(locale, 'Choose a different airport.', 'Выберите другой аэропорт.')
  const fromList = say(
    locale,
    'Choose from the list or leave empty.',
    'Выберите из списка или оставьте пустым.',
  )
  if (values.airline && !/^[A-Z0-9]{2}$/.test(values.airline)) errors.airline = fromList
  if (
    values.aircraft &&
    (!/^[A-Z0-9]{2,4}$/.test(values.aircraft) || !findAircraft(values.aircraft))
  )
    errors.aircraft = fromList
  if (values.number.trim().length > 20)
    errors.number = say(locale, 'Use at most 20 characters.', 'Не больше 20 символов.')
  const time = say(locale, 'Use HH:MM, for example 14:30.', 'Формат ЧЧ:ММ, например 14:30.')
  for (const field of ['departure', 'arrival'] as const)
    if (values[field] && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(values[field]))
      errors[field] = time
  return errors
}

/** Localized, calm copy for a failed load, save or delete. Never shows raw error text, class names or English developer messages. */
export function flightErrorMessage(
  cause: unknown,
  locale: Locale,
  action: 'load' | 'save' | 'delete',
): string {
  if (cause instanceof SettledFlightOperationError)
    return say(
      locale,
      'The original save was settled elsewhere. Check the journal before starting a new save.',
      'Исходное сохранение уже завершено в другом окне. Проверьте журнал, прежде чем начать новое сохранение.',
    )
  if (cause instanceof ApiError) {
    switch (cause.code) {
      case 'UNKNOWN_AIRPORT':
        return say(locale, 'Choose an airport from the list.', 'Выберите аэропорт из списка.')
      case 'UNKNOWN_AIRCRAFT':
        return say(
          locale,
          'Choose an aircraft from the list or leave it empty.',
          'Выберите самолёт из списка или оставьте поле пустым.',
        )
      case 'INVALID_FLIGHT':
        return say(
          locale,
          'Check the flight details and try again.',
          'Проверьте данные перелёта и повторите.',
        )
      case 'IDEMPOTENCY_GONE':
        return say(
          locale,
          'Safe retry expired. Check the journal before a new save.',
          'Срок безопасного повтора истёк. Проверьте журнал.',
        )
      case 'IDEMPOTENCY_CONFLICT':
        return say(
          locale,
          'This save was already sent with different details. Check the journal, then save again.',
          'Это сохранение уже отправлялось с другими данными. Проверьте журнал и сохраните снова.',
        )
      case 'NOT_FOUND':
        return say(locale, 'Flight not found.', 'Перелёт не найден.')
    }
    if (cause.status === 401 || cause.status === 403)
      return say(
        locale,
        'Your session has ended. Sign in again.',
        'Сессия закончилась. Войдите снова.',
      )
    if (cause.status === 429)
      return say(
        locale,
        'Too many attempts. Wait a minute and try again.',
        'Слишком много попыток. Подождите минуту и повторите.',
      )
  }
  if (action === 'load')
    return say(
      locale,
      'Could not load the flight. Check your connection and try again.',
      'Не удалось загрузить перелёт. Проверьте соединение и повторите.',
    )
  if (action === 'delete')
    return say(
      locale,
      'Could not delete. Check your connection and try again.',
      'Не удалось удалить. Проверьте соединение и повторите.',
    )
  return say(
    locale,
    'Could not save. Check your connection and try again.',
    'Не удалось сохранить. Проверьте соединение и повторите.',
  )
}
