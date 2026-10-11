// Every string of the compact review step (spec O21–O22, boards 15.5, 15.9, 18.x), written in English and Russian
// together. Russian addresses the member as «вы» and uses no em dashes in prose. The server's messages are never shown.
import type { CountForms } from '../../../lib/format'

const p = (en: string, ru: string) => ({ en, ru })

export const COPY = {
  subShort: p('Fix what’s unsure, or leave it out.', 'Исправьте неясное или исключите.'),
  subLong: p(
    'Everything else looks right. Fix what’s unsure, or leave it out.',
    'Остальное выглядит верно. Исправьте неясное или исключите.',
  ),
  allLeftOut: p('All left out.', 'Все исключены.'),
  subAllLeftOut: p(
    'Nothing will be saved. Put one back to keep it.',
    'Ничего не сохранится. Верните перелёт, чтобы оставить его.',
  ),
  allRight: p('All look right.', 'Всё выглядит верно.'),
  check: p('Check {count}.', 'Проверьте {count}.'),

  looksRight: p('Looks right', 'Всё верно'),
  looksRightList: p('Flights that look right', 'Перелёты, в которых всё верно'),
  upcoming: p('Upcoming', 'Предстоит'),
  leftOut: p('Left out', 'Исключены'),
  leftOutRow: p('Left out', 'Исключён'),
  showFewer: p('Show fewer', 'Свернуть'),
  putBack: p('Put back', 'Вернуть'),
  putBackRoute: p('Put back {route}', 'Вернуть {route}'),

  whichCity: p('Which {city}?', 'Какой аэропорт?'),
  dayMissing: p('Day missing', 'Нет даты'),
  maybeCancelled: p('Maybe cancelled', 'Возможно, отменён'),
  chipsLabel: p('Airport for {city}', 'Аэропорт: {city}'),
  dateLabel: p('Date for {route}', 'Дата: {route}'),
  dateInvalid: p(
    'Use a real day, like 2019-06-14.',
    'Укажите настоящую дату, например 2019-06-14.',
  ),
  flewIt: p('I flew it', 'Я летал(а)'),
  leaveOut: p('Leave out', 'Исключить'),

  stillUnsure: p('{count} still unsure', 'Неясных: {count}'),
  savingLeavesOut: p('Saving leaves them out.', 'При сохранении они не войдут.'),
  leftOutCount: p('{count} left out', 'Исключено: {count}'),
  savingSkips: p('Saving skips them.', 'При сохранении они не войдут.'),
  allGood: p('Everything looks right', 'Всё выглядит верно'),
  allGoodSub: p('Ready when you are.', 'Можно сохранять.'),
  saving: p('Saving…', 'Сохраняем…'),
  nothingToSave: p('Nothing to save', 'Нечего сохранять'),
  journalEmpty: p('Your journal starts empty.', 'Журнал начнётся с нуля.'),
  startEmpty: p('Start empty', 'Начать с нуля'),
  startEmptyFailed: p(
    'We couldn’t wrap up just now. Nothing is lost: try again.',
    'Сейчас не получилось завершить. Ничего не потеряно: повторите.',
  ),
  couldntSave: p('Couldn’t save', 'Не удалось сохранить'),
  keptFixes: p(
    'Nothing is lost. Your fixes are kept.',
    'Ничего не потеряно. Ваши правки сохранены.',
  ),
  tryAgain: p('Try again', 'Повторить'),
  offline: p('You’re offline', 'Нет сети'),
  offlineSub: p(
    'Your fixes are kept. Save when you’re back.',
    'Ваши правки сохранены. Сохраните, когда сеть вернётся.',
  ),
  offlineReason: p(
    'Saving unlocks when you’re back online.',
    'Сохранение станет доступным, когда сеть вернётся.',
  ),
  unsavedReason: p(
    'Save or discard the edit you have open first.',
    'Сначала сохраните или отмените открытую правку.',
  ),

  loading: p('Loading your flights', 'Загружаем ваши перелёты'),
  goneTitle: p('Couldn’t open these flights', 'Не удалось открыть перелёты'),
  goneSub: p(
    'The list is no longer available. Your journal can start empty.',
    'Список больше недоступен. Журнал можно начать с нуля.',
  ),
  loadFailed: p(
    'The list didn’t load. Try again to open your flights.',
    'Список не загрузился. Повторите, чтобы открыть перелёты.',
  ),
} as const

export const flightsForms: CountForms = {
  en: { one: '{count} flight.', other: '{count} flights.' },
  ru: {
    one: '{count} перелёт.',
    few: '{count} перелёта.',
    many: '{count} перелётов.',
    other: '{count} перелёта.',
  },
}

export const saveForms: CountForms = {
  en: { one: 'Save {count} flight', other: 'Save {count} flights' },
  ru: {
    one: 'Сохранить {count} перелёт',
    few: 'Сохранить {count} перелёта',
    many: 'Сохранить {count} перелётов',
    other: 'Сохранить {count} перелёта',
  },
}

export const saveShortForms: CountForms = {
  en: { one: 'Save {count}', other: 'Save {count}' },
  ru: {
    one: 'Сохранить {count}',
    few: 'Сохранить {count}',
    many: 'Сохранить {count}',
    other: 'Сохранить {count}',
  },
}

export const showAllForms: CountForms = {
  en: { one: 'Show all {count}', other: 'Show all {count}' },
  ru: {
    one: 'Показать все {count}',
    few: 'Показать все {count}',
    many: 'Показать все {count}',
    other: 'Показать все {count}',
  },
}
