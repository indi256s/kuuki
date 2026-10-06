'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api, ApiError } from '../../../../web/src/lib/apiClient'

export function ForgotPasswordForm({ locale }: { locale: 'en' | 'ru' }) {
  const ru = locale === 'ru'
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!email.trim()) return
    setBusy(true)
    try {
      await api.post('/api/auth/password-reset/request', { email: email.trim() })
      setSent(true)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 429
        ? (ru ? 'Слишком много попыток. Подождите и повторите.' : 'Too many attempts. Please wait and try again.')
        : (ru ? 'Не удалось отправить запрос. Повторите попытку.' : 'Could not submit the request. Please try again.'))
    } finally { setBusy(false) }
  }
  return <><p className="eyebrow">Kuuki</p><h1>{ru ? 'Восстановить пароль' : 'Reset your password'}</h1>
      {sent ? <p role="status">{ru ? 'Если для этого адреса доступно восстановление, мы отправили ссылку. Проверьте почту.' : 'If recovery is available for this address, we sent a link. Check your email.'}</p>
        : <form onSubmit={submit}><label htmlFor="recovery-email">{ru ? 'Почта' : 'Email'}</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} />
          <p role="alert" className="form-message">{error}</p><button className="button primary" type="submit" disabled={busy}>{busy ? (ru ? 'Отправляем…' : 'Sending…') : (ru ? 'Отправить ссылку' : 'Send reset link')}</button></form>}
      <p className="auth-switch"><Link href="/signin">{ru ? 'Назад ко входу' : 'Back to sign in'}</Link></p>
  </>
}
