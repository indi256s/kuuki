'use client'

import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import { MAKER_NAMES, type MakerKey } from '@kuuki/data/aircraft-makers'
import type { Rankings } from '@kuuki/shared/overview/rankings'
import { Button } from '../../../ui/button'
import { PayloadAircraftReview } from '../manufacturers/aircraft-review'
import { useOverview } from '../../store/overview-context'
import { copy, flights, percent } from './display'
import './travel-patterns.css'

type Pattern = Rankings['patterns'][number]

function PatternEvidence({
  pattern,
  baseline,
  filtered,
}: {
  pattern: Pattern
  baseline: Pattern
  filtered: boolean
}) {
  const { locale, actions, isCurrent, scope } = useOverview()
  const [picked, setPicked] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const selection = pattern.categories.find((item) => item.key === picked && item.count > 0)
  const title = {
    makers: copy(locale, 'Aircraft manufacturers', 'Производители самолётов'),
    haul: copy(locale, 'Flight length', 'Дальность перелётов'),
    daytime: copy(locale, 'Departure schedule', 'Время вылета'),
  }[pattern.id]
  const label = (key: string) => {
    if (key === 'unknown')
      return copy(
        locale,
        pattern.id === 'makers'
          ? 'Unknown aircraft'
          : pattern.id === 'haul'
            ? 'Unknown distance'
            : 'Unknown time',
        pattern.id === 'makers'
          ? 'Самолёт не указан'
          : pattern.id === 'haul'
            ? 'Расстояние неизвестно'
            : 'Время не указано',
      )
    if (pattern.id === 'makers')
      return key === 'other'
        ? copy(locale, 'Other makers', 'Другие производители')
        : MAKER_NAMES[key as keyof typeof MAKER_NAMES]
    if (pattern.id === 'haul')
      return key === 'long'
        ? copy(locale, 'Long haul', 'Дальние')
        : copy(locale, 'Short & medium haul', 'Ближние и средние')
    return key === 'day'
      ? copy(locale, 'Day departures', 'Дневные вылеты')
      : copy(locale, 'Night departures', 'Ночные вылеты')
  }
  const color = (key: string) =>
    key === 'unknown'
      ? 'var(--surface)'
      : pattern.id === 'makers'
        ? `var(--cat-maker-${key})`
        : key === 'day' || key === 'short-medium'
          ? 'var(--accent)'
          : 'var(--mark-2)'
  const inspect = (key: string) => {
    setPicked(key)
    setExpanded(true)
  }
  const filterSelection = () => {
    if (!selection || selection.key === 'unknown' || !isCurrent()) return
    if (pattern.id === 'makers') actions.add('makers', selection.key as MakerKey)
    else if (pattern.id === 'haul') {
      actions.add('haul', selection.key === 'long' ? 'long' : 'short')
      if (selection.key === 'short-medium') actions.add('haul', 'medium')
    } else {
      actions.add('departureBands', selection.key === 'night' ? 'night' : 'morning')
      if (selection.key === 'day') {
        actions.add('departureBands', 'afternoon')
        actions.add('departureBands', 'evening')
      }
    }
  }
  const description = (item: Pattern['categories'][number], total: number) =>
    `${label(item.key)}: ${flights(locale, item.count)} · ${total > 0 ? percent(item.count / total) : '—'}`
  const unknown = pattern.categories.find((item) => item.key === 'unknown')?.count ?? 0
  const aircraftReview =
    unknown > 0 && pattern.id === 'makers' && scope && scope.coverage.total > scope.coverage.typed
  const hasDetails =
    filtered ||
    pattern.id === 'daytime' ||
    aircraftReview ||
    (selection && selection.key !== 'unknown')
  return (
    <article className="ov3-pattern">
      <div className="ov3-pattern-heading">
        <h3>{title}</h3>
        <span>{flights(locale, pattern.total)}</span>
      </div>
      {pattern.total > 0 ? (
        <>
          <div className="ov3-pattern-stack" aria-label={title}>
            {pattern.categories
              .filter((item) => item.count > 0)
              .map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-unknown={item.key === 'unknown' || undefined}
                  style={
                    { flexGrow: item.count, '--pattern-color': color(item.key) } as CSSProperties
                  }
                  aria-label={description(item, pattern.total)}
                  aria-pressed={selection?.key === item.key}
                  onClick={() => inspect(item.key)}
                />
              ))}
          </div>
          <div className="ov3-pattern-legend">
            {pattern.categories
              .filter((item) => item.count > 0)
              .map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selection?.key === item.key}
                  onClick={() => inspect(item.key)}
                >
                  <i
                    data-unknown={item.key === 'unknown' || undefined}
                    style={{ '--pattern-color': color(item.key) } as CSSProperties}
                    aria-hidden="true"
                  />
                  <span>{label(item.key)}</span>
                  <strong>
                    {item.count} · {percent(item.count / pattern.total)}
                  </strong>
                </button>
              ))}
          </div>
        </>
      ) : (
        <p>{copy(locale, 'No flights in this selection', 'В выборке нет перелётов')}</p>
      )}
      {hasDetails && (
        <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
          <summary>
            {copy(
              locale,
              filtered ? 'Lifetime comparison' : 'Details',
              filtered ? 'Сравнение со всей историей' : 'Подробности',
            )}
          </summary>
          {selection && <p role="status">{label(selection.key)}</p>}
          {pattern.id === 'daytime' && (
            <p>
              {copy(
                locale,
                'Day: 06:00–21:59. Night: 22:00–05:59. Departure airport local time.',
                'День: 06:00–21:59. Ночь: 22:00–05:59. Местное время аэропорта вылета.',
              )}
            </p>
          )}
          {filtered && (
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th>{copy(locale, 'Category', 'Категория')}</th>
                  <th>{copy(locale, 'Selected flights', 'Перелёты в выборке')}</th>
                  <th>{copy(locale, 'Whole lifetime journal', 'Вся история перелётов')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Set(
                    [...pattern.categories, ...baseline.categories].map((item) => item.key),
                  ),
                ].map((key) => {
                  const count = pattern.categories.find((item) => item.key === key)?.count ?? 0
                  const lifetime = baseline.categories.find((item) => item.key === key)?.count ?? 0
                  return (
                    <tr key={key}>
                      <th scope="row">{label(key)}</th>
                      <td>
                        {count} · {pattern.total ? percent(count / pattern.total) : '—'}
                      </td>
                      <td>
                        {lifetime} · {baseline.total ? percent(lifetime / baseline.total) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {filtered && (
            <p>
              {copy(locale, 'Whole lifetime journal', 'Вся история перелётов')}:{' '}
              {flights(locale, baseline.total)}
            </p>
          )}
          <div className="ov3-pattern-actions">
            {selection && selection.key !== 'unknown' && (
              <Button dense variant="secondary" onClick={filterSelection}>
                {copy(locale, 'Filter Overview', 'Фильтровать обзор')}
              </Button>
            )}
            {aircraftReview && <PayloadAircraftReview />}
            {unknown > 0 && pattern.id === 'daytime' && (
              <Link className="ui-button" data-variant="ghost" href="/journal">
                {copy(locale, 'Add times', 'Указать время')}
              </Link>
            )}
          </div>
        </details>
      )}
    </article>
  )
}

export function TravelPatterns({
  patterns,
  baseline,
  filtered,
}: {
  patterns: Pattern[]
  baseline: Pattern[]
  filtered: boolean
}) {
  return (
    <div className="ov3-patterns">
      {patterns.map((pattern) => (
        <PatternEvidence
          key={pattern.id}
          pattern={pattern}
          baseline={baseline.find((item) => item.id === pattern.id)!}
          filtered={filtered}
        />
      ))}
    </div>
  )
}
