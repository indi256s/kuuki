'use client'

import { useEffect, useState, type Ref } from 'react'
import { ArrowLeft, CircleAlert, Clock } from '@keyline-icons/react'
import type { Locale } from '../../lib/format'
import { Button } from '../ui/button'
import { CardField } from './card-field'
import { CardHeading, Spinner } from './form-step'

export type RequestState =
  | { step: 'request'; email: string; error?: 'invalid' | 'rate' | 'paused' | 'network' }
  | { step: 'sending'; email: string }
  | { step: 'sent'; email: string; resendAt: number }

const words = {
  en: {
    heading: 'Get back into Kuuki',
    subtitle: 'We’ll email you a link to set a new password.',
    email: 'Email',
    send: 'Send link',
    sending: 'Sending…',
    back: 'Back to sign in',
    inbox: 'Check your inbox',
    sentBefore: 'If',
    sentAfter:
      'has a Kuuki account, old or new, a link is on its way. It works once, for 30 minutes.',
    resend: 'Send again',
    countdown: 'Send again in',
    different: 'Use a different email',
    available: 'Send again is now available.',
    invalid: 'Enter a valid email.',
    rate: 'Too many links requested. Try again in an hour.',
    paused: 'Email links are paused right now. Try again later.',
    network: 'We could not send the link. Please try again.',
  },
  ru: {
    heading: 'Вернитесь в Kuuki',
    subtitle: 'Мы отправим вам ссылку, чтобы задать новый пароль.',
    email: 'Почта',
    send: 'Отправить ссылку',
    sending: 'Отправляем…',
    back: 'Назад ко входу',
    inbox: 'Проверьте почту',
    sentBefore: 'Если для',
    sentAfter:
      'есть аккаунт Kuuki, старый или новый, ссылка уже в пути. Она действует один раз в течение 30 минут.',
    resend: 'Отправить ещё раз',
    countdown: 'Отправить ещё раз через',
    different: 'Указать другую почту',
    available: 'Теперь можно отправить ссылку ещё раз.',
    invalid: 'Введите действительный адрес почты.',
    rate: 'Вы запросили слишком много ссылок. Попробуйте через час.',
    paused: 'Ссылки на почту временно недоступны. Попробуйте позже.',
    network: 'Не удалось отправить ссылку. Повторите попытку.',
  },
}

function Inbox({
  locale,
  state,
  headingRef,
  onSend,
  onDifferentEmail,
}: {
  locale: Locale
  state: Extract<RequestState, { step: 'sent' }>
  headingRef: Ref<HTMLHeadingElement>
  onSend: () => void
  onDifferentEmail: () => void
}) {
  const t = words[locale]
  const remaining = () => Math.max(0, Math.ceil((state.resendAt - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(remaining)
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil((state.resendAt - Date.now()) / 1000)))
    const timer = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [state.resendAt])
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return (
    <>
      <CardHeading
        ref={headingRef}
        title={t.inbox}
        subtitle={
          <span role="status">
            {t.sentBefore} {state.email} {t.sentAfter}
          </span>
        }
      />
      <div className="auth-recovery-actions">
        <Button
          variant="secondary"
          className="auth-secondary"
          disabled={seconds > 0}
          onClick={onSend}
        >
          <span className="auth-button-row">
            <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
            {seconds > 0 ? `${t.countdown} ${countdown}` : t.resend}
          </span>
        </Button>
        <span role="status" className="sr-only">
          {seconds === 0 ? t.available : ''}
        </span>
        <button type="button" className="auth-recovery-link" onClick={onDifferentEmail}>
          {t.different}
        </button>
      </div>
    </>
  )
}

/** Request and inbox reuse the auth card's field, heading and actions; no tagline or account-state disclosure. */
export function GetBackInStep({
  locale,
  state,
  headingRef,
  emailRef,
  onEmailChange,
  onSend,
  onBack,
  onDifferentEmail,
}: {
  locale: Locale
  state: RequestState
  headingRef: Ref<HTMLHeadingElement>
  emailRef: Ref<HTMLInputElement>
  onEmailChange: (value: string) => void
  onSend: () => void
  onBack: () => void
  onDifferentEmail: () => void
}) {
  const t = words[locale]
  if (state.step === 'sent')
    return (
      <Inbox
        locale={locale}
        state={state}
        headingRef={headingRef}
        onSend={onSend}
        onDifferentEmail={onDifferentEmail}
      />
    )
  const busy = state.step === 'sending'
  const error = state.step === 'request' ? state.error : undefined
  return (
    <>
      <CardHeading ref={headingRef} title={t.heading} subtitle={t.subtitle} />
      <form
        className="auth-form"
        noValidate
        aria-busy={busy || undefined}
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <CardField
          ref={emailRef}
          label={t.email}
          name="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={320}
          value={state.email}
          readOnly={busy}
          onChange={(event) => onEmailChange(event.target.value)}
          error={error === 'invalid' ? t.invalid : undefined}
        />
        {error && error !== 'invalid' ? (
          <p className="auth-form-message" data-tone="error" role="alert">
            <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{t[error]}</span>
          </p>
        ) : null}
        <div className="auth-recovery-actions">
          <Button
            variant="primary"
            type="submit"
            className="auth-primary"
            loading={busy}
            loadingLabel={
              <span className="auth-button-row">
                <Spinner />
                {t.sending}
              </span>
            }
          >
            {t.send}
          </Button>
          <button type="button" className="auth-recovery-link" disabled={busy} onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.back}
          </button>
        </div>
      </form>
    </>
  )
}
