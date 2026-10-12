'use client'

import { useState } from 'react'
import { makerOf, type MakerKey } from '@kuuki/data/aircraft-makers'
import { matches } from '@kuuki/shared/overview/filter'
import { totals } from '@kuuki/shared/overview/figures'
import { SECTION_GATES } from '@kuuki/shared/overview/goals'
import { formatDuration } from '../../../../lib/format'
import { MakerSwatch } from '../../../ui/category-mark'
import { Button } from '../../../ui/button'
import { SegmentedControl } from '../../../ui/segmented-control'
import { LazyChart } from '../../charts/lazy-chart'
import { StageRows } from '../../charts/stage-rows'
import { fill } from '../../copy'
import { ChapterCard } from '../../layout/chapter-card'
import { useReading } from '../../layout/use-reading'
import { useOverview } from '../../store/overview-context'
import { FleetBodies, FleetRidgelines } from '../fleet/section'
import { ManufacturersDetails, makerName } from '../manufacturers/section'
import type { Span } from '../registry'
import { copy, filterLabel, flights, number } from '../rankings/display'
import { HangarsFigure } from './figure'
import { makerRows, planSheds, shareText } from './model'
import './aircraft.css'

type View = 'makers' | 'fleet'
/** One bar of the stage: a maker (Makers) or an ICAO type (Fleet). `value` is what the bar is drawn from. */
type Row = {
  key: string
  name: string
  maker: MakerKey
  flights: number
  share: number
  value: number
}

const ordinal = (locale: 'en' | 'ru', n: number) =>
  locale === 'ru' ? `${n}-й` : (['1st', '2nd', '3rd', '4th', '5th', '6th'][n - 1] ?? `${n}th`)

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
  const state =
    !scope || !all ? 'loading' : makers && fleet && reading && !plan.blank ? 'ready' : 'empty'
  const typeName = (key: string) => payload?.refs.aircraft[key]?.name ?? key

  const title =
    view === 'makers'
      ? copy(locale, 'Share of known-maker flights', 'Доля среди известных производителей')
      : copy(locale, 'Most-flown types', 'Самые частые типы')
  const spoken = (row: Row) =>
    view === 'makers'
      ? row.maker === 'unknown'
        ? `${row.name}, ${flights(locale, row.flights)}`
        : `${row.name}, ${shareText(row.share)} · ${flights(locale, row.flights)}`
      : `${row.key}, ${flights(locale, row.flights)}`
  const points = rows.map((row) => ({ key: row.key, datum: row, label: spoken(row) }))

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
        'Flights with no maker on file. The hangars have no door for them.',
        'Перелёты без производителя в данных. Для них в ангарах нет ворот.',
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
        const dry =
          reading.share >= 0.5
            ? copy(
                locale,
                'Loyalty, or just the cheapest fare.',
                'Верность или просто самый дешёвый билет.',
              )
            : copy(
                locale,
                'No favourites, or no say in the matter.',
                'Любимчиков нет, или выбирали не вы.',
              )
        caption = others
          ? `${others}. ${dry}`
          : copy(
              locale,
              `Every flight with a known maker is ${reading.name}. Loyalty, or a short list.`,
              `Все перелёты с известным производителем: ${reading.name}. Верность или короткий список.`,
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
      const who = typeName(reading.key)
      caption = r.isHeadline
        ? copy(
            locale,
            `${who} · ${share} of flights with an aircraft. You know its safety card by heart.`,
            `${who} · ${share} перелётов с самолётом. Памятку по безопасности вы знаете наизусть.`,
          )
        : copy(
            locale,
            `${who} · ${makerName(reading.maker, locale)} · ${share} of flights with an aircraft · ${ordinal(locale, rank)} most flown`,
            `${who} · ${makerName(reading.maker, locale)} · ${share} перелётов с самолётом · ${ordinal(locale, rank)} по частоте`,
          )
    }
  }

  // Flights, distance and time of the reading: a maker's from the makers figure, a type's from the journal's own rows.
  const sum = (() => {
    if (!reading) return null
    if (view === 'makers') {
      const row = made?.rows.find((item) => item.key === reading.key)
      return row ? { flights: row.flights, km: row.km, minutes: row.minutes } : null
    }
    if (!payload) return null
    const mine = totals(
      payload.rows.filter(
        (row) =>
          (row.state === 'logged' || row.state === 'awaiting') &&
          row.aircraft === reading.key &&
          matches(row, filter, payload.refs),
      ),
    )
    return { flights: mine.flights, km: mine.distanceKm, minutes: mine.durationMinutes }
  })()
  const approximate = view === 'makers' && makers?.totals.minutesApproximate ? '≈ ' : ''
  const columns = sum
    ? [
        { value: number(locale, sum.flights), label: copy(locale, 'Flights', 'Перелёты') },
        {
          value:
            sum.km > 0 ? `${number(locale, Math.round(sum.km))} ${copy(locale, 'km', 'км')}` : '—',
          label: copy(locale, 'Distance', 'Расстояние'),
        },
        {
          value: sum.minutes > 0 ? `${approximate}${formatDuration(locale, sum.minutes)}` : '—',
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
    <ChapterCard
      state={state}
      figure={<HangarsFigure plan={plan} lit={state === 'ready' ? lit : null} picked={r.picked} />}
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
            share: row.maker === 'unknown' && view === 'makers' ? '—' : shareText(row.share),
          })),
        },
        plot: (
          <LazyChart height={points.length * 24} label={title}>
            {(inView) => (
              <StageRows
                points={points}
                value={(point) => point.datum.value}
                format={(point) =>
                  view === 'fleet'
                    ? number(locale, point.datum.flights)
                    : point.datum.maker === 'unknown'
                      ? flights(locale, point.datum.flights)
                      : shareText(point.datum.share)
                }
                name={(point) => point.datum.name}
                // Unknown reads as a count ("5 flights", «5 перелётов»), wider than a share.
                valueWidth={
                  view !== 'fleet' && points.some((point) => point.datum.maker === 'unknown')
                    ? 88
                    : undefined
                }
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
                actions={(point) => [{ label: filterLabel(locale), run: () => only(point.key) }]}
                tip={(selected) => <span>{selected[0].label}</span>}
              />
            )}
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
        title: copy(locale, 'The hangars are shut', 'Ангары закрыты'),
        line:
          gate?.status === 'below' && gate.have > 0
            ? copy(
                locale,
                `This filter leaves ${flights(locale, gate.have)} with a known aircraft. The hangars open at ${number(locale, gate.need)} and don't haggle.`,
                `Самолёт в выборке указан лишь у ${number(locale, gate.have)} из ${number(locale, gate.need)} нужных перелётов. Ангары не торгуются.`,
              )
            : copy(
                locale,
                'No flight in this filter has a known maker. The hangars admit no strangers.',
                'Ни у одного перелёта в выборке производитель не известен. Посторонним вход в ангар воспрещён.',
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
  )
}

const EMPTY = {
  rows: [],
  other: [],
  totals: { flights: 0, minutes: 0, km: 0, minutesApproximate: false },
  flights: [],
}
