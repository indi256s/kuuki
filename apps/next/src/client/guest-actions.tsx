'use client'

import Link from 'next/link'
import { HorizonToggle } from './auth-card/horizon-toggle'
import { LanguageControl } from './auth-card/language-control'
import { useLocale } from './preferences'
import type { Locale } from '../lib/format'

export function GuestActions({
  locale: initialLocale,
  actions,
}: {
  locale: Locale
  actions?: boolean
}) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru'
  return (
    <div className="guest-actions">
      {actions && (
        <nav aria-label={ru ? 'Аккаунт' : 'Account'}>
          <Link href="/signin">{ru ? 'Войти' : 'Sign in'}</Link>
          <Link href="/signup">{ru ? 'Создать аккаунт' : 'Sign up'}</Link>
        </nav>
      )}
      <div className="preferences">
        <LanguageControl locale={locale} />
        <HorizonToggle locale={locale} />
      </div>
    </div>
  )
}
