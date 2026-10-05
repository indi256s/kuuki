'use client'

import { Button } from '../../../../client/ui/button'
import '../../../../client/profile/profile.css'

export default function ProfileError({ reset }: { reset: () => void }) {
  return <section className="error-state editorial-profile" role="alert"><h1><span className="locale-en">Profile unavailable</span><span className="locale-ru" lang="ru">Профиль недоступен</span></h1><p><span className="locale-en">We could not load this profile. Please try again.</span><span className="locale-ru" lang="ru">Не удалось загрузить профиль. Повторите попытку.</span></p><Button onClick={reset}><span className="locale-en">Try again</span><span className="locale-ru" lang="ru">Повторить</span></Button></section>
}
