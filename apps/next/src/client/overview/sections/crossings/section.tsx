'use client'

import { useState } from 'react'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { isEmptyFilter } from '@kuuki/shared/overview/filter'
import { Button } from '../../../ui/button'
import { SegmentedControl } from '../../../ui/segmented-control'
import { StageRows } from '../../charts/stage-rows'
import { LazyChart } from '../../charts/lazy-chart'
import { ChapterCard } from '../../layout/chapter-card'
import { reducedMotion } from '../../layout/drag-motion'
import { useReading } from '../../layout/use-reading'
import { useOverview } from '../../store/overview-context'
import type { Span } from '../registry'
import { copy, CoverageNote, flights, number } from '../rankings/display'
import {
  TOTAL,
  byFlights,
  continentName,
  displayOrder,
  flightsUnit,
  type ContinentId,
} from './continents'
import { ContinentsFigure } from './figure'
import { ShiftYears } from './shift-years'
import './continents.css'

type View = 'flights' | 'firsts'
type Datum = { id: ContinentId; name: string; flights: number; firstYear: number | null }

const NONE: Record<ContinentId, boolean> = {
  europe: false,
  asia: false,
  africa: false,
  'north-america': false,
  'south-america': false,
  oceania: false,
  antarctica: false,
}

export function Section({ span }: { span: Span }) {
  const { scope, all, locale, actions, isCurrent } = useOverview()
  const [view, setView] = useState<View>('flights')
  const [year] = useState(() => new Date().getFullYear())
  const gate = scope?.continents
  const data = gate?.status === 'ready' ? gate.value : null
  const rows = data?.rows ?? []
  const order = displayOrder(rows, view)
  const headline = byFlights(rows)[0]?.id ?? null
  const r = useReading(
    order.map((row) => row.id),
    headline,
  )
  const state = !scope || !all ? 'loading' : data ? 'ready' : 'empty'
  const name = (id: ContinentId) => continentName(id, locale)

  const flown = rows.reduce((set, row) => ({ ...set, [row.id]: row.flights > 0 }), NONE)
  const count = data?.flown ?? 0
  const label = copy(locale, `${count} OF ${TOTAL} PIECES`, `${count} ИЗ ${TOTAL} ЧАСТЕЙ`)
  const reading = rows.find((row) => row.id === r.reading) ?? null

  // The caption: the headline reads like a sentence about the whole tray, a pick about its own continent.
  const newest = byFlights(rows)
    .filter((row) => row.id !== headline && row.firstYear !== null)
    .reduce<(typeof rows)[number] | null>(
      (best, row) => (best && best.firstYear! >= row.firstYear! ? best : row),
      null,
    )
  let value = '—',
    unit: string | undefined,
    caption = ''
  if (data && reading && headline) {
    if (r.isHeadline) {
      value = number(locale, data.flown)
      unit = copy(locale, `of ${TOTAL} continents`, `из ${TOTAL} континентов`)
      caption = [
        copy(locale, `${name(headline)} most`, `Чаще всего — ${name(headline)}`),
        newest
          ? copy(
              locale,
              `${name(newest.id)} since ${newest.firstYear}`,
              `${name(newest.id)} с ${newest.firstYear}`,
            )
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    } else {
      value = number(locale, reading.flights)
      unit = flightsUnit(locale, reading.flights)
      caption =
        reading.flights === 0
          ? copy(locale, `${name(reading.id)} · not flown`, `${name(reading.id)} · не бывали`)
          : reading.firstYear === null
            ? copy(
                locale,
                `${name(reading.id)} · first flight undated`,
                `${name(reading.id)} · дата первого перелёта неизвестна`,
              )
            : copy(
                locale,
                `${name(reading.id)} · first reached in ${reading.firstYear}`,
                `${name(reading.id)} · впервые — в ${reading.firstYear}`,
              )
    }
  }

  // Chart: flights, or the year each continent was first reached (the bar is the years since).
  const firsts = view === 'firsts'
  const held = (row: Datum) =>
    row.flights > 0 && row.firstYear !== null ? Math.max(1, year - row.firstYear + 1) : 0
  const chartCaption = firsts
    ? copy(locale, 'First reached', 'Впервые на континенте')
    : copy(locale, 'Flights by continent', 'Перелёты по континентам')
  const visible = order.filter((row) => row.flights > 0 || row.id === r.reading)
  const unflown = order.filter((row) => row.flights === 0).length
  const omitted = order.length - visible.length
  const scoped = !!scope && !isEmptyFilter(scope.filter)
  const points = visible.map((row) => {
    const datum: Datum = { ...row, name: name(row.id) }
    return {
      key: row.id,
      datum,
      label: firsts
        ? `${datum.name}, ${
            row.flights === 0
              ? copy(locale, 'not flown', 'не бывали')
              : row.firstYear === null
                ? copy(locale, 'first flight undated', 'дата первого перелёта неизвестна')
                : row.firstYear
          }`
        : `${datum.name}, ${flights(locale, row.flights)}`,
    }
  })

  // The tray counts flights per airport, so a flight between continents is in both rows.
  const unplaced = data?.unplaced ?? 0
  const coverage = copy(
    locale,
    `Counted per airport, so a flight between two continents counts for both.${unplaced > 0 ? ` ${flights(locale, unplaced)} couldn't be placed on any continent.` : ''}`,
    `Считаем по аэропортам, поэтому перелёт между двумя континентами идёт в оба.${unplaced > 0 ? ` ${flights(locale, unplaced)} не удалось отнести ни к одному континенту.` : ''}`,
  )
  const lines = scope?.crossings.status === 'ready' ? scope.crossings.value : null
  const baseline = all?.crossings.status === 'ready' ? all.crossings.value : lines
  const hit = lines?.offsets.filter((row) => row.hit).length ?? 0
  // Geographic counts are estimates on shortest airport arcs; with no coordinates they are unknown, not zero.
  const located = (lines?.locatedFlights ?? 0) > 0
  const crossed = (count: number) => (located ? number(locale, count) : '—')
  const route = (count: number, record: { origin: string; destination: string } | null) =>
    !located
      ? ` · ${copy(locale, 'coordinates unavailable', 'координаты неизвестны')}`
      : record
        ? ` · ${copy(locale, 'last', 'последний')} ${record.origin} → ${record.destination}`
        : count > 0
          ? ` · ${copy(locale, 'route unavailable', 'маршрут неизвестен')}`
          : ''

  const missing = scope && SECTION_GATES.crossings.gate(scope)
  const below = missing?.status === 'below' ? missing : null
  return (
    <ChapterCard
      state={state}
      figure={
        <ContinentsFigure
          flown={flown}
          lit={state === 'ready' ? (reading?.id ?? null) : null}
          label={label}
          picked={r.picked && !reducedMotion()}
        />
      }
      figureButton={{
        label: copy(locale, 'Show next continent', 'Показать следующий континент'),
        onPress: r.next,
      }}
      hero={{ value, unit, caption, only: null }}
      rollValue={r.picked}
      chart={{
        table: {
          caption: chartCaption,
          columns: [
            { key: 'continent', label: copy(locale, 'Continent', 'Континент') },
            { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
            { key: 'first', label: copy(locale, 'First reached', 'Впервые'), numeric: true },
          ],
          rows: order.map((row) => ({
            continent: name(row.id),
            flights: row.flights,
            first: row.flights > 0 && row.firstYear !== null ? row.firstYear : '—',
          })),
        },
        caption: chartCaption,
        toggle: (
          <SegmentedControl
            dense
            value={view}
            onChange={setView}
            label={copy(locale, 'Continents', 'Континенты')}
            options={[
              { value: 'flights', label: copy(locale, 'Flights', 'Перелёты') },
              { value: 'firsts', label: copy(locale, 'Firsts', 'Впервые') },
            ]}
          />
        ),
        plot: (
          <>
            <LazyChart height={visible.length * 24} label={chartCaption}>
              {(inView) => (
                <StageRows
                  span={span}
                  points={points}
                  value={(point) => (firsts ? held(point.datum) : point.datum.flights)}
                  format={(point) =>
                    firsts
                      ? point.datum.firstYear === null
                        ? '—'
                        : String(point.datum.firstYear)
                      : number(locale, point.datum.flights)
                  }
                  name={(point) => point.datum.name}
                  valueWidth={44}
                  selectedKey={reading?.id ?? null}
                  inView={inView}
                  ariaLabel={chartCaption}
                  onPick={(point) => r.pick(point.key as ContinentId)}
                  tip={(selected) => <span>{selected[0].label}</span>}
                />
              )}
            </LazyChart>
            {omitted > 0 ? (
              <p className="ov3-continents-unflown">
                {copy(
                  locale,
                  `${scoped ? 'No flights in this selection' : 'No flights'}: ${unflown}`,
                  `${scoped ? 'Без перелётов в выборке' : 'Без перелётов'}: ${unflown}`,
                )}
              </p>
            ) : null}
          </>
        ),
      }}
      details={{
        heading: copy(locale, 'Lines you crossed', 'Пересечённые линии'),
        columns: lines
          ? [
              {
                value: `${number(locale, lines.clockShiftHours)} ${copy(locale, 'h', 'ч')}`,
                label: copy(locale, 'Clocks shifted', 'Сдвиг часов'),
              },
              {
                value: copy(locale, `${hit} of 24`, `${hit} из 24`),
                label: copy(
                  locale,
                  'Hourly UTC offsets at your airports',
                  'Часовых смещений UTC в ваших аэропортах',
                ),
              },
              {
                value: crossed(lines.equator),
                label: `${copy(locale, 'Equator crossings', 'Пересечения экватора')}${route(lines.equator, lines.lastEquator)}`,
              },
              {
                value: crossed(lines.arcticCircle),
                label: `${copy(locale, 'Arctic Circle crossings', 'Пересечения полярного круга')}${route(lines.arcticCircle, lines.lastArctic)}`,
              },
            ]
          : [],
        coverage,
        extra: lines ? (
          <>
            <CoverageNote
              have={lines.locatedFlights}
              total={scope?.figures.flights ?? 0}
              en="Coordinates available for {n} of {m} flights"
              ru="Координаты известны: {n} из {m} перелётов"
            />
            <p className="ov3-sample">
              {copy(
                locale,
                'Crossings estimated from shortest airport-to-airport arcs.',
                'Пересечения оценены по кратчайшим дугам между аэропортами.',
              )}
            </p>
          </>
        ) : undefined,
        more:
          lines && baseline
            ? [
                {
                  summary: copy(locale, 'Clock shift by year', 'Сдвиг часов по годам'),
                  content: <ShiftYears data={lines} baseline={baseline} />,
                },
              ]
            : undefined,
      }}
      empty={{
        title: copy(locale, 'Too few flights to place', 'Мало перелётов для раскладки'),
        line: below
          ? copy(
              locale,
              `Flights with a known airport ${number(locale, below.have)} of ${number(locale, below.need)} required`,
              `Перелётов с известным аэропортом ${number(locale, below.have)} из ${number(locale, below.need)} нужных`,
            )
          : copy(locale, 'No flights with a known airport', 'Нет перелётов с известным аэропортом'),
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
