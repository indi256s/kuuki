// Every import string, written in English and Russian together (Russian addresses the member as «вы»).
// Counts use real plural forms. Server messages are never shown: causes come from import-errors.ts kinds and codes.
import { formatCount, type CountForms, type Locale } from '../../lib/format'
import type { FailureAction, FailureKind } from './import-errors'
import type { RowFailureKind } from './import-errors'
import type { FieldError, FieldName, Readiness } from './review-model'
import type { BatchStage } from './import-types'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })

export const S = {
  eyebrow: p('Journal', 'Журнал'),
  title: p('Import flights', 'Импорт перелётов'),
  lead: p('Turn a boarding pass, booking or screenshot into flights, and check each one before it is saved.', 'Превратите посадочный талон, бронь или скриншот в перелёты и проверьте каждый до сохранения.'),
  stepsLabel: p('Import steps', 'Шаги импорта'),
  stepSource: p('Source', 'Источник'),
  stepReview: p('Review', 'Проверка'),
  stepDone: p('Done', 'Готово'),
  stepCurrent: p('current step', 'текущий шаг'),

  dropTitle: p('Choose a file or drop it here', 'Выберите файл или перетащите его сюда'),
  dropHint: p('Boarding pass, PDF or screenshot, up to 10 MB.', 'Посадочный талон, PDF или скриншот, до 10 МБ.'),
  dropChosen: p('Selected file', 'Выбранный файл'),
  dropChange: p('Choose another file', 'Выбрать другой файл'),
  fileBad: p('Use a PDF, PNG or JPEG file.', 'Подойдёт файл PDF, PNG или JPEG.'),
  fileBig: p('This file is over 10 MB. Choose a smaller one.', 'Файл больше 10 МБ. Выберите файл поменьше.'),
  fileRead: p('This file could not be read. Choose it again.', 'Не удалось прочитать файл. Выберите его ещё раз.'),
  modeLabel: p('Source type', 'Тип источника'),
  modeFile: p('File', 'Файл'),
  modeText: p('Paste text', 'Вставить текст'),
  textLabel: p('Booking or itinerary text', 'Текст брони или маршрута'),
  textHint: p('One flight per line is easiest. Dates with a year work best.', 'Проще всего по одному перелёту на строку. Лучше всего работают даты с годом.'),
  find: p('Find flights', 'Найти перелёты'),
  finding: p('Starting…', 'Запускаем…'),
  needFile: p('Choose a file first.', 'Сначала выберите файл.'),
  needText: p('Paste some text first.', 'Сначала вставьте текст.'),
  privacy: p('The document is sent to a recognition service to find flights. Kuuki keeps only the flight details it finds, for 30 days, so you can come back to them. The file and pasted text are not kept.', 'Документ отправляется в сервис распознавания, чтобы найти перелёты. Kuuki хранит только найденные данные перелётов, 30 дней, чтобы вы могли вернуться к ним. Файл и вставленный текст не сохраняются.'),
  emailHelp: p('How to export flights from your email', 'Как выгрузить перелёты из почты'),
  emailHelpBody: p('Ask your email assistant with the prompt below, then paste its answer as text.', 'Задайте помощнику в почте запрос ниже и вставьте его ответ как текст.'),
  copyPrompt: p('Copy the prompt', 'Скопировать запрос'),
  copied: p('Prompt copied', 'Запрос скопирован'),
  copyFailed: p('Could not copy. Select the text and copy it by hand.', 'Не удалось скопировать. Выделите текст и скопируйте вручную.'),
  promptLabel: p('Prompt text', 'Текст запроса'),
  prompt: p(
    'Search for all flight bookings, boarding passes, itineraries and travel confirmations.\n\nFor each flight include only what you can find: date, origin and destination airports, airline, flight number, departure and arrival times.\n\nFormat: one flight per line.\nExample: 2024-03-15 | JFK → LAX | American Airlines 123 | 08:30-11:45\n\nList all flights. Partial information is fine.',
    'Найди все бронирования перелётов, посадочные талоны, маршруты и подтверждения поездок.\n\nДля каждого перелёта укажи только то, что нашёл: дату, аэропорты вылета и прилёта, авиакомпанию, номер рейса, время вылета и прилёта.\n\nФормат: один перелёт на строку.\nПример: 2024-03-15 | JFK → LAX | American Airlines 123 | 08:30-11:45\n\nПеречисли все перелёты. Неполные данные — это нормально.'),

  recognizing: p('Finding your flights', 'Ищем ваши перелёты'),
  sourceChip: p('Source', 'Источник'),
  textSource: p('Pasted text', 'Вставленный текст'),
  leaveSafe: p('You can close this page. What is found stays in your Journal under waiting drafts.', 'Страницу можно закрыть. Найденное останется в Журнале среди ожидающих черновиков.'),
  cancelRun: p('Cancel', 'Отменить'),
  cancelling: p('Cancelling…', 'Отменяем…'),
  cancelFailed: p('Could not cancel. Try again.', 'Не удалось отменить. Попробуйте ещё раз.'),
  stageAccepted: p('Received', 'Получено'),
  stageRecognizing: p('Reading the document', 'Читаем документ'),
  stageValidating: p('Checking flights', 'Проверяем перелёты'),
  stageReady: p('Ready to review', 'Готово к проверке'),
  stagesLabel: p('Progress', 'Ход распознавания'),
  stateDone: p('done', 'готово'),
  stateActive: p('in progress', 'в процессе'),
  statePending: p('waiting', 'ожидает'),
  foundRows: p('Found so far', 'Найдено на данный момент'),
  reconnecting: p('Connection lost. Showing the last saved result.', 'Связь прервалась. Показан последний сохранённый результат.'),
  loadFailed: p('Could not load this import.', 'Не удалось загрузить этот импорт.'),

  reviewTitle: p('Review flights', 'Проверка перелётов'),
  partialTitle: p('Partial result', 'Частичный результат'),
  partialNote: p('Recognition stopped early. These flights were found before it stopped; check them and add anything missing by hand.', 'Распознавание остановилось раньше. Эти перелёты найдены до остановки; проверьте их и добавьте недостающее вручную.'),
  selectAll: p('Select all', 'Выбрать все'),
  duplicatesTitle: p('Already in your journal', 'Уже в журнале'),
  duplicatesNote: p('These match a flight you already have. They are not selected.', 'Совпадают с перелётом, который у вас уже есть. Они не выбраны.'),
  saveAnyway: p('Save anyway', 'Всё равно сохранить'),
  alreadySaved: p('Saved already', 'Уже сохранено'),
  skippedNote: p('Skipped', 'Пропущено'),
  addManual: p('Add a flight manually', 'Добавить рейс вручную'),
  manualTitle: p('Flight added by hand', 'Рейс, добавленный вручную'),
  manualRemove: p('Remove this flight', 'Убрать этот рейс'),
  edit: p('Edit', 'Изменить'),
  editTitle: p('Edit flight', 'Изменить перелёт'),
  close: p('Close', 'Закрыть'),
  done: p('Done', 'Готово'),
  selectRow: p('Include in import', 'Добавить при импорте'),
  skipRow: p('Skip this flight', 'Пропустить этот рейс'),
  restoreRow: p('Restore', 'Вернуть'),
  check: p('Check', 'Проверьте'),
  confidence: p('Confidence', 'Уверенность'),
  confidenceUnknown: p('Confidence unknown', 'Уверенность неизвестна'),
  fieldUnsure: p('Unsure', 'Не уверены'),
  snippetTitle: p('Found in the document', 'Найдено в документе'),
  saving: p('Saving…', 'Сохраняем…'),
  editSaved: p('Saved', 'Сохранено'),
  editFailed: p('Not saved yet. Your edit is kept here.', 'Пока не сохранено. Ваша правка остаётся здесь.'),
  editRejected: p('The change was refused. Check the fields and save again.', 'Изменение отклонено. Проверьте поля и сохраните ещё раз.'),
  editConflict: p('This flight changed elsewhere. Your edit is kept; save it again to apply it.', 'Этот перелёт изменили в другом месте. Ваша правка сохранена; сохраните ещё раз, чтобы применить её.'),
  retrySave: p('Try saving again', 'Сохранить ещё раз'),
  discardEdit: p('Discard my edit', 'Отменить мою правку'),
  saveRow: p('Save changes', 'Сохранить изменения'),
  yearConfirm: p('I checked the year', 'Я проверил(а) год'),
  yearMissing: p('The document did not show a year. Enter the date and confirm the year before saving.', 'В документе не указан год. Введите дату и подтвердите год перед сохранением.'),
  yearUnconfirmed: p('The document did not show a year. Check the date, then confirm the year.', 'В документе не указан год. Проверьте дату, затем подтвердите год.'),
  blockedDate: p('Add a date to include this flight.', 'Добавьте дату, чтобы включить этот рейс.'),
  blockedYear: p('Confirm the year to include this flight.', 'Подтвердите год, чтобы включить этот рейс.'),
  blockedIssue: p('Fix this flight to include it.', 'Исправьте этот рейс, чтобы включить его.'),
  issueUnknownAirport: p('One of the airports is not in our list.', 'Одного из аэропортов нет в нашем списке.'),
  issueUnknownAircraft: p('The aircraft code is not in our list.', 'Кода самолёта нет в нашем списке.'),
  issueGeneric: p('Some fields need a correction.', 'Некоторые поля нужно исправить.'),
  noDate: p('No date', 'Нет даты'),
  barLabel: p('Import actions', 'Действия импорта'),
  importCount: p('Import', 'Импортировать'),
  importing: p('Saving flights…', 'Сохраняем перелёты…'),
  nothingChosen: p('Select at least one flight to import.', 'Выберите хотя бы один перелёт.'),
  unsavedBlock: p('Some edits are not saved yet. Save or discard them first.', 'Некоторые правки ещё не сохранены. Сохраните или отмените их.'),
  manualInvalid: p('Fix the highlighted fields on the manual flights first.', 'Сначала исправьте выделенные поля у рейсов, добавленных вручную.'),
  cancelImport: p('Discard import', 'Отменить импорт'),
  discardTitle: p('Discard this import?', 'Отменить этот импорт?'),
  discardBody: p('The found flights are removed. Nothing is added to your journal.', 'Найденные перелёты будут удалены. В журнал ничего не добавится.'),
  discardKeep: p('Keep reviewing', 'Продолжить проверку'),
  discardFailed: p('Could not discard the import. Try again.', 'Не удалось отменить импорт. Попробуйте ещё раз.'),
  noRowsLeft: p('Every flight from this import is saved or skipped.', 'Все перелёты из этого импорта сохранены или пропущены.'),

  savedHeading: p('Import finished', 'Импорт завершён'),
  partialSaved: p('Some flights were not saved', 'Не все перелёты сохранены'),
  newCountries: p('New stamps', 'Новые штампы'),
  stampsWaiting: p('Totals are still updating. New stamps appear once they are ready.', 'Итоги ещё обновляются. Новые штампы появятся, когда будут готовы.'),
  stampsDelayed: p('Totals are taking longer to update. Your flights are saved.', 'Обновление итогов занимает больше времени. Перелёты сохранены.'),
  failedList: p('Not saved', 'Не сохранено'),
  uncertainRow: p('We did not get an answer for this flight. It may or may not be saved; trying again is safe.', 'Мы не получили ответа по этому рейсу. Он мог сохраниться или нет; повторить безопасно.'),
  unsentRow: p('Not sent yet.', 'Ещё не отправлено.'),
  backToReview: p('Back to review', 'Назад к проверке'),
  passport: p('Open Passport', 'Открыть паспорт'),
  journal: p('Go to Journal', 'В журнал'),
  importMore: p('Import more', 'Импортировать ещё'),
  identify: p('Identify aircraft', 'Определить самолёты'),
  checkingSaved: p('Checking what was saved…', 'Проверяем, что сохранилось…'),
  checkFailed: p('Could not confirm what was saved. Reload to check.', 'Не удалось проверить, что сохранилось. Обновите страницу.'),

  aircraftTitle: p('Aircraft suggestions', 'Предложения по самолётам'),
  aircraftIntro: p('Suggestions are a starting point, not confirmed facts. Only ones with 70% confidence or more are offered.', 'Предложения — отправная точка, а не подтверждённые факты. Показаны только те, где уверенность не ниже 70%.'),
  aircraftSearching: p('Looking for aircraft…', 'Ищем самолёты…'),
  aircraftSelectAll: p('Select all', 'Выбрать все'),
  aircraftDeselectAll: p('Deselect all', 'Снять выбор'),
  aircraftAccept: p('Save aircraft', 'Сохранить самолёты'),
  aircraftAccepting: p('Saving aircraft…', 'Сохраняем самолёты…'),
  aircraftNone: p('No aircraft could be identified reliably.', 'Не удалось надёжно определить ни одного самолёта.'),
  aircraftSavedTag: p('Saved', 'Сохранено'),
  aircraftFailedTag: p('Not saved', 'Не сохранено'),
  aircraftUncertainTag: p('May not be saved', 'Возможно, не сохранено'),
  aircraftUncertainNote: p('We did not get an answer. Check the journal, or try again; trying again is safe.', 'Ответа не было. Проверьте журнал или повторите; повторить безопасно.'),
  aircraftRetry: p('Try again for the rest', 'Повторить для остальных'),
  aircraftUnidentified: p('No suggestion', 'Без предложения'),
  aircraftReasonNone: p('The service could not name an aircraft for this flight.', 'Сервис не смог назвать самолёт для этого рейса.'),
  aircraftReasonLow: p('The service was not sure enough (under 70%). You can set the aircraft by hand in the journal.', 'Сервис не уверен (ниже 70%). Самолёт можно указать вручную в журнале.'),
  aircraftReasonMissing: p('The service gave no answer for this flight.', 'Сервис не ответил по этому рейсу.'),
  aircraftSearchFailed: p('Aircraft search failed.', 'Поиск самолётов не удался.'),
  aircraftSearchRetry: p('Search again', 'Искать снова'),
  aircraftClose: p('Close', 'Закрыть'),
  aircraftEvidence: p('Evidence', 'Основание'),
  aircraftUnsure: p('Unconfirmed', 'Не подтверждено'),
  aircraftDone: p('Saved aircraft', 'Самолёты сохранены'),

  failureTitle: p('This import did not finish', 'Импорт не завершён'),
  retryAt: p('You can try again after', 'Попробовать снова можно после'),
  tipsTitle: p('What works well', 'Что подходит'),
  tips: p('A boarding pass, a booking confirmation, an itinerary PDF, or a screenshot that shows dates and airports.', 'Посадочный талон, подтверждение брони, PDF с маршрутом или скриншот, где видны даты и аэропорты.'),
} as const

export type Key = keyof typeof S
export const tx = (locale: Locale, key: Key): string => S[key][locale]

export const COUNTS = {
  selected: { en: { one: '{count} selected', other: '{count} selected' }, ru: { one: 'Выбран {count}', few: 'Выбрано {count}', many: 'Выбрано {count}', other: 'Выбрано {count}' } },
  ofTotal: { en: { one: 'of {count}', other: 'of {count}' }, ru: { one: 'из {count}', few: 'из {count}', many: 'из {count}', other: 'из {count}' } },
  found: { en: { one: '{count} flight found', other: '{count} flights found' }, ru: { one: 'Найден {count} перелёт', few: 'Найдено {count} перелёта', many: 'Найдено {count} перелётов', other: 'Найдено {count} перелёта' } },
  duplicates: { en: { one: '{count} flight', other: '{count} flights' }, ru: { one: '{count} перелёт', few: '{count} перелёта', many: '{count} перелётов', other: '{count} перелёта' } },
  added: { en: { one: 'Added {count} flight', other: 'Added {count} flights' }, ru: { one: 'Добавлен {count} перелёт', few: 'Добавлено {count} перелёта', many: 'Добавлено {count} перелётов', other: 'Добавлено {count} перелёта' } },
  newCountries: { en: { one: '{count} new country', other: '{count} new countries' }, ru: { one: '{count} новая страна', few: '{count} новые страны', many: '{count} новых стран', other: '{count} новой страны' } },
  savedOf: { en: { one: 'Saved {count}', other: 'Saved {count}' }, ru: { one: 'Сохранён {count}', few: 'Сохранено {count}', many: 'Сохранено {count}', other: 'Сохранено {count}' } },
  retryFor: { en: { one: 'Try again for {count}', other: 'Try again for {count}' }, ru: { one: 'Повторить для {count}', few: 'Повторить для {count}', many: 'Повторить для {count}', other: 'Повторить для {count}' } },
  importN: { en: { one: 'Import {count}', other: 'Import {count}' }, ru: { one: 'Импортировать {count}', few: 'Импортировать {count}', many: 'Импортировать {count}', other: 'Импортировать {count}' } },
  aircraftSaveN: { en: { one: 'Save {count} aircraft', other: 'Save {count} aircraft' }, ru: { one: 'Сохранить {count} самолёт', few: 'Сохранить {count} самолёта', many: 'Сохранить {count} самолётов', other: 'Сохранить {count} самолёта' } },
  aircraftOffered: { en: { one: '{count} suggestion', other: '{count} suggestions' }, ru: { one: '{count} предложение', few: '{count} предложения', many: '{count} предложений', other: '{count} предложения' } },
  skipped: { en: { one: '{count} skipped', other: '{count} skipped' }, ru: { one: '{count} пропущен', few: '{count} пропущено', many: '{count} пропущено', other: '{count} пропущено' } },
  alreadySavedN: { en: { one: '{count} flight saved already', other: '{count} flights saved already' }, ru: { one: '{count} перелёт уже сохранён', few: '{count} перелёта уже сохранены', many: '{count} перелётов уже сохранены', other: '{count} перелёта уже сохранены' } },
} satisfies Record<string, CountForms>

export const count = (locale: Locale, key: keyof typeof COUNTS, n: number) => formatCount(locale, n, COUNTS[key])

export const STAGE_KEY: Record<BatchStage, Key> = { accepted: 'stageAccepted', recognizing: 'stageRecognizing', validating: 'stageValidating', review_ready: 'stageReady' }

export const FIELD_LABEL: Record<FieldName, Pair> = {
  date: p('Date', 'Дата'), origin: p('From (airport code)', 'Откуда (код аэропорта)'), destination: p('To (airport code)', 'Куда (код аэропорта)'),
  airline_iata: p('Airline code', 'Код авиакомпании'), flight_number: p('Flight number', 'Номер рейса'), aircraft_icao: p('Aircraft code', 'Код самолёта'),
  departure_time: p('Departure time', 'Время вылета'), arrival_time: p('Arrival time', 'Время прилёта'),
}
export const FIELD_HINT: Partial<Record<FieldName, Pair>> = {
  origin: p('Three letters, for example JFK', 'Три буквы, например JFK'), destination: p('Three letters, for example BOS', 'Три буквы, например BOS'),
  airline_iata: p('Two characters, for example AA', 'Два символа, например AA'), aircraft_icao: p('For example B738', 'Например B738'),
  departure_time: p('24-hour time, for example 09:30', 'Время в 24-часовом формате, например 09:30'), arrival_time: p('24-hour time, for example 11:45', 'Время в 24-часовом формате, например 11:45'),
}
export const FIELD_ERROR: Record<FieldError, Pair> = {
  dateRequired: p('Enter the date.', 'Введите дату.'), dateInvalid: p('Enter a real date.', 'Введите существующую дату.'),
  iata: p('Use a three-letter airport code.', 'Нужен трёхбуквенный код аэропорта.'), sameAirport: p('Choose a different airport.', 'Выберите другой аэропорт.'),
  unknownAirport: p('We do not know this airport code.', 'Мы не знаем такого кода аэропорта.'), airline: p('Use a two-character airline code.', 'Нужен двухсимвольный код авиакомпании.'),
  flightNumber: p('This is too long.', 'Слишком длинно.'), aircraft: p('Use two to four letters or digits.', 'От двух до четырёх букв или цифр.'),
  unknownAircraft: p('We do not know this aircraft code.', 'Мы не знаем такого кода самолёта.'), time: p('Use a time like 09:30.', 'Укажите время вроде 09:30.'),
}

export const BLOCK: Record<Readiness, Key> = { date: 'blockedDate', year: 'blockedYear', issue: 'blockedIssue' }

export interface FailureCopy { title: string; body: string }
export const FAILURE: Record<FailureKind, { en: FailureCopy; ru: FailureCopy }> = {
  quota: { en: { title: 'The recognition limit is used up', body: 'You have used all the recognitions available for now.' }, ru: { title: 'Лимит распознавания исчерпан', body: 'Вы использовали все доступные распознавания на сейчас.' } },
  rateLimit: { en: { title: 'Too many requests', body: 'Imports are limited for a short time to keep the service fair.' }, ru: { title: 'Слишком много запросов', body: 'Импорт ненадолго ограничен, чтобы сервис работал для всех.' } },
  unavailable: { en: { title: 'The recognition service is unavailable', body: 'It is not answering right now. Your document was not saved.' }, ru: { title: 'Сервис распознавания недоступен', body: 'Сейчас он не отвечает. Ваш документ не сохранён.' } },
  timeout: { en: { title: 'The service took too long', body: 'It did not answer in time. Trying again usually works.' }, ru: { title: 'Сервис отвечал слишком долго', body: 'Он не успел ответить. Обычно помогает повторить.' } },
  file: { en: { title: 'This file could not be read', body: 'Use a PDF, PNG or JPEG under 10 MB, or paste the text instead.' }, ru: { title: 'Не удалось прочитать файл', body: 'Используйте PDF, PNG или JPEG до 10 МБ или вставьте текст.' } },
  nothing: { en: { title: 'No flights found', body: 'Nothing in this document looked like a flight.' }, ru: { title: 'Перелёты не найдены', body: 'В этом документе не нашлось ничего похожего на перелёт.' } },
  offline: { en: { title: 'You appear to be offline', body: 'Check your connection and try again. Nothing was lost.' }, ru: { title: 'Похоже, нет подключения', body: 'Проверьте соединение и повторите. Ничего не потеряно.' } },
  inProgress: { en: { title: 'Another import is still running', body: 'Wait for it to finish, or open it.' }, ru: { title: 'Другой импорт ещё идёт', body: 'Дождитесь его завершения или откройте его.' } },
  batchLimit: { en: { title: 'Too many open imports', body: 'Finish or discard one of your unfinished imports to start another.' }, ru: { title: 'Слишком много открытых импортов', body: 'Завершите или отмените один из незавершённых импортов, чтобы начать новый.' } },
  expired: { en: { title: 'This import has expired', body: 'Imports are kept for 30 days. Start a new one.' }, ru: { title: 'Срок этого импорта истёк', body: 'Импорты хранятся 30 дней. Начните новый.' } },
  notFound: { en: { title: 'This import is not available', body: 'It was discarded or does not belong to this account.' }, ru: { title: 'Этот импорт недоступен', body: 'Он был отменён или не относится к этому аккаунту.' } },
  interrupted: { en: { title: 'Recognition was interrupted', body: 'It stopped before it finished. Start the import again with the same file.' }, ru: { title: 'Распознавание прервалось', body: 'Оно остановилось, не закончив. Начните импорт заново с тем же файлом.' } },
  truncated: { en: { title: 'Some flights were left out', body: 'The document has more flights than one import can hold. Import the rest separately.' }, ru: { title: 'Часть перелётов не вошла', body: 'В документе больше перелётов, чем помещается в один импорт. Остальное импортируйте отдельно.' } },
  rejected: { en: { title: 'No flight passed the checks', body: 'The flights found were not valid. Try another file or enter them by hand.' }, ru: { title: 'Ни один перелёт не прошёл проверку', body: 'Найденные перелёты оказались некорректными. Попробуйте другой файл или введите их вручную.' } },
  outputLimit: { en: { title: 'The document is too large to read in one go', body: 'Split it into smaller parts and import them one by one.' }, ru: { title: 'Документ слишком большой для одного раза', body: 'Разбейте его на части и импортируйте по очереди.' } },
}

export const ACTION: Record<FailureAction, Pair> = {
  retry: p('Try again', 'Повторить'), manual: p('Enter flights by hand', 'Ввести вручную'), otherFile: p('Choose another file', 'Другой файл'),
  pasteText: p('Paste text instead', 'Вставить текст'), newImport: p('Start a new import', 'Начать новый импорт'),
  openRunning: p('Open the running import', 'Открыть идущий импорт'), unfinished: p('Open an unfinished import', 'Открыть незавершённый импорт'),
}
export const UNFINISHED_EMPTY = p('No unfinished imports were found.', 'Незавершённых импортов не нашлось.')
export const UNFINISHED_ITEM = p('Open import', 'Открыть импорт')

export const ROW_FAILURE: Record<RowFailureKind, Pair> = {
  year: p('The year was not confirmed.', 'Год не подтверждён.'),
  duplicate: p('You already have a flight with this date and route.', 'У вас уже есть перелёт с этой датой и маршрутом.'),
  versionConflict: p('This flight changed elsewhere. Open it in review and check it.', 'Этот перелёт изменили в другом месте. Откройте его в проверке и проверьте.'),
  idempotencyConflict: p('This save clashed with an earlier one. Open it in review and try again.', 'Это сохранение совпало с предыдущим. Откройте рейс в проверке и повторите.'),
  alreadySaved: p('This flight was already saved.', 'Этот перелёт уже сохранён.'),
  flightDeleted: p('The saved flight was deleted. Restore it from review.', 'Сохранённый перелёт удалён. Верните его через проверку.'),
  invalid: p('The flight details were refused. Fix them in review.', 'Данные перелёта отклонены. Исправьте их в проверке.'),
  expired: p('This import has expired.', 'Срок этого импорта истёк.'),
  processing: p('Recognition is still running. Try again in a moment.', 'Распознавание ещё идёт. Повторите через минуту.'),
  missing: p('This flight is no longer part of the import.', 'Этого перелёта больше нет в импорте.'),
  transient: p('The service had a problem. Trying again is safe.', 'У сервиса возникла проблема. Повторить безопасно.'),
}
export const MANUAL_FAILED = p('This manual flight was not saved.', 'Этот рейс, добавленный вручную, не сохранён.')

export function relativeInstant(locale: Locale, iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
