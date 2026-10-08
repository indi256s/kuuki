'use client'

import { Button } from '../../../client/ui/button'

export default function OverviewError({ reset }: { reset: () => void }) {
  return <section className="error-state" role="alert"><h1><span className="locale-en">Overview unavailable</span><span className="locale-ru" lang="ru">Обзор недоступен</span></h1><p><span className="locale-en">We could not load your overview. Please try again.</span><span className="locale-ru" lang="ru">Не удалось загрузить обзор. Повторите попытку.</span></p><Button onClick={reset}><span className="locale-en">Try again</span><span className="locale-ru" lang="ru">Повторить</span></Button></section>
}
