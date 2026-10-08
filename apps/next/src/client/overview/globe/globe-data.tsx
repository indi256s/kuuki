import type { GlobeData } from '@kuuki/shared/overview/globe'
import { formatCount, formatNumber, type Locale } from '../../../lib/format'
import { forms } from '../copy'
import type { ChapterComparison } from '../comparison/compare-chapters'

export function GlobeDataTable({ globe, all, locale, comparison }: { globe: GlobeData; all: GlobeData; locale: Locale; comparison?: ChapterComparison | null }) {
  const allRoutes = new Map(all.routes.map(route => [route.key, route]))
  const selectedRoutes = new Map(globe.routes.map(route => [route.key, route]))
  const ghostRoutes = globe.ghostRoutes.flatMap(key => {
    const route = allRoutes.get(key)
    return route ? [route] : []
  })

  const labels = locale === 'ru'
    ? { table: 'Данные глобуса', view: 'Показать таблицу', kind: 'Показатель', code: 'Код', selected: 'Выбрано', all: 'Всё время', route: 'Маршрут · перелёты', airport: 'Аэропорт · посещения', country: 'Страна · посещения', background: 'Фон' }
    : { table: 'Globe data', view: 'View as table', kind: 'Measure', code: 'Code', selected: 'Selected', all: 'All time', route: 'Route · flights', airport: 'Airport · visits', country: 'Country · visits', background: 'Background' }
  const rows = [
    ...[...globe.routes, ...ghostRoutes].map(route => [labels.route, `${route.a}–${route.b}`, selectedRoutes.get(route.key)?.count ?? 0, allRoutes.get(route.key)?.count ?? 0] as const),
    ...globe.airports.map(airport => [labels.airport, airport.iata, airport.count, all.airports.find(item => item.iata === airport.iata)?.count ?? 0] as const),
    ...[...globe.countries.map(country => country.code), ...globe.ghostCountries].map(code => [labels.country, code, globe.countries.find(item => item.code === code)?.visits ?? 0, all.countries.find(item => item.code === code)?.visits ?? 0] as const),
  ]
  const text = locale === 'ru'
    ? { status: { added: 'Новый в текущем', shared: 'В обоих', absent: 'Только в опорном' }, reference: 'Опорный срез', current: 'Текущий срез', status_: 'Статус', combined: 'Обе выборки' }
    : { status: { added: 'New in current', shared: 'In both', absent: 'Only in reference' }, reference: 'Reference', current: 'Current', status_: 'Status', combined: 'Both selections' }
  return <details className="globe-data">
      <summary>{labels.view}</summary>
      {comparison ? <table>
        <caption>{labels.route}</caption>
        <thead><tr><th scope="col">{labels.code}</th><th scope="col">{text.status_}</th><th scope="col">{text.reference}</th><th scope="col">{text.current}</th></tr></thead>
        <tbody>{comparison.routes.map(route => <tr key={route.key}><td>{route.a}–{route.b}</td><td>{text.status[route.status]}</td>
          <td>{formatNumber(locale, route.heldCount)}</td><td>{formatNumber(locale, route.currentCount)}</td></tr>)}</tbody>
      </table> : <p>{labels.selected}: {formatCount(locale, globe.routes.length, forms.routes)}. {labels.background}: {formatCount(locale, ghostRoutes.length, forms.routes)}.</p>}
      <table>
        <caption>{labels.table}</caption>
        <thead><tr><th scope="col">{labels.kind}</th><th scope="col">{labels.code}</th><th scope="col">{comparison ? text.combined : labels.selected}</th><th scope="col">{labels.all}</th></tr></thead>
        <tbody>{rows.filter(([kind]) => !comparison || kind !== labels.route).map(([kind, code, selected, total]) => <tr key={`${kind}:${code}`}><td>{kind}</td><td>{code}</td><td>{formatNumber(locale, selected)}</td><td>{formatNumber(locale, total)}</td></tr>)}</tbody>
      </table>
    </details>
}
