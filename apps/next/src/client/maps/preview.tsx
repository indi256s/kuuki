import { BUCKET_TOKENS, visitBucket } from '../../lib/map-buckets'
import centers from '../../../public/maps/country-centers-110m-2.0.2.json'

/** `pending`: awaiting flights only. Listed, never filled as a visit. */
export type CountryVisit = { countryCode: string; count: number; groundCount?: number; claimed?: boolean; pending?: boolean }
export type MapLocale = 'en' | 'ru'

export function CountryPreview({ countryIds, locale, period = 'all', visits }: { countryIds: string[]; locale: MapLocale; period?: 'all' | `${number}`; visits?: CountryVisit[] }) {
  const pending = new Set(visits?.filter(visit => visit.pending && !visit.claimed).map(visit => visit.countryCode.toUpperCase()))
  const dots = [...new Set([...countryIds.map(code => code.toUpperCase()), ...pending])]
  const pressedCount = dots.filter(code => !pending.has(code)).length
  const counts = new Map(visits?.map(visit => [visit.countryCode.toUpperCase(), visit.count]))
  const label = period === 'all'
    ? locale === 'ru' ? `Посещено стран: ${pressedCount}` : `${pressedCount} countries visited`
    : locale === 'ru' ? `Стран на карте за ${period}: ${pressedCount}` : `${pressedCount} map countries in ${period}`
  return <figure className="country-preview">
    <svg viewBox="0 0 720 360" role="img" aria-label={label + (pending.size ? locale === 'ru' ? `; ждут отметки: ${pending.size}` : `; ${pending.size} waiting for a stamp` : '')}>
      <image href="/maps/world-outline-110m-2.0.2.svg" width="720" height="360" />
      {dots.map(code => {
        const point = (centers as unknown as Record<string, [number, number]>)[code]
        return point ? <circle key={code} data-country={code} data-pending={pending.has(code) || undefined} cx={point[0]} cy={point[1]} r="3.5" fill={pending.has(code) ? 'none' : `var(${BUCKET_TOKENS[visitBucket(Math.max(1, counts.get(code) ?? 1))]})`} stroke="var(--accent-text)" strokeWidth=".75" strokeDasharray={pending.has(code) ? '2 2' : undefined}><title>{code}</title></circle> : null
      })}
    </svg>
    <figcaption className="sr-only">{locale === 'ru' ? 'Список стран доступен ниже' : 'Country list follows below'}</figcaption>
  </figure>
}
