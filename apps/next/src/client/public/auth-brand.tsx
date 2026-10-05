'use client'

import { usePathname } from 'next/navigation'

const copy = {
  en: { journal: 'Your flights, places, and memories in one journal.', recovery: 'Return to your journeys.' },
  ru: { journal: 'Ваши перелёты, страны и воспоминания — в одном журнале.', recovery: 'Вернитесь к своим путешествиям.' },
}

export function AuthBrand({ locale }: { locale: 'en' | 'ru' }) {
  const t = copy[locale]
  return <div className="auth-brand"><span aria-hidden>くうき</span><p>{usePathname() === '/forgot-password' ? t.recovery : t.journal}</p></div>
}
