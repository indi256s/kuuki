'use client'

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import { trackPrivateOperation, withIdentityMutation } from '../activity'
import { useAppearance } from '../preferences'
import { setLocale, setTheme } from '../appearance'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { SwitchRow } from '../ui/switch-row'
import { SegmentedControl } from '../ui/segmented-control'
import { SwatchPicker } from '../ui/swatch-picker'
import { formatCount, formatNumber, type Locale } from '../../lib/format'
import type { toOwnProfile } from '../../../../../functions/api/_lib/profiles'
import {
  downloadSettingsData,
  useSettingsExportLimit,
  type ExportKind,
  type SettingsCounts,
} from './settings-data'
import { useSettingsGuard } from './settings-guard'
import { SettingsDelete } from './settings-delete'
import './settings.css'

type Profile = ReturnType<typeof toOwnProfile>
const values = (profile: Profile) => ({
  display_name: profile.display_name ?? '',
  bio: profile.bio ?? '',
  home_airport: profile.home_airport ?? '',
  avatar_url: profile.avatar_url ?? '',
  gemini_api_key: profile.gemini_api_key ?? '',
  is_public: profile.is_public,
  show_on_leaderboards: profile.show_on_leaderboards,
})
const flightsLeft = {
  en: { one: '{count} more flight needed.', other: '{count} more flights needed.' },
  ru: {
    one: 'Нужен ещё {count} перелёт.',
    few: 'Нужно ещё {count} перелёта.',
    many: 'Нужно ещё {count} перелётов.',
    other: 'Нужно ещё {count} перелёта.',
  },
}

export function SettingsForm({
  ownerId,
  profile,
  locale,
  counts = null,
}: {
  ownerId: string
  profile: Profile
  locale: Locale
  counts?: SettingsCounts | null
}) {
  const ru = locale === 'ru',
    router = useRouter()
  const [draft, setDraft] = useState(() => values(profile)),
    [baseline, setBaseline] = useState(() => values(profile))
  const [saving, setSaving] = useState(false),
    [exporting, setExporting] = useState(false),
    [identityBusy, setIdentityBusy] = useState(false)
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [deleteOpen, setDeleteOpen] = useState(false)
  const busy = saving || exporting || identityBusy
  const running = useRef(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  const dirtyRef = useRef(dirty)
  useLayoutEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])
  const guard = useSettingsGuard(dirty, busy, locale)
  const appearance = useAppearance(locale),
    limit = useSettingsExportLimit(ownerId)
  useEffect(() => {
    if (!dirtyRef.current) {
      setDraft(values(profile))
      setBaseline(values(profile))
    }
  }, [profile])
  const edit = <K extends keyof typeof draft>(field: K, value: (typeof draft)[K]) => {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setMessage('')
    setError('')
  }
  const [keyboardText, setKeyboardText] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (running.current || !dirty) return
    running.current = true
    setSaving(true)
    setError('')
    setMessage('')
    const controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    try {
      const payload = {
        ...draft,
        display_name: draft.display_name.trim() || null,
        bio: draft.bio.trim() || null,
        home_airport: draft.home_airport.trim() || null,
        avatar_url: draft.avatar_url.trim() || null,
        gemini_api_key: draft.gemini_api_key.trim() || null,
        show_on_leaderboards: draft.is_public && draft.show_on_leaderboards,
      }
      const saved = await api.patch<Profile>('/api/profiles/me', payload, {
        signal: controller.signal,
      })
      if (!controller.signal.aborted && generation === getAuthGeneration()) {
        const next = saved
          ? values(saved)
          : { ...draft, show_on_leaderboards: payload.show_on_leaderboards }
        setDraft(next)
        setBaseline(next)
        setMessage(ru ? 'Сохранено.' : 'Saved.')
        router.refresh()
      }
    } catch (cause) {
      if (!controller.signal.aborted && generation === getAuthGeneration())
        setError(
          cause instanceof ApiError && cause.status === 400
            ? ru
              ? 'Проверьте данные профиля. Изменения не сохранены.'
              : 'Check your profile details. Changes were not saved.'
            : ru
              ? 'Не удалось сохранить изменения. Повторите попытку.'
              : 'Could not save changes. Try again.',
        )
    } finally {
      running.current = false
      setSaving(false)
      release()
    }
  }
  async function download(kinds: ExportKind[]) {
    if (running.current || limit.remaining === null) return
    running.current = true
    setExporting(true)
    setError('')
    setMessage('')
    const controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    let downloaded = 0,
      limited = false
    try {
      for (const kind of kinds) {
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        if (!limit.available()) {
          limited = true
          setError(
            ru
              ? 'Достигнут лимит: 5 CSV-файлов в день. Повторите после указанного времени.'
              : 'Daily limit reached: 5 CSV files. Try again after the reset time.',
          )
          break
        }
        const total = await downloadSettingsData(ownerId, kind, controller.signal)
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        if (total) {
          downloaded++
          limit.record()
        }
      }
      if (!controller.signal.aborted && generation === getAuthGeneration())
        setMessage(
          downloaded
            ? ru
              ? 'CSV-файлы загружены.'
              : 'CSV files downloaded.'
            : limited
              ? ''
              : ru
                ? 'Нет записей для экспорта.'
                : 'No records to export.',
        )
    } catch {
      if (!controller.signal.aborted && generation === getAuthGeneration())
        setError(
          downloaded
            ? ru
              ? 'Часть CSV-файлов загружена. Остальные не удалось скачать. Повторите экспорт нужного раздела.'
              : 'Some CSV files downloaded. Others failed. Retry the remaining data section.'
            : ru
              ? 'Не удалось экспортировать данные. Повторите попытку.'
              : 'Could not export data. Try again.',
        )
    } finally {
      running.current = false
      setExporting(false)
      release()
      limit.refresh()
    }
  }
  async function signout() {
    if (running.current) return
    running.current = true
    setIdentityBusy(true)
    setError('')
    try {
      await withIdentityMutation(async (token) => {
        const result = await api.post('/api/auth/signout', {}, { identityToken: token })
        guard.allowDocumentExit()
        return result
      }, '/signin')
    } catch {
      running.current = false
      setError(ru ? 'Не удалось выйти. Повторите попытку.' : 'Could not sign out. Try again.')
      setIdentityBusy(false)
    }
  }
  const text = (en: string, russian: string) => (ru ? russian : en)
  const labels = {
    flights: text('Flights', 'Перелёты'),
    claims: text('Country claims', 'Отметки стран'),
    ground: text('Ground visits', 'Наземные посещения'),
  }
  const resetTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(limit.retryAt)
  const leaderboardReason = !draft.is_public
    ? text('Make your profile public first.', 'Сначала сделайте профиль публичным.')
    : counts === null
      ? text(
          'Flight count unavailable. Refresh to check eligibility.',
          'Количество перелётов недоступно. Обновите страницу для проверки.',
        )
      : counts.completed < 5
        ? formatCount(locale, 5 - counts.completed, flightsLeft)
        : undefined
  // Arc form/textarea composition (uiarc.dev, MIT; docs/research/2026-10-08-arc-source-inventory.md); the existing guard and save authority own changes.
  return (
    <div className="settings-page settings-editor">
      <header className="settings-heading">
        <p className="eyebrow">{text('Your account', 'Ваш аккаунт')}</p>
        <h1>{text('Settings', 'Настройки')}</h1>
      </header>
      <form
        id="settings-profile-form"
        onKeyDownCapture={(event) => {
          if (event.key === 'Enter') setKeyboardText(true)
        }}
        onPointerDownCapture={() => setKeyboardText(false)}
        onSubmit={save}
      >
        <section aria-labelledby="settings-profile-heading">
          <h2 id="settings-profile-heading">{text('Profile', 'Профиль')}</h2>
          <p className="settings-note">
            {text(
              'Profile and privacy changes are saved together.',
              'Изменения профиля и приватности сохраняются вместе.',
            )}
          </p>
          <div
            className="settings-avatar"
            role="img"
            aria-label={text('Avatar preview', 'Предпросмотр аватара')}
            style={
              draft.avatar_url.startsWith('https://') || draft.avatar_url.startsWith('data:image/')
                ? { backgroundImage: `url(${JSON.stringify(draft.avatar_url)})` }
                : undefined
            }
          >
            {draft.avatar_url.startsWith('https://') || draft.avatar_url.startsWith('data:image/')
              ? null
              : (draft.display_name || profile.username || '?').slice(0, 1).toUpperCase()}
          </div>
          <Field
            label={text('Display name', 'Имя')}
            maxLength={80}
            value={draft.display_name}
            disabled={busy}
            onChange={(event) => edit('display_name', event.target.value)}
          />
          <div className="ui-field settings-bio">
            <label className="ui-field-label" htmlFor="settings-bio">
              {text('Bio', 'О себе')}
            </label>
            <textarea
              className="ui-field-input"
              id="settings-bio"
              maxLength={140}
              rows={3}
              value={draft.bio}
              disabled={busy}
              aria-describedby="settings-bio-count"
              onChange={(event) => edit('bio', event.target.value)}
            />
            <p className="field-help" id="settings-bio-count">
              {draft.bio.length}/140
            </p>
          </div>
          <p>
            {profile.username
              ? `@${profile.username}`
              : text('No username yet', 'Имя пользователя не указано')}{' '}
            ·{' '}
            <Link prefetch={false} href="/onboarding">
              {text('Change username', 'Изменить имя пользователя')}
            </Link>
          </p>
          <Field
            label={text('Home airport', 'Домашний аэропорт')}
            maxLength={10}
            value={draft.home_airport}
            disabled={busy}
            onChange={(event) => edit('home_airport', event.target.value.toUpperCase())}
          />
          <Field
            label={text('Avatar URL', 'Ссылка на аватар')}
            type="url"
            value={draft.avatar_url}
            disabled={busy}
            onChange={(event) => edit('avatar_url', event.target.value)}
            hint={text('Use an HTTPS image URL.', 'Укажите HTTPS-ссылку на изображение.')}
          />
          <div className="settings-credential">
            <Field
              label={text('Personal Gemini API key', 'Личный ключ Gemini API')}
              type="password"
              autoComplete="off"
              value={draft.gemini_api_key}
              disabled={busy}
              onChange={(event) => edit('gemini_api_key', event.target.value)}
              hint={text(
                'Saved only with your account settings.',
                'Сохраняется только в настройках вашего аккаунта.',
              )}
            />
          </div>
        </section>
        <section aria-labelledby="settings-privacy-heading">
          <h2 id="settings-privacy-heading">{text('Privacy', 'Приватность')}</h2>
          <SwitchRow
            label={text('Public profile', 'Публичный профиль')}
            checked={draft.is_public}
            disabled={busy}
            onCheckedChange={(value) =>
              setDraft((previous) => ({
                ...previous,
                is_public: value,
                show_on_leaderboards: value && previous.show_on_leaderboards,
              }))
            }
            consequence={text(
              'Anyone can view a public profile. Turning it off also removes you from leaderboards when saved.',
              'Публичный профиль виден всем. При сохранении закрытого профиля участие в рейтинге тоже отключится.',
            )}
          />
          <SwitchRow
            label={text('Show on leaderboards when eligible', 'Участвовать в рейтинге')}
            checked={draft.show_on_leaderboards}
            disabled={busy}
            disabledReason={leaderboardReason}
            onCheckedChange={(value) => edit('show_on_leaderboards', value)}
            consequence={text(
              'A public profile and five completed flights are required. Rankings refresh periodically.',
              'Нужны публичный профиль и пять завершённых перелётов. Рейтинг обновляется периодически.',
            )}
          />
        </section>
      </form>
      <section aria-labelledby="settings-appearance-heading">
        <h2 id="settings-appearance-heading">{text('Appearance', 'Внешний вид')}</h2>
        <p>
          {text(
            'Appearance changes apply immediately on this device.',
            'Внешний вид меняется сразу на этом устройстве.',
          )}
        </p>
        <SegmentedControl
          label={text('Theme', 'Тема')}
          value={appearance.theme}
          onChange={(theme) => {
            if (!busy) setTheme(theme)
          }}
          options={[
            { value: 'light', label: text('Light', 'Светлая') },
            { value: 'dark', label: text('Dark', 'Тёмная') },
            { value: 'system', label: text('System', 'Система') },
          ]}
        />
        <SegmentedControl
          label={text('Language', 'Язык')}
          value={appearance.locale}
          onChange={(next) =>
            guard.request(() => {
              guard.allowDocumentExit()
              setLocale(next)
            })
          }
          options={[
            { value: 'en', label: 'English' },
            { value: 'ru', label: 'Русский' },
          ]}
        />
        <SwatchPicker locale={locale} />
      </section>
      <section aria-labelledby="settings-data-heading">
        <h2 id="settings-data-heading">{text('Data', 'Данные')}</h2>
        <p>
          {text(
            'Portable CSV files of your records, including upcoming flights and ground-visit notes.',
            'CSV-файлы ваших записей, включая будущие перелёты и заметки о наземных посещениях.',
          )}
        </p>
        {(['flights', 'claims', 'ground'] as const).map((kind) => (
          <div className="settings-export-row" key={kind}>
            <div>
              <h3>{labels[kind]}</h3>
              <p>
                {counts === null
                  ? text('Count unavailable', 'Количество недоступно')
                  : `${text('Records', 'Записи')}: ${formatNumber(locale, counts[kind])}`}
              </p>
            </div>
            <Button
              disabled={busy}
              loading={exporting}
              loadingLabel={text('Downloading…', 'Загружаем…')}
              disabledReason={
                limit.remaining === null
                  ? text('Checking daily allowance…', 'Проверяем дневной лимит…')
                  : limit.remaining === 0
                    ? text('Daily limit reached.', 'Дневной лимит достигнут.')
                    : counts?.[kind] === 0
                      ? text('No records to export.', 'Нет записей для экспорта.')
                      : undefined
              }
              onClick={() => void download([kind])}
            >
              {kind === 'flights'
                ? text('Download flights', 'Скачать перелёты')
                : kind === 'claims'
                  ? text('Download country claims', 'Скачать страны')
                  : text('Download ground visits', 'Скачать наземные посещения')}
            </Button>
          </div>
        ))}
        <p>
          {text(
            'Limit: 5 CSV files per day on this device.',
            'Лимит: 5 CSV-файлов в день на этом устройстве.',
          )}{' '}
          {limit.remaining === null
            ? text('Checking allowance…', 'Проверяем лимит…')
            : `${text('Remaining', 'Осталось')}: ${limit.remaining}.`}{' '}
          {text('Resets', 'Обновится')}: {resetTime} UTC.
        </p>
      </section>
      <section aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading">{text('Account', 'Аккаунт')}</h2>
        <div className="settings-actions">
          <Button disabled={busy} onClick={() => guard.request(() => void signout())}>
            {text('Sign out', 'Выйти')}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => guard.request(() => setDeleteOpen(true))}
          >
            {text('Delete account', 'Удалить аккаунт')}
          </Button>
        </div>
      </section>
      <p role="status">{message}</p>
      <p role={error ? 'alert' : undefined} className="ui-field-error">
        {error}
      </p>
      <p>
        <Link
          prefetch={false}
          href={profile.username ? `/fly/${encodeURIComponent(profile.username)}` : '/onboarding'}
        >
          {text('View my profile', 'Мой профиль')}
        </Link>
      </p>
      {dirty ? (
        <div
          className="settings-savebar"
          role="region"
          aria-label={text('Unsaved account changes', 'Несохранённые изменения аккаунта')}
        >
          <span>{text('Unsaved changes', 'Есть несохранённые изменения')}</span>
          <Button
            disabled={busy}
            onClick={() => {
              setDraft(baseline)
              setError('')
              setMessage('')
            }}
          >
            {text('Discard', 'Отменить')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="settings-profile-form"
            disabled={exporting || identityBusy}
            morphText
            instantText={keyboardText}
            onPointerDown={() => setKeyboardText(false)}
            loading={saving}
            loadingLabel={text('Saving…', 'Сохраняем…')}
          >
            {text('Save changes', 'Сохранить')}
          </Button>
        </div>
      ) : null}
      {guard.dialog}
      <SettingsDelete
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        counts={counts}
        locale={locale}
        download={() => download(['flights', 'claims', 'ground'])}
        exporting={exporting}
        exportOutcome={{ message, error }}
        exportInfo={`${text('Limit: 5 CSV files per day. Remaining', 'Лимит: 5 CSV-файлов в день. Осталось')}: ${limit.remaining ?? '…'}. ${text('Resets', 'Обновится')}: ${resetTime} UTC.`}
        onBusy={setIdentityBusy}
        allowDocumentExit={guard.allowDocumentExit}
      />
    </div>
  )
}
