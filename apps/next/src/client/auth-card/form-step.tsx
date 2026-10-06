'use client'

import type { FormEvent, ReactNode, Ref } from 'react'
import { CircleAlert, CircleCheck, Mail } from 'lucide-react'
import { Button } from '../ui/button'
import type { Locale } from '../../lib/format'
import { CardField } from './card-field'
import './auth-card.css'

export const formWords = {
  en: {
    heading: 'Welcome to Kuuki', subtitle: 'Sign in, or use a new email to start your journal.', email: 'Email', password: 'Password', cantSignIn: 'Can’t sign in?', continue: 'Continue', checking: 'Checking…',
    createHeading: 'Start your journal', createSubtitle: 'Your flights stay private until you share them.', noJournal: ['No Kuuki journal uses', 'yet.'], change: 'Change',
    createPassword: 'Create a password', passwordHint: 'At least 8 characters', create: 'Create account', creating: 'Creating…', getBackIn: 'Email me a link to get back in',
  },
  ru: {
    heading: 'Добро пожаловать в Kuuki', subtitle: 'Войдите или укажите новую почту, чтобы начать журнал.', email: 'Почта', password: 'Пароль', cantSignIn: 'Не получается войти?', continue: 'Продолжить', checking: 'Проверяем…',
    createHeading: 'Начните свой журнал', createSubtitle: 'Ваши перелёты видны только вам, пока вы ими не поделитесь.', noJournal: ['Журнала Kuuki для', 'пока нет.'], change: 'Изменить',
    createPassword: 'Придумайте пароль', passwordHint: 'Не менее 8 символов', create: 'Создать аккаунт', creating: 'Создаём…', getBackIn: 'Отправить ссылку для входа на почту',
  },
}

/** Every message the form and create steps can show, by the state's `error` / `notice` value. */
export const formMessages = {
  en: {
    email: 'Enter a valid email.', password: 'Enter your password.', invalid: 'Email or password is incorrect.', short: 'Use at least 8 characters.',
    rate: 'Too many attempts. Please wait and try again.', network: 'We could not complete this request. Please try again.',
    taken: 'This email just got a journal. Continue to sign in.', created: 'Your account was created. Continue to sign in.', 'password-saved': 'Password saved. Sign in with it now.',
  },
  ru: {
    email: 'Введите действительный адрес почты.', password: 'Введите пароль.', invalid: 'Неверная почта или пароль.', short: 'Используйте не менее 8 символов.',
    rate: 'Слишком много попыток. Подождите и повторите.', network: 'Не удалось завершить запрос. Повторите попытку.',
    taken: 'Для этой почты только что создали журнал. Нажмите «Продолжить», чтобы войти.', created: 'Аккаунт создан. Нажмите «Продолжить», чтобы войти.', 'password-saved': 'Пароль сохранён. Теперь войдите с ним.',
  },
}

export type FormError = keyof typeof formMessages.en

/** The card heading: H1 plus the muted subtitle. `tabIndex=-1` lets a state change move focus to it. */
export function CardHeading({ title, subtitle, ref }: { title: string; subtitle?: ReactNode; ref?: Ref<HTMLHeadingElement> }) {
  return <div className="auth-heading"><h1 ref={ref} tabIndex={-1}>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
}

/** A message that belongs to the whole form, not one field: an icon plus text, never colour alone. */
export function FormMessage({ tone, children }: { tone: 'error' | 'notice'; children: ReactNode }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck
  return <p className="auth-form-message" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon size={16} strokeWidth={1.75} aria-hidden="true" /><span>{children}</span>
  </p>
}

export function Spinner() {
  return <svg className="auth-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
}

export type FormStepProps = {
  locale: Locale
  /** `form` and `checking` draw board 1.1 / 1.3 / 1.4; `create` and `creating` draw board 1.2 in place. */
  step: 'form' | 'checking' | 'create' | 'creating'
  email: string
  password: string
  error?: FormError
  notice?: 'created' | 'password-saved'
  /** Where the card sends focus after a state change. */
  headingRef: Ref<HTMLHeadingElement>
  emailRef: Ref<HTMLInputElement>
  passwordRef: Ref<HTMLInputElement>
  primaryRef: Ref<HTMLButtonElement>
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  /** Create step: back to the form to fix the email. */
  onChangeEmail: () => void
  /** Wrong password: the secondary action that emails a link to get back in. */
  onGetBackIn: () => void
}

const FIELD_ERRORS: Partial<Record<FormError, 'email' | 'password'>> = { email: 'email', password: 'password', invalid: 'password', short: 'password' }

/**
 * The one form (boards 1.1 to 1.4): Email, Password and Continue. The create step reuses the same inputs, so the
 * typed email and password stay put and editing keeps focus. Enter in either field submits.
 */
export function FormStep({ locale, step, email, password, error, notice, headingRef, emailRef, passwordRef, primaryRef, onEmailChange, onPasswordChange, onSubmit, onChangeEmail, onGetBackIn }: FormStepProps) {
  const t = formWords[locale]
  const m = formMessages[locale]
  const creating = step === 'create' || step === 'creating'
  const busy = step === 'checking' || step === 'creating'
  const field = error ? FIELD_ERRORS[error] : undefined
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit() }
  return <>
    <CardHeading ref={headingRef} title={creating ? t.createHeading : t.heading} subtitle={creating ? t.createSubtitle : t.subtitle} />
    {creating ? <div className="auth-status-line">
      <p role="status">{t.noJournal[0]} <strong>{email.trim()}</strong> {t.noJournal[1]}</p>
      <button type="button" className="auth-status-change" onClick={onChangeEmail} disabled={step === 'creating'}>{t.change}</button>
    </div> : null}
    <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      <div className="auth-fields">
        {/* `text` with an email keyboard rather than `email`: only text inputs expose the selection Change sets. */}
        <CardField ref={emailRef} label={t.email} name="email" type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
          maxLength={320} value={email} readOnly={busy} onChange={event => onEmailChange(event.target.value)} error={field === 'email' ? m[error!] : undefined} />
        <CardField ref={passwordRef} label={creating ? t.createPassword : t.password} name="password" type="password" autoComplete={creating ? 'new-password' : 'current-password'}
          maxLength={1024} locale={locale} value={password} readOnly={busy} onChange={event => onPasswordChange(event.target.value)} error={field === 'password' ? m[error!] : undefined}
          aside={creating ? <span className="auth-field-hint">{t.passwordHint}</span> : <a className="auth-text-link auth-text-link-up" href="/forgot-password" aria-disabled={busy || undefined} onClick={event => { event.preventDefault(); onGetBackIn() }}>{t.cantSignIn}</a>} />
        {error === 'invalid' ? <Button variant="secondary" className="auth-secondary" onClick={onGetBackIn}>
          <span className="auth-button-row"><Mail size={16} strokeWidth={1.75} aria-hidden="true" />{t.getBackIn}</span>
        </Button> : null}
      </div>
      {error && !field ? <FormMessage tone="error">{m[error]}</FormMessage> : null}
      {notice && !error ? <FormMessage tone="notice">{m[notice]}</FormMessage> : null}
      <Button ref={primaryRef} variant="primary" type="submit" className="auth-primary" loading={busy}
        loadingLabel={<span className="auth-button-row"><Spinner />{creating ? t.creating : t.checking}</span>}>
        {creating ? t.create : t.continue}
      </Button>
    </form>
  </>
}
