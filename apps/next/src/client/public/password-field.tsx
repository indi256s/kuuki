'use client'

import { forwardRef, useState } from 'react'
import { Field, type FieldProps } from '../ui/field'
import type { Locale } from '../../lib/format'

export const passwordRule = { en: 'Use 8 to 1024 characters.', ru: 'От 8 до 1024 символов.' }
export const passwordMismatch = { en: 'Passwords do not match.', ru: 'Пароли не совпадают.' }

export const PasswordField = forwardRef<HTMLInputElement, FieldProps & { locale: Locale }>(function PasswordField({ locale, label, ...props }, ref) {
  const [shown, setShown] = useState(false)
  const action = shown ? (locale === 'ru' ? 'Скрыть' : 'Hide') : (locale === 'ru' ? 'Показать' : 'Show')
  return <div className="auth-password" data-hint={props.hint ? "true" : undefined}><Field {...props} ref={ref} label={label} type={shown ? 'text' : 'password'} />
    <button className="auth-reveal" type="button" aria-label={`${action}: ${label}`} aria-pressed={shown} onClick={() => setShown(value => !value)}>{action}</button>
  </div>
})
