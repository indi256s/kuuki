import { formatCount, type CountForms, type Locale } from '../../lib/format'

type Pair = { en: string; ru: string }
const p = (en: string, ru: string): Pair => ({ en, ru })

export const R = {
  flew: p('Flew', 'Летал'),
  flying: p('Flying', 'Полечу'),
  land: p('By land', 'По земле'),
  skip: p('Skip', 'Нет'),
  decision: p('{route}: how you went', '{route}: как вы добрались'),
  route: p('Route', 'Маршрут'),
  shared: p('Questions for several legs', 'Вопросы по нескольким отрезкам'),
  saved: p('In your journal', 'В журнале'),
  landSaved: p('In your Passport', 'В паспорте'),
  landFailed: p('Not added to your Passport yet.', 'Пока не попало в паспорт.'),
  duplicate: p('Already in your journal', 'Уже есть в журнале'),
  copy: p('Twice in this import', 'Дважды в этом импорте'),
  airport: p('Choose airport', 'Выбрать аэропорт'),
  airportFor: p('Choose airport: {city}', 'Выбрать аэропорт: {city}'),
  from: p('From airport', 'Аэропорт вылета'),
  to: p('To airport', 'Аэропорт прилёта'),
  search: p('City or airport', 'Город или аэропорт'),
  closeSearch: p('Close search', 'Закрыть поиск'),
  year: p('Choose year', 'Выбрать год'),
  date: p('Add date', 'Указать дату'),
  each: p('Answer on each leg', 'Ответить для каждого'),
  add: p('Add to journal', 'Добавить в журнал'),
  done: p('Finish import', 'Завершить импорт'),
  unsaved: p('Save or discard your edit first.', 'Сначала сохраните или отмените правку.'),
  unsavedLeg: p('Edit not saved.', 'Правка не сохранена.'),
  sameCountry: p(
    'Trips inside one country add no stamps.',
    'Поездки внутри одной страны не дают штампов.',
  ),
  unknownCountry: p('Country unknown', 'Страна неизвестна'),
  nothing: p('Mark a leg Flew or By land.', 'Отметьте «Летал» или «По земле».'),
  openJournal: p('Open journal', 'Открыть журнал'),
  leftOut: p('Left out', 'Не вошли'),
  finished: p('Import finished', 'Импорт завершён'),
  ghost: p('not marked yet', 'пока не отмечена'),
} as const

export const RC = {
  addN: {
    en: { one: 'Add {count} to journal', other: 'Add {count} to journal' },
    ru: {
      one: 'Добавить {count} в журнал',
      few: 'Добавить {count} в журнал',
      many: 'Добавить {count} в журнал',
      other: 'Добавить {count} в журнал',
    },
  },
  land: {
    en: { one: '{count} by land', other: '{count} by land' },
    ru: {
      one: '{count} по земле',
      few: '{count} по земле',
      many: '{count} по земле',
      other: '{count} по земле',
    },
  },
  open: {
    en: { one: '{count} to decide', other: '{count} to decide' },
    ru: {
      one: 'ещё {count} без ответа',
      few: 'ещё {count} без ответа',
      many: 'ещё {count} без ответа',
      other: 'ещё {count} без ответа',
    },
  },
  notReady: {
    en: { one: '{count} not ready', other: '{count} not ready' },
    ru: {
      one: '{count} не готов',
      few: '{count} не готовы',
      many: '{count} не готовы',
      other: '{count} не готовы',
    },
  },
  legs: {
    en: { one: '{count} leg', other: '{count} legs' },
    ru: {
      one: '{count} отрезок',
      few: '{count} отрезка',
      many: '{count} отрезков',
      other: '{count} отрезка',
    },
  },
  ofCountries: {
    en: { one: '{lit} of {count} country', other: '{lit} of {count} countries' },
    ru: {
      one: '{lit} из {count} страны',
      few: '{lit} из {count} стран',
      many: '{lit} из {count} стран',
      other: '{lit} из {count} страны',
    },
  },
  landTrips: {
    en: { one: '{count} trip by land', other: '{count} trips by land' },
    ru: {
      one: '{count} поездка по земле',
      few: '{count} поездки по земле',
      many: '{count} поездок по земле',
      other: '{count} поездки по земле',
    },
  },
  landAdded: {
    en: { one: 'trip by land added', other: 'trips by land added' },
    ru: {
      one: 'поездка по земле добавлена',
      few: 'поездки по земле добавлено',
      many: 'поездок по земле добавлено',
      other: 'поездки по земле добавлено',
    },
  },
  landSavedNotice: {
    en: { one: '{count} trip by land saved', other: '{count} trips by land saved' },
    ru: {
      one: 'Сохранена {count} поездка по земле',
      few: 'Сохранено {count} поездки по земле',
      many: 'Сохранено {count} поездок по земле',
      other: 'Сохранено {count} поездки по земле',
    },
  },
} satisfies Record<string, CountForms>

export const rcount = (locale: Locale, key: keyof typeof RC, n: number) =>
  formatCount(locale, n, RC[key])
