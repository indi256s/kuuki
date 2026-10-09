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
  lead: p(
    'Turn a boarding pass, booking or screenshot into flights, and check each one before it is saved.',
    'Превратите посадочный талон, бронь или скриншот в перелёты и проверьте каждый до сохранения.',
  ),
  stepsLabel: p('Import steps', 'Шаги импорта'),
  stepSource: p('Source', 'Источник'),
  stepReview: p('Review', 'Проверка'),
  stepDone: p('Done', 'Готово'),
  stepCurrent: p('current step', 'текущий шаг'),

  dropTitle: p('Choose a file or drop it here', 'Выберите файл или перетащите его сюда'),
  dropHint: p(
    'Boarding pass, PDF or screenshot, up to 10 MB.',
    'Посадочный талон, PDF или скриншот, до 10 МБ.',
  ),
  dropPaste: p(
    'Paste a screenshot with ⌘V or Ctrl+V.',
    'Вставьте скриншот сочетанием ⌘V или Ctrl+V.',
  ),
  dropNow: p('Drop to add the file', 'Отпустите, чтобы добавить файл'),
  dropRemove: p('Remove', 'Удалить'),
  dropChosen: p('Selected file', 'Выбранный файл'),
  dropChange: p('Choose another file', 'Выбрать другой файл'),
  fileBad: p('Use a PDF, PNG or JPEG file.', 'Подойдёт файл PDF, PNG или JPEG.'),
  fileBig: p(
    'This file is over 10 MB. Choose a smaller one.',
    'Файл больше 10 МБ. Выберите файл поменьше.',
  ),
  fileRead: p(
    'This file could not be read. Choose it again.',
    'Не удалось прочитать файл. Выберите его ещё раз.',
  ),
  modeLabel: p('Source type', 'Тип источника'),
  modeFile: p('File', 'Файл'),
  modeText: p('Paste text', 'Вставить текст'),
  textLabel: p('Booking or itinerary text', 'Текст брони или маршрута'),
  textHint: p(
    'One flight per line is easiest. Dates with a year work best.',
    'Проще всего по одному перелёту на строку. Лучше всего работают даты с годом.',
  ),
  find: p('Find flights', 'Найти перелёты'),
  finding: p('Starting…', 'Запускаем…'),
  needFile: p('Choose a file first.', 'Сначала выберите файл.'),
  needText: p('Paste some text first.', 'Сначала вставьте текст.'),
  privacy: p(
    'The document is sent to a recognition service to find flights. Kuuki keeps only the flight details it finds, for 30 days, so you can come back to them. The file and pasted text are not kept.',
    'Документ отправляется в сервис распознавания, чтобы найти перелёты. Kuuki хранит только найденные данные перелётов, 30 дней, чтобы вы могли вернуться к ним. Файл и вставленный текст не сохраняются.',
  ),
  emailHelp: p('How to export flights from your email', 'Как выгрузить перелёты из почты'),
  // Provider-neutral: assistants rename their mail and calendar features often, so the help names the assistants, not the features.
  emailHelpBody: p(
    'Works with ChatGPT, Claude or Gemini. First connect your email and calendar to the assistant, then send it the prompt below and paste its reply under Paste text.',
    'Подойдёт ChatGPT, Claude или Gemini. Сначала подключите к нему почту и календарь, затем отправьте запрос ниже и вставьте ответ в режиме «Вставить текст».',
  ),
  importLimit: p(
    'One import keeps up to 100 flights. With a long history, ask for one or a few years at a time.',
    'За один импорт сохраняется до 100 перелётов. Если перелётов много, запрашивайте их по одному или нескольким годам.',
  ),
  copyPrompt: p('Copy the prompt', 'Скопировать запрос'),
  copied: p('Prompt copied', 'Запрос скопирован'),
  copyFailed: p(
    'Could not copy. Select the text and copy it by hand.',
    'Не удалось скопировать. Выделите текст и скопируйте вручную.',
  ),
  promptLabel: p('Prompt text', 'Текст запроса'),
  // The reply format is the one the server extraction reads most reliably (functions/api/import/_shared.ts):
  // a written year, IATA codes, one segment per line, no private booking details.
  prompt: p(
    'Search my email and calendar for all my flights, past and upcoming, across all years: booking confirmations, e-tickets, itineraries, check-in and boarding pass emails, and flight events in my calendar.\n\nIf you cannot access my email or calendar, say so in one sentence and stop. Do not guess or make up flights.\n\nWrite one line per flight in this format:\nYYYY-MM-DD | origin → destination | airline and flight number | departure-arrival\n\nExamples:\n2024-03-15 | JFK → LAX | American Airlines AA 123 | 08:30-11:45\n2024-03-22 | LAX → JFK | Delta DL 409 | 22:10-06:35+1\n\nRules:\n- Always write the full date with a four-digit year.\n- Use 3-letter IATA airport codes. If you do not know the code, write the city name.\n- Times are local at each airport, 24-hour, as shown in the booking. Add +1 when the arrival is on the next day.\n- Write ? for anything you cannot find.\n- Each leg of a connection and each direction of a return trip goes on a separate line.\n- List each flight once, even if it appears in several emails or in the calendar. If a flight was changed, use the latest details.\n- Leave out cancelled or refunded flights.\n- Sort from oldest to newest.\n- Do not include passenger names, booking references, ticket numbers, email addresses, frequent flyer numbers, prices or payment details.\n\nReply with only the list in one plain-text code block, with no other text.',
    'Найдите в моей почте и календаре все мои перелёты, прошедшие и предстоящие, за все годы: подтверждения бронирований, электронные билеты, маршрутные квитанции, письма о регистрации и посадочные талоны, а также события перелётов в календаре.\n\nЕсли у вас нет доступа к моей почте или календарю, скажите об этом одним предложением и остановитесь. Не угадывайте и не придумывайте перелёты.\n\nПишите по одному перелёту на строку в таком формате:\nГГГГ-ММ-ДД | откуда → куда | авиакомпания и номер рейса | вылет-прилёт\n\nПримеры:\n2024-03-15 | SVO → LED | Aeroflot SU 6 | 08:30-10:00\n2024-03-22 | LED → TBS | Georgian Airways A9 638 | 23:40-03:05+1\n\nПравила:\n- Всегда пишите полную дату с годом из четырёх цифр.\n- Используйте трёхбуквенные коды аэропортов IATA. Если код неизвестен, напишите название города.\n- Время местное для каждого аэропорта, в 24-часовом формате, как в брони. Если прилёт на следующий день, добавьте +1.\n- Если чего-то не удалось найти, ставьте ? на это место.\n- Каждый отрезок с пересадкой и каждое направление поездки туда и обратно — отдельная строка.\n- Указывайте каждый перелёт один раз, даже если он встречается в нескольких письмах или в календаре. Если рейс меняли, используйте последние данные.\n- Не включайте отменённые перелёты и перелёты с возвратом билета.\n- Сортируйте от самых ранних к самым поздним.\n- Не указывайте имена пассажиров, номера бронирований, номера билетов, адреса почты, номера бонусных карт, цены и платёжные данные.\n\nОтветьте только списком в одном блоке кода с обычным текстом, без других пояснений.',
  ),

  recognizing: p('Finding your flights', 'Ищем ваши перелёты'),
  sourceChip: p('Source', 'Источник'),
  textSource: p('Pasted text', 'Вставленный текст'),
  leaveSafe: p(
    'You can close this page. What is found stays in your Journal under waiting drafts.',
    'Страницу можно закрыть. Найденное останется в Журнале среди ожидающих черновиков.',
  ),
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
  reconnecting: p(
    'Connection lost. Showing the last saved result.',
    'Связь прервалась. Показан последний сохранённый результат.',
  ),
  loadFailed: p('Could not load this import.', 'Не удалось загрузить этот импорт.'),

  reviewTitle: p('Review flights', 'Проверка перелётов'),
  partialTitle: p('Partial result', 'Частичный результат'),
  partialNote: p(
    'Recognition stopped early. These flights were found before it stopped; check them and add anything missing by hand.',
    'Распознавание остановилось раньше. Эти перелёты найдены до остановки; проверьте их и добавьте недостающее вручную.',
  ),
  selectAll: p('Select all', 'Выбрать все'),
  duplicatesTitle: p('Already in your journal', 'Уже в журнале'),
  duplicatesNote: p(
    'These match a flight you already have. They are not selected.',
    'Совпадают с перелётом, который у вас уже есть. Они не выбраны.',
  ),
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
  editFailed: p(
    'Not saved yet. Your edit is kept here.',
    'Пока не сохранено. Ваша правка остаётся здесь.',
  ),
  editRejected: p(
    'The change was refused. Check the fields and save again.',
    'Изменение отклонено. Проверьте поля и сохраните ещё раз.',
  ),
  editConflict: p(
    'This flight changed elsewhere. Your edit is kept; save it again to apply it.',
    'Этот перелёт изменили в другом месте. Ваша правка сохранена; сохраните ещё раз, чтобы применить её.',
  ),
  retrySave: p('Try saving again', 'Сохранить ещё раз'),
  discardEdit: p('Discard my edit', 'Отменить мою правку'),
  saveRow: p('Save changes', 'Сохранить изменения'),
  yearConfirm: p('I checked the year', 'Я проверил(а) год'),
  yearMissing: p(
    'The document did not show a year. Enter the date and confirm the year before saving.',
    'В документе не указан год. Введите дату и подтвердите год перед сохранением.',
  ),
  yearUnconfirmed: p(
    'The document did not show a year. Check the date, then confirm the year.',
    'В документе не указан год. Проверьте дату, затем подтвердите год.',
  ),
  blockedDate: p('Add a date to include this flight.', 'Добавьте дату, чтобы включить этот рейс.'),
  blockedYear: p(
    'Confirm the year to include this flight.',
    'Подтвердите год, чтобы включить этот рейс.',
  ),
  blockedIssue: p('Fix this flight to include it.', 'Исправьте этот рейс, чтобы включить его.'),
  monthDayNote: p(
    'The document shows {date} without the year.',
    'В документе указано {date}, без года.',
  ),

  questionsTitle: p('Questions', 'Вопросы'),
  questionsEach: p('I will set each one', 'Укажу в каждом'),
  questionsApplying: p('Applying…', 'Применяем…'),
  questionsRetry: p('Try again', 'Повторить'),
  yearQuestion: p('Which year did you fly?', 'В каком году вы летели?'),
  yearBody: p(
    'The document shows only the day and month. One answer sets the year for all of them.',
    'В документе только день и месяц. Один ответ задаст год для всех.',
  ),
  yearOther: p('Another year', 'Другой год'),
  yearLabel: p('Year', 'Год'),
  yearApply: p('Apply', 'Применить'),
  yearInvalid: p('Enter a year from 1950 to {max}.', 'Введите год от 1950 до {max}.'),
  yearDone: p('Year {year}', 'Год {year}'),
  airlineQuestion: p('Save them without an airline?', 'Сохранить их без авиакомпании?'),
  airlineBody: p(
    'The source does not name it. You can add it later in the journal.',
    'В источнике её нет. Её можно добавить позже в журнале.',
  ),
  airlineAnswer: p('Save without airline', 'Сохранить без авиакомпании'),
  airlineDone: p('Without an airline', 'Без авиакомпании'),
  airportTitle: p('{city}: which airport?', '{city}: какой аэропорт?'),
  airportBody: p(
    'The source names the city, not the airport. Choose for each flight.',
    'В источнике указан город, а не аэропорт. Выберите для каждого перелёта.',
  ),
  statusQuestion: p('Did you take these flights?', 'Вы летели этими рейсами?'),
  statusBody: p(
    'The source suggests a cancellation, a refund, another passenger or conflicting details.',
    'В источнике есть признаки отмены, возврата, чужой брони или противоречий.',
  ),
  statusFlew: p('Flew', 'Летали'),
  statusNotFlew: p('Did not fly', 'Не летали'),
  statusSkipped: p('Skipped', 'Пропущен'),
  statusRestore: p('Bring back', 'Вернуть'),
  issueUnknownAirport: p(
    'One of the airports is not in our list.',
    'Одного из аэропортов нет в нашем списке.',
  ),
  issueUnknownAircraft: p(
    'The aircraft code is not in our list.',
    'Кода самолёта нет в нашем списке.',
  ),
  issueGeneric: p('Some fields need a correction.', 'Некоторые поля нужно исправить.'),
  noDate: p('No date', 'Нет даты'),
  barLabel: p('Import actions', 'Действия импорта'),
  importCount: p('Import', 'Импортировать'),
  importing: p('Saving flights…', 'Сохраняем перелёты…'),
  nothingChosen: p('Select at least one flight to import.', 'Выберите хотя бы один перелёт.'),
  unsavedBlock: p(
    'Some edits are not saved yet. Use “Save changes” on the flight you edited, or discard them first.',
    'Некоторые правки ещё не сохранены. Нажмите «Сохранить изменения» у изменённого рейса или отмените их.',
  ),
  pausedWhileSaving: p(
    'Saving your flights. Editing is paused until it finishes.',
    'Сохраняем перелёты. Правки приостановлены до завершения.',
  ),
  heldDone: p(
    'Your flights were saved, but some corrections are not saved yet. Save or discard them to see the summary.',
    'Перелёты сохранены, но некоторые правки ещё не сохранены. Сохраните или отмените их, чтобы увидеть итог.',
  ),
  unsavedDone: p(
    'Some edits on the review page are not saved yet. Go back to review to save or discard them, then try again.',
    'Некоторые правки на странице проверки ещё не сохранены. Вернитесь к проверке, сохраните или отмените их и повторите.',
  ),
  unsavedRow: p(
    'Changes not saved yet. Use “Save changes” to keep them; leaving this page loses only these changes.',
    'Изменения ещё не сохранены. Нажмите «Сохранить изменения», чтобы оставить их; если уйти со страницы, потеряются только они.',
  ),
  retention: p(
    'Kept until {date}. Flights you have not saved by then are removed.',
    'Хранится до {date}. Несохранённые к этому дню перелёты будут удалены.',
  ),
  sourceAgain: p(
    'Your document is not kept, so choose the file or paste the text again to try again.',
    'Документ не сохраняется, поэтому выберите файл или вставьте текст ещё раз.',
  ),
  cancelledNote: p(
    'You cancelled recognition. These flights were found before it stopped; check them and add anything missing by hand.',
    'Вы отменили распознавание. Эти перелёты найдены до остановки; проверьте их и добавьте недостающее вручную.',
  ),
  cancelReadFailed: p(
    'Recognition was cancelled, but the flights found so far could not be loaded. Reload the page to see them.',
    'Распознавание отменено, но найденные перелёты не удалось загрузить. Обновите страницу, чтобы увидеть их.',
  ),
  reviewRemaining: p('Review the remaining flights', 'Проверить оставшиеся перелёты'),
  retryOriginal: p('Retry original save', 'Повторить исходное сохранение'),
  checkedJournal: p(
    'I checked the journal — start a new save',
    'Журнал проверен — начать новое сохранение',
  ),
  unconfirmedTitle: p('Unconfirmed saves', 'Неподтверждённые сохранения'),
  unconfirmedLead: p(
    'These flights were sent from this browser, but no clear answer came back. Retrying the original save cannot add a flight twice. If you checked your journal instead, mark the save as checked.',
    'Эти перелёты отправлены из этого браузера, но чёткого ответа не пришло. Повтор исходного сохранения не добавит перелёт дважды. Если вы уже проверили журнал, отметьте это.',
  ),
  unconfirmedUnreadable: p(
    'The details of this save cannot be read. Check your journal, then mark it as checked.',
    'Данные этого сохранения не читаются. Проверьте журнал и отметьте, что он проверен.',
  ),
  unreadableSave: p('Unreadable save', 'Нечитаемое сохранение'),
  retryExpiredReason: p('The safe retry period has passed.', 'Срок безопасного повтора истёк.'),
  retryUnreadableReason: p('The saved details cannot be read.', 'Сохранённые данные не читаются.'),
  journalChecked: p('I checked the journal', 'Журнал проверен'),
  recoverySaved: p(
    'Saved: {flight}. It is in your journal now.',
    'Сохранено: {flight}. Перелёт уже в журнале.',
  ),
  recoverySettled: p(
    'Marked as checked: {flight}. If it is not in your journal, add it again.',
    'Отмечено как проверенное: {flight}. Если перелёта нет в журнале, добавьте его снова.',
  ),
  showHeldSave: p('Show the unconfirmed save', 'Показать неподтверждённое сохранение'),
  manualInvalid: p(
    'Fix the highlighted fields on the manual flights first.',
    'Сначала исправьте выделенные поля у рейсов, добавленных вручную.',
  ),
  cancelImport: p('Discard import', 'Отменить импорт'),
  discardTitle: p('Discard this import?', 'Отменить этот импорт?'),
  discardBody: p(
    'The found flights are removed. Nothing is added to your journal.',
    'Найденные перелёты будут удалены. В журнал ничего не добавится.',
  ),
  discardKeep: p('Keep reviewing', 'Продолжить проверку'),
  discardFailed: p(
    'Could not discard the import. Try again.',
    'Не удалось отменить импорт. Попробуйте ещё раз.',
  ),
  noRowsLeft: p(
    'Every flight from this import is saved or skipped.',
    'Все перелёты из этого импорта сохранены или пропущены.',
  ),

  savedHeading: p('Import finished', 'Импорт завершён'),
  partialSaved: p('Some flights were not saved', 'Не все перелёты сохранены'),
  newCountries: p('New stamps', 'Новые штампы'),
  stampsWaiting: p(
    'Totals are still updating. New stamps appear once they are ready.',
    'Итоги ещё обновляются. Новые штампы появятся, когда будут готовы.',
  ),
  stampsDelayed: p(
    'Totals are taking longer to update. Your flights are saved.',
    'Обновление итогов занимает больше времени. Перелёты сохранены.',
  ),
  failedList: p('Not saved', 'Не сохранено'),
  uncertainRow: p(
    'We did not get an answer for this flight. It may or may not be saved; trying again is safe.',
    'Мы не получили ответа по этому рейсу. Он мог сохраниться или нет; повторить безопасно.',
  ),
  unsentRow: p('Not sent yet.', 'Ещё не отправлено.'),
  backToReview: p('Back to review', 'Назад к проверке'),
  passport: p('Open Passport', 'Открыть паспорт'),
  journal: p('Go to Journal', 'В журнал'),
  importMore: p('Import more', 'Импортировать ещё'),
  identify: p('Identify aircraft', 'Определить самолёты'),
  checkingSaved: p('Checking what was saved…', 'Проверяем, что сохранилось…'),
  checkFailed: p(
    'Could not confirm what was saved. Reload to check.',
    'Не удалось проверить, что сохранилось. Обновите страницу.',
  ),

  aircraftTitle: p('Aircraft suggestions', 'Предложения по самолётам'),
  aircraftIntro: p(
    'AI classifies search results; these suggestions are not independently verified. Only ones with 70% confidence or more are offered. Schedule-based and unclear suggestions start unselected.',
    'ИИ классифицирует результаты поиска; эти предложения не проверены независимо. Показаны только те, где уверенность не ниже 70%. Предложения по расписанию и с неясным источником изначально не выбраны.',
  ),
  aircraftSearching: p('Looking for aircraft…', 'Ищем самолёты…'),
  aircraftSelectAll: p('Select all', 'Выбрать все'),
  aircraftDeselectAll: p('Deselect all', 'Снять выбор'),
  aircraftAccept: p('Save aircraft', 'Сохранить самолёты'),
  aircraftAccepting: p('Saving aircraft…', 'Сохраняем самолёты…'),
  aircraftNone: p(
    'No aircraft could be identified reliably.',
    'Не удалось надёжно определить ни одного самолёта.',
  ),
  aircraftSavedTag: p('Saved', 'Сохранено'),
  aircraftFailedTag: p('Not saved', 'Не сохранено'),
  aircraftUncertainTag: p('May not be saved', 'Возможно, не сохранено'),
  aircraftUncertainNote: p(
    'We did not get an answer. Check the journal, or try again; trying again is safe.',
    'Ответа не было. Проверьте журнал или повторите; повторить безопасно.',
  ),
  aircraftRetry: p('Try again for the rest', 'Повторить для остальных'),
  aircraftUnidentified: p('No suggestion', 'Без предложения'),
  aircraftReasonNone: p(
    'The service could not name an aircraft for this flight.',
    'Сервис не смог назвать самолёт для этого рейса.',
  ),
  aircraftReasonLow: p(
    'The service was not sure enough (under 70%). You can set the aircraft by hand in the journal.',
    'Сервис не уверен (ниже 70%). Самолёт можно указать вручную в журнале.',
  ),
  aircraftReasonMissing: p(
    'The service gave no answer for this flight.',
    'Сервис не ответил по этому рейсу.',
  ),
  aircraftSearchFailed: p('Aircraft search failed.', 'Поиск самолётов не удался.'),
  aircraftSearchRetry: p('Search again', 'Искать снова'),
  aircraftClose: p('Close', 'Закрыть'),
  aircraftEvidence: p('Evidence', 'Основание'),
  aircraftUnsure: p('Unconfirmed', 'Не подтверждено'),
  aircraftActual: p(
    'Search suggests an actual-flight record',
    'Поиск указывает на запись о выполненном рейсе',
  ),
  aircraftScheduled: p(
    'Based on a schedule; check before saving',
    'По расписанию; проверьте перед сохранением',
  ),
  aircraftBasisUnknown: p(
    'Source type unclear; check before saving',
    'Тип источника неясен; проверьте перед сохранением',
  ),
  aircraftRecordDate: p('Flight date in source', 'Дата рейса в источнике'),
  aircraftRegistration: p('Registration', 'Бортовой номер'),
  aircraftOperator: p('Operator', 'Эксплуатант'),
  aircraftSources: p('Sources to check', 'Источники для проверки'),
  aircraftSearchSuggestions: p(
    'Google Search Suggestions for aircraft research',
    'Поисковые подсказки Google для поиска самолёта',
  ),

  failureTitle: p('This import did not finish', 'Импорт не завершён'),
  retryAt: p('You can try again after', 'Попробовать снова можно после'),
  tipsTitle: p('What works well', 'Что подходит'),
  tips: p(
    'A boarding pass, a booking confirmation, an itinerary PDF, or a screenshot that shows dates and airports.',
    'Посадочный талон, подтверждение брони, PDF с маршрутом или скриншот, где видны даты и аэропорты.',
  ),
} as const

export type Key = keyof typeof S
export const tx = (locale: Locale, key: Key): string => S[key][locale]

export const COUNTS = {
  selected: {
    en: { one: '{count} selected', other: '{count} selected' },
    ru: {
      one: 'Выбран {count}',
      few: 'Выбрано {count}',
      many: 'Выбрано {count}',
      other: 'Выбрано {count}',
    },
  },
  ofTotal: {
    en: { one: 'of {count}', other: 'of {count}' },
    ru: { one: 'из {count}', few: 'из {count}', many: 'из {count}', other: 'из {count}' },
  },
  found: {
    en: { one: '{count} flight found', other: '{count} flights found' },
    ru: {
      one: 'Найден {count} перелёт',
      few: 'Найдено {count} перелёта',
      many: 'Найдено {count} перелётов',
      other: 'Найдено {count} перелёта',
    },
  },
  duplicates: {
    en: { one: '{count} flight', other: '{count} flights' },
    ru: {
      one: '{count} перелёт',
      few: '{count} перелёта',
      many: '{count} перелётов',
      other: '{count} перелёта',
    },
  },
  added: {
    en: { one: 'Added {count} flight', other: 'Added {count} flights' },
    ru: {
      one: 'Добавлен {count} перелёт',
      few: 'Добавлено {count} перелёта',
      many: 'Добавлено {count} перелётов',
      other: 'Добавлено {count} перелёта',
    },
  },
  newCountries: {
    en: { one: '{count} new country', other: '{count} new countries' },
    ru: {
      one: '{count} новая страна',
      few: '{count} новые страны',
      many: '{count} новых стран',
      other: '{count} новой страны',
    },
  },
  savedOf: {
    en: { one: 'Saved {count}', other: 'Saved {count}' },
    ru: {
      one: 'Сохранён {count}',
      few: 'Сохранено {count}',
      many: 'Сохранено {count}',
      other: 'Сохранено {count}',
    },
  },
  retryFor: {
    en: { one: 'Try again for {count}', other: 'Try again for {count}' },
    ru: {
      one: 'Повторить для {count}',
      few: 'Повторить для {count}',
      many: 'Повторить для {count}',
      other: 'Повторить для {count}',
    },
  },
  importN: {
    en: { one: 'Import {count}', other: 'Import {count}' },
    ru: {
      one: 'Импортировать {count}',
      few: 'Импортировать {count}',
      many: 'Импортировать {count}',
      other: 'Импортировать {count}',
    },
  },
  aircraftSaveN: {
    en: { one: 'Save {count} aircraft', other: 'Save {count} aircraft' },
    ru: {
      one: 'Сохранить {count} самолёт',
      few: 'Сохранить {count} самолёта',
      many: 'Сохранить {count} самолётов',
      other: 'Сохранить {count} самолёта',
    },
  },
  aircraftOffered: {
    en: { one: '{count} suggestion', other: '{count} suggestions' },
    ru: {
      one: '{count} предложение',
      few: '{count} предложения',
      many: '{count} предложений',
      other: '{count} предложения',
    },
  },
  skipped: {
    en: { one: '{count} skipped', other: '{count} skipped' },
    ru: {
      one: '{count} пропущен',
      few: '{count} пропущено',
      many: '{count} пропущено',
      other: '{count} пропущено',
    },
  },
  remaining: {
    en: {
      one: '{count} flight is still waiting in review.',
      other: '{count} flights are still waiting in review.',
    },
    ru: {
      one: 'В проверке остался {count} перелёт.',
      few: 'В проверке осталось {count} перелёта.',
      many: 'В проверке осталось {count} перелётов.',
      other: 'В проверке осталось {count} перелёта.',
    },
  },
  flightsN: {
    en: { one: '{count} flight', other: '{count} flights' },
    ru: {
      one: '{count} перелёт',
      few: '{count} перелёта',
      many: '{count} перелётов',
      other: '{count} перелёта',
    },
  },
  readyN: {
    en: { one: '{count} ready to import', other: '{count} ready to import' },
    ru: {
      one: 'Готово к импорту: {count}',
      few: 'Готово к импорту: {count}',
      many: 'Готово к импорту: {count}',
      other: 'Готово к импорту: {count}',
    },
  },
  questionsN: {
    en: { one: '{count} question', other: '{count} questions' },
    ru: {
      one: '{count} вопрос',
      few: '{count} вопроса',
      many: '{count} вопросов',
      other: '{count} вопроса',
    },
  },
  forFlights: {
    en: { one: 'for {count} flight', other: 'for {count} flights' },
    ru: {
      one: 'на {count} перелёт',
      few: 'на {count} перелёта',
      many: 'на {count} перелётов',
      other: 'на {count} перелёта',
    },
  },
  yearTitle: {
    en: { one: '{count} flight shows no year', other: '{count} flights show no year' },
    ru: {
      one: 'У {count} перелёта не виден год',
      few: 'У {count} перелётов не виден год',
      many: 'У {count} перелётов не виден год',
      other: 'У {count} перелёта не виден год',
    },
  },
  airlineTitle: {
    en: { one: '{count} flight has no airline', other: '{count} flights have no airline' },
    ru: {
      one: 'У {count} перелёта не указана авиакомпания',
      few: 'У {count} перелётов не указана авиакомпания',
      many: 'У {count} перелётов не указана авиакомпания',
      other: 'У {count} перелёта не указана авиакомпания',
    },
  },
  statusTitle: {
    en: { one: 'Check the status of {count} flight', other: 'Check the status of {count} flights' },
    ru: {
      one: 'Проверьте статус {count} перелёта',
      few: 'Проверьте статус {count} перелётов',
      many: 'Проверьте статус {count} перелётов',
      other: 'Проверьте статус {count} перелёта',
    },
  },
  notApplied: {
    en: { one: 'Not applied to {count} flight', other: 'Not applied to {count} flights' },
    ru: {
      one: 'Не применено к {count} перелёту',
      few: 'Не применено к {count} перелётам',
      many: 'Не применено к {count} перелётам',
      other: 'Не применено к {count} перелёта',
    },
  },
  alreadySavedN: {
    en: { one: '{count} flight saved already', other: '{count} flights saved already' },
    ru: {
      one: '{count} перелёт уже сохранён',
      few: '{count} перелёта уже сохранены',
      many: '{count} перелётов уже сохранены',
      other: '{count} перелёта уже сохранены',
    },
  },
} satisfies Record<string, CountForms>

export const count = (locale: Locale, key: keyof typeof COUNTS, n: number) =>
  formatCount(locale, n, COUNTS[key])

export const STAGE_KEY: Record<BatchStage, Key> = {
  accepted: 'stageAccepted',
  recognizing: 'stageRecognizing',
  validating: 'stageValidating',
  review_ready: 'stageReady',
}

export const FIELD_LABEL: Record<FieldName, Pair> = {
  date: p('Date', 'Дата'),
  origin: p('From (airport code)', 'Откуда (код аэропорта)'),
  destination: p('To (airport code)', 'Куда (код аэропорта)'),
  airline_iata: p('Airline code', 'Код авиакомпании'),
  flight_number: p('Flight number', 'Номер рейса'),
  aircraft_icao: p('Aircraft code', 'Код самолёта'),
  departure_time: p('Departure time', 'Время вылета'),
  arrival_time: p('Arrival time', 'Время прилёта'),
}
export const FIELD_HINT: Partial<Record<FieldName, Pair>> = {
  origin: p('Three letters, for example JFK', 'Три буквы, например JFK'),
  destination: p('Three letters, for example BOS', 'Три буквы, например BOS'),
  airline_iata: p('Two characters, for example AA', 'Два символа, например AA'),
  aircraft_icao: p('For example B738', 'Например B738'),
  departure_time: p(
    '24-hour time, for example 09:30',
    'Время в 24-часовом формате, например 09:30',
  ),
  arrival_time: p('24-hour time, for example 11:45', 'Время в 24-часовом формате, например 11:45'),
}
export const FIELD_ERROR: Record<FieldError, Pair> = {
  dateRequired: p('Enter the date.', 'Введите дату.'),
  dateInvalid: p('Enter a real date.', 'Введите существующую дату.'),
  iata: p('Use a three-letter airport code.', 'Нужен трёхбуквенный код аэропорта.'),
  sameAirport: p('Choose a different airport.', 'Выберите другой аэропорт.'),
  unknownAirport: p('We do not know this airport code.', 'Мы не знаем такого кода аэропорта.'),
  airline: p('Use a two-character airline code.', 'Нужен двухсимвольный код авиакомпании.'),
  flightNumber: p('This is too long.', 'Слишком длинно.'),
  aircraft: p('Use two to four letters or digits.', 'От двух до четырёх букв или цифр.'),
  unknownAircraft: p('We do not know this aircraft code.', 'Мы не знаем такого кода самолёта.'),
  time: p('Use a time like 09:30.', 'Укажите время вроде 09:30.'),
}

export const BLOCK: Record<Readiness, Key> = {
  date: 'blockedDate',
  year: 'blockedYear',
  issue: 'blockedIssue',
}

export interface FailureCopy {
  title: string
  body: string
}
export const FAILURE: Record<FailureKind, { en: FailureCopy; ru: FailureCopy }> = {
  quota: {
    en: {
      title: 'The recognition limit is used up',
      body: 'You have used all the recognitions available for now.',
    },
    ru: {
      title: 'Лимит распознавания исчерпан',
      body: 'Вы использовали все доступные распознавания на сейчас.',
    },
  },
  rateLimit: {
    en: {
      title: 'Too many requests',
      body: 'Imports are limited for a short time to keep the service fair.',
    },
    ru: {
      title: 'Слишком много запросов',
      body: 'Импорт ненадолго ограничен, чтобы сервис работал для всех.',
    },
  },
  unavailable: {
    en: {
      title: 'The recognition service is unavailable',
      body: 'It is not answering right now. Your document was not saved.',
    },
    ru: {
      title: 'Сервис распознавания недоступен',
      body: 'Сейчас он не отвечает. Ваш документ не сохранён.',
    },
  },
  timeout: {
    en: {
      title: 'The service took too long',
      body: 'It did not answer in time. Trying again usually works.',
    },
    ru: {
      title: 'Сервис отвечал слишком долго',
      body: 'Он не успел ответить. Обычно помогает повторить.',
    },
  },
  file: {
    en: {
      title: 'This file could not be read',
      body: 'Use a PDF, PNG or JPEG under 10 MB, or paste the text instead.',
    },
    ru: {
      title: 'Не удалось прочитать файл',
      body: 'Используйте PDF, PNG или JPEG до 10 МБ или вставьте текст.',
    },
  },
  nothing: {
    en: { title: 'No flights found', body: 'Nothing in this document looked like a flight.' },
    ru: {
      title: 'Перелёты не найдены',
      body: 'В этом документе не нашлось ничего похожего на перелёт.',
    },
  },
  offline: {
    en: {
      title: 'You appear to be offline',
      body: 'Check your connection and try again. Nothing was lost.',
    },
    ru: {
      title: 'Похоже, нет подключения',
      body: 'Проверьте соединение и повторите. Ничего не потеряно.',
    },
  },
  inProgress: {
    en: { title: 'Another import is still running', body: 'Wait for it to finish, or open it.' },
    ru: { title: 'Другой импорт ещё идёт', body: 'Дождитесь его завершения или откройте его.' },
  },
  batchLimit: {
    en: {
      title: 'Too many open imports',
      body: 'Finish or discard one of your unfinished imports to start another.',
    },
    ru: {
      title: 'Слишком много открытых импортов',
      body: 'Завершите или отмените один из незавершённых импортов, чтобы начать новый.',
    },
  },
  expired: {
    en: {
      title: 'This import has expired',
      body: 'Imports are kept for 30 days. Start a new one.',
    },
    ru: { title: 'Срок этого импорта истёк', body: 'Импорты хранятся 30 дней. Начните новый.' },
  },
  notFound: {
    en: {
      title: 'This import is not available',
      body: 'It was discarded or does not belong to this account.',
    },
    ru: {
      title: 'Этот импорт недоступен',
      body: 'Он был отменён или не относится к этому аккаунту.',
    },
  },
  interrupted: {
    en: {
      title: 'Recognition was interrupted',
      body: 'It stopped before it finished. Start the import again with the same file.',
    },
    ru: {
      title: 'Распознавание прервалось',
      body: 'Оно остановилось, не закончив. Начните импорт заново с тем же файлом.',
    },
  },
  truncated: {
    en: {
      title: 'Some flights were left out',
      body: 'The document has more flights than one import can hold. Import the rest separately.',
    },
    ru: {
      title: 'Часть перелётов не вошла',
      body: 'В документе больше перелётов, чем помещается в один импорт. Остальное импортируйте отдельно.',
    },
  },
  rejected: {
    en: {
      title: 'No flight passed the checks',
      body: 'The flights found were not valid. Try another file or enter them by hand.',
    },
    ru: {
      title: 'Ни один перелёт не прошёл проверку',
      body: 'Найденные перелёты оказались некорректными. Попробуйте другой файл или введите их вручную.',
    },
  },
  outputLimit: {
    en: {
      title: 'The document is too large to read in one go',
      body: 'Split it into smaller parts and import them one by one.',
    },
    ru: {
      title: 'Документ слишком большой для одного раза',
      body: 'Разбейте его на части и импортируйте по очереди.',
    },
  },
}

export const ACTION: Record<FailureAction, Pair> = {
  retry: p('Try again', 'Повторить'),
  manual: p('Enter flights by hand', 'Ввести вручную'),
  otherFile: p('Choose another file', 'Другой файл'),
  pasteText: p('Paste text instead', 'Вставить текст'),
  newImport: p('Start a new import', 'Начать новый импорт'),
  openRunning: p('Open the running import', 'Открыть идущий импорт'),
  unfinished: p('Open an unfinished import', 'Открыть незавершённый импорт'),
}
export const UNFINISHED_EMPTY = p(
  'No unfinished imports were found.',
  'Незавершённых импортов не нашлось.',
)
export const UNFINISHED_ITEM = p('Open import', 'Открыть импорт')

export const ROW_FAILURE: Record<RowFailureKind, Pair> = {
  year: p('The year was not confirmed.', 'Год не подтверждён.'),
  duplicate: p(
    'You already have a flight with this date and route.',
    'У вас уже есть перелёт с этой датой и маршрутом.',
  ),
  versionConflict: p(
    'This flight changed elsewhere. Open it in review and check it.',
    'Этот перелёт изменили в другом месте. Откройте его в проверке и проверьте.',
  ),
  idempotencyConflict: p(
    'This save clashed with an earlier one. Open it in review and try again.',
    'Это сохранение совпало с предыдущим. Откройте рейс в проверке и повторите.',
  ),
  alreadySaved: p('This flight was already saved.', 'Этот перелёт уже сохранён.'),
  flightDeleted: p(
    'The saved flight was deleted. Restore it from review.',
    'Сохранённый перелёт удалён. Верните его через проверку.',
  ),
  invalid: p(
    'The flight details were refused. Fix them in review.',
    'Данные перелёта отклонены. Исправьте их в проверке.',
  ),
  expired: p('This import has expired.', 'Срок этого импорта истёк.'),
  processing: p(
    'Recognition is still running. Try again in a moment.',
    'Распознавание ещё идёт. Повторите через минуту.',
  ),
  missing: p(
    'This flight is no longer part of the import.',
    'Этого перелёта больше нет в импорте.',
  ),
  transient: p(
    'The service had a problem. Trying again is safe.',
    'У сервиса возникла проблема. Повторить безопасно.',
  ),
}
export type ManualFailureKind =
  | 'refused'
  | 'duplicate'
  | 'uncertain'
  | 'unconfirmed'
  | 'expired'
  | 'settled'
/** What happened to a flight added by hand, in the words the member needs to choose the next step. */
export const MANUAL_FAILURE: Record<ManualFailureKind, Pair> = {
  settled: p(
    'The original save was settled or replaced elsewhere. Check your journal before starting a new save.',
    'Исходное сохранение уже завершено или заменено в другом окне. Проверьте журнал, прежде чем начать новое сохранение.',
  ),
  refused: p(
    'The service refused these details, so nothing was saved. Fix the fields and save again.',
    'Сервис отклонил эти данные, поэтому ничего не сохранено. Исправьте поля и сохраните ещё раз.',
  ),
  duplicate: p(
    'A save of this same flight is still unconfirmed, so this one was not sent. Open that save to retry it or mark it as checked in your journal, then try again.',
    'Сохранение точно такого же рейса пока не подтверждено, поэтому этот рейс не отправлен. Откройте то сохранение, повторите его или отметьте, что журнал проверен, затем попробуйте снова.',
  ),
  uncertain: p(
    'We did not get a clear answer, so this flight may or may not be saved. Retry the original save, or check your journal first.',
    'Мы не получили чёткого ответа, поэтому рейс мог сохраниться или нет. Повторите исходное сохранение или сначала проверьте журнал.',
  ),
  unconfirmed: p(
    'An earlier save of this flight is unconfirmed, so the changed details were not sent. Retry the original save, or check your journal and start a new save.',
    'Предыдущее сохранение этого рейса не подтверждено, поэтому изменённые данные не отправлены. Повторите исходное сохранение или проверьте журнал и начните новое.',
  ),
  expired: p(
    'A safe retry is no longer possible for this flight. Check your journal, then start a new save.',
    'Безопасный повтор для этого рейса уже невозможен. Проверьте журнал и начните новое сохранение.',
  ),
}
export const MANUAL_ROW_RETRYABLE: Record<ManualFailureKind, boolean> = {
  settled: false,
  refused: false,
  duplicate: false,
  uncertain: true,
  unconfirmed: false,
  expired: false,
}

export function relativeInstant(locale: Locale, iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
