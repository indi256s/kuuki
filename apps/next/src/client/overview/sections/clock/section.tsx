'use client'

import { useMemo, useState } from 'react'
import { SegmentedControl } from '../../../ui/segmented-control'
import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { IsoFigure } from '../../iso/iso-figure'
import { clock } from '../../iso/clock'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { CoverageNote, copy, filterLabel, flights, percent } from '../rankings/display'
import { ClockDial, DIAL_SIZE, type ClockHour } from './dial'
import { departures, hhmm, pad } from './departure'
import '../cookie.css'
import '../../iso/clock.css'
import './clock.css'

export function Section({ span }: { span: Span }) {
  const { scope, all, locale, actions, isCurrent } = useOverview()
  const [mode, setMode] = useState<'departures' | 'arrivals'>('departures')
  const [showLatest, setShowLatest] = useState(false)
  const found = scope && departures(scope)
  const earliest = found?.earliest,
    latest = found?.latest,
    busiest = found?.peak
  const earliestTime = earliest
    ? hhmm(earliest.depMinute)
    : busiest
      ? `${pad(busiest.hour)}:00`
      : '--:--'
  const latestTime = latest ? hhmm(latest.depMinute) : ''
  const figure = useMemo(
    () => clock(earliestTime, 1.2, latestTime || undefined),
    [earliestTime, latestTime],
  )
  if (!scope || !all) return null
  const gate = scope.clock
  if (gate.status !== 'ready') return null
  const data = gate.value,
    baseline = all.clock.status === 'ready' ? all.clock.value : data
  const rows = mode === 'departures' ? data.byHour : data.arrByHour
  const ghosts = mode === 'departures' ? baseline.byHour : baseline.arrByHour
  const peak = mode === 'departures' ? data.peakHour : data.arrPeakHour
  const points: ChartPoint<ClockHour>[] = rows.map((row) => ({
    key: row.key,
    datum: row,
    label: `${row.key}:00–${row.key}:59 · ${flights(locale, row.flights)}`,
  }))
  const pick = (hour: number) => {
    if (isCurrent()) actions.add(mode === 'departures' ? 'depHours' : 'arrHours', hour)
  }
  const title = copy(
    locale,
    mode === 'departures' ? 'Local departure time' : 'Local arrival time',
    mode === 'departures' ? 'Местное время вылета' : 'Местное время прилёта',
  )
  const shown = showLatest && latest ? latest : earliest
  const value = shown ? hhmm(shown.depMinute) : busiest ? `${pad(busiest.hour)}:00` : '—'
  const sub = (
    shown
      ? [
          showLatest && latest
            ? copy(locale, 'Latest departure', 'Самый поздний вылет')
            : copy(locale, 'Earliest departure', 'Самый ранний вылет'),
          `${shown.origin} → ${shown.destination}`,
          busiest &&
            copy(
              locale,
              `busiest hour ${pad(busiest.hour)}:00`,
              `чаще всего в ${pad(busiest.hour)}:00`,
            ),
        ]
      : [
          copy(locale, 'Busiest hour', 'Самый частый час'),
          busiest && flights(locale, busiest.flights),
        ]
  )
    .filter(Boolean)
    .join(' · ')
  const clockFigure = <IsoFigure figure={figure} className="iso-clock" />
  return (
    <div className="ov3-clock" data-span={span}>
      <div className="ov3-cookie-head">
        <div className="ov3-cookie-copy" aria-live="polite">
          <p className="ov3-cookie-value">{value}</p>
          <p className="ov3-cookie-sub">{sub}</p>
        </div>
        {earliest && latest ? (
          <button
            type="button"
            className="ov3-clock-toggle"
            aria-pressed={showLatest}
            aria-label={copy(locale, 'Show latest departure', 'Показать самый поздний вылет')}
            onClick={() => setShowLatest((v) => !v)}
          >
            {clockFigure}
          </button>
        ) : (
          clockFigure
        )}
      </div>
      <SegmentedControl
        value={mode}
        onChange={setMode}
        label={copy(locale, 'Clock', 'Часы')}
        options={[
          { value: 'departures', label: copy(locale, 'Departures', 'Вылеты') },
          { value: 'arrivals', label: copy(locale, 'Arrivals', 'Прилёты') },
        ]}
      />
      <div className="ov3-clock-dial">
        <LazyChart height={364} label={title}>
          {(inView) => (
            <KuukiChart
              key={mode}
              points={points}
              height={DIAL_SIZE}
              viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
              inView={inView}
              ariaLabel={title}
              onPick={(point) => pick(point.datum.hour)}
              actions={(point) => [
                { label: filterLabel(locale), run: () => pick(point.datum.hour) },
              ]}
              tip={(points) => <span>{points[0].label}</span>}
              table={{
                caption: title,
                columns: [
                  { key: 'key', label: copy(locale, 'Hour', 'Час') },
                  { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
                ],
                rows,
              }}
            >
              {(mark) => (
                <ClockDial
                  points={points}
                  ghosts={ghosts}
                  peakHour={peak?.hour ?? null}
                  centerLabel={peak ? `${String(peak.hour).padStart(2, '0')}:00` : '—'}
                  centerCaption={copy(locale, 'busiest', 'чаще всего')}
                  mark={mark}
                />
              )}
            </KuukiChart>
          )}
        </LazyChart>
      </div>
      <p>
        {title} · {mode === 'departures' ? data.withDepartureTime : data.withArrivalTime}{' '}
        {copy(locale, 'of', 'из')} {data.total} {copy(locale, 'flights', 'перелётов')}
      </p>
      <CoverageNote
        have={data.withDepartureTime}
        total={data.total}
        en="Based on {n} of {m} flights with departure times"
        ru="По {n} из {m} перелётов с временем вылета"
      />
      <div className="ov3-clock-stats">
        <p>
          <strong>{percent(data.beforeNoonShare)}</strong>{' '}
          {copy(locale, 'departures before noon', 'вылетов до полудня')}
        </p>
        <p>
          <strong>{flights(locale, data.redEyes)}</strong> · {copy(locale, 'red-eye', 'ночные')} ·
          22:00–06:00
        </p>
      </div>
    </div>
  )
}
