'use client'

import { useMemo, useState } from 'react'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { Button } from '../../../ui/button'
import { SegmentedControl } from '../../../ui/segmented-control'
import { StageColumns } from '../../charts/stage-columns'
import { LazyChart } from '../../charts/lazy-chart'
import type { ChartPoint } from '../../charts/kuuki-chart'
import { fill } from '../../copy'
import { IsoFigure } from '../../iso/iso-figure'
import { clock } from '../../iso/clock'
import { ChapterCard } from '../../layout/chapter-card'
import { useFigureK } from '../../layout/figure-box'
import { useReading } from '../../layout/use-reading'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, filterLabel, flights, number, percent } from '../rankings/display'
import { departures, hhmm } from './departure'
import '../../iso/clock.css'

type View = 'departures' | 'arrivals'
type Row = { key: string; hour: number; flights: number }

const BLANK = '    '
const pad = (hour: number) => String(hour).padStart(2, '0')
const hourKey = (hour: number) => `h${pad(hour)}`
const isNight = (hour: number) => hour >= 22 || hour < 6
const TICKS = [0, 6, 12, 18, 23].map((index) => ({ index, text: pad(index) }))

/**
 * The two readings the display holds. A pick writes the new time into the slot that is not shown and flips `side`, so CSS fades
 * the old segments out and the new ones in (iso/clock.css). Anything that is not a pick rewrites both slots: the display changes without moving.
 */
function useMorph(time: string, picked: boolean) {
  const [slots, setSlots] = useState({ a: time, b: time, side: 'a' as 'a' | 'b' })
  if (slots[slots.side] === time) return slots
  const next = !picked
    ? { a: time, b: time, side: slots.side }
    : slots.side === 'a'
      ? { ...slots, b: time, side: 'b' as const }
      : { ...slots, a: time, side: 'a' as const }
  setSlots(next)
  return next
}

/** The clock in the card's figure box: its face shows `a` and `b`, and `side` names the one in front (the digit morph, clock.css). */
function ClockFigure({ a, b, side }: { a: string; b: string; side: 'a' | 'b' }) {
  const k = useFigureK('', (k) => clock('00:00', k))
  const figure = useMemo(() => clock(a, k, b), [a, b, k])
  return (
    <div className="ov3-clock-figure" data-side={side}>
      <IsoFigure figure={figure} className="iso-clock" />
    </div>
  )
}

export function Section({ span }: { span: Span }) {
  const { scope, all, filter, locale, actions, isCurrent } = useOverview()
  const [view, setView] = useState<View>('departures')
  const departing = view === 'departures'
  const facet = departing ? 'depHours' : 'arrHours'
  const data = scope && scope.clock.status === 'ready' ? scope.clock.value : null
  const found = scope && departing ? departures(scope) : null
  const earliest = found?.earliest ?? null,
    latest = found?.latest ?? null
  const rows: readonly Row[] = data ? (departing ? data.byHour : data.arrByHour) : []
  const peak = data ? (departing ? data.peakHour : data.arrPeakHour) : null
  const timed = data ? (departing ? data.withDepartureTime : data.withArrivalTime) : 0
  const filled = rows.filter((row) => row.flights > 0)
  const busiest = peak ? hourKey(peak.hour) : null
  const keys = [
    ...(earliest ? ['earliest'] : []),
    ...(latest ? ['latest'] : []),
    ...filled.map((row) => hourKey(row.hour)),
  ]
  const r = useReading(keys, earliest ? 'earliest' : busiest)
  // The figure button steps through earliest, latest and busiest; arrivals have no recorded minute, so they step through the first and last hour with arrivals.
  const cycle = [
    ...new Set(
      (earliest
        ? ['earliest', latest ? 'latest' : null, busiest]
        : [
            filled.length ? hourKey(filled[0].hour) : null,
            filled.length ? hourKey(filled[filled.length - 1].hour) : null,
            busiest,
          ]
      ).filter((key): key is string => key !== null),
    ),
  ]
  const reading = r.reading
  const record = reading === 'earliest' ? earliest : reading === 'latest' ? latest : null
  const hour = record
    ? Math.floor(record.depMinute / 60)
    : reading && /^h\d\d$/.test(reading)
      ? Number(reading.slice(1))
      : null
  const time = record ? hhmm(record.depMinute) : hour !== null ? hhmm(hour * 60) : null
  const state = !scope || !all ? 'loading' : data ? 'ready' : 'empty'
  const slots = useMorph(state === 'ready' && time ? time : BLANK, r.picked)

  const only = (value: number) => {
    if (isCurrent()) actions.add(facet, value)
  }
  const title = copy(
    locale,
    departing ? 'Local departure time' : 'Local arrival time',
    departing ? 'Местное время вылета' : 'Местное время прилёта',
  )
  const points: ChartPoint<Row>[] = rows.map((row) => ({
    key: row.key,
    datum: row,
    label: `${row.key}:00–${row.key}:59 · ${flights(locale, row.flights)}`,
  }))
  const row = hour !== null ? rows.find((item) => item.hour === hour) : undefined
  const noun = departing
    ? copy(locale, 'departures', 'вылетов')
    : copy(locale, 'arrivals', 'прилётов')
  const tail = (count: number) =>
    hour !== null && isNight(hour)
      ? departing
        ? copy(locale, 'a red-eye hour, sleep optional', 'ночной час, сон по желанию')
        : copy(
            locale,
            'a night arrival, bed still a rumour',
            'ночной прилёт, кровать пока в планах',
          )
      : copy(
          locale,
          `${percent(count / Math.max(1, timed))} of timed ${noun}`,
          `${percent(count / Math.max(1, timed))} ${noun} со временем`,
        )
  const clockTime = hour !== null ? hhmm(hour * 60) : ''
  let caption = ''
  if (record && reading) {
    caption = [
      reading === 'earliest'
        ? copy(locale, 'Earliest departure', 'Самый ранний вылет')
        : copy(locale, 'Latest departure', 'Самый поздний вылет'),
      `${record.origin} → ${record.destination}`,
      peak &&
        copy(
          locale,
          `busiest hour ${hhmm(peak.hour * 60)}`,
          `чаще всего в ${hhmm(peak.hour * 60)}`,
        ),
    ]
      .filter(Boolean)
      .join(' · ')
  } else if (row) {
    caption = [
      peak && row.hour === peak.hour
        ? `${copy(locale, 'Busiest hour', 'Самый частый час')} · ${flights(locale, row.flights)}`
        : copy(
            locale,
            `${flights(locale, row.flights)} at ${clockTime}`,
            `${flights(locale, row.flights)} в ${clockTime}`,
          ),
      tail(row.flights),
    ].join(' · ')
  }

  const gate = scope && SECTION_GATES.clock.gate(scope)
  const missing = gate?.status === 'below' ? gate : null
  const have = departing ? (data?.withDepartureTime ?? 0) : (data?.withArrivalTime ?? 0)
  const columns = data
    ? [
        {
          value: percent(data.beforeNoonShare),
          label: copy(locale, 'Departures before noon', 'Вылетов до полудня'),
        },
        {
          value: number(locale, data.redEyes),
          label: copy(locale, 'Red-eyes · 22:00–06:00', 'Ночных · 22:00–06:00'),
        },
        ...(row
          ? [
              {
                value: number(locale, row.flights),
                label: departing
                  ? copy(locale, `Departures at ${clockTime}`, `Вылетов в ${clockTime}`)
                  : copy(locale, `Arrivals at ${clockTime}`, `Прилётов в ${clockTime}`),
              },
            ]
          : []),
      ]
    : []
  const step = () => {
    const at = reading ? cycle.indexOf(reading) : -1
    const next = cycle[at < 0 ? 0 : (at + 1) % cycle.length]
    if (next !== undefined) r.pick(next)
  }
  return (
    <ChapterCard
      state={state}
      figure={<ClockFigure a={slots.a} b={slots.b} side={slots.side} />}
      figureButton={
        cycle.length > 1
          ? {
              label: copy(locale, 'Show next clock reading', 'Показать следующее время на часах'),
              onPress: step,
            }
          : undefined
      }
      hero={{
        value: time ?? '—',
        caption,
        only:
          !r.isHeadline && hour !== null && !(filter[facet] ?? []).includes(hour)
            ? {
                label: copy(locale, `Only ${clockTime}`, `Только ${clockTime}`),
                onPress: () => only(hour),
              }
            : null,
      }}
      rollValue={r.picked}
      chart={{
        table: {
          caption: title,
          columns: [
            { key: 'key', label: copy(locale, 'Hour', 'Час') },
            { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
          ],
          rows: [...rows],
        },
        caption: title,
        toggle: (
          <SegmentedControl
            dense
            value={view}
            onChange={setView}
            label={copy(locale, 'Clock', 'Часы')}
            options={[
              { value: 'departures', label: copy(locale, 'Departures', 'Вылеты') },
              { value: 'arrivals', label: copy(locale, 'Arrivals', 'Прилёты') },
            ]}
          />
        ),
        plot: (
          <LazyChart height={span === 'full' ? 206 : 176} label={title}>
            {(inView) => (
              <StageColumns
                span={span}
                points={points}
                value={(point) => point.datum.flights}
                format={(point) => point.datum.key}
                selectedKey={hour === null ? null : pad(hour)}
                appliedKeys={(filter[facet] ?? []).map(pad)}
                ticks={TICKS}
                bands={[
                  { from: 22, to: 24 },
                  { from: 0, to: 6, label: copy(locale, 'night', 'ночь') },
                ]}
                tallest
                mono
                inView={inView}
                ariaLabel={title}
                onPick={(point) => {
                  if (point.datum.flights > 0) r.pick(hourKey(point.datum.hour))
                }}
                actions={(point) => [
                  { label: filterLabel(locale), run: () => only(point.datum.hour) },
                ]}
                tip={(items) => <span>{items[0].label}</span>}
              />
            )}
          </LazyChart>
        ),
      }}
      details={{
        heading: copy(locale, 'Time of day', 'Время суток'),
        columns,
        coverage:
          data && have < data.total
            ? fill(
                departing
                  ? copy(
                      locale,
                      'Based on {n} of {m} flights with departure times',
                      'По {n} из {m} перелётов с временем вылета',
                    )
                  : copy(
                      locale,
                      'Based on {n} of {m} flights with arrival times',
                      'По {n} из {m} перелётов с временем прилёта',
                    ),
                { n: number(locale, have), m: number(locale, data.total) },
              )
            : null,
      }}
      empty={{
        title: copy(locale, 'Too few departure times', 'Слишком мало времён вылета'),
        line: missing
          ? copy(
              locale,
              `This filter leaves ${flights(locale, missing.have)} with a departure time, and the clock needs ${number(locale, missing.need)}. Not enough to wind it.`,
              `Перелётов со временем вылета в выборке: ${number(locale, missing.have)}, а часам нужно ${number(locale, missing.need)}. Заводить их нечем.`,
            )
          : '',
        action: (
          <Button
            variant="secondary"
            onClick={() => {
              if (isCurrent()) actions.clear()
            }}
          >
            {copy(locale, 'Clear filter', 'Сбросить фильтр')}
          </Button>
        ),
      }}
    />
  )
}
