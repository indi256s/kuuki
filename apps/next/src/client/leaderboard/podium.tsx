'use client'

import Link from 'next/link'
import {
  isGroundCategory,
  type LeaderboardCategory,
} from '../../../../../functions/api/_lib/leaderboard'
import type { LeaderboardEntry } from '../../../../../functions/api/_services/publicLeaderboard'
import { formatNumber, type Locale } from '../../lib/format'
import { ProfileAvatar } from '../profile/avatar'
import { SplitFlap } from '../ui/split-flap'
import { categoryUnit } from './categories'
import { entryName } from './model'

const RISE_SCRIPT =
  "try{var k='kuuki:leaderboard-podium';if(sessionStorage.getItem(k))document.currentScript.previousElementSibling.removeAttribute('data-rise');else sessionStorage.setItem(k,'1')}catch(e){}"

/** People on the same place stand on the same step; a step missing from the top three is a free sign. */
function steps(top: LeaderboardEntry[]) {
  const byRank = new Map<number, LeaderboardEntry[]>()
  for (const entry of top) {
    if (entry.rank > 3) continue
    byRank.set(entry.rank, [...(byRank.get(entry.rank) ?? []), entry])
  }
  return [...byRank.entries()].sort(([a], [b]) => a - b).map(([rank, people]) => ({ rank, people }))
}

export function Podium({
  top,
  category,
  period,
  guest,
  locale,
  rise,
}: {
  top: LeaderboardEntry[]
  category: LeaderboardCategory
  period: string
  guest: boolean
  locale: Locale
  /** Hard load: the signs rise and the winner's digits flip. */
  rise: boolean
}) {
  const ru = locale === 'ru'
  const placed = steps(top).slice(0, 3)
  // Free signs stand in for missing people, not skipped ranks: 1, 1, 3 is a full podium on two steps.
  const people = placed.reduce((count, step) => count + step.people.length, 0)
  const free = Array.from(
    { length: Math.max(0, Math.min(3 - placed.length, 3 - people)) },
    (_, index) => placed.length + index,
  )
  const freeTarget = guest
    ? { href: '/signin', hint: ru ? 'войти' : 'sign in' }
    : isGroundCategory(category)
      ? {
          href: '/ground-travel/new',
          hint: ru ? 'добавить наземную поездку' : 'add a ground journey',
        }
      : { href: '/add', hint: ru ? 'добавить перелёт' : 'add a flight' }
  return (
    <>
      <ol
        className="leaderboard-podium"
        data-rise={rise ? '' : undefined}
        suppressHydrationWarning
        aria-label={ru ? 'Лидеры' : 'Top three'}
      >
        {placed.map(({ rank, people }, position) => {
          const value = people[0].value
          const medal = ['gold', 'silver', 'bronze'][rank - 1]
          return (
            <li key={rank} className="leaderboard-sign" data-pos={position} value={rank}>
              <span className="leaderboard-sign-step" data-medal={medal}>
                #{rank}
              </span>
              <span className="leaderboard-sign-people">
                {people.map((entry) => {
                  const name = entryName(entry, locale)
                  return (
                    <span key={entry.user_id} className="leaderboard-sign-person">
                      <ProfileAvatar
                        id={entry.user_id}
                        url={entry.avatar_url}
                        name={name}
                        size={44}
                      />
                      {entry.username ? (
                        <Link
                          className="leaderboard-sign-name"
                          href={`/fly/${encodeURIComponent(entry.username)}`}
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="leaderboard-sign-name">{name}</span>
                      )}
                    </span>
                  )
                })}
              </span>
              <span className="leaderboard-sign-value">
                <SplitFlap
                  key={`${category}:${period}`}
                  value={formatNumber(locale, value)}
                  entering={rise && position === 0}
                  delay={320}
                />
                <small>{categoryUnit(category, value, locale)}</small>
              </span>
            </li>
          )
        })}
        {free.map((position) => (
          <li key={`free-${position}`} className="leaderboard-free" data-pos={position}>
            <Link href={freeTarget.href}>
              {ru ? 'Свободно' : 'Free'}
              <span className="sr-only">, {freeTarget.hint}</span>
            </Link>
          </li>
        ))}
      </ol>
      {rise && <script dangerouslySetInnerHTML={{ __html: RISE_SCRIPT }} />}
    </>
  )
}
