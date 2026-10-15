// Every Overview string in English and Russian together (Russian addresses the member as «вы»).
// Counts take real plural forms through the shared formatter; nothing here is a joke or a promise about stamping.
import type { CountForms, Locale } from '../../lib/format'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })
export const t = (pair: Pair, locale: Locale) => pair[locale]

const flights: CountForms = {
  en: { one: '{count} flight', other: '{count} flights' },
  ru: {
    one: '{count} перелёт',
    few: '{count} перелёта',
    many: '{count} перелётов',
    other: '{count} перелёта',
  },
}
const flightsOf: CountForms = {
  en: { one: '{count} flight', other: '{count} flights' },
  ru: {
    one: '{count} перелёта',
    few: '{count} перелётов',
    many: '{count} перелётов',
    other: '{count} перелётов',
  },
}
const routes: CountForms = {
  en: { one: '{count} route', other: '{count} routes' },
  ru: {
    one: '{count} маршрут',
    few: '{count} маршрута',
    many: '{count} маршрутов',
    other: '{count} маршрута',
  },
}
const airports: CountForms = {
  en: { one: '{count} airport', other: '{count} airports' },
  ru: {
    one: '{count} аэропорт',
    few: '{count} аэропорта',
    many: '{count} аэропортов',
    other: '{count} аэропорта',
  },
}
const countries: CountForms = {
  en: { one: '{count} country or territory', other: '{count} countries and territories' },
  ru: {
    one: '{count} страна или территория',
    few: '{count} страны и территории',
    many: '{count} стран и территорий',
    other: '{count} страны и территории',
  },
}
const visits: CountForms = {
  en: { one: '{count} visit', other: '{count} visits' },
  ru: {
    one: '{count} посещение',
    few: '{count} посещения',
    many: '{count} посещений',
    other: '{count} посещения',
  },
}
const waiting: CountForms = {
  en: { one: '{count} waiting for a stamp', other: '{count} waiting for a stamp' },
  ru: {
    one: '{count} ждёт отметки',
    few: '{count} ждут отметки',
    many: '{count} ждут отметки',
    other: '{count} ждут отметки',
  },
}
const inDays: CountForms = {
  en: { one: 'In {count} day', other: 'In {count} days' },
  ru: {
    one: 'Через {count} день',
    few: 'Через {count} дня',
    many: 'Через {count} дней',
    other: 'Через {count} дня',
  },
}
const earth: CountForms = {
  en: { one: '{count} time around the Earth', other: '{count} times around the Earth' },
  ru: {
    one: '{count} раз вокруг Земли',
    few: '{count} раза вокруг Земли',
    many: '{count} раз вокруг Земли',
    other: '{count} раза вокруг Земли',
  },
}
const noAircraft: CountForms = {
  en: {
    one: '{count} flight has no aircraft listed',
    other: '{count} flights have no aircraft listed',
  },
  ru: {
    one: 'У {count} рейса не указан самолёт',
    few: 'У {count} рейсов не указан самолёт',
    many: 'У {count} рейсов не указан самолёт',
    other: 'У {count} рейсов не указан самолёт',
  },
}
const showNext: CountForms = {
  en: { one: 'Show the next {count} flight', other: 'Show the next {count} flights' },
  ru: {
    one: 'Показать следующий {count} перелёт',
    few: 'Показать следующие {count} перелёта',
    many: 'Показать следующие {count} перелётов',
    other: 'Показать следующие {count} перелёта',
  },
}
const aircraftSaved: CountForms = {
  en: { one: '{count} aircraft saved.', other: '{count} aircraft saved.' },
  ru: {
    one: 'Сохранён {count} самолёт.',
    few: 'Сохранено {count} самолёта.',
    many: 'Сохранено {count} самолётов.',
    other: 'Сохранено {count} самолёта.',
  },
}
const routesShown: CountForms = {
  en: {
    one: 'Showing the first {shown} of {count} route.',
    other: 'Showing the first {shown} of {count} routes.',
  },
  ru: {
    one: 'Показаны первые {shown} из {count} маршрута.',
    few: 'Показаны первые {shown} из {count} маршрутов.',
    many: 'Показаны первые {shown} из {count} маршрутов.',
    other: 'Показаны первые {shown} из {count} маршрута.',
  },
}
const unplaced: CountForms = {
  en: {
    one: '{count} route has no known airport position and is not drawn.',
    other: '{count} routes have no known airport position and are not drawn.',
  },
  ru: {
    one: '{count} маршрут без известных координат аэропорта не показан.',
    few: '{count} маршрута без известных координат аэропорта не показаны.',
    many: '{count} маршрутов без известных координат аэропорта не показаны.',
    other: '{count} маршрута без известных координат аэропорта не показаны.',
  },
}
const durationKnown: CountForms = {
  en: {
    one: 'Duration known for {known} of {count} flight',
    other: 'Duration known for {known} of {count} flights',
  },
  ru: {
    one: 'Время известно для {known} из {count} перелёта',
    few: 'Время известно для {known} из {count} перелётов',
    many: 'Время известно для {known} из {count} перелётов',
    other: 'Время известно для {known} из {count} перелётов',
  },
}

export const forms = {
  flights,
  flightsOf,
  routes,
  routesShown,
  unplaced,
  airports,
  countries,
  visits,
  waiting,
  inDays,
  earth,
  noAircraft,
  durationKnown,
  showNext,
  aircraftSaved,
}

export const S = {
  heading: p('Overview', 'Обзор'),
  eyebrow: p('Your journeys', 'Ваши путешествия'),
  lead: p('The shape of your flying, at a glance.', 'Ваши полёты одним взглядом.'),
  period: p('Period', 'Период'),
  all: p('All time', 'Всё время'),
  earlier: p('Earlier years', 'Более ранние годы'),
  loading: p('Loading overview…', 'Загружаем обзор…'),

  failed: p(
    'The overview could not be loaded. Your flights are saved in the journal.',
    'Не удалось загрузить обзор. Перелёты сохранены в журнале.',
  ),
  retry: p('Try again', 'Повторить'),
  pending: p(
    'Recent changes are still being prepared. Figures may lag behind your journal.',
    'Последние изменения ещё обрабатываются. Цифры могут отставать от журнала.',
  ),
  error: p(
    'Some figures could not be refreshed. Your saved flights remain in the journal.',
    'Часть цифр не обновилась. Сохранённые перелёты остаются в журнале.',
  ),
  countriesUpdating: p('Country figures are updating.', 'Данные о странах обновляются.'),

  nextFlight: p('Next flight', 'Следующий перелёт'),
  today: p('Today', 'Сегодня'),
  tomorrow: p('Tomorrow', 'Завтра'),
  arrivedPrompt: p('Did you arrive?', 'Вы долетели?'),
  reviewQueue: p('Review in Journal', 'Открыть в журнале'),
  editFlight: p('Edit flight', 'Изменить перелёт'),
  queueStale: p(
    'The confirmation queue could not be refreshed. What you see may be out of date.',
    'Не удалось обновить очередь подтверждения. Показанное может быть устаревшим.',
  ),
  queueChecking: p('Checking the confirmation queue.', 'Проверяем очередь подтверждения.'),
  queueUnavailable: p(
    'The confirmation queue could not be loaded.',
    'Не удалось загрузить очередь подтверждения.',
  ),
  moreWaiting: p('Other flights are waiting too.', 'Ждут и другие перелёты.'),

  figures: p('Totals for the period', 'Итоги за период'),
  flights: p('Flights', 'Перелёты'),
  distance: p('Distance', 'Расстояние'),
  countries: p('Countries and territories', 'Страны и территории'),
  archivedIncluded: p('Includes archived flight evidence', 'Включая архивные данные о перелётах'),
  time: p('Time in the air', 'Время в воздухе'),
  hours: p('h', 'ч'),
  updating: p('Updating', 'Обновляется'),
  durationUnknown: p('Duration not recorded', 'Время не указано'),
  firstYear: p('First year', 'Первый год'),
  unchanged: p('No change vs {year}', 'Без изменений к {year}'),
  vs: p('vs {year}', 'к {year}'),

  map: p('Places by air', 'Места по воздуху'),
  globeLoading: p('Loading globe…', 'Загружаем глобус…'),
  globeUnavailable: p('Globe unavailable.', 'Глобус недоступен.'),
  mapLink: p('Open Passport map', 'Открыть карту паспорта'),
  legend: p('Visits per country', 'Посещений на страну'),
  legendAll: p('Flights and trips per country', 'Перелётов и поездок на страну'),
  legendFlights: p('Flights per country', 'Перелётов на страну'),
  legendGround: p('Trips per country', 'Поездок на страну'),
  scopeLabel: p('Travel scope', 'Вид поездок'),
  scopeAll: p('All', 'Всё'),
  scopeFlights: p('Flights', 'Перелёты'),
  scopeGround: p('Ground', 'По земле'),
  summaryAllTravel: p('All travel, all time', 'Все поездки, за всё время'),
  summaryGround: p('All ground trips, all time', 'Все поездки по земле, за всё время'),
  aviationFacetNote: p(
    'Flight filters leave out ground trips',
    'Наземные поездки не подходят под фильтры перелётов',
  ),
  groundZero: p(
    'No ground trips match these filters',
    'Под эти фильтры не подходит ни одна поездка по земле',
  ),
  flightsOnly: p('flights only', 'только перелёты'),
  countryList: p('Countries on the map', 'Страны на карте'),
  noCountries: p('No countries yet.', 'Пока нет стран.'),
  routesUpdating: p('Route lines are updating.', 'Линии маршрутов обновляются.'),
  routesUnavailable: p(
    'Route lines are unavailable right now. Countries are still shown.',
    'Линии маршрутов сейчас недоступны. Страны по-прежнему показаны.',
  ),

  notable: p('Notable', 'Заметное'),
  longest: p('Longest flight', 'Самый длинный перелёт'),
  frequent: p('Most frequent route', 'Самый частый маршрут'),
  newCountries: p('New countries in {year}', 'Новые страны за {year}'),
  newWaiting: p('waiting for a stamp', 'ждёт отметки'),
  moreCountries: p('and {count} more', 'и ещё {count}'),
  favoriteAirline: p('Favorite airline', 'Любимая авиакомпания'),
  noInsights: p(
    'More journeys will reveal a pattern.',
    'После нескольких перелётов появится картина.',
  ),

  rankings: p('Frequent flyers', 'Частые спутники'),
  airlines: p('Airlines', 'Авиакомпании'),
  airports: p('Airports', 'Аэропорты'),
  aircraft: p('Aircraft', 'Самолёты'),
  manufacturers: p('By manufacturer', 'По производителям'),
  all_: p('All', 'Все'),
  noRanking: p('Nothing recorded for this period yet.', 'За этот период пока ничего не указано.'),
  reviewReload: p('Review the refreshed list', 'Проверить обновлённый список'),
  reviewRetained: p(
    'Unsaved suggestions and retry outcomes remain in this review.',
    'Несохранённые предложения и результаты для повторной попытки остаются в этой проверке.',
  ),
  reviewWorking: p(
    'Search or save in progress. Please wait.',
    'Идёт поиск или сохранение. Подождите.',
  ),
  reviewDiscard: p(
    'Unsaved suggestions will be lost.',
    'Несохранённые предложения будут потеряны.',
  ),
  reviewDiscardContinue: p('Discard and continue', 'Отбросить и продолжить'),
  reviewKeep: p('Keep reviewing', 'Продолжить проверку'),
  reviewAircraft: p('Review aircraft', 'Проверить самолёты'),
  reviewTitle: p('Missing aircraft', 'Указать самолёты'),
  reviewDescription: p(
    'Suggestions are saved only after you confirm them.',
    'Предложения сохраняются только после вашего подтверждения.',
  ),
  reviewLoading: p('Loading flights…', 'Загружаем перелёты…'),
  reviewFailed: p('The flights could not be loaded.', 'Не удалось загрузить перелёты.'),
  reviewRange: p(
    'Flights {from}–{to} of {total} without an aircraft.',
    'Перелёты {from}–{to} из {total} без указанного самолёта.',
  ),
  reviewMoreFailed: p(
    'The next flights could not be loaded.',
    'Не удалось загрузить следующие перелёты.',
  ),
  reviewRefreshFailed: p(
    'Saved, but the list could not be refreshed.',
    'Сохранено, но список не удалось обновить.',
  ),
  reviewEnd: p(
    'There are no older flights after these. Newer ones still have no aircraft.',
    'Более старых перелётов нет. У более новых по-прежнему не указан самолёт.',
  ),
  reviewStartOver: p('Back to the newest', 'К самым новым'),
  reviewNone: p(
    'Every flight in this period has an aircraft.',
    'У всех перелётов за этот период указан самолёт.',
  ),
  close: p('Close', 'Закрыть'),

  rhythm: p('Rhythm', 'Ритм'),
  last12: p('Last 12 months', 'Последние 12 месяцев'),
  busiest: p('Busiest month: {month}, {flights}.', 'Больше всего перелётов: {month}, {flights}.'),
  quiet: p('No flights in this period.', 'В этом периоде перелётов нет.'),
  regions: p('Regions', 'Регионы'),
  regionOf: p('{pressed} of {total}', '{pressed} из {total}'),
  regionWaiting: p('+{count} waiting', '+{count} ждёт'),

  emptyTitle: p('First flight', 'Первый перелёт'),
  emptyBody: p(
    'Import a booking or boarding pass, or add a flight by hand.',
    'Импортируйте бронь или посадочный талон либо добавьте перелёт вручную.',
  ),
  firstRunNote: p(
    'Nothing reaches your journal until you confirm it.',
    'В журнал ничего не попадёт без вашего подтверждения.',
  ),
  import: p('Import flights', 'Импортировать перелёты'),
  add: p('Add manually', 'Добавить вручную'),
  sampleLabel: p(
    'Sample data, not your flights. This is how your overview will look.',
    'Пример с условными данными, не ваши перелёты. Так будет выглядеть ваш обзор.',
  ),
  noYear: p('No flights in {year}.', 'В {year} году перелётов нет.'),
  noYearHint: p('Choose another period above.', 'Выберите другой период выше.'),
} as const

export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
