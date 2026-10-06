'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@kuuki/client/apiClient'
import { AuthPanel } from './auth-shell'
import { Field } from '../ui/field'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'

/** Activation enables a migrated account; recovery resets an existing password. Both services return a generic acknowledgement. */
export function EmailLinkForm({ locale, purpose, initialEmail = '' }: { locale: Locale; purpose: 'activation' | 'recovery'; initialEmail?: string }) {
  const ru = locale === 'ru'
  const activation = purpose === 'activation'
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState('')
  const title = activation ? (ru ? 'Активировать старый аккаунт' : 'Activate an existing account') : (ru ? 'Восстановить пароль' : 'Reset your password')
  const action = activation ? (ru ? 'Отправить ссылку активации' : 'Send activation link') : (ru ? 'Отправить ссылку' : 'Send reset link')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    const valid = email.trim().length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    setInvalid(!valid)
    if (!valid) return
    setBusy(true)
    try {
      await api.post(activation ? '/api/auth/activation/request' : '/api/auth/password-reset/request', { email: email.trim() })
      setSent(true)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 429
        ? (ru ? 'Слишком много попыток. Подождите и повторите.' : 'Too many attempts. Please wait and try again.')
        : (ru ? 'Не удалось отправить запрос. Повторите попытку.' : 'Could not submit the request. Please try again.'))
    } finally { setBusy(false) }
  }
  return <AuthPanel title={title} description={activation
    ? (ru ? 'Укажите почту старого профиля Kuuki, чтобы задать личный пароль.' : 'Use the email of your existing Kuuki profile to set a personal password.')
    : (ru ? 'Мы отправим ссылку, чтобы вы могли задать новый пароль.' : 'We will send a link so you can choose a new password.')}>
    {sent ? <p role="status" className="auth-success">{activation
      ? (ru ? 'Если для этого адреса нужна активация, мы отправили ссылку. Проверьте почту.' : 'If activation is needed for this address, we sent a link. Check your email.')
      : (ru ? 'Если для этого адреса доступно восстановление, мы отправили ссылку. Проверьте почту.' : 'If recovery is available for this address, we sent a link. Check your email.')}</p>
      : <form onSubmit={submit} noValidate aria-busy={busy}>
        <Field label={ru ? 'Почта' : 'Email'} type="email" autoComplete="email" maxLength={320} value={email} onChange={event => { setEmail(event.target.value); setInvalid(false) }}
          error={invalid ? (ru ? 'Введите действительный адрес почты.' : 'Enter a valid email.') : undefined} />
        <p role={error ? 'alert' : undefined} className="auth-message">{error}</p>
        <Button variant="primary" type="submit" loading={busy} loadingLabel={ru ? 'Отправляем…' : 'Sending…'}>{action}</Button>
      </form>}
    <div className="auth-links"><Link href={`/signin${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`}>{ru ? 'Назад ко входу' : 'Back to sign in'}</Link>
      {activation ? <Link href="/forgot-password">{ru ? 'Уже задали пароль? Восстановить его' : 'Already set a password? Reset it'}</Link> : null}
    </div>
  </AuthPanel>
}
