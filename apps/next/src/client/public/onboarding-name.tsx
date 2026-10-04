'use client'

import { useState } from 'react'
import { api, ApiError } from '../../../../web/src/lib/apiClient'

export function OnboardingName({ username: initialUsername, displayName: initialName, locale }: { username: string; displayName: string; locale: 'en' | 'ru' }) {
  const ru = locale === 'ru'
  const [username, setUsername] = useState(initialUsername)
  const [name, setName] = useState(initialName)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const normalized = username.trim().toLowerCase()
  async function save(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!/^[a-z0-9_]{3,30}$/.test(normalized)) { setMessage((ru ? 'Используйте от 3 до 30 латинских букв, цифр или подчёркиваний.' : 'Use 3–30 Latin letters, numbers, or underscores.')); return }
    setSaving(true)
    try {
      const check = await api.get<{ available: boolean }>('/api/profiles/check-username', { username: normalized })
      if (!check.available) { setMessage((ru ? 'Это имя уже занято.' : 'That username is already taken.')); return }
      await api.patch('/api/profiles/me', { username: normalized, display_name: name.trim() || null })
      setUsername(normalized)
      setMessage((ru ? 'Сохранено. Адрес профиля готов.' : 'Saved. Your profile address is ready.'))
    } catch (error) { setMessage(error instanceof ApiError && error.status === 409 ? (ru ? 'Это имя уже занято.' : 'That username is already taken.') : (ru ? 'Не удалось сохранить профиль. Повторите попытку.' : 'Could not save your profile. Please try again.')) }
    finally { setSaving(false) }
  }
  return <form className="onboarding-form" onSubmit={save}><div className="field"><label htmlFor="onboarding-name">{ru ? 'Отображаемое имя' : 'Display name'}</label><input id="onboarding-name" value={name} maxLength={80} onChange={event => setName(event.target.value)} /></div><div className="field"><label htmlFor="onboarding-username">{ru ? 'Имя пользователя' : 'Username'}</label><input id="onboarding-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" /></div><p className="handle">/fly/{normalized || 'your-name'}</p><p className="field-help">{ru ? 'Имя пользователя состоит из латинских букв, цифр и подчёркиваний. Мы сохраняем его строчными буквами.' : 'Usernames use Latin letters, numbers and underscores. We save them in lowercase.'}</p><p role="status">{message}</p><button className="button primary" disabled={saving}>{saving ? (ru ? 'Сохраняем…' : 'Saving…') : (ru ? 'Сохранить профиль' : 'Save profile')}</button></form>
}
