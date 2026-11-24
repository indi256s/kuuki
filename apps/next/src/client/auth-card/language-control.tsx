'use client'

import { setLocale } from '../appearance'
import { useAppearance } from '../preferences'
import type { Locale } from '../../lib/format'
import './auth-card.css'

const languages: Record<Locale, { code: string; name: string }> = {
  en: { code: 'EN', name: 'English' },
  ru: { code: 'RU', name: 'Русский' },
}

export function LanguageControl({
  locale,
  onLocaleChange = setLocale,
}: {
  locale: Locale
  onLocaleChange?: (locale: Locale) => void
}) {
  const other: Locale = useAppearance(locale).locale === 'ru' ? 'en' : 'ru'
  const { code, name } = languages[other]
  return (
    <button
      type="button"
      className="auth-corner-control"
      data-kind="language"
      lang={other}
      aria-label={`${name} (${code})`}
      title={name}
      onClick={() => onLocaleChange(other)}
    >
      {(Object.keys(languages) as Locale[]).map((key) => (
        <span key={key} aria-hidden="true" data-shown={key === other || undefined}>
          {languages[key].code}
        </span>
      ))}
    </button>
  )
}
