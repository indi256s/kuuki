'use client'

export default function ProfileError({ reset }: { reset: () => void }) {
  return <section className="error-state" role="alert"><h1><span className="locale-en">Profile unavailable</span><span className="locale-ru" lang="ru">Профиль недоступен</span></h1><p><span className="locale-en">We could not load this profile. Please try again.</span><span className="locale-ru" lang="ru">Не удалось загрузить профиль. Повторите попытку.</span></p><button type="button" onClick={reset}><span className="locale-en">Try again</span><span className="locale-ru" lang="ru">Повторить</span></button></section>
}
