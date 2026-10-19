'use client'

import { useState, type CSSProperties } from 'react'
import { makerOf, type MakerKey } from '@kuuki/data/aircraft-makers'
import { matches } from '@kuuki/shared/overview/filter'
import { totals } from '@kuuki/shared/overview/figures'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { formatDuration } from '../../../../lib/format'
import { MakerSwatch } from '../../../ui/category-mark'
import { Button } from '../../../ui/button'
import { SegmentedControl } from '../../../ui/segmented-control'
import { LazyChart } from '../../charts/lazy-chart'
import { ArcWaffle } from '../../charts/arc-waffle'
import { StageRows } from '../../charts/stage-rows'
import { fill } from '../../copy'
import { ChapterCard } from '../../layout/chapter-card'
import { useReading } from '../../layout/use-reading'
import { useOverview } from '../../store/overview-context'
import { FleetBodies, FleetRidgelines } from '../fleet/section'
import { ManufacturersDetails, makerName } from '../manufacturers/section'
import type { Span } from '../registry'
import { copy, filterLabel, flights, number } from '../rankings/display'
import { FleetFigure, HangarsFigure } from './figure'
import { hasDims } from '../../iso/fleet'
import { makerRows, planSheds, shareText } from './model'
import './aircraft.css'

type View = 'makers' | 'fleet'
/** One stage reading: a maker (Makers) or an ICAO type (Fleet). */
type Row = {
  key: string
  name: string
  maker: MakerKey
  flights: number
  share: number
  value: number
}

const ordinal = (locale: 'en' | 'ru', n: number) => {
  if (locale === 'ru') return `${n}-й`
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? 'th'
      : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th')
  return `${n}${suffix}`
}

export function Section({ span }: { span: Span }) {
  const { scope, all, payload, filter, locale, actions, isCurrent } = useOverview()
  const [view, setView] = useState<View>('makers')
  const makers = scope?.makers.status === 'ready' ? scope.makers.value : null
  const fleet = scope?.fleet.status === 'ready' ? scope.fleet.value : null
  const made = makers ? makerRows(makers) : null
  const typed = scope?.coverage.typed ?? 0
  const known = made?.rows.filter((row) => row.key !== 'unknown') ?? []
  const rows: Row[] =
    view === 'makers'
      ? (made?.rows ?? []).map((row) => ({
          key: row.key,
          name: makerName(row.key, locale),
          maker: row.key,
          flights: row.flights,
          share: row.share,
          value: row.share,
        }))
      : (fleet?.topTypes ?? []).slice(0, 5).map((row) => ({
          key: row.key,
          name: row.key,
          maker: makerOf(row.key),
          flights: row.flights,
          share: typed ? row.flights / typed : 0,
          value: row.flights,
        }))
  const keys = rows.map((row) => row.key)
  // The headline is the most flown maker (Unknown is never it) or the most flown type.
  const r = useReading(keys, keys[0] ?? null)
  const reading = rows.find((row) => row.key === r.reading) ?? rows[0] ?? null

  const plan = planSheds(
    makerRows(makers ?? (all?.makers.status === 'ready' ? all.makers.value : EMPTY)).rows,
    (key) => makerName(key, locale),
    locale,
  )
  const lit = reading ? plan.shedOf(reading.maker) : null
  const facet = view === 'makers' ? 'makers' : 'aircraft'
  const only = (key: string) => {
    if (!isCurrent()) return
    if (view === 'makers') actions.add('makers', key as MakerKey)
    else actions.add('aircraft', key)
  }
  const applied: readonly string[] = (filter[facet] as string[] | undefined) ?? []

  const gate = scope ? SECTION_GATES.aircraft.gate(scope) : null
  const state = !scope || !all ? 'loading' : makers && fleet && reading ? 'ready' : 'empty'
  const typeName = (key: string) => payload?.refs.aircraft[key]?.name ?? key

  const title =
    view === 'makers'
      ? copy(locale, 'All flights by maker', 'Все перелёты по производителям')
      : copy(locale, 'Most-flown types', 'Самые частые типы')
  const spoken = (row: Row) =>
    view === 'makers'
      ? `${row.name}, ${shareText(row.share)} · ${flights(locale, row.flights)}`
      : `${row.key}, ${flights(locale, row.flights)}`
  const points = rows.map((row) => ({ key: row.key, datum: row, label: spoken(row) }))
  const plotHeight =
    view === 'makers' && span === 'full'
      ? Math.max(238, points.length * 36 + 26)
      : span === 'sheet'
        ? 176
        : 206

  const rowHeight = span === 'sheet' ? 44 : plotHeight / Math.max(1, points.length)

  let value = '—',
    unit: string | undefined,
    caption = ''
  if (reading) {
    const rank = keys.indexOf(reading.key) + 1
    if (view === 'makers' && reading.maker === 'unknown') {
      value = number(locale, reading.flights)
      unit = copy(locale, 'unknown', 'без производителя')
      caption = copy(
        locale,
        `${shareText(reading.share)} of all flights have an unknown maker`,
        `${shareText(reading.share)} всех перелётов с неизвестным производителем`,
      )
    } else if (view === 'makers') {
      value = shareText(reading.share)
      unit = reading.name
      if (r.isHeadline) {
        const others = known
          .filter((row) => row.key !== reading.key)
          .slice(0, 2)
          .map((row) => `${makerName(row.key, locale)} ${shareText(row.share)}`)
          .join(', ')
        caption = others
          ? others
          : copy(
              locale,
              `${shareText(reading.share)} of all flights`,
              `${shareText(reading.share)} всех перелётов`,
            )
      } else {
        caption = copy(
          locale,
          `${flights(locale, reading.flights)} of ${number(locale, made?.total ?? 0)} · ${ordinal(locale, rank)} of ${known.length} makers`,
          `${flights(locale, reading.flights)} из ${number(locale, made?.total ?? 0)} · ${ordinal(locale, rank)} из ${known.length} производителей`,
        )
      }
    } else {
      value = number(locale, reading.flights)
      unit = `× ${reading.key}`
      const share = shareText(reading.share)
      const who = hasDims(reading.key)
        ? typeName(reading.key)
        : `${typeName(reading.key)} (${copy(locale, 'body-class silhouette', 'силуэт класса самолёта')})`
      caption = r.isHeadline
        ? copy(
            locale,
            `${who} · ${share} of flights with an aircraft`,
            `${who} · ${share} перелётов с самолётом`,
          )
        : copy(
            locale,
            `${who} · ${makerName(reading.maker, locale)} · ${share} of flights with an aircraft · ${ordinal(locale, rank)} most flown`,
            `${who} · ${makerName(reading.maker, locale)} · ${share} перелётов с самолётом · ${ordinal(locale, rank)} по частоте`,
          )
    }
  }

  // The journal rows behind the reading: a maker's flights or a type's.
  const behind =
    reading && payload
      ? payload.rows.filter(
          (row) =>
            (row.state === 'logged' || row.state === 'awaiting') &&
            (view === 'makers'
              ? makerOf(row.aircraft) === reading.key
              : row.aircraft === reading.key) &&
            matches(row, filter, payload.refs),
        )
      : []
  // Flights, distance and time of the reading: a maker's from the makers figure, a type's from its rows.
  const sum = (() => {
    if (!reading) return null
    if (view === 'makers') {
      const row = made?.rows.find((item) => item.key === reading.key)
      return row ? { flights: row.flights, km: row.km, minutes: row.minutes } : null
    }
    if (!payload) return null
    const mine = totals(behind)
    return { flights: mine.flights, km: mine.distanceKm, minutes: mine.durationMinutes }
  })()
  const columns = sum
    ? [
        { value: number(locale, sum.flights), label: copy(locale, 'Flights', 'Перелёты') },
        {
          value:
            sum.km > 0 ? `${number(locale, Math.round(sum.km))} ${copy(locale, 'km', 'км')}` : '—',
          label: copy(locale, 'Distance', 'Расстояние'),
        },
        {
          value: sum.minutes > 0 ? formatDuration(locale, sum.minutes) : '—',
          label: copy(locale, 'Time in the air', 'Время в воздухе'),
        },
      ]
    : []
  const coverage =
    scope && scope.coverage.typed < scope.coverage.total
      ? fill(
          copy(
            locale,
            'Based on {n} of {m} flights with an aircraft',
            'По {n} из {m} перелётов с самолётом',
          ),
          { n: number(locale, scope.coverage.typed), m: number(locale, scope.coverage.total) },
        )
      : null

  return (
    <div
      className="ov3-aircraft"
      style={{ '--aircraft-plot-height': `${plotHeight}px` } as CSSProperties}
    >
      <ChapterCard
        state={state}
        figure={
          view === 'fleet' && reading ? (
            <FleetFigure
              icao={reading.key}
              body={payload?.refs.aircraft[reading.key]?.type ?? null}
            />
          ) : (
            <HangarsFigure plan={plan} lit={state === 'ready' ? lit : null} picked={r.picked} />
          )
        }
        figureButton={
          rows.length > 1
            ? {
                label:
                  view === 'makers'
                    ? copy(locale, 'Show next maker', 'Показать следующего производителя')
                    : copy(locale, 'Show next type', 'Показать следующий тип'),
                onPress: r.next,
              }
            : undefined
        }
        hero={{
          value,
          unit,
          caption,
          only:
            reading && !r.isHeadline && !applied.includes(reading.key)
              ? {
                  label: copy(locale, `Only ${reading.name}`, `Только ${reading.name}`),
                  onPress: () => only(reading.key),
                }
              : null,
        }}
        rollValue={r.picked}
        chart={{
          caption: title,
          layout: 'content',
          toggle: (
            <SegmentedControl
              dense
              value={view}
              onChange={setView}
              label={copy(locale, 'Aircraft view', 'Вид самолётов')}
              options={[
                { value: 'makers', label: copy(locale, 'Makers', 'Производители') },
                { value: 'fleet', label: copy(locale, 'Fleet', 'Парк') },
              ]}
            />
          ),
          table: {
            caption: title,
            columns: [
              {
                key: 'name',
                label:
                  view === 'makers'
                    ? copy(locale, 'Maker', 'Производитель')
                    : copy(locale, 'Type', 'Тип'),
              },
              { key: 'flights', label: copy(locale, 'Flights', 'Перелёты'), numeric: true },
              { key: 'share', label: copy(locale, 'Share', 'Доля'), numeric: true },
            ],
            rows: rows.map((row) => ({
              name: view === 'makers' ? row.name : `${row.key} · ${typeName(row.key)}`,
              flights: row.flights,
              share: shareText(row.share),
            })),
          },
          plot: (
            <LazyChart height={plotHeight} label={title}>
              {(inView) =>
                view === 'makers' && span === 'full' ? (
                  <ArcWaffle
                    points={points}
                    value={(point) => point.datum.flights}
                    name={(point) => point.datum.name}
                    format={(point) =>
                      `${number(locale, point.datum.flights)} · ${shareText(point.datum.share)}`
                    }
                    fill={(point) => `var(--cat-maker-${point.datum.maker})`}
                    outline={(point) => point.datum.maker === 'unknown'}
                    selectedKey={r.reading}
                    appliedKeys={applied}
                    inView={inView}
                    height={plotHeight}
                    ariaLabel={title}
                    note={copy(
                      locale,
                      '100 cells · rounded shares, exact counts in legend',
                      '100 ячеек · округлённые доли, точные числа в легенде',
                    )}
                    onPick={(point) => r.pick(point.key)}
                    actions={(point) => [
                      { label: filterLabel(locale), run: () => only(point.key) },
                    ]}
                    tip={(selected) => <span>{selected[0].label}</span>}
                  />
                ) : (
                  <div className={span === 'sheet' ? 'ov3-aircraft-sheet-rows' : undefined}>
                    <StageRows
                      rowHeight={rowHeight}
                      points={points}
                      value={(point) => point.datum.value}
                      format={(point) =>
                        view === 'fleet'
                          ? number(locale, point.datum.flights)
                          : `${number(locale, point.datum.flights)} · ${shareText(point.datum.share)}`
                      }
                      name={(point) => point.datum.name}
                      valueWidth={view === 'makers' ? 104 : undefined}
                      mono={view === 'fleet'}
                      swatch={(point) => <MakerSwatch maker={point.datum.maker} />}
                      fill={(point) => `var(--cat-maker-${point.datum.maker})`}
                      outline={(point) => point.datum.maker === 'unknown'}
                      span={span}
                      selectedKey={r.reading}
                      appliedKeys={applied}
                      inView={inView}
                      ariaLabel={title}
                      onPick={(point) => r.pick(point.key)}
                      actions={(point) => [
                        { label: filterLabel(locale), run: () => only(point.key) },
                      ]}
                      tip={(selected) => <span>{selected[0].label}</span>}
                    />
                  </div>
                )
              }
            </LazyChart>
          ),
        }}
        details={{
          heading: copy(locale, 'Makers and fleet', 'Производители и парк'),
          columns,
          coverage,
          more: [
            {
              summary: copy(locale, 'Manufacturers and types', 'Производители и типы'),
              content: (
                <div className="ov3-aircraft-more">
                  <ManufacturersDetails />
                  <FleetBodies />
                </div>
              ),
            },
            {
              summary: copy(locale, 'Flight length by type', 'Длительность по типам'),
              content: <FleetRidgelines span={span} />,
            },
          ],
        }}
        empty={{
          title:
            gate?.status === 'below'
              ? copy(
                  locale,
                  'Too few flights with aircraft',
                  'Мало перелётов с известным самолётом',
                )
              : copy(locale, 'Unknown manufacturers', 'Производители неизвестны'),
          line:
            gate?.status === 'below'
              ? copy(
                  locale,
                  `Flights with a known aircraft ${number(locale, gate.have)} of ${number(locale, gate.need)} required`,
                  `Перелётов с известным самолётом ${number(locale, gate.have)} из ${number(locale, gate.need)} нужных`,
                )
              : copy(
                  locale,
                  'No flights with a known maker',
                  'Нет перелётов с известным производителем',
                ),
          action: (
            <Button
              dense
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
    </div>
  )
}

const EMPTY = {
  rows: [],
  totals: { flights: 0, minutes: 0, km: 0, minutesApproximate: false },
  flights: [],
}
