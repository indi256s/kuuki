'use client'

import { NavigationLink as Link } from './navigation-link'
import { useRouter } from 'next/navigation'
import { Monitor, Moon, Sun } from '@keyline-icons/react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { api, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation, withIdentityMutation } from './activity'
import { deviceAccent, setAccent, setLocale, setTheme, useAccentSave } from './appearance'
import { useAppearance } from './preferences'
import { Menu, MenuCheckboxItem, MenuGroup, MenuItem, MenuTray } from './ui/menu'
import { documentNumber } from './profile/mrz'
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
  flights,
  locale = 'en',
}: {
  id?: string
  avatarUrl?: string | null
  username: string
  displayName?: string | null
  isPublic: boolean
  profileAccent?: string | null
  /** The flight total, printed as the passport's document number on the stub. */
  flights?: number | null
  locale?: 'en' | 'ru'
}) {
  const router = useRouter()
  const appearance = useAppearance(locale)
  const ru = appearance.locale === 'ru'
  const text = (en: string, ruText: string) => (ru ? ruText : en)
  const [publicProfile, setPublicProfile] = useState(isPublic)
  // The server value wins again after router.refresh() re-renders the shell.
  const [serverPublic, setServerPublic] = useState(isPublic)
  if (serverPublic !== isPublic) {
    setServerPublic(isPublic)
    setPublicProfile(isPublic)
  }
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
      message: { en: 'Could not save the accent.', ru: 'Не удалось сохранить акцент.' },
    }),
  )

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
          message: { en: 'Could not change visibility.', ru: 'Не удалось изменить видимость.' },
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
        toast.show({
          kind: 'error',
          message: { en: 'Could not sign out.', ru: 'Не удалось выйти.' },
        })
    }
  }

  const profileHref = '/passport'
  const name = displayName?.trim() || username
  const icon = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const
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
          aria-label={text('Account menu', 'Меню аккаунта')}
        >
          <span aria-hidden="true">
            <ProfileAvatar id={id} url={avatarUrl} name={name} size={40} />
          </span>
        </button>
      }
    >
      {/* The stub takes this device's accent, as the tray does, not an owner page's. */}
      <div
        className="account-stub"
        style={{ '--stub-accent': `var(--swatch-${accent})` } as CSSProperties}
      >
        <div className="account-eyebrow" aria-hidden="true">
          <span>Kuuki · {text('Boarding pass', 'Посадочный')}</span>
          {typeof flights === 'number' ? <span>No. {documentNumber(flights)}</span> : null}
        </div>
        <MenuItem asChild>
          <Link href={profileHref} className="account-who">
            <span className="account-who-text">
              <span className="account-name">{name}</span>
              <span className="account-handle">@{username}</span>
            </span>
            <span aria-hidden="true">
              <ProfileAvatar id={id} url={avatarUrl} name={name} size={48} />
            </span>
          </Link>
        </MenuItem>
        <div className="account-fields">
          <MenuCheckboxItem
            checked={publicProfile}
            disabled={busy}
            aria-label={text('Public profile', 'Публичный профиль')}
            onCheckedChange={(next) => void toggleVisibility(next === true)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="account-field-key">{text('Profile', 'Профиль')}</span>
            <span className="account-field-value">
              <span className="account-switch" />
              <span className="account-field-word">
                <span data-off={publicProfile ? undefined : ''}>{text('Public', 'Открыт')}</span>
                <span data-off={publicProfile ? '' : undefined}>{text('Hidden', 'Скрыт')}</span>
              </span>
            </span>
          </MenuCheckboxItem>
          <QueueMenuItem locale={appearance.locale} field />
        </div>
      </div>
      <div className="account-body">
        <MenuGroup>
          <MenuItem asChild>
            <Link href="/leaderboard">{text('Leaderboard', 'Рейтинг')}</Link>
          </MenuItem>
          <MenuItem asChild>
            <Link href="/settings">{text('Settings', 'Настройки')}</Link>
          </MenuItem>
        </MenuGroup>
        <div className="account-appearance">
          <MenuTray
            label={text('Theme', 'Тема')}
            hideLabel
            value={appearance.theme}
            onValueChange={(value) => setTheme(value)}
            options={[
              { value: 'light', label: text('Light', 'Светлая'), icon: <Sun {...icon} /> },
              { value: 'dark', label: text('Dark', 'Тёмная'), icon: <Moon {...icon} /> },
              { value: 'system', label: text('System', 'Системная'), icon: <Monitor {...icon} /> },
            ]}
          />
          <MenuTray
            label={text('Language', 'Язык')}
            hideLabel
            value={appearance.locale}
            onValueChange={(value) => setLocale(value)}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'ru', label: 'RU' },
            ]}
          />
        </div>
        <div className="account-accent">
          <MenuTray
            label={text('Accent', 'Акцент')}
            hideLabel
            value={accent}
            onValueChange={(next) => {
              setAccent(next)
              accentSave.save(next)
            }}
            options={ACCENTS.map((item) => ({
              value: item,
              label: NAMES[item][appearance.locale],
              swatch: `var(--swatch-${item})`,
              swatchInk: `var(--swatch-${item}-ink)`,
            }))}
          />
        </div>
        <MenuItem data-signout="" onSelect={() => void signOut()}>
          {text('Sign out', 'Выйти')}
        </MenuItem>
      </div>
    </Menu>
  )
}
