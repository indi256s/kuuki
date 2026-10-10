'use client'

import { useState } from 'react'
import { SegmentedControl } from '../../../ui/segmented-control'
import { KuukiChart, type ChartPoint } from '../../charts/kuuki-chart'
import { LazyChart } from '../../charts/lazy-chart'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { CoverageNote, copy, filterLabel, flights, percent } from '../rankings/display'
import { ClockDial, DIAL_SIZE, type ClockHour } from './dial'
import './clock.css'

export function Section({ span }: { span: Span }) {
  const { scope, all, locale, actions, isCurrent } = useOverview()
  const [mode, setMode] = useState<'departures' | 'arrivals'>('departures')
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
  return (
    <div className="ov3-clock" data-span={span}>
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
