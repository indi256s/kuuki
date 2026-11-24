'use client'

import { useState, type FormEvent, type ReactNode, type Ref } from 'react'
import Image from 'next/image'
import { CircleAlert, CircleCheck, LoaderCircle, Mail } from '@keyline-icons/react'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'
import { CardField } from './card-field'
import './auth-card.css'

export const formWords = {
  en: {
    heading: 'Welcome to Kuuki',
    email: 'Email',
    password: 'Password',
    cantSignIn: 'Can’t sign in?',
    continue: 'Continue',
    checking: 'Checking…',
    google: 'Continue with Google',
    googleOpening: 'Opening Google…',
    createHeading: 'Start your journal',
    noJournal: ['No Kuuki journal uses', 'yet.'],
    change: 'Change',
    createPassword: 'Create a password',
    passwordHint: 'At least 8 characters',
    create: 'Create account',
    creating: 'Creating…',
    getBackIn: 'Email me a link to get back in',
  },
  ru: {
    heading: 'Добро пожаловать в Kuuki',
    email: 'Почта',
    password: 'Пароль',
    cantSignIn: 'Не получается войти?',
    continue: 'Продолжить',
    checking: 'Проверяем…',
    google: 'Продолжить с Google',
    googleOpening: 'Открываем Google…',
    createHeading: 'Начните свой журнал',
    noJournal: ['Журнала Kuuki для', 'пока нет.'],
    change: 'Изменить',
    createPassword: 'Придумайте пароль',
    passwordHint: 'Не менее 8 символов',
    create: 'Создать аккаунт',
    creating: 'Создаём…',
    getBackIn: 'Отправить ссылку для входа на почту',
  },
}

export const formMessages = {
  en: {
    email: 'Enter a valid email.',
    password: 'Enter your password.',
    invalid: 'Email or password is incorrect.',
    short: 'Use at least 8 characters.',
    rate: 'Too many attempts. Please wait and try again.',
    network: 'We could not complete this request. Please try again.',
    taken: 'This email just got a journal. Continue to sign in.',
    created: 'Your account was created. Continue to sign in.',
    'password-saved': 'Password saved. Sign in with it now.',
    google: 'Google sign-in was not completed. Please try again.',
    'google-link': 'Use “Can’t sign in?” to verify your email and sign in with a password.',
  },
  ru: {
    email: 'Введите действительный адрес почты.',
    password: 'Введите пароль.',
    invalid: 'Неверная почта или пароль.',
    short: 'Используйте не менее 8 символов.',
    rate: 'Слишком много попыток. Подождите и повторите.',
    network: 'Не удалось завершить запрос. Повторите попытку.',
    taken: 'Для этой почты только что создали журнал. Нажмите «Продолжить», чтобы войти.',
    created: 'Аккаунт создан. Нажмите «Продолжить», чтобы войти.',
    'password-saved': 'Пароль сохранён. Теперь войдите с ним.',
    google: 'Вход через Google не завершён. Попробуйте ещё раз.',
    'google-link': 'Подтвердите почту через «Не получается войти?» и войдите с паролем.',
  },
}

export type FormError = keyof typeof formMessages.en

export function CardHeading({
  title,
  subtitle,
  ref,
}: {
  title: string
  subtitle?: ReactNode
  ref?: Ref<HTMLHeadingElement>
}) {
  return (
    <div className="auth-heading">
      <h1 ref={ref} tabIndex={-1}>
        {title}
      </h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  )
}

export function FormMessage({ tone, children }: { tone: 'error' | 'notice'; children: ReactNode }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck
  return (
    <p className="auth-form-message" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export function Spinner() {
  return <LoaderCircle className="auth-spinner" size={16} strokeWidth={2} aria-hidden="true" />
}

export type FormStepProps = {
  locale: Locale
  step: 'form' | 'checking' | 'create' | 'creating' | 'google'
  email: string
  password: string
  error?: FormError
  notice?: 'created' | 'password-saved'
  headingRef: Ref<HTMLHeadingElement>
  emailRef: Ref<HTMLInputElement>
  passwordRef: Ref<HTMLInputElement>
  primaryRef: Ref<HTMLButtonElement>
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onChangeEmail: () => void
  onGetBackIn: () => void
  onGoogle?: () => void
}

const FIELD_ERRORS: Partial<Record<FormError, 'email' | 'password'>> = {
  email: 'email',
  password: 'password',
  invalid: 'password',
  short: 'password',
}

export function FormStep({
  locale,
  step,
  email,
  password,
  error,
  notice,
  headingRef,
  emailRef,
  passwordRef,
  primaryRef,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onChangeEmail,
  onGetBackIn,
  onGoogle,
}: FormStepProps) {
  const t = formWords[locale]
  const m = formMessages[locale]
  const creating = step === 'create' || step === 'creating'
  const busy = step === 'checking' || step === 'creating' || step === 'google'
  const field = error ? FIELD_ERRORS[error] : undefined
  const [checked, setChecked] = useState('')
  if (creating && checked !== email.trim()) setChecked(email.trim())
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }
  return (
    <>
      <CardHeading ref={headingRef} title={creating ? t.createHeading : t.heading} />
      {onGoogle ? (
        <Button
          className="auth-secondary auth-google"
          onClick={onGoogle}
          disabled={busy && step !== 'google'}
          loading={step === 'google'}
          loadingLabel={t.googleOpening}
          icon={<Image src="/google-g.png" alt="" width={20} height={20} unoptimized />}
        >
          {t.google}
        </Button>
      ) : null}
      <div className="auth-status" inert={!creating} aria-hidden={!creating || undefined}>
        <div className="auth-status-clip">
          {checked ? (
            <div className="auth-status-line">
              <p key={creating ? 'live' : 'idle'} role={creating ? 'status' : undefined}>
                {t.noJournal[0]} <strong>{checked}</strong> {t.noJournal[1]}
              </p>
              <button
                type="button"
                className="auth-status-change"
                onClick={onChangeEmail}
                disabled={step === 'creating'}
              >
                {t.change}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
        <div className="auth-fields">
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
            value={email}
            readOnly={busy}
            onChange={(event) => onEmailChange(event.target.value)}
            error={field === 'email' ? m[error!] : undefined}
          />
          <CardField
            ref={passwordRef}
            label={creating ? t.createPassword : t.password}
            name="password"
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            maxLength={1024}
            locale={locale}
            value={password}
            readOnly={busy}
            onChange={(event) => onPasswordChange(event.target.value)}
            error={field === 'password' ? m[error!] : undefined}
            aside={
              creating ? (
                <span className="auth-field-hint">{t.passwordHint}</span>
              ) : (
                <a
                  className="auth-text-link auth-text-link-up"
                  href="/forgot-password"
                  aria-disabled={busy || undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    onGetBackIn()
                  }}
                >
                  {t.cantSignIn}
                </a>
              )
            }
          />
          {error === 'invalid' ? (
            <Button variant="secondary" className="auth-secondary" onClick={onGetBackIn}>
              <span className="auth-button-row">
                <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                {t.getBackIn}
              </span>
            </Button>
          ) : null}
        </div>
        {error && !field ? <FormMessage tone="error">{m[error]}</FormMessage> : null}
        {notice && !error ? <FormMessage tone="notice">{m[notice]}</FormMessage> : null}
        <Button
          ref={primaryRef}
          variant="primary"
          type="submit"
          className="auth-primary"
          disabled={step === 'google'}
          loading={busy && step !== 'google'}
          loadingLabel={
            <span className="auth-button-row">
              <Spinner />
              {creating ? t.creating : t.checking}
            </span>
          }
        >
          {creating ? t.create : t.continue}
        </Button>
      </form>
    </>
  )
}
