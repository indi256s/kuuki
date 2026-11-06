'use client'

import { useMemo, useState } from 'react'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { Button } from '../../../ui/button'
import { StageColumns, type StageTick } from '../../charts/stage-columns'
import { LazyChart } from '../../charts/lazy-chart'
import type { ChartPoint } from '../../charts/kuuki-chart'
import { formatCount } from '../../../../lib/format'
import { fill } from '../../copy'
import { IsoFigure } from '../../iso/iso-figure'
import { clock } from '../../iso/clock'
import { ChapterCard } from '../../layout/chapter-card'
import { useFigureK } from '../../layout/figure-box'
import { useReading } from '../../layout/use-reading'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, number, percent } from '../rankings/display'
import { departures, hhmm } from './departure'
import '../../iso/clock.css'

type Row = { key: string; hour: number; flights: number; arrivals: number }

const BLANK = '    '
const pad = (hour: number) => String(hour).padStart(2, '0')
const hourKey = (hour: number) => `h${pad(hour)}`
const TICKS = [0, 6, 12, 18, 23]
/** The axis ticks, plus the picked hour when it is not crowded by a neighbour (the sheet's pitch fits a label every second hour). */
const ticksFor = (hour: number | null): StageTick[] =>
  (hour === null || TICKS.some((tick) => Math.abs(tick - hour) < 2) ? TICKS : [...TICKS, hour])
    .sort((a, b) => a - b)
    .map((index) => ({ index, text: pad(index) }))

const departureForms = {
  en: { one: '{count} departure', other: '{count} departures' },
  ru: {
    one: '{count} вылет',
    few: '{count} вылета',
    many: '{count} вылетов',
    other: '{count} вылета',
  },
}
const arrivalForms = {
  en: { one: '{count} arrival', other: '{count} arrivals' },
  ru: {
    one: '{count} прилёт',
    few: '{count} прилёта',
    many: '{count} прилётов',
    other: '{count} прилёта',
  },
}

/**
 * The two readings the display holds. A pick writes the new time into the slot that is not shown, flips `side` and sets `pressed`, so CSS
 * presses the snooze bar and sets the clock: the old segments go dark and the new ones light (iso/clock.css). Anything that is not a pick
 * rewrites both slots: the display changes without moving.
 */
function useMorph(time: string, picked: boolean) {
  const [slots, setSlots] = useState({ a: time, b: time, side: 'a' as 'a' | 'b', pressed: false })
  if (slots[slots.side] === time) return slots
  const next = !picked
    ? { ...slots, a: time, b: time }
    : slots.side === 'a'
      ? { ...slots, b: time, side: 'b' as const, pressed: true }
      : { ...slots, a: time, side: 'a' as const, pressed: true }
  setSlots(next)
  return next
}

/** The clock in the card's figure box: its face shows `a` and `b`, `side` names the one in front, and `pressed` says a pick has set it (clock.css). */
function ClockFigure({
  a,
  b,
  side,
  pressed,
}: {
  a: string
  b: string
  side: 'a' | 'b'
  pressed: boolean
}) {
  const k = useFigureK('', (k) => clock('00:00', k))
  const figure = useMemo(() => clock(a, k, b), [a, b, k])
  return (
    <div className="ov3-clock-figure" data-side={side} data-press={pressed ? side : undefined}>
      <IsoFigure figure={figure} className="iso-clock" />
    </div>
  )
}

export function Section({ span }: { span: Span }) {
  const { scope, all, filter, locale, actions, isCurrent } = useOverview()
  const data = scope && scope.clock.status === 'ready' ? scope.clock.value : null
  const found = scope ? departures(scope) : null
  const earliest = found?.earliest ?? null,
    latest = found?.latest ?? null
  // One reading per hour: departures and arrivals of the same hour share a row.
  const rows: readonly Row[] = data
    ? data.byHour.map((row, index) => ({ ...row, arrivals: data.arrByHour[index]?.flights ?? 0 }))
    : []
  const peak = data ? data.peakHour : null
  const timed = data ? data.withDepartureTime : 0
  const filled = rows.filter((row) => row.flights > 0 || row.arrivals > 0)
  const busiest = peak ? hourKey(peak.hour) : null
  const keys = [
    ...(earliest ? ['earliest'] : []),
    ...(latest ? ['latest'] : []),
    ...filled.map((row) => hourKey(row.hour)),
  ]
  const r = useReading(keys, earliest ? 'earliest' : busiest)
  // The figure button steps through earliest, latest and the busiest departure hour.
  const cycle = [
    ...new Set(
      [earliest ? 'earliest' : null, latest ? 'latest' : null, busiest].filter(
        (key): key is string => key !== null,
      ),
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

  const only = (facet: 'depHours' | 'arrHours', value: number) => {
    if (isCurrent()) actions.add(facet, value)
  }
  const title = copy(
    locale,
    'Departures ↑ · arrivals ↓ · local time',
    'Вылеты ↑ · прилёты ↓ · по местному времени',
  )
  const deps = (count: number) => formatCount(locale, count, departureForms)
  const arrs = (count: number) => formatCount(locale, count, arrivalForms)
  const counts = (item: Row) => `${deps(item.flights)}, ${arrs(item.arrivals)}`
  const points: ChartPoint<Row>[] = rows.map((row) => ({
    key: row.key,
    datum: row,
    label: `${row.key}:00–${row.key}:59 · ${counts(row)}`,
  }))
  const row = hour !== null ? rows.find((item) => item.hour === hour) : undefined
  // «Только» takes the departure hour, or the arrival hour when the hour has no departures.
  const facetOf = (item: Row) => (item.flights > 0 ? 'depHours' : 'arrHours')
  const isApplied = (item: Row) =>
    (filter.depHours ?? []).includes(item.hour) || (filter.arrHours ?? []).includes(item.hour)
  const tail = (count: number) =>
    count > 0
      ? copy(
          locale,
          `${percent(count / Math.max(1, timed))} of timed departures`,
          `${percent(count / Math.max(1, timed))} вылетов со временем`,
        )
      : ''
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
        ? `${copy(locale, 'Busiest hour', 'Самый частый час')} · ${counts(row)}`
        : counts(row),
      tail(row.flights),
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const gate = scope && SECTION_GATES.clock.gate(scope)
  const missing = gate?.status === 'below' ? gate : null
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
                label: copy(locale, `Departures at ${clockTime}`, `Вылетов в ${clockTime}`),
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
      figure={<ClockFigure a={slots.a} b={slots.b} side={slots.side} pressed={slots.pressed} />}
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
          !r.isHeadline && row && !isApplied(row)
            ? {
                label: copy(locale, `Only ${clockTime}`, `Только ${clockTime}`),
                onPress: () => only(facetOf(row), row.hour),
              }
            : null,
      }}
      rollValue={r.picked}
      chart={{
        table: {
          caption: title,
          columns: [
            { key: 'key', label: copy(locale, 'Hour', 'Час') },
            { key: 'flights', label: copy(locale, 'Departures', 'Вылеты'), numeric: true },
            { key: 'arrivals', label: copy(locale, 'Arrivals', 'Прилёты'), numeric: true },
          ],
          rows: [...rows],
        },
        caption: title,
        plot: (
          <LazyChart height={span === 'full' ? 206 : 176} label={title}>
            {(inView) => (
              <StageColumns
                span={span}
                points={points}
                value={(point) => point.datum.flights}
                below={(point) => point.datum.arrivals}
                format={(point) => String(point.datum.flights)}
                formatBelow={(point) => String(point.datum.arrivals)}
                selectedKey={hour === null ? null : pad(hour)}
                appliedKeys={[
                  ...new Set([...(filter.depHours ?? []), ...(filter.arrHours ?? [])]),
                ].map(pad)}
                ticks={ticksFor(hour)}
                bands={[
                  { from: 22, to: 24 },
                  { from: 0, to: 6, label: copy(locale, 'night', 'ночь') },
                ]}
                tallest
                inView={inView}
                ariaLabel={title}
                onPick={(point) => {
                  if (point.datum.flights > 0 || point.datum.arrivals > 0)
                    r.pick(hourKey(point.datum.hour))
                }}
                actions={(point) => [
                  ...(point.datum.flights > 0
                    ? [
                        {
                          label: copy(
                            locale,
                            `Only departures at ${hhmm(point.datum.hour * 60)}`,
                            `Только вылеты в ${hhmm(point.datum.hour * 60)}`,
                          ),
                          run: () => only('depHours', point.datum.hour),
                        },
                      ]
                    : []),
                  ...(point.datum.arrivals > 0
                    ? [
                        {
                          label: copy(
                            locale,
                            `Only arrivals at ${hhmm(point.datum.hour * 60)}`,
                            `Только прилёты в ${hhmm(point.datum.hour * 60)}`,
                          ),
                          run: () => only('arrHours', point.datum.hour),
                        },
                      ]
                    : []),
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
        coverage: data
          ? [
              data.withDepartureTime < data.total
                ? fill(
                    copy(
                      locale,
                      'Based on {n} of {m} flights with departure times',
                      'По {n} из {m} перелётов с временем вылета',
                    ),
                    { n: number(locale, data.withDepartureTime), m: number(locale, data.total) },
                  )
                : null,
              data.withArrivalTime !== data.withDepartureTime
                ? fill(
                    copy(
                      locale,
                      'Based on {n} of {m} flights with arrival times',
                      'По {n} из {m} перелётов с временем прилёта',
                    ),
                    { n: number(locale, data.withArrivalTime), m: number(locale, data.total) },
                  )
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || null
          : null,
      }}
      empty={{
        title: copy(locale, 'Too few departure times', 'Слишком мало времён вылета'),
        line: missing
          ? copy(
              locale,
              `Flights with departure times ${number(locale, missing.have)} of ${number(locale, missing.need)} required`,
              `Перелётов со временем вылета ${number(locale, missing.have)} из ${number(locale, missing.need)} нужных`,
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
