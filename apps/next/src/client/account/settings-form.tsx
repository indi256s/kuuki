'use client'

import { useLocale } from '../preferences'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, ApiError, getAuthGeneration } from '@kuuki/client/apiClient'
import { ADDRESS_PATTERN, NAME_MAX, normalizeAddress, normalizeName } from '@kuuki/shared/address'
import { trackPrivateOperation, withIdentityMutation } from '../activity'
import { useAppearance } from '../preferences'
import { setLocale, setTheme, useAccentSave } from '../appearance'
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
  username: profile.username ?? '',
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
type AddressCheck = 'ok' | 'taken' | 'invalid'
const subscribeNothing = () => () => {}
const readHost = () => window.location.host
const serverHost = () => ''

export function SettingsForm({
  ownerId,
  profile,
  locale: initialLocale,
  counts = null,
  hasPassword = true,
}: {
  ownerId: string
  profile: Profile
  locale: Locale
  counts?: SettingsCounts | null
  hasPassword?: boolean | null
}) {
  const locale = useLocale(initialLocale)
  const ru = locale === 'ru',
    router = useRouter()
  const [draft, setDraft] = useState(() => values(profile)),
    [baseline, setBaseline] = useState(() => values(profile))
  const [saving, setSaving] = useState(false),
    [exporting, setExporting] = useState(false),
    [identityBusy, setIdentityBusy] = useState(false)
  const [messageCopy, setMessage] = useState<Record<Locale, string> | null>(null),
    [errorCopy, setError] = useState<Record<Locale, string> | null>(null),
    [deleteOpen, setDeleteOpen] = useState(false)
  const message = messageCopy?.[locale] ?? ''
  const error = errorCopy?.[locale] ?? ''
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
    setMessage(null)
    setError(null)
  }
  // The accent saves on its own, like theme and language: it is not part of the dirty form or its payload.
  const { save: saveAccent, failed: accentError } = useAccentSave(profile.theme_color)
  const [keyboardText, setKeyboardText] = useState(false)
  const host = useSyncExternalStore(subscribeNothing, readHost, serverHost)
  const [editingAddress, setEditingAddress] = useState(false),
    [check, setCheck] = useState<{ value: string; state: AddressCheck } | null>(null),
    [serverTaken, setServerTaken] = useState<string | null>(null),
    [serverInvalid, setServerInvalid] = useState<string | null>(null),
    [nameInvalid, setNameInvalid] = useState(false)
  const savedAddress = baseline.username,
    candidate = draft.username
  const addressState: 'ok' | 'invalid' | 'taken' | 'checking' =
    candidate === savedAddress
      ? 'ok'
      : !ADDRESS_PATTERN.test(candidate) || serverInvalid === candidate
        ? 'invalid'
        : serverTaken === candidate
          ? 'taken'
          : check?.value === candidate
            ? check.state
            : 'checking'
  useEffect(() => {
    if (candidate === savedAddress || !ADDRESS_PATTERN.test(candidate)) return
    const controller = new AbortController(),
      release = trackPrivateOperation(controller)
    const timer = setTimeout(async () => {
      try {
        const reply = await api.get<{ available: boolean; valid: boolean }>(
          '/api/profiles/check-username',
          { username: candidate },
          { signal: controller.signal },
        )
        if (!controller.signal.aborted)
          setCheck({
            value: candidate,
            state: reply?.valid === false ? 'invalid' : reply?.available ? 'ok' : 'taken',
          })
      } catch {
        // The server is authoritative on save; an unreachable check must not block the member.
        if (!controller.signal.aborted) setCheck({ value: candidate, state: 'ok' })
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
      release()
    }
  }, [candidate, savedAddress])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (running.current || !dirty || addressState !== 'ok') return
    running.current = true
    setSaving(true)
    setError(null)
    setMessage(null)
    const controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    try {
      const { username, display_name, ...fields } = draft
      const sentUsername = username !== baseline.username ? username : null
      const payload = {
        ...fields,
        // Without a chosen address the server derives one from the name on the first save.
        ...(sentUsername ? { username: sentUsername } : {}),
        // An unchanged name stays out: a name saved before the 40-character limit must not block other edits.
        ...(display_name !== baseline.display_name
          ? { display_name: normalizeName(display_name) || null }
          : {}),
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
        setEditingAddress(false)
        setMessage({ en: 'Saved.', ru: 'Сохранено.' })
        router.refresh()
      }
    } catch (cause) {
      if (!controller.signal.aborted && generation === getAuthGeneration()) {
        const code = cause instanceof ApiError ? cause.code : undefined
        if (
          cause instanceof ApiError &&
          cause.status === 409 &&
          draft.username !== baseline.username
        )
          setServerTaken(draft.username)
        else if (code === 'INVALID_NAME') setNameInvalid(true)
        else if (code === 'INVALID_USERNAME' && draft.username !== baseline.username)
          setServerInvalid(draft.username)
        else
          setError(
            cause instanceof ApiError && cause.status === 400
              ? {
                  en: 'Check your profile details. Changes were not saved.',
                  ru: 'Проверьте данные профиля. Изменения не сохранены.',
                }
              : {
                  en: 'Could not save changes. Try again.',
                  ru: 'Не удалось сохранить изменения. Повторите попытку.',
                },
          )
      }
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
    setError(null)
    setMessage(null)
    const controller = new AbortController(),
      release = trackPrivateOperation(controller),
      generation = getAuthGeneration()
    let downloaded = 0,
      csvDownloaded = false,
      limited = false
    try {
      for (const kind of kinds) {
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        if (!limit.available()) {
          limited = true
          setError({
            en: 'Daily limit reached: 5 files. Try again after the reset time.',
            ru: 'Достигнут лимит: 5 файлов в день. Повторите после указанного времени.',
          })
          break
        }
        const total = await downloadSettingsData(ownerId, kind, controller.signal)
        if (controller.signal.aborted || generation !== getAuthGeneration()) return
        if (total) {
          downloaded++
          if (kind !== 'journeys') csvDownloaded = true
          limit.record()
        }
      }
      if (!controller.signal.aborted && generation === getAuthGeneration())
        setMessage(
          downloaded
            ? csvDownloaded
              ? { en: 'CSV files downloaded.', ru: 'CSV-файлы загружены.' }
              : { en: 'JSON file downloaded.', ru: 'JSON-файл загружен.' }
            : limited
              ? null
              : { en: 'No records to export.', ru: 'Нет записей для экспорта.' },
        )
    } catch {
      if (!controller.signal.aborted && generation === getAuthGeneration())
        setError(
          downloaded
            ? {
                en: 'Some CSV files downloaded. Others failed. Retry the remaining data section.',
                ru: 'Часть CSV-файлов загружена. Остальные не удалось скачать. Повторите экспорт нужного раздела.',
              }
            : {
                en: 'Could not export data. Try again.',
                ru: 'Не удалось экспортировать данные. Повторите попытку.',
              },
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
    setError(null)
    try {
      await withIdentityMutation(async (token) => {
        const result = await api.post('/api/auth/signout', {}, { identityToken: token })
        guard.allowDocumentExit()
        return result
      }, '/signin')
    } catch {
      running.current = false
      setError({
        en: 'Could not sign out. Try again.',
        ru: 'Не удалось выйти. Повторите попытку.',
      })
      setIdentityBusy(false)
    }
  }
  const text = (en: string, russian: string) => (ru ? russian : en)
  const labels = {
    flights: text('Flights', 'Перелёты'),
    claims: text('Country claims', 'Отметки стран'),
    ground: text('Ground visits', 'Наземные посещения'),
    journeys: text('Ground journeys', 'Наземные поездки'),
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
            name="name"
            autoComplete="name"
            dir="auto"
            maxLength={NAME_MAX}
            value={draft.display_name}
            disabled={busy}
            error={
              nameInvalid ? text('Use 1 to 40 characters.', 'От 1 до 40 символов.') : undefined
            }
            onChange={(event) => {
              setNameInvalid(false)
              edit('display_name', event.target.value)
            }}
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
          {editingAddress ? (
            <Field
              label={text('Address', 'Адрес')}
              name="address"
              dir="ltr"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={60}
              value={draft.username}
              disabled={busy}
              hint={<span dir="ltr">{host}/fly/</span>}
              error={
                addressState === 'invalid'
                  ? text(
                      'Use letters, numbers and hyphens, 3 to 30 characters.',
                      'Латинские буквы, цифры и дефисы, от 3 до 30 символов.',
                    )
                  : addressState === 'taken'
                    ? text('That address is taken.', 'Этот адрес занят.')
                    : undefined
              }
              onChange={(event) => edit('username', normalizeAddress(event.target.value))}
            />
          ) : (
            <div className="settings-address">
              <span className="ui-field-label">{text('Address', 'Адрес')}</span>
              <p>
                {baseline.username ? (
                  <span dir="ltr">
                    {host}/fly/{baseline.username}
                  </span>
                ) : (
                  text(
                    'Your address is set from your name when you save.',
                    'Адрес появится из вашего имени, когда вы сохраните.',
                  )
                )}
              </p>
              <Button dense disabled={busy} onClick={() => setEditingAddress(true)}>
                {text('Edit', 'Изменить')}
              </Button>
            </div>
          )}
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
              'Turning it off removes you from leaderboards.',
              'Если закрыть профиль, вы пропадёте из рейтинга.',
            )}
          />
          <SwitchRow
            label={text('Show on leaderboards when eligible', 'Участвовать в рейтинге')}
            checked={draft.show_on_leaderboards}
            disabled={busy}
            disabledReason={leaderboardReason}
            onCheckedChange={(value) => edit('show_on_leaderboards', value)}
            consequence={text(
              'A public profile and five completed flights are required.',
              'Нужны публичный профиль и пять завершённых перелётов.',
            )}
          />
        </section>
      </form>
      <section aria-labelledby="settings-appearance-heading">
        <h2 id="settings-appearance-heading">{text('Appearance', 'Внешний вид')}</h2>
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
          onChange={setLocale}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ru', label: 'Русский' },
          ]}
        />
        <SwatchPicker locale={locale} onChange={saveAccent} />
        {accentError ? (
          <p role="alert" className="ui-field-error">
            {text(
              'Could not save the accent color. It went back to the previous one.',
              'Не удалось сохранить акцентный цвет. Мы вернули прежний.',
            )}
          </p>
        ) : null}
      </section>
      <section aria-labelledby="settings-data-heading">
        <h2 id="settings-data-heading">{text('Data', 'Данные')}</h2>
        {(['flights', 'claims', 'ground', 'journeys'] as const).map((kind) => (
          <div className="settings-export-row" key={kind}>
            <div>
              <h3>{labels[kind]}</h3>
              <p>
                {counts === null
                  ? text('Count unavailable', 'Количество недоступно')
                  : kind === 'journeys'
                    ? `${text('Journeys', 'Поездки')}: ${formatNumber(locale, counts.journeys)} · ${text('Manual places', 'Свои места')}: ${formatNumber(locale, counts.manualPlaces)}`
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
                    : (kind === 'journeys'
                          ? (counts?.journeys ?? 1) + (counts?.manualPlaces ?? 1)
                          : counts?.[kind]) === 0
                      ? text('No records to export.', 'Нет записей для экспорта.')
                      : undefined
              }
              onClick={() => void download([kind])}
            >
              {kind === 'flights'
                ? text('Download flights', 'Скачать перелёты')
                : kind === 'claims'
                  ? text('Download country claims', 'Скачать страны')
                  : kind === 'ground'
                    ? text('Download ground visits', 'Скачать наземные посещения')
                    : text('Download ground journeys (JSON)', 'Скачать наземные поездки (JSON)')}
            </Button>
          </div>
        ))}
        {limit.remaining !== null && limit.remaining <= 1 ? (
          <p>
            {`${text('Remaining', 'Осталось')}: ${limit.remaining}.`} {text('Resets', 'Обновится')}:{' '}
            {resetTime} UTC.
          </p>
        ) : null}
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
      {profile.username ? (
        <p>
          <Link prefetch={false} href="/passport">
            {text('View my profile', 'Мой профиль')}
          </Link>
        </p>
      ) : null}
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
              setEditingAddress(false)
              setNameInvalid(false)
              setError(null)
              setMessage(null)
            }}
          >
            {text('Discard', 'Отменить')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="settings-profile-form"
            disabled={exporting || identityBusy}
            disabledReason={
              addressState === 'invalid'
                ? text('Fix the address to save.', 'Исправьте адрес, чтобы сохранить.')
                : addressState === 'taken'
                  ? text(
                      'Pick a free address to save.',
                      'Выберите свободный адрес, чтобы сохранить.',
                    )
                  : addressState === 'checking'
                    ? text('Checking the address…', 'Проверяем адрес…')
                    : undefined
            }
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
        hasPassword={hasPassword}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        counts={counts}
        locale={locale}
        download={() => download(['flights', 'claims', 'ground', 'journeys'])}
        exporting={exporting}
        exportOutcome={{ message, error }}
        exportInfo={`${text('Limit: 5 files per day. Remaining', 'Лимит: 5 файлов в день. Осталось')}: ${limit.remaining ?? '…'}. ${text('Resets', 'Обновится')}: ${resetTime} UTC.`}
        onBusy={setIdentityBusy}
        allowDocumentExit={guard.allowDocumentExit}
      />
    </div>
  )
}
