'use client'

import { NavigationLink as Link } from './navigation-link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api, getAuthGeneration } from '../../../web/src/lib/apiClient'
import { trackPrivateOperation, withIdentityMutation } from './activity'
import { setLocale, setTheme } from './appearance'
import { useAppearance } from './preferences'
import { Menu, MenuCheckboxItem, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from './ui/menu'
import { ProfileAvatar } from './profile/avatar'

type Theme = 'system' | 'light' | 'dark'

export function AvatarMenu({ username, id = username, avatarUrl, displayName, isPublic, locale = 'en' }: { id?: string; avatarUrl?: string | null; username: string; displayName?: string | null; isPublic: boolean; locale?: 'en' | 'ru' }) {
  const router = useRouter()
  const appearance = useAppearance(locale)
  const ru = appearance.locale === 'ru'
  const [publicProfile, setPublicProfile] = useState(isPublic)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // The server value wins again after router.refresh() re-renders the shell.
  useEffect(() => { setPublicProfile(isPublic) }, [isPublic])

  async function toggleVisibility(next: boolean) {
    if (busy) return
    setBusy(true); setError(''); setPublicProfile(next)
    const controller = new AbortController(), release = trackPrivateOperation(controller), generation = getAuthGeneration()
    try {
      // Going private also leaves the leaderboard, as Settings does; going public changes nothing else.
      await api.patch('/api/profiles/me', next ? { is_public: true } : { is_public: false, show_on_leaderboards: false }, { signal: controller.signal })
      if (!controller.signal.aborted && generation === getAuthGeneration()) router.refresh()
    } catch {
      if (!controller.signal.aborted && generation === getAuthGeneration() && mounted.current) { setPublicProfile(!next); setError(ru ? 'Не удалось изменить видимость.' : 'Could not change visibility.') }
    } finally { release(); if (mounted.current) setBusy(false) }
  }
  async function signOut() {
    try { await withIdentityMutation(token => api.post('/api/auth/signout', {}, { identityToken: token }), '/signin') }
    catch { if (mounted.current) setError(ru ? 'Не удалось выйти.' : 'Could not sign out.') }
  }

  const profileHref = `/fly/${encodeURIComponent(username)}`
  return <Menu align="end" trigger={<button type="button" className="avatar-button" aria-label={ru ? 'Меню аккаунта' : 'Account menu'}><span aria-hidden="true"><ProfileAvatar id={id} url={avatarUrl} name={displayName?.trim() || username} size={40} /></span></button>}>
    <MenuItem asChild>
      <Link href={profileHref} className="avatar-profile-link"><span>{ru ? 'Мой профиль' : 'My profile'}</span><span className="avatar-status">{publicProfile ? (ru ? 'Публичный' : 'Public') : (ru ? 'Скрыт' : 'Hidden')}</span></Link>
    </MenuItem>
    <MenuCheckboxItem checked={publicProfile} disabled={busy} onCheckedChange={next => void toggleVisibility(next === true)} onSelect={event => event.preventDefault()}>{ru ? 'Публичный профиль' : 'Public profile'}</MenuCheckboxItem>
    {error ? <p className="avatar-error" role="alert">{error}</p> : null}
    <MenuItem asChild><Link href="/settings">{ru ? 'Настройки' : 'Settings'}</Link></MenuItem>
    <MenuSeparator />
    <MenuLabel>{ru ? 'Тема' : 'Theme'}</MenuLabel>
    <MenuRadioGroup value={appearance.theme} onValueChange={value => setTheme(value as Theme)}>
      <MenuRadioItem value="light">{ru ? 'Светлая' : 'Light'}</MenuRadioItem>
      <MenuRadioItem value="dark">{ru ? 'Тёмная' : 'Dark'}</MenuRadioItem>
      <MenuRadioItem value="system">{ru ? 'Системная' : 'System'}</MenuRadioItem>
    </MenuRadioGroup>
    <MenuSeparator />
    <MenuLabel>{ru ? 'Язык' : 'Language'}</MenuLabel>
    <MenuRadioGroup value={appearance.locale} onValueChange={value => setLocale(value as 'en' | 'ru')}>
      <MenuRadioItem value="en">EN</MenuRadioItem>
      <MenuRadioItem value="ru">RU</MenuRadioItem>
    </MenuRadioGroup>
    <MenuSeparator />
    <MenuItem onSelect={() => void signOut()}>{ru ? 'Выйти' : 'Sign out'}</MenuItem>
  </Menu>
}
