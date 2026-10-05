'use client'

import { Button } from '../../../client/ui/button'
import '../../../client/leaderboard/leaderboard.css'

export default function LeaderboardError({ reset }: { reset: () => void }) {
  return <section className="error-state editorial-leaderboard" role="alert"><h1><span className="locale-en">Leaderboard unavailable</span><span className="locale-ru" lang="ru">Рейтинг недоступен</span></h1><p><span className="locale-en">We could not load the rankings. Please try again.</span><span className="locale-ru" lang="ru">Не удалось загрузить рейтинг. Повторите попытку.</span></p><Button onClick={reset}><span className="locale-en">Try again</span><span className="locale-ru" lang="ru">Повторить</span></Button></section>
}
