'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { api, ApiError } from '@kuuki/client/apiClient'
import { withIdentityMutation } from '../activity'
import { setLocale } from '../appearance'
import { AuthCardFrame } from '../auth-card/auth-card'
import { CardField } from '../auth-card/card-field'
import { CardHeading, FormMessage, formMessages } from '../auth-card/form-step'
import { passwordRule } from '../public/password-field'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'

declare global { interface Window { __kuukiResetToken?: string } }

const words = {
  en: { title: 'Choose a new password', password: 'New password', hint: 'At least 8 characters', save: 'Save password', saving: 'Saving…', checking: 'Checking link…', expired: 'This link has expired', expiredBody: 'Links work once, for 30 minutes.', newLink: 'Send a new link', back: 'Back to sign in', rate: 'Too many attempts. Please wait and try again.', failed: 'Could not save your password. Please try again.' },
  ru: { title: 'Выберите новый пароль', password: 'Новый пароль', hint: 'Не менее 8 символов', save: 'Сохранить пароль', saving: 'Сохраняем…', checking: 'Проверяем ссылку…', expired: 'Срок действия ссылки истёк', expiredBody: 'Ссылки действуют 30 минут и работают только один раз.', newLink: 'Отправить новую ссылку', back: 'Назад ко входу', rate: 'Слишком много попыток. Подождите и повторите.', failed: 'Не удалось сохранить пароль. Повторите попытку.' },
}

export function ResetPasswordForm({ locale: initialLocale }: { locale: Locale }) {
  const [locale, setLocalLocale] = useState(initialLocale)
  const t = words[locale]
  const captured = useRef<string | undefined>(undefined)
  const heading = useRef<HTMLHeadingElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'rate' | 'failed' | ''>('')
  const [passwordError, setPasswordError] = useState(false)
  useEffect(() => {
    // Only the early bootstrap reads/scrubs the fragment. Keep its one-time handoff in this mounted form's memory.
    if (captured.current === undefined) captured.current = window.__kuukiResetToken || ''
    delete window.__kuukiResetToken
    // React may replay the effect; replaying must not discard a captured token.
    setToken(/^[A-Za-z0-9_-]{43}$/.test(captured.current) ? captured.current : '')
    try {
      const address = sessionStorage.getItem('kuuki_auth_email')?.trim() ?? ''
      if (address.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) setEmail(address)
    } catch { /* A token-only visit still works when no same-origin email hint is available. */ }
  }, [])
  useEffect(() => { if (token !== null) heading.current?.focus() }, [token, success])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !token) return
    setError('')
    const invalidPassword = password.length < 8 || password.length > 1024
    setPasswordError(invalidPassword)
    if (invalidPassword) { heading.current?.focus(); return }
    setBusy(true)
    try {
      await withIdentityMutation(async identityToken => {
        const reply = await api.post<{ ok?: unknown }>('/api/auth/password-reset/complete', { password }, { identityToken, headers: { Authorization: `Bearer ${token}` } })
        if (reply?.ok !== true) throw new Error('Invalid password reset response')
        return reply
      }, '/?notice=password-saved')
      captured.current = ''
      setPassword('')
      setSuccess(true)
      setToken('')
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_RECOVERY') {
        captured.current = ''
        setPassword('')
        setToken('')
      } else setError(caught instanceof ApiError && caught.status === 429 ? 'rate' : 'failed')
    } finally { setBusy(false) }
  }
  const expired = token === '' && !success
  return <AuthCardFrame locale={locale} onLocaleChange={next => { setLocale(next, false); setLocalLocale(next) }}>
    <CardHeading ref={heading} title={expired ? t.expired : t.title} subtitle={expired ? t.expiredBody : undefined} />
    {success ? <FormMessage tone="notice">{formMessages[locale]['password-saved']}</FormMessage> : token === null ? <p role="status">{t.checking}</p> : expired ?
      <Link href="/forgot-password" className="ui-button auth-primary" data-variant="primary">{t.newLink}</Link> :
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
        {email ? <input type="hidden" name="username" autoComplete="username" value={email} /> : null}
        <div className="auth-field">
          <CardField ref={passwordInput} locale={locale} label={t.password} name="password" type="password" autoComplete="new-password" maxLength={1024} readOnly={busy}
            value={password} onChange={event => { setPassword(event.target.value); setPasswordError(false) }} error={passwordError ? passwordRule[locale] : undefined} aria-describedby="reset-password-hint" />
          <span id="reset-password-hint" className="auth-field-hint">{t.hint}</span>
        </div>
        {error ? <FormMessage tone="error">{t[error]}</FormMessage> : null}
        <Button variant="primary" type="submit" className="auth-primary" loading={busy} loadingLabel={t.saving}>{t.save}</Button>
      </form>}
    <Link className="auth-text-link" href="/"><span className="auth-button-row"><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{t.back}</span></Link>
  </AuthCardFrame>
}
