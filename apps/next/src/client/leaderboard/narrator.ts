import type { Locale } from '../../lib/format'

export type NarratorState =
  | 'leader'
  | 'tied'
  | 'close'
  | 'far'
  | 'slipped'
  | 'progressSky'
  | 'progressGround'
  | 'blocked'
  | 'off'
  | 'pending'
  | 'unranked'
  | 'guest'
  | 'empty'

export interface NarratorParams {
  place?: string
  name?: string
  gap?: string
  value?: string
  have?: string
  need?: string
  places?: string
}

type Line = (p: NarratorParams) => string
type Entry = { en: Line; ru: Line; link?: 'settings' | 'signin' }

export const narratorCopy: Record<NarratorState, Entry> = {
  leader: {
    en: () => 'First place. Everyone else is reading your tail number.',
    ru: () => 'Первое место. Остальные изучают ваш хвостовой номер.',
  },
  tied: {
    en: (p) => `Tied for ${p.place} with @${p.name}. Nobody gets the window seat.`,
    ru: (p) => `Место ${p.place} делите с @${p.name}. Кресло у окна не достаётся никому.`,
  },
  close: {
    en: (p) => `${p.gap} behind @${p.name}. Close enough to read their boarding pass.`,
    ru: (p) => `До @${p.name}: ${p.gap}. Посадочный талон уже можно прочитать.`,
  },
  far: {
    en: (p) => `${p.gap} behind @${p.name}. Pack snacks.`,
    ru: (p) => `До @${p.name}: ${p.gap}. Рекомендуется взять перекус.`,
  },
  slipped: {
    en: (p) => `Places lost since the last update: ${p.places}. Someone else has been busy.`,
    ru: (p) => `С прошлой публикации потеряно мест: ${p.places}. Кто-то времени не терял.`,
  },
  progressSky: {
    en: (p) => `Flights: ${p.have} of ${p.need}. The board will wait. It has no choice.`,
    ru: (p) => `Перелётов: ${p.have} из ${p.need}. Табло подождёт, выбора у него нет.`,
  },
  progressGround: {
    en: (p) => `Completed ground journeys: ${p.have} of ${p.need}. The rails are patient.`,
    ru: (p) => `Завершённых наземных поездок: ${p.have} из ${p.need}. Рельсы терпеливы.`,
  },
  blocked: {
    en: () => 'Ground rankings use the countries you publish. To join, publish all countries in',
    ru: () =>
      'Наземный рейтинг строится по опубликованным странам. Чтобы участвовать, опубликуйте все страны в разделе',
    link: 'settings',
  },
  off: {
    en: () => 'Your profile is private or not on the leaderboards. You can change this in',
    ru: () => 'Ваш профиль скрыт или не участвует в рейтинге. Это меняется в разделе',
    link: 'settings',
  },
  pending: {
    en: () =>
      'Your latest changes are still being published. Places shown are from the last update.',
    ru: () => 'Последние изменения ещё публикуются. Места указаны по прошлой публикации.',
  },
  unranked: {
    en: () => 'Nothing here yet. The absence has been noted.',
    ru: () => 'Здесь пока пусто. Отсутствие зафиксировано.',
  },
  guest: {
    en: (p) => `@${p.name} leads with ${p.value}. To contest that,`,
    ru: (p) => `Лидирует @${p.name}: ${p.value}. Чтобы оспорить,`,
    link: 'signin',
  },
  empty: {
    en: () => 'Nobody on this board yet. First place is unattended.',
    ru: () => 'В этом рейтинге никого. Первое место без присмотра.',
  },
}

export const narratorLink = {
  settings: { href: '/settings', en: 'Settings.', ru: '«Настройки».' },
  signin: { href: '/signin', en: 'sign in.', ru: 'войдите.' },
} as const

export const CLOSE_GAP = 2

export function narrate(state: NarratorState, params: NarratorParams, locale: Locale) {
  const entry = narratorCopy[state]
  const link = entry.link ? narratorLink[entry.link] : null
  return {
    text: entry[locale](params),
    link: link ? { href: link.href, label: link[locale] } : null,
  }
}
