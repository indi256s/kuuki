'use client'

import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import type { Rankings } from '@kuuki/shared/overview/rankings'
import { Button } from '../../../ui/button'
import { useOverview } from '../../store/overview-context'
import { copy, flights, percent, number } from './display'
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
  const { locale, actions, isCurrent } = useOverview()
  const [picked, setPicked] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const selection = pattern.categories.find((item) => item.key === picked && item.count > 0)
  const title =
    pattern.id === 'haul'
      ? copy(locale, 'Flight length', 'Дальность перелётов')
      : copy(locale, 'Departure schedule', 'Время вылета')
  const label = (key: string) => {
    if (key === 'unknown')
      return copy(
        locale,
        pattern.id === 'haul' ? 'Unknown distance' : 'Unknown time',
        pattern.id === 'haul' ? 'Расстояние неизвестно' : 'Время не указано',
      )
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
      : key === 'day' || key === 'short-medium'
        ? 'var(--cmp-1)'
        : 'var(--cmp-2)'
  const inspect = (key: string) => {
    setPicked(key)
    setExpanded(true)
  }
  const filterSelection = () => {
    if (!selection || selection.key === 'unknown' || !isCurrent()) return
    if (pattern.id === 'haul') {
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
  const hasDetails =
    filtered || pattern.id === 'daytime' || (selection && selection.key !== 'unknown')
  return (
    <article className="ov3-pattern">
      <div className="ov3-pattern-heading">
        <h3>{title}</h3>
        <span>{flights(locale, pattern.total)}</span>
      </div>
      {pattern.total > 0 ? (
        <div className="ov3-pattern-legend">
          {pattern.categories
            .filter((item) => item.count > 0)
            .map((item) => (
              <button
                key={item.key}
                type="button"
                aria-label={description(item, pattern.total)}
                aria-pressed={selection?.key === item.key}
                onClick={() => inspect(item.key)}
              >
                <span>{label(item.key)}</span>
                <span className="ov3-pattern-ratio" aria-hidden="true">
                  <i
                    data-unknown={item.key === 'unknown' || undefined}
                    style={
                      {
                        '--pattern-color': color(item.key),
                        inlineSize: `${(item.count / pattern.total) * 100}%`,
                      } as CSSProperties
                    }
                  />
                </span>
                <strong>
                  {number(locale, item.count)} · {percent(item.count / pattern.total)}
                </strong>
              </button>
            ))}
        </div>
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
                        {number(locale, count)} ·{' '}
                        {pattern.total ? percent(count / pattern.total) : '—'}
                      </td>
                      <td>
                        {number(locale, lifetime)} ·{' '}
                        {baseline.total ? percent(lifetime / baseline.total) : '—'}
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
      {patterns
        .filter((pattern) => pattern.id !== 'makers')
        .map((pattern) => (
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
