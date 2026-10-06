import type { ProjectedPair } from '@kuuki/shared'
import { BUCKET_TOKENS, visitBucket } from '../../lib/map-buckets'
import centers from '../../../public/maps/country-centers-110m-2.0.2.json'
import { routeGeometry } from './geometry'

/** `pending`: awaiting flights only. Listed, never filled as a visit. */
export type CountryVisit = { countryCode: string; count: number; groundCount?: number; claimed?: boolean; pending?: boolean }
export type MapLocale = 'en' | 'ru'

// The same equirectangular projection as the pinned outline and centers (scripts/map-build-geometry.py).
const point = ([lon, lat]: [number, number]) => `${Math.round((lon + 180) * 20) / 10},${Math.round((90 - lat) * 20) / 10}`

/** SVG path of a pair's great circle, split at the antimeridian like the opened map; null when it cannot be drawn. */
export function previewArcPath(pair: Pick<ProjectedPair, 'from' | 'to'>): string | null {
  const geometry = routeGeometry(pair)
  if (!geometry) return null
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
  return lines.map(line => 'M' + line.map(point).join('L')).join('')
}

/** `routes`: the period's undirected pairs from the route projection, one static arc each (no motion). */
export function CountryPreview({ countryIds, locale, period = 'all', visits, routes }: { countryIds: string[]; locale: MapLocale; period?: 'all' | `${number}`; visits?: CountryVisit[]; routes?: ProjectedPair[] }) {
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
      {routes?.map(pair => {
        const d = previewArcPath(pair)
        return d ? <path key={`${pair.a}-${pair.b}`} data-route={`${pair.a}-${pair.b}`} d={d} fill="none" stroke="var(--map-route)" strokeWidth="1" strokeOpacity=".7" strokeLinecap="round" /> : null
      })}
      {dots.map(code => {
        const point = (centers as unknown as Record<string, [number, number]>)[code]
        return point ? <circle key={code} data-country={code} data-pending={pending.has(code) || undefined} cx={point[0]} cy={point[1]} r="3.5" fill={pending.has(code) ? 'none' : `var(${BUCKET_TOKENS[visitBucket(Math.max(1, counts.get(code) ?? 1))]})`} stroke="var(--accent-text)" strokeWidth=".75" strokeDasharray={pending.has(code) ? '2 2' : undefined}><title>{code}</title></circle> : null
      })}
    </svg>
    <figcaption className="sr-only">{locale === 'ru' ? 'Список стран доступен ниже' : 'Country list follows below'}</figcaption>
  </figure>
}
