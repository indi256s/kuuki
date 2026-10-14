// EN and RU wording for the rail ticket OCR panel. Sentence case; the status of a file is one line of text.

import type { CountForms } from '../../../../lib/format'
import type { RowStatus } from './model'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })

export const trains: CountForms = {
  en: { one: '{count} train', other: '{count} trains' },
  ru: {
    one: '{count} поезд',
    few: '{count} поезда',
    many: '{count} поездов',
    other: '{count} поезда',
  },
}
export const files: CountForms = {
  en: { one: '{count} file', other: '{count} files' },
  ru: {
    one: '{count} файл',
    few: '{count} файла',
    many: '{count} файлов',
    other: '{count} файла',
  },
}

export const T = {
  heading: p('Fill from tickets', 'Заполнить по билетам'),
  title: p('Choose tickets or drop them here', 'Выберите билеты или перетащите их сюда'),
  hint: p(
    'Up to 10 files at a time: PDF, JPEG, PNG or WebP, 10 MB each. Tickets are not stored.',
    'До 10 файлов за раз: PDF, JPEG, PNG или WebP, до 10 МБ каждый. Билеты не сохраняются.',
  ),
  rows: p('Tickets', 'Билеты'),
  remove: p('Remove', 'Убрать'),
  retry: p('Retry', 'Повторить'),
  stop: p('Stop', 'Остановить'),
  cutOff: p(
    'Only the first 10 files were taken. Choose the rest again after these are read.',
    'Взяты только первые 10 файлов. Остальные выберите снова, когда эти будут прочитаны.',
  ),
  summaryReading: p('Reading tickets…', 'Читаем билеты…'),
  summaryStopped: p(
    'Stopped. Files already read are kept.',
    'Остановлено. Прочитанные файлы сохранены.',
  ),
  checkThis: p('Check this', 'Проверьте'),
  yearMissing: p('The ticket has no year.', 'На билете нет года.'),
  year: p('Year', 'Год'),
  yearFor: p('Year for', 'Год для'),
  yearProblem: p(
    'Use a four-digit year that makes a real date.',
    'Нужен год из четырёх цифр, при котором дата существует.',
  ),
  ticketCity: p('City on the ticket', 'Город на билете'),
  ticketCityNote: p('Choose the place in the route.', 'Выберите место в маршруте.'),
  departureStation: p('Departure station', 'Станция отправления'),
  arrivalStation: p('Arrival station', 'Станция прибытия'),
  trainNumber: p('Train number', 'Номер поезда'),
  operator: p('Operator', 'Перевозчик'),
  departureDate: p('Departure date', 'Дата отправления'),
  arrivalDate: p('Arrival date', 'Дата прибытия'),
  departureTime: p('Departure time (local)', 'Время отправления (местное)'),
  arrivalTime: p('Arrival time (local)', 'Время прибытия (местное)'),
  include: p('Include', 'Включить'),
  repeat: p('Possible repeat', 'Возможный повтор'),
  cancelled: p('Cancelled ticket', 'Отменённый билет'),
  otherPassenger: p('Another passenger', 'Другой пассажир'),
  added: p('Added to route', 'Добавлен в маршрут'),
  replaceLeg: p('Replace a leg', 'Заменить участок'),
  replaceWhich: p('Leg to replace', 'Какой участок заменить'),
  replaceThis: p('Replace this leg', 'Заменить участок'),
  addToRoute: p('Add to route', 'Добавить в маршрут'),
  replaceRoute: p('Replace route', 'Заменить маршрут'),
  nothingSelected: p('Tick at least one train.', 'Отметьте хотя бы один поезд.'),
  routeFull: p('The route would pass 100 legs.', 'В маршруте стало бы больше 100 участков.'),
  routeLocked: p('The form is saving.', 'Форма сохраняется.'),
  confirmTitle: p('Replace the whole route?', 'Заменить весь маршрут?'),
  confirmBody: p(
    'The legs you have now are removed from this form. Journey dates, status and countries stay as they are.',
    'Участки, которые сейчас в форме, будут убраны. Даты путешествия, статус и страны останутся как есть.',
  ),
  confirm: p('Replace route', 'Заменить маршрут'),
  cancel: p('Cancel', 'Отмена'),
  legName: p('Leg', 'Участок'),
  train: p('Train', 'Поезд'),
  aboutReplace: p(
    'Replace swaps only the leg you pick. Nothing else changes.',
    'Заменяется только выбранный участок. Остальное не меняется.',
  ),
} as const

const status: Record<RowStatus, Pair> = {
  waiting: p('Waiting', 'Ожидает'),
  reading: p('Reading…', 'Читаем…'),
  found: p('Found', 'Найдено'), // replaced by the counted form
  none: p('No trains found', 'Поездов не найдено'),
  'too-large': p('Too large (max 10 MB)', 'Слишком большой (не более 10 МБ)'),
  unsupported: p('Unsupported type', 'Тип не поддерживается'),
  failed: p('Could not read this file', 'Не удалось прочитать файл'),
  'rate-limited': p('Rate limited, try later', 'Лимит запросов, попробуйте позже'),
  stopped: p('Stopped', 'Остановлено'),
}
export const unclear = p('Some fields unclear', 'Часть полей неясна')

export const statusText = (locale: 'en' | 'ru', key: RowStatus): string => status[key][locale]
