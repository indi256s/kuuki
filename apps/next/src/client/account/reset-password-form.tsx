'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@kuuki/client/apiClient'
import { withIdentityMutation } from '../activity'
import { AuthShell } from '../public/auth-shell'
import { PasswordField, passwordRule, passwordMismatch } from '../public/password-field'
import { Button } from '../ui/button'

declare global { interface Window { __kuukiResetToken?: string } }

export function ResetPasswordForm({ locale }: { locale: 'en' | 'ru' }) {
  const ru = locale === 'ru'
  const captured = useRef<string | undefined>(undefined)
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  useEffect(() => {
    // Only the early bootstrap reads/scrubs the fragment. Keep its one-time handoff in this mounted form's memory.
    if (captured.current === undefined) captured.current = window.__kuukiResetToken || ''
    delete window.__kuukiResetToken
    // React may replay the effect; replaying must not discard a captured token.
    setToken(/^[A-Za-z0-9_-]{43}$/.test(captured.current) ? captured.current : '')
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !token) return
    setError('')
    const invalidPassword = password.length < 8 || password.length > 1024
    const mismatch = password !== confirm
    setPasswordError(invalidPassword ? passwordRule[locale] : '')
    setConfirmError(mismatch ? passwordMismatch[locale] : '')
    if (invalidPassword || mismatch) return
    setBusy(true)
    try {
      await withIdentityMutation(identityToken => api.post('/api/auth/password-reset/complete', { password }, { identityToken, headers: { Authorization: `Bearer ${token}` } }), '/password-updated')
      captured.current = ''
      setSuccess(true)
      setToken('')
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_RECOVERY') {
        captured.current = ''
        setToken('')
      } else setError(caught instanceof ApiError && caught.status === 429
        ? (ru ? 'Слишком много попыток. Подождите и повторите.' : 'Too many attempts. Please wait and try again.')
        : (ru ? 'Не удалось сохранить пароль. Повторите попытку.' : 'Could not save your password. Please try again.'))
    } finally { setBusy(false) }
  }
  return <AuthShell locale={locale} title={ru ? 'Новый пароль' : 'Choose a new password'}>
    {success ? <p role="status">{ru ? 'Пароль обновлён. Войдите с новым паролем.' : 'Password updated. Sign in with your new password.'}</p> : token === null ? <p role="status">{ru ? 'Проверяем ссылку…' : 'Checking link…'}</p> : !token ? <p role="alert">{ru ? 'Ссылка недействительна, уже использована или срок её действия истёк. Запросите новую.' : 'This link is invalid or expired, or has already been used. Request a new one.'}</p> :
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <PasswordField locale={locale} label={ru ? 'Новый пароль' : 'New password'} autoComplete="new-password" maxLength={1024} hint={passwordRule[locale]} value={password} onChange={event => { setPassword(event.target.value); setPasswordError('') }} error={passwordError} />
        <PasswordField locale={locale} label={ru ? 'Повторите пароль' : 'Confirm password'} autoComplete="new-password" maxLength={1024} value={confirm} onChange={event => { setConfirm(event.target.value); setConfirmError('') }} error={confirmError} />
        <p role={error ? 'alert' : undefined} className="auth-message">{error}</p>
        <Button variant="primary" type="submit" loading={busy} loadingLabel={ru ? 'Сохраняем…' : 'Saving…'}>{ru ? 'Сохранить пароль' : 'Save password'}</Button>
      </form>}
    <div className="auth-links"><Link href="/forgot-password">{ru ? 'Запросить новую ссылку' : 'Request a new link'}</Link><Link href="/signin">{ru ? 'Назад ко входу' : 'Back to sign in'}</Link></div>
  </AuthShell>
}
