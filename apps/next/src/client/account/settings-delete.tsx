'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Check, Eye, EyeOff } from '@keyline-icons/react'
import { api, ApiError } from '@kuuki/client/apiClient'
import { withIdentityMutation } from '../activity'
import { Dialog } from '../ui/dialog'
import { Button } from '../ui/button'
import { Field } from '../ui/field'
import { formatNumber, type Locale } from '../../lib/format'
import type { SettingsCounts } from './settings-data'

export function SettingsDelete({
  open,
  onClose,
  counts,
  locale,
  download,
  exporting,
  exportOutcome,
  exportInfo,
  onBusy,
  allowDocumentExit,
}: {
  open: boolean
  onClose: () => void
  counts: SettingsCounts | null
  locale: Locale
  download: () => Promise<void>
  exporting: boolean
  exportOutcome: { message: string; error: string }
  exportInfo: string
  onBusy: (busy: boolean) => void
  allowDocumentExit: () => void
}) {
  const ru = locale === 'ru'
  const [step, setStep] = useState(1),
    [password, setPassword] = useState(''),
    [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const sending = useRef(false)
  const close = () => {
    if (!sending.current && !exporting) {
      setStep(1)
      setPassword('')
      setError('')
      onClose()
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || !password || step !== 3) return
    sending.current = true
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      await withIdentityMutation(async (token) => {
        const result = await api.delete('/api/auth/account', { password }, { identityToken: token })
        allowDocumentExit()
        return result
      }, '/account-deleted')
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INVALID_CREDENTIALS')
        setError(
          ru
            ? 'Неверный пароль. Проверьте текущий пароль.'
            : 'Incorrect password. Check your current password.',
        )
      else if (cause instanceof ApiError && cause.status === 429) {
        const seconds = Number((cause.body as { retryAfter?: unknown } | undefined)?.retryAfter)
        setError(
          (ru ? 'Слишком много попыток. Повторите позже.' : 'Too many attempts. Try again later.') +
            (Number.isFinite(seconds) && seconds > 0
              ? ru
                ? ` Через ${seconds} с.`
                : ` In ${seconds} seconds.`
              : ''),
        )
      } else if (cause instanceof ApiError && cause.code === 'CSRF')
        setError(
          ru
            ? 'Сессия проверки устарела. Обновите страницу и повторите.'
            : 'Your security check expired. Refresh the page and try again.',
        )
      else if (cause instanceof TypeError || !(cause instanceof ApiError))
        setError(
          ru
            ? 'Нет ответа от сервера. Проверьте соединение. Удаление не подтверждено.'
            : 'No response from the server. Check your connection. Deletion is not confirmed.',
        )
      else
        setError(
          ru
            ? 'Не удалось удалить аккаунт. Ваши данные пока доступны. Повторите позже.'
            : 'Could not delete your account. Your data is still available. Try again later.',
        )
      sending.current = false
      setBusy(false)
      onBusy(false)
    }
  }
  const titles = ru
    ? ['Что будет удалено', 'Сохранить данные?', 'Подтвердите паролем']
    : ['What will be deleted', 'Keep your data?', 'Confirm with your password']
  // Arc Stepper/password-field presentation (uiarc.dev, MIT; docs/research/2026-10-08-arc-source-inventory.md), driven by the existing three-step deletion.
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      title={titles[step - 1]}
      description={ru ? 'Удаление аккаунта нельзя отменить.' : 'Account deletion cannot be undone.'}
      dismissible={!busy && !exporting}
      closeLabel={ru ? 'Закрыть' : 'Close'}
      className="settings-delete-dialog"
    >
      <ol className="settings-steps" aria-label={ru ? 'Шаги удаления' : 'Deletion steps'}>
        {titles.map((title, index) => (
          <li
            key={title}
            data-status={
              index + 1 < step ? 'complete' : index + 1 === step ? 'current' : 'upcoming'
            }
            aria-current={step === index + 1 ? 'step' : undefined}
          >
            <span className="settings-step-marker" aria-hidden="true">
              {index + 1 < step ? <Check size={16} aria-hidden="true" /> : index + 1}
            </span>
            <span className="settings-step-label">{title}</span>
          </li>
        ))}
      </ol>
      <div key={step} className="settings-delete-step">
        {step === 1 ? (
          <>
            <p>
              {ru
                ? 'Будут удалены профиль, перелёты, отметки стран, наземные посещения, черновики импорта и достижения. Все сеансы будут завершены.'
                : 'Your profile, flights, country claims, ground visits, import drafts, and achievements will be deleted. All sessions will end.'}
            </p>
            <dl className="settings-counts">
              {(['flights', 'claims', 'ground', 'drafts'] as const).map((kind, index) => (
                <div key={kind}>
                  <dt>
                    {
                      (ru
                        ? ['Перелёты', 'Отметки стран', 'Наземные посещения', 'Черновики импорта']
                        : ['Flights', 'Country claims', 'Ground visits', 'Import drafts'])[index]
                    }
                  </dt>
                  <dd>
                    {counts
                      ? formatNumber(locale, counts[kind])
                      : ru
                        ? 'Количество недоступно'
                        : 'Count unavailable'}
                  </dd>
                </div>
              ))}
            </dl>
            <Button variant="primary" onClick={() => setStep(2)}>
              {ru ? 'Продолжить' : 'Continue'}
            </Button>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <p>
              {ru
                ? 'Сохраните доступные CSV-файлы до удаления. Они содержат ваши записи; восстановить аккаунт из них автоматически нельзя.'
                : 'Download the available CSV files before deleting. They contain your records; they cannot automatically restore your account.'}
            </p>
            <p>{exportInfo}</p>
            <div className="settings-actions">
              <Button
                loading={exporting}
                loadingLabel={ru ? 'Загружаем…' : 'Downloading…'}
                onClick={() => void download()}
              >
                {ru ? 'Скачать данные' : 'Download data'}
              </Button>
              <Button disabled={exporting} onClick={() => setStep(3)}>
                {ru ? 'Пропустить' : 'Skip'}
              </Button>
            </div>
            <p role="status">{exportOutcome.message}</p>
            {exportOutcome.error ? <p role="alert">{exportOutcome.error}</p> : null}
            <Button disabled={exporting} variant="primary" onClick={() => setStep(3)}>
              {ru ? 'Продолжить' : 'Continue'}
            </Button>
          </>
        ) : null}
        {step === 3 ? (
          <form onSubmit={submit}>
            <div className="settings-password-field">
              <Field
                label={ru ? 'Текущий пароль' : 'Current password'}
                autoComplete="current-password"
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={busy}
                error={error}
              />
              <Button
                variant="ghost"
                disabled={busy}
                aria-pressed={reveal}
                onClick={() => setReveal((previous) => !previous)}
              >
                {reveal ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
                {ru
                  ? reveal
                    ? 'Скрыть пароль'
                    : 'Показать пароль'
                  : reveal
                    ? 'Hide password'
                    : 'Show password'}
              </Button>
            </div>
            <p>
              {ru
                ? 'Подтверждая паролем, вы соглашаетесь удалить аккаунт и все его данные навсегда.'
                : 'Confirming with your password permanently deletes your account and all its data.'}
            </p>
            <Button
              type="submit"
              variant="danger"
              disabled={!password}
              loading={busy}
              loadingLabel={ru ? 'Удаляем аккаунт…' : 'Deleting account…'}
            >
              {ru ? 'Удалить навсегда' : 'Delete permanently'}
            </Button>
            <p role="status">
              {busy
                ? ru
                  ? 'Удаляем аккаунт. Не закрывайте страницу.'
                  : 'Deleting your account. Keep this page open.'
                : ''}
            </p>
          </form>
        ) : null}
      </div>
      <div className="settings-delete-footer">
        {step > 1 ? (
          <Button
            disabled={busy || exporting}
            onClick={() => {
              setStep((previous) => previous - 1)
              setError('')
            }}
          >
            {ru ? 'Назад' : 'Back'}
          </Button>
        ) : null}
        <Button disabled={busy || exporting} onClick={close}>
          {ru ? 'Отмена' : 'Cancel'}
        </Button>
      </div>
    </Dialog>
  )
}
