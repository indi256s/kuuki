'use client'

import { Lock } from '@keyline-icons/react'
import { useEffect, useId, useRef, useState, type MouseEvent, type RefObject } from 'react'
import type { LeaderboardCategory } from '../../../../../functions/api/_lib/leaderboard'
import type { LeaderboardBoardPayload } from '../../../../../functions/api/_services/publicLeaderboard'
import type { Locale } from '../../lib/format'
import { GateTile } from '../ui/gate-tile'
import { SplitFlap } from '../ui/split-flap'
import { categoryGroups as groups, categoryName, groupName } from './categories'
import { tileModel, type Period } from './model'

export const categoryHref = (category: string, period: string) =>
  `/leaderboard?category=${category}&period=${period}`

export function CategoryStrip({
  payload,
  locale,
  category,
  period,
  shownRanks,
  navRef,
  onSelect,
}: {
  payload: LeaderboardBoardPayload
  locale: Locale
  category: LeaderboardCategory
  period: Period
  /** All-time ranks to show instead of the published ones while a rank-up waits to flip. */
  shownRanks: Partial<Record<LeaderboardCategory, number>>
  navRef: RefObject<HTMLElement | null>
  onSelect: (category: LeaderboardCategory) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const id = useId()
  const [announced, setAnnounced] = useState('')
  // The strip scrolls sideways on phones; a fade shows only on an edge that can still scroll.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const update = () => {
      element.toggleAttribute('data-fade-start', element.scrollLeft > 1)
      element.toggleAttribute(
        'data-fade-end',
        element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      )
    }
    // Centre the selected tile by moving only the strip, never the page.
    const selected = element.querySelector<HTMLElement>('[aria-current="page"]')
    if (selected && element.scrollWidth > element.clientWidth)
      element.scrollLeft = selected.offsetLeft - (element.clientWidth - selected.offsetWidth) / 2
    update()
    element.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      element.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active)
        setAnnounced(
          `${locale === 'ru' ? 'Категория рейтинга' : 'Leaderboard category'}: ${categoryName(category, locale)}`,
        )
    })
    return () => {
      active = false
    }
  }, [category, locale])
  const onClick = (event: MouseEvent<HTMLAnchorElement>, key: LeaderboardCategory) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    onSelect(key)
  }
  return (
    <>
      <p className="sr-only" role="status">
        {announced}
      </p>
      <nav
        ref={navRef}
        aria-label={locale === 'ru' ? 'Категории рейтинга' : 'Leaderboard categories'}
      >
        <div className="leaderboard-tiles" ref={scroller}>
          {groups.map(([group, keys]) => (
            <div
              key={group}
              role="group"
              aria-labelledby={`${id}-${group}`}
              className="leaderboard-group"
            >
              <p className="leaderboard-group-label" id={`${id}-${group}`}>
                {groupName[group][locale === 'ru' ? 1 : 0]}
              </p>
              <div className="leaderboard-group-tiles">
                {keys.map((key) => {
                  const label = categoryName(key, locale)
                  const model = tileModel(
                    payload,
                    key,
                    period,
                    label,
                    locale,
                    period === 'all' ? shownRanks[key] : undefined,
                  )
                  return (
                    <GateTile
                      key={key}
                      size="compact"
                      href={categoryHref(key, period)}
                      data-category={key}
                      aria-current={key === category ? 'page' : undefined}
                      label={label}
                      ariaLabel={model.name}
                      onClick={(event) => onClick(event, key)}
                      value={
                        model.kind === 'rank' ? (
                          <SplitFlap
                            key={period}
                            value={`${model.shared ? '=' : '#'}${model.rank}`}
                            entering={false}
                          />
                        ) : model.kind === 'lock' ? (
                          <Lock size={24} aria-hidden="true" />
                        ) : (
                          model.text
                        )
                      }
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </>
  )
}

/** The error page's strip: the same tiles, links only, no values and no data read. */
export function StaticStrip({ locale }: { locale: Locale }) {
  return (
    <nav aria-label={locale === 'ru' ? 'Категории рейтинга' : 'Leaderboard categories'}>
      <div className="leaderboard-tiles">
        {groups.map(([group, keys]) => (
          <div
            key={group}
            className="leaderboard-group"
            role="group"
            aria-label={groupName[group][locale === 'ru' ? 1 : 0]}
          >
            <p className="leaderboard-group-label" aria-hidden="true">
              {groupName[group][locale === 'ru' ? 1 : 0]}
            </p>
            <div className="leaderboard-group-tiles">
              {keys.map((key) => (
                <GateTile
                  key={key}
                  size="compact"
                  href={categoryHref(key, 'all')}
                  label={categoryName(key, locale)}
                  ariaLabel={categoryName(key, locale)}
                  value={null}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  )
}
