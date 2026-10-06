'use client'

import { useState, type ReactNode } from 'react'
import { api, ApiError } from '@kuuki/client/apiClient'
import { withIdentityMutation } from '../activity'
import type { Locale } from '../../lib/format'
import { BrandPanel } from './brand-panel'
import { CornerControls } from './corner-controls'
import { FormStep } from './form-step'
import { Tagline } from './taglines'
import './auth-card.css'

/**
 * The card's static frame: brand panel (left on desktop, the band above the sheet on mobile), corner controls, and the
 * form panel holding `children`. Shared by every auth surface so the top stays put while the content changes.
 */
export function AuthCardFrame({ locale, brandField, theme, children }: { locale: Locale; brandField?: ReactNode; theme?: ReactNode; children: ReactNode }) {
  return <div className="auth-card">
    <BrandPanel field={brandField} />
    <CornerControls locale={locale} theme={theme} />
    <section className="auth-form-panel"><div className="auth-column">{children}</div></section>
  </div>
}

const errors = {
  en: { email: 'Enter a valid email.', password: 'Enter your password.', credentials: 'Email or password is incorrect.', limited: 'Too many attempts. Please wait and try again.', failed: 'We could not complete this request. Please try again.' },
  ru: { email: 'Введите действительный адрес почты.', password: 'Введите пароль.', credentials: 'Неверная почта или пароль.', limited: 'Слишком много попыток. Подождите и повторите.', failed: 'Не удалось завершить запрос. Повторите попытку.' },
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FormState = { busy: boolean; emailError?: string; passwordError?: string }

/**
 * The one-form auth card. The form area is driven by local state; today it is the form step wired to the existing
 * sign-in endpoint. The one-form state machine (auth one-form ticket 05) replaces `submit` and adds the other steps.
 */
export function AuthCard({ locale, initialEmail = '', tagline }: { locale: Locale; initialEmail?: string; tagline: number }) {
  const [state, setState] = useState<FormState>({ busy: false })
  const e = errors[locale]
  const submit = async ({ email, password }: { email: string; password: string }) => {
    if (state.busy) return
    const emailError = EMAIL.test(email) ? undefined : e.email
    const passwordError = password ? undefined : e.password
    if (emailError || passwordError) { setState({ busy: false, emailError, passwordError }); return }
    setState({ busy: true })
    try {
      await withIdentityMutation(token => api.post('/api/auth/sign-in/email', { email, password }, { identityToken: token }), '/overview')
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined
      const message = code === 'INVALID_CREDENTIALS' || code === 'INVALID_EMAIL_OR_PASSWORD' ? e.credentials
        : error instanceof ApiError && error.status === 429 ? e.limited : e.failed
      setState({ busy: false, passwordError: message })
    }
  }
  return <AuthCardFrame locale={locale}>
    <FormStep locale={locale} defaultEmail={initialEmail} busy={state.busy} emailError={state.emailError} passwordError={state.passwordError} onSubmit={submit} />
    <Tagline locale={locale} index={tagline} />
  </AuthCardFrame>
}
