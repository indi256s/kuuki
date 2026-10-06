import type { Locale } from '../../lib/format'
import './auth-card.css'

/** The rotation set. One line is picked per page load; the two board strings are the seed. */
export const TAGLINES = [
  { en: 'Snap a boarding pass. We’ll figure it out.', ru: 'Сфотографируйте посадочный талон. Остальное за нами.' },
  { en: 'Halfway to the Moon, apparently.', ru: 'Кажется, уже полпути до Луны.' },
] as const

/** Called once per request on the server, so the pick survives hydration. */
export function pickTagline(random = Math.random) {
  return Math.floor(random() * TAGLINES.length)
}

/** Shown under the form on the form and create steps only. It never animates. */
export function Tagline({ locale, index }: { locale: Locale; index: number }) {
  return <p className="auth-tagline">{(TAGLINES[index] ?? TAGLINES[0])[locale]}</p>
}
