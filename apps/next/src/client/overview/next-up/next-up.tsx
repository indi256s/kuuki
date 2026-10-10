'use client'

import Link from 'next/link'
import { useId } from 'react'
import type { Goal } from '@kuuki/shared/overview/goals'
import {
  PayloadAircraftReview,
  useAircraftReviewCount,
} from '../sections/manufacturers/aircraft-review'
import { UnlockMeter } from '../sections/rankings/display'
import { SECTIONS } from '../sections/registry'
import { useOverview } from '../store/overview-context'
import { t } from '../copy'
import { goalCopy } from './lines'
import './next-up.css'

export function NextUp({ goals }: { goals: Goal[] }) {
  const { locale } = useOverview()
  // Without a review to offer, adding a flight is the way forward.
  const reviewCount = useAircraftReviewCount()
  const prefix = useId()
  if (goals.length === 0) return null
  const title = t({ en: 'Next up', ru: 'Дальше' }, locale)
  return (
    <section className="ov3-nextup" aria-label={title}>
      <h2 className="ov3-nextup-title">{title}</h2>
      <ul className="ov3-nextup-list">
        {goals.map((goal) => {
          const { line, label } = goalCopy(goal, locale, (unlock) =>
            t(SECTIONS[unlock.section].title, locale),
          )
          const lineId = `${prefix}-${goal.id}`
          return (
            <li key={goal.id} className="ov3-nextup-row" data-kind={goal.kind}>
              <div className="ov3-nextup-body">
                <p id={lineId}>{line}</p>
                <UnlockMeter have={goal.have} need={goal.need} label={label} />
              </div>
              {goal.kind === 'unlock' ? (
                <div className="ov3-nextup-action">
                  {goal.unit === 'aircraft' && reviewCount !== null ? (
                    <PayloadAircraftReview />
                  ) : (
                    <Link
                      className="ui-button"
                      data-variant="ghost"
                      href={goal.unit === 'times' ? '/journal' : '/add'}
                      aria-describedby={lineId}
                    >
                      {goal.unit === 'times'
                        ? t({ en: 'Add times', ru: 'Указать время' }, locale)
                        : t({ en: 'Add a flight', ru: 'Добавить перелёт' }, locale)}
                    </Link>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
