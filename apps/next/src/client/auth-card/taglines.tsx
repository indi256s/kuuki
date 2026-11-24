import type { Locale } from '../../lib/format'
import './auth-card.css'

export const TAGLINES = [
  {
    en: 'Snap a boarding pass. We’ll figure it out.',
    ru: 'Сфотографируйте посадочный талон. Остальное за нами.',
  },
  { en: 'Halfway to the Moon, apparently.', ru: 'Кажется, уже полпути до Луны.' },
] as const

export function pickTagline(random = Math.random) {
  return Math.floor(random() * TAGLINES.length)
}

export function Tagline({ locale, index }: { locale: Locale; index: number }) {
  return <p className="auth-tagline">{(TAGLINES[index] ?? TAGLINES[0])[locale]}</p>
}
