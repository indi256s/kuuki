'use client'

import { ApiError, api, getAuthGeneration } from '@kuuki/client/apiClient'
import {
  ADDRESS_PATTERN,
  NAME_MAX,
  deriveAddress,
  normalizeAddress,
  normalizeName,
} from '@kuuki/shared/address'
import { CircleAlert, Lock, Pencil } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { trackPrivateOperation } from '../activity'
import { CardField } from '../auth-card/card-field'
import { Button } from '../ui/button'
import './name-step.css'
import type { StepProps } from './types'

const COPY = {
  en: {
    title: 'What should we call you?',
    sub: 'It goes on your passport. Your journal stays private until you share it.',
    label: 'Your name',
    placeholder: 'e.g. Alex Mor',
    continue: 'Continue',
    saving: 'Saving…',
    tryAgain: 'Try again',
    reasonEmpty: 'Add your name to continue.',
    reasonChecking: 'Checking the address…',
    invalidName: 'Use 1 to 40 characters.',
    invalidAddress: 'Use letters, numbers and hyphens, 3 to 30 characters.',
    taken: 'That address is taken.',
    failure: 'We couldn’t save your name. Nothing you typed was lost.',
    offline: 'You’re offline. What you typed is kept. Continue unlocks when you reconnect.',
    editAddress: 'Edit address',
    address: 'Address',
  },
  ru: {
    title: 'Как вас называть?',
    sub: 'Оно попадёт в ваш паспорт. Журнал остаётся приватным, пока вы им не поделитесь.',
    label: 'Ваше имя',
    placeholder: 'например, Алекс Мор',
    continue: 'Продолжить',
    saving: 'Сохраняем…',
    tryAgain: 'Повторить',
    reasonEmpty: 'Введите имя, чтобы продолжить.',
    reasonChecking: 'Проверяем адрес…',
    invalidName: 'От 1 до 40 символов.',
    invalidAddress: 'Латинские буквы, цифры и дефисы, от 3 до 30 символов.',
    taken: 'Этот адрес занят.',
    failure: 'Не удалось сохранить имя. Всё, что вы ввели, на месте.',
    offline: 'Нет сети. Введённое сохранено. «Продолжить» станет доступным, когда сеть вернётся.',
    editAddress: 'Изменить адрес',
    address: 'Адрес',
  },
} as const

type Reply = { display_name: string | null; username: string | null } | null | undefined
type CheckState = 'ok' | 'taken' | 'invalid'

const subscribeNothing = () => () => {}
const readHost = () => window.location.host
const serverHost = () => ''

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
const readOnline = () => navigator.onLine !== false
const serverOnline = () => true

export function NameStep({
  locale,
  headingRef,
  initialName,
  initialAddress,
  onName,
  onSaved,
}: StepProps & {
  initialName: string
  initialAddress: string | null
  /** Every input event, so the passport prints the name as it is typed. */
  onName: (name: string) => void
  onSaved: (saved: { displayName: string; username: string }) => void
}) {
  const t = COPY[locale]
  const host = useSyncExternalStore(subscribeNothing, readHost, serverHost)
  const online = useSyncExternalStore(subscribeOnline, readOnline, serverOnline)
  const [name, setName] = useState(initialName)
  // The address the member chose, or the one saved before they came Back; null means "derive it from the name".
  const [custom, setCustom] = useState<string | null>(initialAddress)
  const [kept, setKept] = useState(initialAddress !== null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [check, setCheck] = useState<{ value: string; state: CheckState } | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [nameInvalid, setNameInvalid] = useState(false)
  const [serverTaken, setServerTaken] = useState<string | null>(null)
  const [serverInvalid, setServerInvalid] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLButtonElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const running = useRef(false)
  const cancelled = useRef(false)

  // Autofocus on the first mount; a step entered with Back lets the heading take focus afterwards.
  useEffect(() => nameRef.current?.focus(), [])
  useEffect(() => {
    if (editing) addressRef.current?.select()
  }, [editing])

  const normalized = normalizeName(name)
  // A fixed random tail per mounted step, so the `pilot-xxxx` fallback doesn't flicker while typing.
  const [tail] = useState(() => Array.from({ length: 4 }, () => Math.random()))
  const derived = useMemo(() => {
    let index = 0
    return deriveAddress(normalized, () => tail[index++ % tail.length] ?? 0)
  }, [normalized, tail])

  const candidate = editing ? normalizeAddress(draft) : custom
  const addressState: 'none' | 'invalid' | 'checking' | CheckState =
    candidate === null
      ? 'none'
      : !ADDRESS_PATTERN.test(candidate) || serverInvalid === candidate
        ? 'invalid'
        : candidate === initialAddress
          ? 'ok'
          : serverTaken === candidate
            ? 'taken'
            : check?.value === candidate
              ? check.state
              : 'checking'

  useEffect(() => {
    if (
      candidate === null ||
      !ADDRESS_PATTERN.test(candidate) ||
      candidate === initialAddress ||
      !online
    )
      return
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
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
  }, [candidate, initialAddress, online])

  const addressError =
    addressState === 'invalid' ? t.invalidAddress : addressState === 'taken' ? t.taken : null
  const shownAddress = custom ?? (normalized ? derived : 'your-name')
  const username = editing ? normalizeAddress(draft) : (custom ?? derived)
  const addressBlocked = addressState === 'invalid' || addressState === 'taken'
  const empty = normalized === ''
  const blocked = empty || addressBlocked || !online
  const reason = empty ? t.reasonEmpty : addressState === 'checking' ? t.reasonChecking : undefined

  function changeName(value: string) {
    setName(value)
    onName(value)
    setFailed(false)
    setNameInvalid(false)
    // A kept address belongs to the name it was saved with.
    if (kept) {
      setKept(false)
      setCustom(null)
    }
  }
  function startEditing() {
    cancelled.current = false
    setDraft(custom ?? (normalized ? derived : ''))
    setEditing(true)
  }
  function commit() {
    const value = normalizeAddress(draft)
    if (!ADDRESS_PATTERN.test(value) || serverInvalid === value) return false
    if (value !== custom) setKept(false)
    setCustom(value)
    setEditing(false)
    return true
  }
  function onAddressKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (addressState !== 'taken' && commit()) editRef.current?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelled.current = true
      setEditing(false)
      requestAnimationFrame(() => editRef.current?.focus())
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (running.current || blocked || addressState === 'checking') return
    running.current = true
    setSaving(true)
    setFailed(false)
    const displayName = normalized
    const sentUsername = username
    const edited = editing || custom !== null
    const controller = new AbortController()
    const release = trackPrivateOperation(controller)
    const generation = getAuthGeneration()
    try {
      const reply = await api.patch<Reply>(
        '/api/profiles/me',
        { display_name: displayName, username: sentUsername, username_derived: !edited },
        { signal: controller.signal },
      )
      if (!controller.signal.aborted && generation === getAuthGeneration())
        onSaved({
          displayName: reply?.display_name ?? displayName,
          username: reply?.username ?? sentUsername,
        })
    } catch (cause) {
      if (controller.signal.aborted || generation !== getAuthGeneration()) return
      const code = cause instanceof ApiError ? cause.code : undefined
      if (cause instanceof ApiError && cause.status === 409 && edited) setServerTaken(sentUsername)
      else if (code === 'INVALID_NAME') setNameInvalid(true)
      else if (code === 'INVALID_USERNAME') setServerInvalid(sentUsername)
      else setFailed(true)
    } finally {
      running.current = false
      setSaving(false)
      release()
    }
  }

  const note = !online ? t.offline : failed ? t.failure : null
  const addressErrorId = 'name-address-error'
  return (
    <>
      <div className="auth-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          {t.title}
        </h1>
        <p>{t.sub}</p>
      </div>
      <form className="auth-form" onSubmit={save} noValidate>
        <div className="name-fields">
          <CardField
            ref={nameRef}
            label={t.label}
            name="name"
            autoComplete="name"
            dir="auto"
            maxLength={NAME_MAX}
            placeholder={t.placeholder}
            value={name}
            onChange={(event) => changeName(event.target.value)}
            error={nameInvalid ? t.invalidName : undefined}
          />
          {editing ? (
            <div className="name-address-edit" data-invalid={addressError ? 'true' : undefined}>
              <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="name-address-prefix" dir="ltr">
                {host}/fly/
              </span>
              <input
                ref={addressRef}
                className="name-address-input"
                dir="ltr"
                aria-label={t.address}
                aria-invalid={addressError ? true : undefined}
                aria-describedby={addressError ? addressErrorId : undefined}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={60}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onAddressKey}
                onBlur={() => {
                  if (!cancelled.current && addressState !== 'taken') commit()
                }}
              />
            </div>
          ) : (
            <button
              ref={editRef}
              type="button"
              className="name-address"
              aria-label={t.editAddress}
              aria-describedby="name-address-url"
              onClick={startEditing}
            >
              <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
              <span id="name-address-url" className="name-address-url" dir="ltr">
                {host}/fly/{shownAddress}
              </span>
              <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          {addressError ? (
            <p id={addressErrorId} className="auth-field-error" role="alert">
              <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{addressError}</span>
            </p>
          ) : null}
        </div>
        {note ? (
          <p className="name-note" role="alert">
            {note}
          </p>
        ) : null}
        <Button
          variant="primary"
          type="submit"
          className="auth-primary"
          disabled={blocked}
          disabledReason={reason}
          loading={saving}
          loadingLabel={t.saving}
        >
          {failed ? t.tryAgain : t.continue}
        </Button>
      </form>
    </>
  )
}
