'use client'
import { Button } from '../../../../client/ui/button'
import { useLocale } from '../../../../client/preferences'
import { NavigationLink } from '../../../../client/navigation-link'
export default function AirportError({ reset }: { reset: () => void }) {
  const locale = useLocale()
  return (
    <section className="error-state" role="alert">
      <h1>{locale === 'ru' ? 'Аэропорт недоступен' : 'Airport unavailable'}</h1>
      <Button onClick={reset}>{locale === 'ru' ? 'Повторить' : 'Try again'}</Button>
      <NavigationLink href="/overview">{locale === 'ru' ? 'Обзор' : 'Overview'}</NavigationLink>
    </section>
  )
}
