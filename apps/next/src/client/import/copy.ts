// Every import string, written in English and Russian together (Russian addresses the member as «вы»).
// Counts use real plural forms. Server messages are never shown: causes come from import-errors.ts kinds and codes.
import { formatCount, type CountForms, type Locale } from '../../lib/format'
import { AIRCRAFT_RESULT } from './aircraft-result-copy'
import type { FailureAction, FailureKind } from './import-errors'
import type { RowFailureKind } from './import-errors'
import type { FieldError, FieldName, Readiness } from './review-model'
import type { BatchStage } from './import-types'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })

/**
 * The reply shape the prompt asks for, kept as one string so the prompt and the parser grammar
 * (functions/api/import/_text.ts) are tested against the same text (prompt-contract.test.ts).
 */
export const PROMPT_EXAMPLE = p(
  [
    'KUUKI FLIGHTS v2',
    '2024-03-15 | JFK → LAX | American Airlines AA 123 | 08:30 → 11:45',
    '2024-03-22 | LAX → JFK | Delta DL 409 | 22:10 → 06:35+1',
    '2024-06-02 (calendar entry) | LHR → AMS | KLM KL 1000',
    '2025-01-10 | JFK → LHR | British Airways BA 178 | 19:00 → 07:00+1 [maybe cancelled]',
    'Partial dates / incomplete records (1)',
    'Undated | SVO → LED | Aeroflot SU 6',
  ].join('\n'),
  [
    'KUUKI FLIGHTS v2',
    '2024-03-15 | SVO → LED | Aeroflot SU 6 | 08:30 → 10:00',
    '2024-03-22 | LED → TBS | Georgian Airways A9 638 | 23:40 → 03:05+1',
    '2024-06-02 (calendar entry) | LED → SVO | Pobeda DP 402',
    '2025-01-10 | SVO → IST | Turkish Airlines TK 416 | 18:00 → 21:30 [maybe cancelled]',
    'Partial dates / incomplete records (1)',
    'Undated | LED → AER | Aeroflot SU 1190',
  ].join('\n'),
)

export const S = {
  eyebrow: p('Journal', 'Журнал'),
  title: p('Import flights', 'Импорт перелётов'),
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
    'The document is sent to recognition and checking services to find flights and check their details. Kuuki keeps only the flight details it finds, for 30 days, so you can come back to them. The file and pasted text are not kept.',
    'Документ отправляется в сервисы распознавания и проверки, чтобы найти перелёты и проверить данные. Kuuki хранит только найденные данные перелётов, 30 дней, чтобы вы могли вернуться к ним. Файл и вставленный текст не сохраняются.',
  ),
  qaTitle: p('Add a boarding pass', 'Добавить посадочный'),
  qaLead: p(
    'Take a photo or choose a screenshot or PDF. Kuuki reads the barcode and shows the flight for you to check.',
    'Сфотографируйте талон или выберите скриншот или PDF. Kuuki прочитает штрихкод и покажет рейс, чтобы вы его проверили.',
  ),
  qaPhoto: p('Take photo', 'Сфотографировать'),
  qaChoose: p('Choose screenshot or PDF', 'Выбрать скриншот или PDF'),
  qaActionsLabel: p('Boarding pass source', 'Источник посадочного талона'),
  qaReading: p('Reading the barcode…', 'Читаем штрихкод…'),
  qaLocalNote: p(
    'Kuuki reads the barcode on this device first. If it can, only the flight details are saved for your review. The photo or file is not uploaded.',
    'Сначала Kuuki читает штрихкод на этом устройстве. Если получится, для проверки сохраняются только данные рейса, а фото или файл не загружаются.',
  ),
  qaNoBarcode: p(
    'We could not find a boarding pass barcode in this file.',
    'Мы не нашли в этом файле штрихкод посадочного талона.',
  ),
  qaNotPass: p(
    'This file has a code, but it is not a boarding pass.',
    'В этом файле есть код, но это не посадочный талон.',
  ),
  qaUnsupported: p(
    'This browser could not read the barcode here.',
    'Этот браузер не смог прочитать штрихкод здесь.',
  ),
  qaUploadNote: p(
    'If you continue, this document is uploaded to Kuuki’s online recognition to find your flights. The file is not stored. The flight details it finds wait for your review for up to 30 days, then unsaved ones are removed.',
    'Если продолжить, документ будет загружен в онлайн-распознавание Kuuki, чтобы найти ваши перелёты. Файл не сохраняется. Найденные данные перелётов ждут вашей проверки до 30 дней, затем несохранённые удаляются.',
  ),
  qaPartialNote: p(
    'Some flights on this pass could not be read from the barcode. You can upload the document to look for the rest.',
    'Не все рейсы на этом талоне удалось прочитать со штрихкода. Чтобы поискать остальные, можно загрузить документ.',
  ),
  qaUpload: p('Upload for recognition', 'Отправить на распознавание'),
  qaUploading: p('Preparing…', 'Готовим…'),
  qaManual: p('Enter manually', 'Ввести вручную'),
  qaGeneral: p('Upload a booking or PDF', 'Загрузить бронь или PDF'),
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
    `Find every flight I have taken or booked, across all years, in my email and calendar: booking confirmations, e-tickets, itineraries, check-in and boarding pass emails, and flight events in the calendar.

If you cannot access my email or calendar, say so in one sentence and stop; do not guess.

Otherwise reply with one plain-text code block and nothing else. Its first line is exactly KUUKI FLIGHTS v2. Each line after it is one flight leg:
YYYY-MM-DD | ORIGIN → DESTINATION | Airline FL 123 | 08:30 → 11:45

Example (the shape only, not my flights):
${PROMPT_EXAMPLE.en}

Rules:
- Write the date as YYYY-MM-DD with the full year. When the only source is a calendar event, write (calendar entry) right after the date.
- Write airports as 3-letter IATA codes, or the city name when you do not know the code.
- Write times as local 24-hour times. Put +1 right after an arrival on the next day (06:35+1). Leave out a time or flight number you cannot find.
- Put a flight with no known date on a line starting with Undated, and group such lines under the heading "Partial dates / incomplete records (N)", where N is the number of lines below it.
- Put flights booked for someone else, or whose ownership you cannot settle, under the heading "Other-passenger bookings or conflicting ownership (N)" after the main list.
- Add a short note in square brackets at the end of a line when something about that flight is in doubt, for example [maybe cancelled].
- Leave out flights that were cancelled or refunded. List a flight you cannot confirm either way with [maybe cancelled].
- Give each flight once, with its latest details if it was changed, one leg per line (each leg of a connection, each direction of a return trip).
- Sort from oldest to newest.
- Keep each line to what the format shows: no passenger names, booking references, ticket numbers, email addresses, frequent flyer numbers, prices or payment details.`,
    `Найдите в моей почте и календаре все перелёты, которые я совершил или забронировал, за все годы: подтверждения бронирований, электронные билеты, маршрутные квитанции, письма о регистрации и посадочные талоны, а также события перелётов в календаре.

Если у вас нет доступа к моей почте или календарю, скажите об этом одним предложением и остановитесь; не угадывайте.

Иначе ответьте одним блоком кода с обычным текстом и ничем больше. Его первая строка ровно KUUKI FLIGHTS v2. Каждая следующая строка — один перелёт:
ГГГГ-ММ-ДД | ОТКУДА → КУДА | Авиакомпания FL 123 | 08:30 → 11:45

Пример (только формат, это не мои перелёты):
${PROMPT_EXAMPLE.ru}

Правила:
- Пишите дату как ГГГГ-ММ-ДД, с полным годом. Если единственный источник — событие в календаре, сразу после даты добавьте (calendar entry).
- Пишите аэропорты трёхбуквенными кодами IATA или названием города, если код вам неизвестен.
- Пишите время местное, в 24-часовом формате. Если прилёт на следующий день, сразу после времени прилёта добавьте +1 (06:35+1). Время или номер рейса, которых вы не нашли, опустите.
- Перелёт без известной даты пишите в строке, которая начинается со слова Undated, и собирайте такие строки под заголовком «Partial dates / incomplete records (N)», где N — число строк под ним.
- Перелёты, забронированные для другого человека или с неясной принадлежностью, соберите после основного списка под заголовком «Other-passenger bookings or conflicting ownership (N)».
- Если что-то в перелёте вызывает сомнение, добавьте в конец строки короткую заметку в квадратных скобках, например [maybe cancelled].
- Отменённые и возвращённые перелёты не включайте. Перелёт, судьбу которого вы не можете подтвердить, укажите с пометкой [maybe cancelled].
- Указывайте каждый перелёт один раз, с последними данными, если рейс меняли, по одному отрезку на строку (каждый отрезок пересадки, каждое направление поездки туда и обратно).
- Сортируйте от самых ранних к самым поздним.
- Оставляйте в строке только то, что требует формат: без имён пассажиров, номеров бронирований, номеров билетов, адресов почты, номеров бонусных карт, цен и платёжных данных.`,
  ),

  sourceChip: p('Source', 'Источник'),
  textSource: p('Pasted text', 'Вставленный текст'),
  leaveSafe: p(
    'You can close this page. What is found stays in your Journal under waiting drafts.',
    'Страницу можно закрыть. Найденное останется в Журнале среди ожидающих черновиков.',
  ),
  progressBound: p(
    'You can leave this page. We’ll let you know when your flights are ready to review.',
    'Можно уйти с этой страницы. Сообщим, когда перелёты будут готовы к проверке.',
  ),
  cancelRun: p('Cancel', 'Отменить'),
  cancelling: p('Cancelling…', 'Отменяем…'),
  cancelFailed: p('Could not cancel. Try again.', 'Не удалось отменить. Попробуйте ещё раз.'),
  stageAccepted: p('Received', 'Получено'),
  stagePreparing: p('Preparing import', 'Готовим импорт'),
  stageWaiting: p('Waiting to read', 'Ожидаем распознавания'),
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
  readFromBarcode: p('Read from the barcode', 'Прочитано со штрихкода'),
  notVerified: p(
    'Not verified against the source. Check the details before selecting this flight.',
    'Данные не подтверждены источником. Проверьте их, прежде чем выбрать перелёт.',
  ),
  notVerifiedSave: p(
    'Check the details against the document before saving.',
    'Сверьте данные с документом перед сохранением.',
  ),
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
  blockedFlown: p(
    'Confirm that you took this flight to include it.',
    'Подтвердите, что вы летели этим рейсом, чтобы включить его.',
  ),
  blockedIssue: p('Fix this flight to include it.', 'Исправьте этот рейс, чтобы включить его.'),
  yearToConfirm: p('Year to confirm', 'Нужно указать год'),
  ordinalDay: p('Day {day} of the year', '{day}-й день года'),
  ordinalNote: p(
    'The pass gives only the day of the year, so the year needs your confirmation.',
    'В талоне указан только день года, поэтому год нужно подтвердить.',
  ),
  monthDayNote: p(
    'The document shows {date} without the year.',
    'В документе указано {date}, без года.',
  ),

  questionsTitle: p('Questions', 'Вопросы'),
  questionsEach: p("I'll set each one", 'Укажу для каждого'),
  questionsEachAirport: p('Set them in the list', 'Укажу в списке'),
  questionsApplying: p('Applying…', 'Применяем…'),
  questionsRetry: p('Try again', 'Повторить'),
  yearQuestion: p('Which year did you fly?', 'В каком году вы летели?'),
  yearBody: p('The document shows only the day and month.', 'В документе только день и месяц.'),
  yearOrdinalBody: p(
    'The pass records the day of the year, not the year itself.',
    'В талоне записан день года, а самого года нет.',
  ),
  yearForAll: p('One answer sets the year for all of them.', 'Один ответ задаст год для всех.'),
  yearNoSuchDay: p(
    'There is no such day in {year}. Try another year.',
    'В {year} году такого дня нет. Попробуйте другой год.',
  ),
  yearOther: p('Another year', 'Другой год'),
  yearLabel: p('Year', 'Год'),
  yearApply: p('Apply', 'Применить'),
  yearInvalid: p('Enter a year from 1950 to {max}.', 'Введите год от 1950 до {max}.'),
  yearDone: p('Year {year}', 'Год {year}'),
  airlineQuestion: p('Save them without an airline?', 'Сохранить их без авиакомпании?'),
  airlineBody: p(
    'The source does not name it. You can add it later in the journal.',
    'В источнике её нет — добавите позже в журнале.',
  ),
  airlineAnswer: p('Save without airline', 'Сохранить без авиакомпании'),
  airlineDone: p('Without an airline', 'Без авиакомпании'),
  airportTitle: p('{city}: which airport?', '{city}: какой аэропорт?'),
  airportBody: p(
    'The source names the city, not the airport. Choose for each flight.',
    'В источнике указан город, а не аэропорт. Выберите для каждого перелёта.',
  ),
  flownQuestion: p('Have you taken this flight?', 'Вы уже летели этим рейсом?'),
  flownBody: p(
    'A pass does not prove you flew. Only a yes lets this flight be saved to your journal.',
    'Талон не доказывает, что вы летели. Сохранить рейс в журнал можно только после ответа «да».',
  ),
  flownYes: p('Yes, I flew', 'Да, летел(а)'),
  flownNotYet: p('Not yet', 'Ещё нет'),
  flownNotYetNote: p(
    'Not yet. It stays in review for later.',
    'Ещё нет. Рейс остаётся в проверке — вернётесь к нему позже.',
  ),
  finishLater: p('Finish later', 'Закончить позже'),
  finishLaterNote: p(
    'Your flights stay in review until {date}. Open them from your journal to finish.',
    'Рейсы остаются в проверке до {date}. Откройте их в журнале, чтобы закончить.',
  ),
  finishLaterBlocked: p(
    'Save or discard your edits first, so nothing is lost.',
    'Сначала сохраните или отмените правки, чтобы ничего не потерялось.',
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
  issueNoOrigin: p('departure missing', 'нет аэропорта вылета'),
  issueNoDestination: p('arrival missing', 'нет аэропорта прилёта'),
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
  readyNote: p('Answered flights join as you go.', 'Отвеченные сразу попадают в готовые.'),
  nothingChosen: p('Select at least one flight to import.', 'Выберите хотя бы один перелёт.'),
  unsavedBlock: p(
    'Some edits are not saved yet. Use “Save changes” on the flight you edited, or discard them first.',
    'Некоторые правки ещё не сохранены. Нажмите «Сохранить изменения» у изменённого рейса или отмените их.',
  ),
  pausedWhileSaving: p(
    'Editing is paused until it finishes. Your answers are safe.',
    'Правки на паузе до конца сохранения. Ответы не потеряются.',
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
    'Импорт хранится до {date}. Несохранённые к этому дню перелёты будут удалены.',
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
  retentionDone: p('Kept until {date}, then removed.', 'Хранятся до {date}, затем удаляются.'),
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
  doneNote: p(
    'The paperwork took longer than some of the flights.',
    'Бумажная волокита заняла больше времени, чем некоторые перелёты.',
  ),
  summaryAnd: p('and', 'и'),
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
  ...AIRCRAFT_RESULT,
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

/** The floating import dock in the member shell. Counts are in COUNTS. */
export const DOCK = {
  label: p('Imports', 'Импорт'),
  readingSub: p(
    'We’ll let you know when it’s ready to review.',
    'Сообщим, когда можно будет проверить.',
  ),
  review: p('Review', 'Проверить'),
  tryAgain: p('Try again', 'Ещё раз'),
  yourFile: p('your file', 'ваш файл'),
  yourText: p('your text', 'ваш текст'),
  hide: p('Hide', 'Скрыть'),
  open: p('Show imports', 'Показать импорт'),
  cancelReading: p('Cancel reading', 'Остановить чтение'),
  recent: p('Found last', 'Последние найденные'),
}

export type Key = keyof typeof S
export const tx = (locale: Locale, key: Key): string => S[key][locale]

export const COUNTS = {
  saveSelected: {
    en: { one: 'Save {count} flight', other: 'Save {count} flights' },
    ru: {
      one: 'Сохранить {count} перелёт',
      few: 'Сохранить {count} перелёта',
      many: 'Сохранить {count} перелётов',
      other: 'Сохранить {count} перелёта',
    },
  },
  savedFlights: {
    en: { one: '{count} flight saved', other: '{count} flights saved' },
    ru: {
      one: 'Сохранён {count} перелёт',
      few: 'Сохранено {count} перелёта',
      many: 'Сохранено {count} перелётов',
      other: 'Сохранено {count} перелёта',
    },
  },
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
  stillInReview: {
    en: { one: '{count} still in review →', other: '{count} still in review →' },
    ru: {
      one: 'В проверке ещё {count} →',
      few: 'В проверке ещё {count} →',
      many: 'В проверке ещё {count} →',
      other: 'В проверке ещё {count} →',
    },
  },
  flightsAdded: {
    en: { one: 'flight added', other: 'flights added' },
    ru: {
      one: 'перелёт добавлен',
      few: 'перелёта добавлено',
      many: 'перелётов добавлено',
      other: 'перелёта добавлено',
    },
  },
  needYou: {
    en: { one: '{count} needs you.', other: '{count} need you.' },
    ru: {
      one: 'Вам — {count}.',
      few: 'Вам — {count}.',
      many: 'Вам — {count}.',
      other: 'Вам — {count}.',
    },
  },
  readyRest: {
    en: {
      one: '{count} is ready. The rest need an answer or two.',
      other: '{count} are ready. The rest need an answer or two.',
    },
    ru: {
      one: '{count} готов. Остальным нужен ответ-другой.',
      few: '{count} готовы. Остальным нужен ответ-другой.',
      many: '{count} готовы. Остальным нужен ответ-другой.',
      other: '{count} готовы. Остальным нужен ответ-другой.',
    },
  },
  showMore: {
    en: { one: 'Show {count} more', other: 'Show {count} more' },
    ru: {
      one: 'Показать ещё {count}',
      few: 'Показать ещё {count}',
      many: 'Показать ещё {count}',
      other: 'Показать ещё {count}',
    },
  },
  savingN: {
    en: { one: 'Saving {count} flight…', other: 'Saving {count} flights…' },
    ru: {
      one: 'Сохраняем {count} перелёт…',
      few: 'Сохраняем {count} перелёта…',
      many: 'Сохраняем {count} перелётов…',
      other: 'Сохраняем {count} перелёта…',
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
  foundShort: {
    en: { one: '{count} found', other: '{count} found' },
    ru: {
      one: 'Найдено: {count}',
      few: 'Найдено: {count}',
      many: 'Найдено: {count}',
      other: 'Найдено: {count}',
    },
  },
  allSorted: {
    en: { one: '{count} flight, all sorted.', other: '{count} flights, all sorted.' },
    ru: {
      one: '{count} перелёт, всё ясно.',
      few: '{count} перелёта, всё ясно.',
      many: '{count} перелётов, всё ясно.',
      other: '{count} перелёта, всё ясно.',
    },
  },
  stoppedKept: {
    en: {
      one: 'Stopped early. {count} flight kept.',
      other: 'Stopped early. {count} flights kept.',
    },
    ru: {
      one: 'Остановились раньше. Сохранили {count}.',
      few: 'Остановились раньше. Сохранили {count}.',
      many: 'Остановились раньше. Сохранили {count}.',
      other: 'Остановились раньше. Сохранили {count}.',
    },
  },
  more: {
    en: { one: '+{count}', other: '+{count}' },
    ru: { one: '+{count}', few: '+{count}', many: '+{count}', other: '+{count}' },
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

export const progressLabel = (locale: Locale, stage: BatchStage | null): string =>
  stage === null
    ? S.stagePreparing[locale]
    : stage === 'accepted'
      ? S.stageWaiting[locale]
      : tx(locale, STAGE_KEY[stage])

export const FIELD_LABEL: Record<FieldName, Pair> = {
  date: p('Date', 'Дата'),
  origin: p('From (airport code)', 'Откуда (код аэропорта)'),
  destination: p('To (airport code)', 'Куда (код аэропорта)'),
  airline_iata: p('Airline', 'Авиакомпания'),
  flight_number: p('Flight number', 'Номер рейса'),
  aircraft_icao: p('Aircraft code', 'Код самолёта'),
  departure_time: p('Departure time', 'Время вылета'),
  arrival_time: p('Arrival time', 'Время прилёта'),
}
export const FIELD_HINT: Partial<Record<FieldName, Pair>> = {
  origin: p('City, airport or code, for example JFK', 'Город, аэропорт или код, например JFK'),
  destination: p('City, airport or code, for example BOS', 'Город, аэропорт или код, например BOS'),
  airline_iata: p(
    'Search by name or code, for example Turkish Airlines or TK',
    'Ищите по названию или коду, например Turkish Airlines или TK',
  ),
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
  flown: 'blockedFlown',
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
