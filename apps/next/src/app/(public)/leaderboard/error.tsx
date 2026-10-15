'use client'

import { StaticStrip } from '../../../client/leaderboard/category-strip'
import { useLocale } from '../../../client/preferences'
import { Button } from '../../../client/ui/button'
import '../../../client/leaderboard/leaderboard.css'

export default function LeaderboardError({ reset }: { reset: () => void }) {
  const locale = useLocale()
  return (
    <div className="editorial-leaderboard">
      <div className="leaderboard-head">
        <h1>{locale === 'ru' ? 'Рейтинг' : 'Leaderboard'}</h1>
      </div>
      <StaticStrip locale={locale} />
      <section className="error-state" role="alert">
        <p>
          <span className="locale-en">We could not load the rankings. Please try again.</span>
          <span className="locale-ru" lang="ru">
            Не удалось загрузить рейтинг. Повторите попытку.
          </span>
        </p>
        <Button onClick={reset}>
          <span className="locale-en">Try again</span>
          <span className="locale-ru" lang="ru">
            Повторить
          </span>
        </Button>
      </section>
    </div>
  )
}
