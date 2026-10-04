import centers from '../../../public/maps/country-centers-110m-2.0.2.json'

export type CountryVisit = { countryCode: string; count: number; claimed?: boolean }
export type MapLocale = 'en' | 'ru'

export function CountryPreview({ countryIds, locale, period = 'all' }: { countryIds: string[]; locale: MapLocale; period?: 'all' | `${number}` }) {
  const dots = [...new Set(countryIds.map(code => code.toUpperCase()))]
  const label = period === 'all'
    ? locale === 'ru' ? `Посещено стран: ${dots.length}` : `${dots.length} countries visited`
    : locale === 'ru' ? `Стран на карте за ${period}: ${dots.length}` : `${dots.length} map countries in ${period}`
  return <figure className="country-preview">
    <svg viewBox="0 0 720 360" role="img" aria-label={label}>
      <image href="/maps/world-outline-110m-2.0.2.svg" width="720" height="360" />
      {dots.map(code => {
        const point = (centers as unknown as Record<string, [number, number]>)[code]
        return point ? <circle key={code} cx={point[0]} cy={point[1]} r="3.5" fill="var(--accent, #b66c50)"><title>{code}</title></circle> : null
      })}
    </svg>
    <figcaption className="sr-only">{locale === 'ru' ? 'Список стран доступен ниже' : 'Country list follows below'}</figcaption>
  </figure>
}
