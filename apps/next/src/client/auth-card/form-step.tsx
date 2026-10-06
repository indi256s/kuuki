'use client'

import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'
import { CardField } from './card-field'
import './auth-card.css'

export const formWords = {
  en: { heading: 'Welcome to Kuuki', subtitle: 'Sign in, or use a new email to start your journal.', email: 'Email', password: 'Password', cantSignIn: 'Can’t sign in?', continue: 'Continue', checking: 'Checking…' },
  ru: { heading: 'Добро пожаловать в Kuuki', subtitle: 'Войдите или укажите новую почту, чтобы начать журнал.', email: 'Почта', password: 'Пароль', cantSignIn: 'Не получается войти?', continue: 'Продолжить', checking: 'Проверяем…' },
}

/** The card heading: H1 plus the muted subtitle. `tabIndex=-1` lets a state change move focus to it. */
export function CardHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return <div className="auth-heading"><h1 tabIndex={-1}>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
}

export type FormStepProps = {
  locale: Locale
  defaultEmail?: string
  emailError?: ReactNode
  passwordError?: ReactNode
  busy?: boolean
  onSubmit: (values: { email: string; password: string }) => void
}

/** The form step (board 1.1): Email, Password with "Can’t sign in?", and Continue. Enter in either field submits. */
export function FormStep({ locale, defaultEmail = '', emailError, passwordError, busy, onSubmit }: FormStepProps) {
  const t = formWords[locale]
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onSubmit({ email: String(data.get('email') ?? '').trim(), password: String(data.get('password') ?? '') })
  }
  return <>
    <CardHeading title={t.heading} subtitle={t.subtitle} />
    <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <div className="auth-fields">
        <CardField label={t.email} name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false}
          maxLength={320} defaultValue={defaultEmail} error={emailError} />
        <CardField label={t.password} name="password" type="password" autoComplete="current-password" maxLength={1024} locale={locale} error={passwordError}
          aside={<Link className="auth-text-link auth-text-link-up" href="/forgot-password">{t.cantSignIn}</Link>} />
      </div>
      <Button variant="primary" type="submit" className="auth-primary" loading={busy} loadingLabel={t.checking}>{t.continue}</Button>
    </form>
  </>
}
