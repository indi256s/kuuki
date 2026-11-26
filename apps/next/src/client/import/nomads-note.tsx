import { formatCount, formatDistanceKm, type CountForms, type Locale } from '../../lib/format'
import { Disclosure } from '../ui/disclosure'
import { R } from './route-copy'
import { LIKELY_GROUND_KM, NOMADS_MAX_ROUTES, type NomadsSummary } from './nomads-json'

const STORY = {
  stays: {
    en: { one: '{count} stay', other: '{count} stays' },
    ru: {
      one: '{count} пребывание',
      few: '{count} пребывания',
      many: '{count} пребываний',
      other: '{count} пребывания',
    },
  },
  countries: {
    en: { one: 'in {count} country', other: 'across {count} countries' },
    ru: {
      one: 'в {count} стране',
      few: 'в {count} странах',
      many: 'в {count} странах',
      other: 'в {count} страны',
    },
  },
  routes: {
    en: { one: '{count} possible flight', other: '{count} possible flights' },
    ru: {
      one: '{count} возможный перелёт',
      few: '{count} возможных перелёта',
      many: '{count} возможных перелётов',
      other: '{count} возможного перелёта',
    },
  },
} satisfies Record<string, CountForms>

const LEFT_OUT = {
  ground: {
    en: { one: '{count} hop under {km}', other: '{count} hops under {km}' },
    ru: {
      one: '{count} переезд короче {km}',
      few: '{count} переезда короче {km}',
      many: '{count} переездов короче {km}',
      other: '{count} переезда короче {km}',
    },
  },
  unclear: {
    en: { one: '{count} move with an unclear order', other: '{count} moves with an unclear order' },
    ru: {
      one: '{count} переезд с неясным порядком',
      few: '{count} переезда с неясным порядком',
      many: '{count} переездов с неясным порядком',
      other: '{count} переезда с неясным порядком',
    },
  },
  invalid: {
    en: { one: '{count} unreadable stay', other: '{count} unreadable stays' },
    ru: {
      one: '{count} нечитаемое пребывание',
      few: '{count} нечитаемых пребывания',
      many: '{count} нечитаемых пребываний',
      other: '{count} нечитаемого пребывания',
    },
  },
  older: {
    en: {
      one: '{count} earliest route over the {limit} limit',
      other: '{count} earliest routes over the {limit} limit',
    },
    ru: {
      one: '{count} самый ранний маршрут сверх лимита в {limit}',
      few: '{count} самых ранних маршрута сверх лимита в {limit}',
      many: '{count} самых ранних маршрутов сверх лимита в {limit}',
      other: '{count} самого раннего маршрута сверх лимита в {limit}',
    },
  },
} satisfies Record<string, CountForms>

const C = {
  empty: { en: 'No possible flights found.', ru: 'Возможных перелётов не нашлось.' },
  stayedPut: {
    en: 'Staying put is a travel style too.',
    ru: 'Оставаться на месте — тоже стиль путешествий.',
  },
}

export function nomadsStory(locale: Locale, summary: NomadsSummary): string {
  const stays = formatCount(locale, summary.stays, STORY.stays)
  const where = summary.countries
    ? ` ${formatCount(locale, summary.countries, STORY.countries)}`
    : ''
  return `${stays}${where} · ${formatCount(locale, summary.routes, STORY.routes)}`
}

export function nomadsLeftOutParts(locale: Locale, summary: NomadsSummary): string[] {
  return (Object.keys(LEFT_OUT) as (keyof typeof LEFT_OUT)[])
    .filter((key) => summary[key] > 0)
    .map((key) =>
      formatCount(locale, summary[key], LEFT_OUT[key])
        .replace('{km}', formatDistanceKm(locale, LIKELY_GROUND_KM))
        .replace('{limit}', String(NOMADS_MAX_ROUTES)),
    )
}

export function NomadsNote({
  locale,
  summary,
  empty,
}: {
  locale: Locale
  summary: NomadsSummary
  empty: boolean
}) {
  const leftOut = nomadsLeftOutParts(locale, summary)
  return (
    <span className="unified-import-nomads">
      <span className="import-count">{nomadsStory(locale, summary)}</span>
      {empty ? <span>{C.empty[locale]}</span> : null}
      {empty && !summary.invalid ? <span>{C.stayedPut[locale]}</span> : null}
      {leftOut.length ? (
        <Disclosure summary={R.leftOut[locale]}>
          <ul className="unified-import-left-out">
            {leftOut.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
        </Disclosure>
      ) : null}
    </span>
  )
}
