'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, getAuthGeneration } from '../../../../web/src/lib/apiClient'
import { getAllFlights } from '../../../../web/src/lib/flights'
import { trackPrivateOperation, withIdentityMutation } from '../activity'
import { Preferences } from '../preferences'
import type { toOwnProfile } from '../../../../../functions/api/_lib/profiles'
import './account.css'

type Profile = ReturnType<typeof toOwnProfile>

export function SettingsForm({ ownerId, profile, locale }: { ownerId: string; profile: Profile; locale: 'en' | 'ru' }) {
  const ru = locale === 'ru', router = useRouter()
  const [name, setName] = useState(profile.display_name ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [homeAirport, setHomeAirport] = useState(profile.home_airport ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [apiKey, setApiKey] = useState(profile.gemini_api_key ?? '')
  const [isPublic, setPublic] = useState(profile.is_public)
  const [leaderboard, setLeaderboard] = useState(profile.show_on_leaderboards)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false), [deletePassword, setDeletePassword] = useState(''), [deleteConfirm, setDeleteConfirm] = useState(false)
  useEffect(() => { setName(profile.display_name ?? ''); setBio(profile.bio ?? ''); setHomeAirport(profile.home_airport ?? ''); setAvatarUrl(profile.avatar_url ?? ''); setApiKey(profile.gemini_api_key ?? ''); setPublic(profile.is_public); setLeaderboard(profile.show_on_leaderboards) }, [profile])

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration()
    try {
      await api.patch('/api/profiles/me', { display_name: name.trim() || null, bio: bio.trim() || null, home_airport: homeAirport.trim() || null, avatar_url: avatarUrl.trim() || null, gemini_api_key: apiKey.trim() || null, is_public: isPublic, show_on_leaderboards: isPublic && leaderboard }, { signal: controller.signal })
      if (!controller.signal.aborted && generation === getAuthGeneration()) { setMessage(ru ? 'Сохранено.' : 'Saved.'); router.refresh() }
    } catch { if (!controller.signal.aborted && generation === getAuthGeneration()) setError(ru ? 'Не удалось сохранить изменения.' : 'Could not save changes.') }
    finally { setBusy(false); release() }
  }
  async function download(kind: 'flights' | 'claims' | 'ground') {
    setBusy(true); setError(''); setMessage('')
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration()
    try {
      if (kind === 'flights') {
        const rows = await getAllFlights(ownerId, { signal: controller.signal })
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        if (!rows.length) { setMessage(ru ? 'Пока нет перелётов для экспорта.' : 'No flights to export yet.'); return }
        const { exportFlights } = await import('../../../../web/src/lib/export')
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        exportFlights(rows)
      } else if (kind === 'claims') {
        const { getUserClaims } = await import('../../../../web/src/lib/passport')
        const rows = await getUserClaims(ownerId)
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        if (!rows.length) { setMessage(ru ? 'Пока нет отметок стран для экспорта.' : 'No country claims to export yet.'); return }
        const { exportClaims } = await import('../../../../web/src/lib/export')
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        exportClaims(rows)
      } else {
        const rows = await api.get<{ countryCode: string; visitYear: number | null; entryMethod: string | null; note: string | null; createdAt: string }[]>('/api/passport/ground-visits', undefined, { signal: controller.signal })
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        if (!rows.length) { setMessage(ru ? 'Пока нет наземных посещений для экспорта.' : 'No ground visits to export yet.'); return }
        const { exportGroundVisits } = await import('./ground-export')
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        await exportGroundVisits(rows)
      }
      setMessage(ru ? 'CSV-файл загружен.' : 'CSV downloaded.')
    } catch { if (!controller.signal.aborted && generation === getAuthGeneration()) setError(ru ? 'Не удалось экспортировать данные.' : 'Could not export data.') }
    finally { setBusy(false); release() }
  }
  async function signout() {
    setBusy(true); setError('')
    try { await withIdentityMutation(token => api.post('/api/auth/signout', {}, { identityToken: token }), '/signin') }
    catch { setError(ru ? 'Не удалось выйти.' : 'Could not sign out.'); setBusy(false) }
  }
  async function deleteAccount(event: FormEvent) {
    event.preventDefault()
    if (!deleteConfirm || !deletePassword) return
    setBusy(true); setError('')
    try { await withIdentityMutation(token => api.delete('/api/auth/account', { password: deletePassword }, { identityToken: token }), '/signin') }
    catch { setError(ru ? 'Неверный пароль или не удалось удалить аккаунт.' : 'Incorrect password or account deletion failed.'); setBusy(false) }
  }
  return <div className="settings-page account-settings"><p className="eyebrow">{ru ? 'Ваш аккаунт' : 'Your account'}</p><h1>{ru ? 'Настройки' : 'Settings'}</h1><p className="lead">{ru ? 'Профиль, приватность и данные.' : 'Profile, privacy, and data.'}</p>
    <form onSubmit={save}><section><h2>{ru ? 'Профиль' : 'Profile'}</h2><label htmlFor="settings-name">{ru ? 'Имя' : 'Display name'}</label><input disabled={busy} id="settings-name" maxLength={80} value={name} onChange={event => setName(event.target.value)} /><label htmlFor="settings-bio">{ru ? 'О себе' : 'Bio'}</label><textarea disabled={busy} id="settings-bio" maxLength={140} rows={3} value={bio} onChange={event => setBio(event.target.value)} /><p className="field-help">{bio.length}/140</p><p>{profile.username ? `@${profile.username}` : (ru ? 'Имя пользователя не указано' : 'No username yet')} · <Link href="/onboarding">{ru ? 'Изменить имя пользователя' : 'Change username'}</Link></p><label htmlFor="settings-home">{ru ? 'Домашний аэропорт' : 'Home airport'}</label><input disabled={busy} id="settings-home" maxLength={10} value={homeAirport} onChange={event => setHomeAirport(event.target.value.toUpperCase())} /><label htmlFor="settings-avatar">{ru ? 'Ссылка на аватар' : 'Avatar URL'}</label><input disabled={busy} id="settings-avatar" type="url" value={avatarUrl} onChange={event => setAvatarUrl(event.target.value)} /><label htmlFor="settings-key">{ru ? 'Личный ключ Gemini API' : 'Personal Gemini API key'}</label><input disabled={busy} id="settings-key" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} /><p className="field-help">{ru ? 'Ключ сохраняется только в настройках вашего аккаунта.' : 'This key is saved with your account settings.'}</p></section>
      <section><h2>{ru ? 'Приватность' : 'Privacy'}</h2><label className="account-check"><input type="checkbox" disabled={busy} checked={isPublic} onChange={event => { setPublic(event.target.checked); if (!event.target.checked) setLeaderboard(false) }} />{ru ? 'Публичный профиль' : 'Public profile'}</label><label className="account-check"><input type="checkbox" checked={leaderboard} disabled={busy || !isPublic} onChange={event => setLeaderboard(event.target.checked)} />{ru ? 'Показывать в рейтинге, когда доступно' : 'Show on leaderboards when eligible'}</label><p className="field-help">{ru ? 'Рейтинг доступен публичным профилям после пяти перелётов.' : 'Leaderboard eligibility starts at five flights on a public profile.'}</p><button className="button primary" disabled={busy}>{busy ? (ru ? 'Сохраняем…' : 'Saving…') : (ru ? 'Сохранить' : 'Save changes')}</button></section></form>
    <section><h2>{ru ? 'Язык и тема' : 'Language and appearance'}</h2><Preferences initialLocale={locale} /></section>
    <section><h2>{ru ? 'Ваши данные' : 'Your data'}</h2><p>{ru ? 'Перед удалением аккаунта загрузите CSV-файлы перелётов, отмеченных стран и наземных посещений с заметками.' : 'Before deleting your account, download CSV files of your flights, country claims, and ground visits with notes.'}</p><div className="account-actions"><button type="button" disabled={busy} onClick={() => void download('flights')}>{ru ? 'Скачать перелёты' : 'Download flights'}</button><button type="button" disabled={busy} onClick={() => void download('claims')}>{ru ? 'Скачать страны' : 'Download country claims'}</button><button type="button" disabled={busy} onClick={() => void download('ground')}>{ru ? 'Скачать наземные посещения' : 'Download ground visits'}</button></div></section>
    <section><h2>{ru ? 'Аккаунт' : 'Account'}</h2><div className="account-actions"><button type="button" disabled={busy} onClick={() => void signout()}>{ru ? 'Выйти' : 'Sign out'}</button><button type="button" disabled={busy} onClick={() => setDeleteOpen(true)}>{ru ? 'Удалить аккаунт' : 'Delete account'}</button></div>
      {deleteOpen && <form className="account-delete" onSubmit={deleteAccount}><h3>{ru ? 'Удалить аккаунт навсегда?' : 'Permanently delete your account?'}</h3><p>{ru ? 'Перелёты, отметки стран и профиль будут удалены. Это действие нельзя отменить. Сначала загрузите свои данные, если хотите их сохранить.' : 'Your flights, country claims, and profile will be deleted. This cannot be undone. Download your data first if you want to keep it.'}</p><label htmlFor="delete-password">{ru ? 'Текущий пароль' : 'Current password'}</label><input id="delete-password" type="password" autoComplete="current-password" required value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /><label className="account-check"><input type="checkbox" checked={deleteConfirm} onChange={event => setDeleteConfirm(event.target.checked)} />{ru ? 'Я понимаю, что удаление необратимо' : 'I understand this deletion is permanent'}</label><div className="account-actions"><button type="button" onClick={() => { setDeleteOpen(false); setDeletePassword(''); setDeleteConfirm(false) }}>{ru ? 'Отмена' : 'Cancel'}</button><button type="submit" disabled={!deleteConfirm || !deletePassword || busy}>{ru ? 'Удалить навсегда' : 'Delete permanently'}</button></div></form>}</section>
    <p role="status">{message}</p><p role="alert" className="form-message">{error}</p><p><Link href={profile.username ? `/fly/${encodeURIComponent(profile.username)}` : '/onboarding'}>{ru ? 'Мой профиль' : 'View my profile'}</Link></p>
  </div>
}
