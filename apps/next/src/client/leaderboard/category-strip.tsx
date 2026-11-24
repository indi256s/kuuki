'use client'

import { Lock } from '@keyline-icons/react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react'
import type { LeaderboardCategory } from '../../../../../functions/api/_lib/leaderboard'
import type { LeaderboardBoardPayload } from '../../../../../functions/api/_services/publicLeaderboard'
import type { Locale } from '../../lib/format'
import { GateTile } from '../ui/gate-tile'
import { SplitFlap } from '../ui/split-flap'
import { useScrollFade } from '../ui/use-scroll-fade'
import { categoryGroups as groups, categoryName, groupName, tileLabel } from './categories'
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
  shownRanks: Partial<Record<LeaderboardCategory, number>>
  navRef: RefObject<HTMLElement | null>
  onSelect: (category: LeaderboardCategory) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const id = useId()
  const [announced, setAnnounced] = useState('')
  useEffect(() => {
    const element = scroller.current
    const selected = element?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!element || !selected || element.scrollWidth <= element.clientWidth) return
    const edge = 28
    const box = element.getBoundingClientRect()
    const tile = selected.getBoundingClientRect()
    const group = selected.closest<HTMLElement>('.leaderboard-group')?.getBoundingClientRect()
    if (tile.left < box.left + edge) {
      const target = group && tile.right - group.left <= box.width - edge ? group.left : tile.left
      element.scrollLeft += target - box.left - edge
    } else if (tile.right > box.right - edge) {
      element.scrollLeft += tile.right - box.right + edge
    }
  }, [category])
  useScrollFade(scroller)
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
        className="leaderboard-strip"
        aria-label={locale === 'ru' ? 'Категории рейтинга' : 'Leaderboard categories'}
        onPointerDownCapture={(event) => {
          event.currentTarget.dataset.input = 'pointer'
        }}
        onKeyDownCapture={(event) => {
          event.currentTarget.dataset.input = 'keyboard'
        }}
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
                  const model = tileModel(
                    payload,
                    key,
                    period,
                    categoryName(key, locale),
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
                      label={tileLabel(key, locale)}
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
                          <Lock size={16} aria-hidden="true" />
                        ) : model.kind === 'progress' ? (
                          <span
                            className="gate-tile-progress"
                            style={
                              {
                                '--progress': Math.min(1, model.have / model.need),
                              } as CSSProperties
                            }
                          >
                            {model.text}
                          </span>
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

export function StaticStrip({ locale }: { locale: Locale }) {
  return (
    <nav
      className="leaderboard-strip"
      aria-label={locale === 'ru' ? 'Категории рейтинга' : 'Leaderboard categories'}
    >
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
                  label={tileLabel(key, locale)}
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
