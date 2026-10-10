'use client'
import { useOverview } from '../../store/overview-context'
import { CoverageNote, copy, flights } from '../rankings/display'
import './clock.css'
export function Tile() {
  const { scope, locale } = useOverview()
  if (!scope) return null
  if (scope.clock.status !== 'ready')
    return <p>{copy(locale, 'Not enough times yet', 'Пока мало данных о времени')}</p>
  const data = scope.clock.value,
    peak = data.peakHour,
    max = Math.max(1, ...data.byHour.map((row) => row.flights))
  return (
    <div>
      <div className="ov3-clock-mini" aria-hidden="true">
        {data.byHour.map((row) => (
          <i
            key={row.key}
            style={{
              height: Math.max(2, (row.flights / max) * 40),
              background: row.hour === peak?.hour ? 'var(--mark-1)' : 'var(--mark-2)',
            }}
          />
        ))}
      </div>
      <strong>{peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—'}</strong>
      <p>
        {copy(locale, 'Busiest hour', 'Самый частый час')} · {flights(locale, peak?.flights ?? 0)}
      </p>
      <CoverageNote
        have={data.withDepartureTime}
        total={data.total}
        en="Based on {n} of {m} flights with departure times"
        ru="По {n} из {m} перелётов с временем вылета"
      />
    </div>
  )
}
