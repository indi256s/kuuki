'use client'

import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import { copy, filterLabel, number } from '../rankings/display'
import { CrossingBars, barsWidth, type ShiftYear } from './bars'

/** The per-year clock shift chart and its table: years the page is filtered to keep their ghost, years with no flights stay unselectable. */
export function ShiftYears({
  data,
  baseline,
}: {
  data: { shiftByYear: ShiftYear[] }
  baseline: { shiftByYear: ShiftYear[] }
}) {
  const { locale, actions, isCurrent } = useOverview()
  const ghosts = baseline.shiftByYear
  const points: ChartPoint<ShiftYear>[] = data.shiftByYear
    .filter((row) => row.flights > 0 && ghosts.some((base) => base.year === row.year))
    .map((row) => ({
      key: row.key,
      datum: row,
      label: `${row.year} · +${number(locale, row.forward)} / −${number(locale, row.back)} ${copy(locale, 'h', 'ч')}`,
    }))
  const rows = ghosts.map(
    (base) =>
      data.shiftByYear.find((row) => row.year === base.year) ?? {
        ...base,
        forward: 0,
        back: 0,
        flights: 0,
      },
  )
  const pick = (year: number) => {
    if (isCurrent()) actions.setPeriod({ years: [year] })
  }
  const caption = copy(locale, 'Clock change per year · hours', 'Сдвиг часов по годам · часы')
  return (
    <LazyChart height={284} label={caption}>
      {(inView) => (
        <KuukiChart
          points={points}
          height={220}
          fit={(available) => barsWidth(ghosts.length, available)}
          inView={inView}
          ariaLabel={caption}
          onPick={(point) => pick(point.datum.year)}
          actions={(point) => [{ label: filterLabel(locale), run: () => pick(point.datum.year) }]}
          tip={(points) => <span>{points[0].label}</span>}
          table={{
            caption,
            columns: [
              { key: 'year', label: copy(locale, 'Year', 'Год') },
              { key: 'forward', label: copy(locale, 'Forward', 'Вперёд'), numeric: true },
              { key: 'back', label: copy(locale, 'Back', 'Назад'), numeric: true },
              { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
            ],
            rows: rows.map((row) => ({
              year: row.year,
              forward: row.flights ? row.forward : '–',
              back: row.flights ? row.back : '–',
              flights: row.flights,
            })),
          }}
        >
          {(mark, { width }) => (
            <CrossingBars
              points={points}
              ghosts={ghosts}
              width={width}
              height={220}
              format={(value) => number(locale, value)}
              mark={mark}
            />
          )}
        </KuukiChart>
      )}
    </LazyChart>
  )
}
