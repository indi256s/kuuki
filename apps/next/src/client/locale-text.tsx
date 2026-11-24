'use client'

import type { ReactNode } from 'react'
import { useLocale } from './preferences'
import type { Locale } from '../lib/format'

export function LocaleText({ en, ru, locale }: { en: ReactNode; ru: ReactNode; locale: Locale }) {
  return useLocale(locale) === 'ru' ? ru : en
}
