import 'server-only'
import { headers } from 'next/headers'
import { parseCookies } from '../../../../functions/api/_lib/cookies'

export type Locale = 'en' | 'ru'

export async function getRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers()
  const saved = parseCookies(requestHeaders.get('cookie')).kuuki_locale
  if (saved === 'en' || saved === 'ru') return saved
  const accepted = (requestHeaders.get('accept-language') ?? '').toLowerCase().split(',')
    .map((entry, index) => {
      const [tag, quality] = entry.trim().split(';q=')
      return { tag, q: quality ? Number(quality) : 1, index }
    })
    .filter(entry => Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  for (const entry of accepted) {
    if (/^ru(?:-|$)/.test(entry.tag)) return 'ru'
    if (/^en(?:-|$)/.test(entry.tag)) return 'en'
  }
  return 'en'
}

export const copy = {
  en: { loading: 'Loading your flights…', signIn: 'Sign in to see your flights.', error: 'Your flights could not be loaded.', flights: 'Flights', countries: 'Countries', distance: 'Distance', empty: 'Your first flight will appear here.' },
  ru: { loading: 'Загружаем ваши перелёты…', signIn: 'Войдите, чтобы увидеть свои перелёты.', error: 'Не удалось загрузить перелёты.', flights: 'Перелёты', countries: 'Страны', distance: 'Расстояние', empty: 'Ваш первый перелёт появится здесь.' },
} satisfies Record<Locale, Record<string, string>>
