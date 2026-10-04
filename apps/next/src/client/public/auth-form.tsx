'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, ApiError } from '../../../../web/src/lib/apiClient'
import { withIdentityMutation } from '../activity'

type Mode = 'signin' | 'signup'
type Locale = 'en' | 'ru'
const schema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email(),
  password: z.string().min(1).max(1024),
})
type Fields = z.infer<typeof schema>

const words = {
  en: { signin: { heading: 'Sign in', action: 'Sign in', other: 'Create an account', otherPath: '/signup' }, signup: { heading: 'Create an account', action: 'Create account', other: 'Already have an account? Sign in', otherPath: '/signin' } },
  ru: { signin: { heading: 'С возвращением', action: 'Войти', other: 'Создать аккаунт', otherPath: '/signup' }, signup: { heading: 'Создать аккаунт', action: 'Создать аккаунт', other: 'Уже есть аккаунт? Войти', otherPath: '/signin' } },
}
const messages = { en: { brand: 'Your flights, places, and memories in one journal.', name: 'Name', email: 'Email', password: 'Password', hide: 'Hide', show: 'Show', invalidEmail: 'Enter a valid email.', shortPassword: 'Use at least 8 characters.', rule: 'At least 8 characters.', working: 'Working…', activation: 'Moving an existing account? Continue to activation', created: 'Your account was created, but sign-in did not finish. Please sign in to continue.', credentials: 'Email or password is incorrect.', taken: 'An account already uses this email. Sign in instead.', limited: 'Too many attempts. Please wait and try again.', failed: 'We could not complete this request. Please try again.' }, ru: { brand: 'Ваши перелёты, страны и воспоминания — в одном журнале.', name: 'Имя', email: 'Почта', password: 'Пароль', hide: 'Скрыть', show: 'Показать', invalidEmail: 'Введите действительный адрес почты.', shortPassword: 'Не менее 8 символов.', rule: 'Не менее 8 символов.', working: 'Подождите…', activation: 'Переносите старый аккаунт? Продолжить активацию', created: 'Аккаунт создан, но вход не завершился. Войдите, чтобы продолжить.', credentials: 'Неверная почта или пароль.', taken: 'Этот адрес уже используется. Войдите.', limited: 'Слишком много попыток. Подождите и повторите.', failed: 'Не удалось завершить запрос. Повторите попытку.' } }

export function AuthForm({ mode, locale, initialEmail = '' }: { mode: Mode; locale: Locale; initialEmail?: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [created, setCreated] = useState(false)
  const t = words[locale][mode]
  const m = messages[locale]
  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<Fields>({
    resolver: zodResolver(mode === 'signup' ? schema.extend({ password: z.string().min(8).max(1024) }) : schema), defaultValues: { email: initialEmail, password: '', name: '' },
  })
  const submit = handleSubmit(async values => {
    setServerError('')
    try {
      await withIdentityMutation(token => api.post(mode === 'signin' ? '/api/auth/sign-in/email' : '/api/auth/sign-up/email', {
        email: values.email, password: values.password, ...(mode === 'signup' ? { displayName: values.name } : {}),
      }, { identityToken: token }), mode === 'signin' ? '/overview' : '/onboarding')
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SIGN_IN_REQUIRED') {
        setCreated(true)
        setServerError(m.created)
      } else if (error instanceof ApiError && (error.code === 'INVALID_CREDENTIALS' || error.code === 'INVALID_EMAIL_OR_PASSWORD')) {
        setServerError(m.credentials)
      } else if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setServerError(m.taken)
      } else if (error instanceof ApiError && error.status === 429) {
        setServerError(m.limited)
      } else {
        setServerError(m.failed)
      }
    }
  })
  return <div className="auth-card"><div className="auth-brand"><span aria-hidden>くうき</span><p>{m.brand}</p></div>
    <div className="auth-panel"><p className="eyebrow">Kuuki</p><h1>{t.heading}</h1>
      {created ? <Link className="button primary" href={`/signin?email=${encodeURIComponent(getValues('email'))}`}>Sign in</Link> : <form onSubmit={submit} noValidate>
        {mode === 'signup' && <div className="field"><label htmlFor="auth-name">{m.name}</label><input id="auth-name" autoComplete="name" {...register('name')} /><span className="error">{errors.name?.message}</span></div>}
        <div className="field"><label htmlFor="auth-email">{m.email}</label><input id="auth-email" type="email" autoComplete="email" {...register('email')} /><span className="error">{errors.email ? m.invalidEmail : ''}</span></div>
        <div className="field"><label htmlFor="auth-password">{m.password}</label><div className="password-field"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} {...register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? `${m.hide} ${m.password}` : `${m.show} ${m.password}`}>{showPassword ? m.hide : m.show}</button></div><span className="error">{errors.password ? m.shortPassword : mode === 'signup' ? m.rule : ''}</span></div>
        <p role="alert" className="form-message">{serverError}</p><button className="button primary" type="submit" disabled={isSubmitting}>{isSubmitting ? m.working : t.action}</button>
      </form>}
      {mode === 'signin' && <p className="auth-switch"><Link href="/forgot-password">{locale === 'ru' ? 'Забыли пароль?' : 'Forgot password?'}</Link></p>}
      <p className="auth-switch"><Link href={t.otherPath}>{t.other}</Link></p>
      <p className="auth-switch"><a href="/legacy/?mode=signin">{m.activation}</a></p>
    </div></div>
}
