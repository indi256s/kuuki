'use client'
import { useLocale } from '../preferences'
import { NavigationLink } from '../navigation-link'
export function AirportNotFound({ locale: initialLocale }: { locale: 'en' | 'ru' }) {
  const locale = useLocale(initialLocale)
  return (
    <section className="empty-state">
      <h1>{locale === 'ru' ? 'Аэропорт не найден' : 'Airport not found'}</h1>
      <NavigationLink href="/overview">{locale === 'ru' ? 'Обзор' : 'Overview'}</NavigationLink>
    </section>
  )
}
