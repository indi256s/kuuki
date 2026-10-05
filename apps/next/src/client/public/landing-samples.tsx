import { Ticket } from '../signature/ticket'
import { Stamp } from '../signature/stamp'
import { ProfileAvatar } from '../profile/avatar'
import type { Locale } from '../../lib/format'

/** Explicit fictional samples: no account or derived reads power the guest proof. */
export function LandingSamples({ locale }: { locale: Locale }) {
  const ru = locale === 'ru'
  return <section className="landing-vignettes" aria-label={ru ? 'Пример журнала · вымышленные данные' : 'Sample journal · fictional data'}>
    <article><p className="eyebrow">{ru ? 'Пример · Перелёт' : 'Sample · Flight'}</p><Ticket locale={locale} state="logged" origin={{ iata: 'TBS', city: ru ? 'Тбилиси' : 'Tbilisi' }} destination={{ iata: 'NRT', city: ru ? 'Токио' : 'Tokyo' }} date="2026-04-12" /><p>{ru ? 'Сохраните маршрут, дату и детали перелёта.' : 'Keep the route, date and details of your flight.'}</p></article>
    <article><p className="eyebrow">{ru ? 'Пример · Паспорт' : 'Sample · Passport'}</p><Stamp locale={locale} countryCode="JP" nativeName="日本" name={ru ? 'Япония' : 'Japan'} kind="air" firstYear={2026} static /><p>{ru ? 'Ваши места становятся отметками в паспорте.' : 'Your places become stamps in your passport.'}</p></article>
    <article><p className="eyebrow">{ru ? 'Пример · Профиль' : 'Sample · Profile'}</p><ProfileAvatar id="kuuki-fictional-sample" name={ru ? 'Алекс' : 'Alex'} url={null} /><h2>{ru ? 'Алекс' : 'Alex'}</h2><p className="handle">@sample_traveler</p><p>{ru ? '12 перелётов · 6 стран и территорий. Вымышленный профиль.' : '12 flights · 6 countries and territories. Fictional profile.'}</p></article>
  </section>
}
