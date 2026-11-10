// Copy of the Flighty CSV import, EN and RU together (Russian addresses the member as «вы»). Calm and direct:
// this is capture and privacy copy. Server messages are never shown; causes come from HistoryFailure kinds.
import { formatCount, type CountForms, type Locale } from '../../lib/format'
import type { FlightyIssueCode } from '@kuuki/shared/flighty'
import type { HistoryFindingKind, HistoryRowState } from '@kuuki/shared/flightyHistory'
import type { HistoryFailure } from './history-session'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })

export const H = {
  reading: p('Reading the file', 'Читаем файл'),
  sending: p('Sending records', 'Отправляем записи'),
  restoring: p('Loading the import', 'Загружаем импорт'),
  reselect: p(
    'Choose the same file again to send the rest of its records.',
    'Выберите тот же файл ещё раз, чтобы отправить остальные записи.',
  ),
  chooseAgain: p('Choose the file', 'Выбрать файл'),
  summary: p('Summary', 'Сводка'),
  questions: p('Questions', 'Вопросы'),
  exceptions: p('Records to check', 'Записи для проверки'),
  more: p('Show more', 'Показать ещё'),
  line: p('Line', 'Строка'),
  noRoute: p('No route', 'Без маршрута'),
  answeredAbove: p('Answered in Questions above.', 'Ответ — в вопросах выше.'),
  skip: p('Skip', 'Пропустить'),
  addNew: p('Add as a new flight', 'Добавить новым перелётом'),
  link: p('Same as the journal flight', 'Это перелёт из журнала'),
  dropTimes: p('Save without times', 'Сохранить без времени'),
  apply: p('Apply', 'Применить'),
  noAirline: p('No airline', 'Без авиакомпании'),
  flew: p('Flown', 'Состоялись'),
  cancelled: p('Cancelled', 'Отменены'),
  airlineCode: p('IATA airline code', 'Код авиакомпании IATA'),
  airportCode: p('IATA airport code', 'Код аэропорта IATA'),
  unknownColumns: p('Kept but not read:', 'Сохранены без разбора:'),
  readyTitle: p('Ready to save', 'Готово к сохранению'),
  showReady: p('Look through them', 'Просмотреть'),
  hideReady: p('Hide', 'Скрыть'),
  date: p('Date', 'Дата'),
  noFlightNumber: p('No flight number', 'Без номера рейса'),
  addAllNew: p('Add them', 'Добавить'),
  keepJournal: p('Keep the journal flights', 'Оставить перелёты журнала'),
  addSeparate: p('Add as separate flights', 'Добавить отдельными перелётами'),
  saving: p('Saving', 'Сохраняем'),
  nothingReady: p(
    'Answer the questions to save flights.',
    'Ответьте на вопросы, чтобы сохранить перелёты.',
  ),
  finished: p('Import finished', 'Импорт завершён'),
  openJournal: p('Open journal', 'Открыть журнал'),
  archive: p('Download source data', 'Скачать исходные данные'),
  erase: p('Delete source data', 'Удалить исходные данные'),
  eraseTitle: p('Delete the source data of this import?', 'Удалить исходные данные этого импорта?'),
  eraseConsequence: p(
    'The file’s fields, including booking codes and notes, are deleted. Saved flights stay in your journal.',
    'Поля файла, включая коды бронирования и заметки, будут удалены. Сохранённые перелёты останутся в журнале.',
  ),
  erased: p('Source data deleted.', 'Исходные данные удалены.'),
  discard: p('Discard import', 'Отменить импорт'),
  discardTitle: p('Discard this import?', 'Отменить этот импорт?'),
  discardConsequence: p(
    'Records not saved yet are dropped. Flights already saved stay in your journal.',
    'Несохранённые записи будут отброшены. Уже сохранённые перелёты останутся в журнале.',
  ),
  cancel: p('Cancel', 'Отмена'),
  retry: p('Try again', 'Повторить'),
  close: p('Close import', 'Закрыть импорт'),
  privacy: p(
    'The file is read on this device and sent to your account. Booking codes and notes are visible only to you.',
    'Файл читается на этом устройстве и отправляется в ваш аккаунт. Коды бронирования и заметки видны только вам.',
  ),
}

export const STATE_LABEL: Record<
  Exclude<HistoryRowState, 'needs_review' | 'error'> | 'open',
  Pair
> = {
  ready: p('Ready to save', 'Готово к сохранению'),
  open: p('Need your answer', 'Ждут вашего ответа'),
  created: p('Added to the journal', 'Добавлено в журнал'),
  duplicate: p('Already in the journal', 'Уже в журнале'),
  preserved_only: p('Cancelled, kept in source data', 'Отменённые, сохранены в исходных данных'),
  ignored: p('Skipped', 'Пропущено'),
  removed: p('Deleted from the journal later', 'Позже удалены из журнала'),
}

export const ISSUE: Record<FlightyIssueCode, Pair> = {
  EMPTY_RECORD: p('The record is empty.', 'Запись пустая.'),
  INVALID_DATE: p('The date can’t be read.', 'Дату не прочитать.'),
  MISSING_AIRPORT: p('An airport is missing.', 'Не указан аэропорт.'),
  UNKNOWN_AIRPORT: p('Unknown airport code.', 'Неизвестный код аэропорта.'),
  UNKNOWN_AIRLINE: p('Unknown airline code.', 'Неизвестный код авиакомпании.'),
  AMBIGUOUS_AIRLINE: p(
    'The airline code fits several airlines.',
    'Код подходит нескольким авиакомпаниям.',
  ),
  UNVERIFIED_AIRLINE: p('The airline can’t be checked.', 'Авиакомпанию не проверить.'),
  UNKNOWN_CANCELED: p('Unclear whether the flight was cancelled.', 'Непонятно, отменён ли рейс.'),
  INVALID_FLIGHT_NUMBER: p('The flight number can’t be read.', 'Номер рейса не прочитать.'),
  INVALID_TIME: p('A time can’t be read.', 'Время не прочитать.'),
  AMBIGUOUS_TIME: p(
    'The clocks changed that night: pick the offset.',
    'В ту ночь переводили часы: выберите смещение.',
  ),
  UNRESOLVED_TIME: p('A time falls into a clock change.', 'Время попадает на перевод часов.'),
  INCONSISTENT_TIMES: p('The times don’t fit together.', 'Время не сходится.'),
  DURATION_OUT_OF_RANGE: p('The flight time is implausible.', 'Время в пути неправдоподобно.'),
}

export const FIELD: Record<'origin' | 'destination' | 'diversion', Pair> = {
  origin: p('From', 'Откуда'),
  destination: p('To', 'Куда'),
  diversion: p('Diverted to', 'Ушёл на запасной в'),
}

export const FINDING: Record<HistoryFindingKind, Pair> = {
  previous_import: p('Already imported.', 'Уже импортирован.'),
  previous_deleted: p(
    'You deleted this flight after an earlier import.',
    'Вы удалили этот перелёт после прошлого импорта.',
  ),
  source_changed: p('Changed since an earlier import.', 'Изменился с прошлого импорта.'),
  existing_flight: p(
    'Your journal has a flight on this date and route.',
    'В журнале есть перелёт с этой датой и маршрутом.',
  ),
  repeated_in_file: p(
    'The file has another record with this date and route.',
    'В файле есть другая запись с этой датой и маршрутом.',
  ),
  new_since_import: p('New since your earlier import.', 'Новый с прошлого импорта.'),
}

const QUESTION: Record<string, (token: string) => Pair> = {
  airline: (token) => p(`Which airline is “${token}”?`, `Какая это авиакомпания — «${token}»?`),
  airport: (token) => p(`Which airport is “${token}”?`, `Какой это аэропорт — «${token}»?`),
  canceled: (token) =>
    token
      ? p(`Were flights marked “${token}” cancelled?`, `Рейсы с отметкой «${token}» отменены?`)
      : p(
          'Were flights with an empty cancellation field flown?',
          'Рейсы с пустым полем отмены состоялись?',
        ),
  'match:new_since_import': () =>
    p(
      'Add records that are new since your earlier import?',
      'Добавить записи, новые с прошлого импорта?',
    ),
  'match:existing_flight': () =>
    p(
      'Your journal already has flights on these dates and routes.',
      'В журнале уже есть перелёты с этими датами и маршрутами.',
    ),
}

/** One question per group, named by its source token. */
export const groupQuestion = (locale: Locale, group: string, token: string) =>
  (QUESTION[group] ?? QUESTION[group.split(':')[0]])(token)[locale]

const COUNT_FORMS = {
  records: {
    en: { one: '{count} record', other: '{count} records' },
    ru: {
      one: '{count} запись',
      few: '{count} записи',
      many: '{count} записей',
      other: '{count} записи',
    },
  },
  save: {
    en: { one: 'Save {count} record', other: 'Save {count} records' },
    ru: {
      one: 'Сохранить {count} запись',
      few: 'Сохранить {count} записи',
      many: 'Сохранить {count} записей',
      other: 'Сохранить {count} записи',
    },
  },
  of: {
    en: { one: 'of {count}', other: 'of {count}' },
    ru: { one: 'из {count}', few: 'из {count}', many: 'из {count}', other: 'из {count}' },
  },
} satisfies Record<string, CountForms>

export const hcount = (locale: Locale, key: keyof typeof COUNT_FORMS, n: number) =>
  formatCount(locale, n, COUNT_FORMS[key])

const FILE_PROBLEM: Record<string, Pair> = {
  EMPTY_FILE: p('The file is empty.', 'Файл пустой.'),
  FILE_TOO_LARGE: p('The file is over 10 MB.', 'Файл больше 10 МБ.'),
  TOO_MANY_RECORDS: p('The file has over 10,000 records.', 'В файле больше 10 000 записей.'),
  RECORD_TOO_LARGE: p('A record is too large.', 'Одна из записей слишком большая.'),
  MALFORMED_CSV: p('The file isn’t valid CSV.', 'Файл не в формате CSV.'),
  ROW_WIDTH_MISMATCH: p(
    'A row has the wrong number of columns.',
    'В строке неверное число столбцов.',
  ),
  DUPLICATE_HEADER: p('A column name repeats.', 'Название столбца повторяется.'),
  MISSING_HEADER: p(
    'This isn’t a Flighty export: a required column is missing.',
    'Это не экспорт Flighty: нет обязательного столбца.',
  ),
  INVALID_HEADER: p('A column name can’t be read.', 'Название столбца не прочитать.'),
}

const FAILURE: Record<Exclude<HistoryFailure['kind'], 'file'>, Pair> = {
  different_file: p(
    'This is a different file. Choose the file this import started from.',
    'Это другой файл. Выберите файл, с которого начался импорт.',
  ),
  too_large: FILE_PROBLEM.TOO_MANY_RECORDS,
  run_limit: p(
    'Three imports are already open. Finish or discard one first.',
    'Уже открыто три импорта. Сначала завершите или отмените один.',
  ),
  closed: p('This import is closed.', 'Этот импорт закрыт.'),
  stale: p(
    'The import changed in another tab. The latest state is shown.',
    'Импорт изменился в другой вкладке. Показано актуальное состояние.',
  ),
  offline: p('No connection. Nothing was lost.', 'Нет соединения. Ничего не потеряно.'),
  server: p(
    'Something went wrong on our side. Nothing was lost.',
    'Что-то пошло не так у нас. Ничего не потеряно.',
  ),
}

export function failureText(locale: Locale, failure: HistoryFailure): string {
  if (failure.kind !== 'file') return FAILURE[failure.kind][locale]
  const copy = FILE_PROBLEM[failure.code] ?? FILE_PROBLEM.MALFORMED_CSV
  return failure.line ? `${copy[locale]} ${H.line[locale]} ${failure.line}.` : copy[locale]
}
