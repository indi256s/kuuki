'use client'

import { NavigationLink as Link } from './navigation-link'
import { useRouter } from 'next/navigation'
import { Check, CircleUser, LogOut, Settings, Trophy } from '@keyline-icons/react'
import { useEffect, useRef, useState } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation, withIdentityMutation } from './activity'
import { deviceAccent, setAccent, setLocale, setTheme, useAccentSave } from './appearance'
import { useAppearance } from './preferences'
import { Menu, MenuCheckboxItem, MenuGroup, MenuItem, MenuTray } from './ui/menu'
import { QueueMenuItem } from './queue-summary'
import { NAMES } from './ui/swatch-picker'
import { ACCENTS, type Accent } from '../lib/theme-colors'
import { useToast } from './ui/toast'
import { ProfileAvatar } from './profile/avatar'

export function AvatarMenu({
  username,
  id = username,
  avatarUrl,
  displayName,
  isPublic,
  profileAccent,
  locale = 'en',
}: {
  id?: string
  avatarUrl?: string | null
  username: string
  displayName?: string | null
  isPublic: boolean
  profileAccent?: string | null
  locale?: 'en' | 'ru'
}) {
  const router = useRouter()
  const appearance = useAppearance(locale)
  const ru = appearance.locale === 'ru'
  const [publicProfile, setPublicProfile] = useState(isPublic)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  // The tray shows this device's accent, which is not the one on screen while an owner's profile page is open.
  const [accent, setDeviceAccent] = useState<Accent>('shu')
  useEffect(() => {
    const read = () => setDeviceAccent(deviceAccent())
    read()
    window.addEventListener('kuuki:appearance', read)
    return () => window.removeEventListener('kuuki:appearance', read)
  }, [])
  const accentSave = useAccentSave(profileAccent, () =>
    toast.show({
      kind: 'error',
      message: ru ? 'Не удалось сохранить акцент.' : 'Could not save the accent.',
    }),
  )
  // The server value wins again after router.refresh() re-renders the shell.
  useEffect(() => {
    setPublicProfile(isPublic)
  }, [isPublic])

  async function toggleVisibility(next: boolean) {
    if (busy) return
    setBusy(true)
    setPublicProfile(next)
    const controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    try {
      // Going private also leaves the leaderboard, as Settings does; going public changes nothing else.
      await api.patch(
        '/api/profiles/me',
        next ? { is_public: true } : { is_public: false, show_on_leaderboards: false },
        { signal: controller.signal },
      )
      if (!controller.signal.aborted && generation === getAuthGeneration()) router.refresh()
    } catch {
      if (!controller.signal.aborted && generation === getAuthGeneration() && mounted.current) {
        setPublicProfile(!next)
        toast.show({
          kind: 'error',
          message: ru ? 'Не удалось изменить видимость.' : 'Could not change visibility.',
        })
      }
    } finally {
      release()
      if (mounted.current) setBusy(false)
    }
  }
  async function signOut() {
    try {
      await withIdentityMutation(
        (token) => api.post('/api/auth/signout', {}, { identityToken: token }),
        '/signin',
      )
    } catch {
      if (mounted.current)
        toast.show({ kind: 'error', message: ru ? 'Не удалось выйти.' : 'Could not sign out.' })
    }
  }

  const profileHref = `/fly/${encodeURIComponent(username)}`
  const text = (en: string, ruText: string) => (ru ? ruText : en)
  return (
    <Menu
      align="end"
      className="account-menu"
      scrim="mobile"
      hideWhenDetached
      trigger={
        <button
          type="button"
          className="avatar-button"
          aria-label={ru ? 'Меню аккаунта' : 'Account menu'}
        >
          <span aria-hidden="true">
            <ProfileAvatar
              id={id}
              url={avatarUrl}
              name={displayName?.trim() || username}
              size={40}
            />
          </span>
        </button>
      }
    >
      <MenuGroup>
        <MenuItem asChild>
          <Link href={profileHref} className="avatar-profile">
            <CircleUser size={20} strokeWidth={2} aria-hidden="true" />
            <span className="avatar-profile-text">
              <span className="avatar-profile-title">{text('My profile', 'Мой профиль')}</span>
              <span className="avatar-profile-sub">
                @{username} ·{' '}
                <span className="avatar-status">
                  {publicProfile ? text('Public', 'Публичный') : text('Hidden', 'Скрыт')}
                </span>
              </span>
            </span>
          </Link>
        </MenuItem>
        <QueueMenuItem locale={appearance.locale} />
        <MenuItem asChild>
          <Link href="/leaderboard">
            <Trophy size={20} strokeWidth={2} aria-hidden="true" />
            {text('Leaderboard', 'Рейтинг')}
          </Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/settings">
            <Settings size={20} strokeWidth={2} aria-hidden="true" />
            {text('Settings', 'Настройки')}
          </Link>
        </MenuItem>
      </MenuGroup>
      <MenuGroup>
        <MenuCheckboxItem
          checked={publicProfile}
          disabled={busy}
          onCheckedChange={(next) => void toggleVisibility(next === true)}
          onSelect={(event) => event.preventDefault()}
        >
          <span
            className="avatar-box"
            data-checked={publicProfile ? '' : undefined}
            aria-hidden="true"
          >
            {publicProfile ? <Check size={14} strokeWidth={3} /> : null}
          </span>
          {text('Public profile', 'Публичный профиль')}
        </MenuCheckboxItem>
        <MenuTray
          label={text('Theme', 'Тема')}
          value={appearance.theme}
          onValueChange={(value) => setTheme(value)}
          options={[
            { value: 'light', label: text('Light', 'Светлая') },
            { value: 'dark', label: text('Dark', 'Тёмная') },
            { value: 'system', label: text('System', 'Системная') },
          ]}
        />
        <MenuTray
          label={text('Accent', 'Акцент')}
          value={accent}
          onValueChange={(next) => {
            setAccent(next)
            accentSave.save(next)
          }}
          options={ACCENTS.map((name) => ({
            value: name,
            label: NAMES[name][appearance.locale],
            swatch: `var(--swatch-${name})`,
          }))}
        />
        <MenuTray
          label={text('Language', 'Язык')}
          value={appearance.locale}
          onValueChange={(value) => setLocale(value)}
          options={[
            { value: 'en', label: 'EN' },
            { value: 'ru', label: 'RU' },
          ]}
        />
      </MenuGroup>
      <MenuItem data-signout="" onSelect={() => void signOut()}>
        <LogOut size={20} strokeWidth={2} aria-hidden="true" />
        {text('Sign out', 'Выйти')}
      </MenuItem>
    </Menu>
  )
}
