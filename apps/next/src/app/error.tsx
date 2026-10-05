'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <main id="main" className="page-shell"><div className="error-state" role="alert"><h1><span className="locale-en">We couldn’t load this page.</span><span className="locale-ru" lang="ru">Не удалось загрузить страницу.</span></h1><p><span className="locale-en">Try again in a moment.</span><span className="locale-ru" lang="ru">Повторите попытку через некоторое время.</span></p><button className="button primary" onClick={reset}><span className="locale-en">Try again</span><span className="locale-ru" lang="ru">Повторить</span></button></div></main>
}
