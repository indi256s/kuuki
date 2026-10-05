'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, ApiError } from '../../../../web/src/lib/apiClient'
import { withIdentityMutation } from '../activity'
import { AuthShell } from './auth-shell'
import { PasswordField, passwordRule, passwordMismatch } from './password-field'
import { Field } from '../ui/field'
import { Button } from '../ui/button'

type Mode = 'signin' | 'signup'
type Locale = 'en' | 'ru'
const schema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.email(),
  password: z.string().min(1).max(1024),
  confirm: z.string().optional(),
})
type Fields = z.infer<typeof schema>

const words = {
  en: { signin: { heading: 'Sign in', action: 'Sign in', other: 'Create an account', otherPath: '/signup' }, signup: { heading: 'Create an account', action: 'Create account', other: 'Already have an account? Sign in', otherPath: '/signin' } },
  ru: { signin: { heading: 'С возвращением', action: 'Войти', other: 'Создать аккаунт', otherPath: '/signup' }, signup: { heading: 'Создать аккаунт', action: 'Создать аккаунт', other: 'Уже есть аккаунт? Войти', otherPath: '/signin' } },
}
const messages = { en: { name: 'Name', email: 'Email', password: 'Password', invalidEmail: 'Enter a valid email.', working: 'Working…', activation: 'Moving an existing account? Continue to activation', created: 'Your account was created, but sign-in did not finish. Please sign in to continue.', credentials: 'Email or password is incorrect.', taken: 'An account already uses this email. Sign in instead.', limited: 'Too many attempts. Please wait and try again.', failed: 'We could not complete this request. Please try again.' }, ru: { name: 'Имя', email: 'Почта', password: 'Пароль', invalidEmail: 'Введите действительный адрес почты.', working: 'Подождите…', activation: 'Переносите старый аккаунт? Продолжить активацию', created: 'Аккаунт создан, но вход не завершился. Войдите, чтобы продолжить.', credentials: 'Неверная почта или пароль.', taken: 'Этот адрес уже используется. Войдите.', limited: 'Слишком много попыток. Подождите и повторите.', failed: 'Не удалось завершить запрос. Повторите попытку.' } }

export function AuthForm({ mode, locale, initialEmail = '' }: { mode: Mode; locale: Locale; initialEmail?: string }) {
  const [serverError, setServerError] = useState('')
  const [created, setCreated] = useState(false)
  const t = words[locale][mode]
  const m = messages[locale]
  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm<Fields>({
    resolver: zodResolver(mode === 'signup' ? schema.extend({ password: z.string().min(8).max(1024), confirm: z.string() }).refine(values => values.password === values.confirm, { path: ['confirm'] }) : schema), mode: 'onBlur', defaultValues: { email: initialEmail, password: '', confirm: '', name: '' },
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
        setServerError('')
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
  return <AuthShell locale={locale} title={t.heading}>
    {created ? <><p role="status" className="auth-success">{m.created}</p><div className="auth-links"><Link href={`/signin?email=${encodeURIComponent(getValues('email'))}`}>{words[locale].signin.action}</Link></div></> : <form onSubmit={submit} noValidate aria-busy={isSubmitting}>
      {mode === 'signup' ? <Field label={m.name} autoComplete="name" maxLength={80} error={errors.name ? (locale === 'ru' ? 'Не более 80 символов.' : 'Use at most 80 characters.') : undefined} optionalLabel={locale === 'ru' ? 'необязательно' : 'optional'} {...register('name')} /> : null}
      <Field label={m.email} type="email" autoComplete="email" maxLength={320} error={errors.email ? m.invalidEmail : undefined} {...register('email')} />
      <PasswordField locale={locale} label={m.password} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} maxLength={1024} hint={mode === 'signup' ? passwordRule[locale] : undefined}
        error={errors.password ? (mode === 'signup' ? passwordRule[locale] : locale === 'ru' ? 'Введите пароль.' : 'Enter your password.') : undefined} {...register('password')} />
      {mode === 'signup' ? <PasswordField locale={locale} label={locale === 'ru' ? 'Повторите пароль' : 'Confirm password'} autoComplete="new-password" maxLength={1024}
        error={errors.confirm ? passwordMismatch[locale] : undefined} {...register('confirm')} /> : null}
      <p role={serverError ? 'alert' : undefined} className="auth-message">{serverError}</p>
      <Button variant="primary" type="submit" loading={isSubmitting} loadingLabel={m.working}>{t.action}</Button>
    </form>}
    <div className="auth-links">
      {mode === 'signin' ? <Link href="/forgot-password">{locale === 'ru' ? 'Забыли пароль?' : 'Forgot password?'}</Link> : null}
      <Link href={t.otherPath}>{t.other}</Link>
      <Link href="/activation-request">{m.activation}</Link>
    </div>
  </AuthShell>
}
