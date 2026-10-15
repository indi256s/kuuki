'use client'

import type { ComponentProps } from 'react'
import { useLocale } from '../preferences'
import { ClosedCover } from './sections'

/** A private or missing public passport: a cover with one way out. */
export function ProfileClosed(props: ComponentProps<typeof ClosedCover>) {
  const locale = useLocale(props.locale)
  return <ClosedCover {...props} locale={locale} />
}

export function ProfileLoading({ locale: initialLocale }: { locale: 'en' | 'ru' }) {
  const locale = useLocale(initialLocale)
  return <p role="status">{locale === 'ru' ? 'Загружаем профиль…' : 'Loading profile…'}</p>
}
