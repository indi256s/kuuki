'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api } from '../../../../web/src/lib/apiClient'
import { withIdentityMutation } from '../activity'

declare global { interface Window { __kuukiResetToken?: string } }

export function ResetPasswordForm({ locale }: { locale: 'en' | 'ru' }) {
  const ru = locale === 'ru'
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    // bootstrap.js strips the fragment before hydration and holds it only in memory.
    let value = window.__kuukiResetToken || ''
    delete window.__kuukiResetToken
    if (!value && window.location.hash) {
      value = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    // The token is supplied by bootstrap outside React, then consumed once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(/^[A-Za-z0-9_-]{43}$/.test(value) ? value : '')
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!token) return
    if (password.length < 8 || password.length > 1024) { setError(ru ? 'Пароль должен содержать от 8 до 1024 символов.' : 'Use 8 to 1024 characters.'); return }
    if (password !== confirm) { setError(ru ? 'Пароли не совпадают.' : 'Passwords do not match.'); return }
    setBusy(true)
    try {
      await withIdentityMutation(identityToken => api.post('/api/auth/password-reset/complete', { password }, { identityToken, headers: { Authorization: `Bearer ${token}` } }), '/signin')
    } catch {
      setError(ru ? 'Ссылка недействительна или срок её действия истёк. Запросите новую.' : 'This link is invalid or expired. Request a new one.')
      setBusy(false)
    }
  }
  return <div className="auth-card"><div className="auth-brand"><span aria-hidden>くうき</span><p>{ru ? 'Новый пароль для ваших путешествий.' : 'A new password for your journeys.'}</p></div>
    <div className="auth-panel"><p className="eyebrow">Kuuki</p><h1>{ru ? 'Новый пароль' : 'Choose a new password'}</h1>
      {token === null ? <p role="status">{ru ? 'Проверяем ссылку…' : 'Checking link…'}</p> : !token ? <p role="alert">{ru ? 'Ссылка недействительна. Запросите новую.' : 'This link is invalid. Request a new one.'}</p> :
        <form onSubmit={submit}><label htmlFor="new-password">{ru ? 'Новый пароль' : 'New password'}</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required value={password} onChange={event => setPassword(event.target.value)} />
          <label htmlFor="confirm-password">{ru ? 'Повторите пароль' : 'Confirm password'}</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={event => setConfirm(event.target.value)} />
          <p role="alert" className="form-message">{error}</p><button className="button primary" disabled={busy}>{busy ? (ru ? 'Сохраняем…' : 'Saving…') : (ru ? 'Сохранить пароль' : 'Save password')}</button></form>}
      <p className="auth-switch"><Link href="/forgot-password">{ru ? 'Запросить новую ссылку' : 'Request a new link'}</Link></p>
    </div></div>
}
