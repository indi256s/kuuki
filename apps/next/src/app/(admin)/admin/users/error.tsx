'use client'

import { Button } from '../../../../client/ui/button'
import { useLocale } from '../../../../client/preferences'

export default function AnalyticsError({ reset }: { reset: () => void }) {
  const ru = useLocale() === 'ru'
  return (
    <section className="error-state" role="alert">
      <h1>{ru ? 'Статистика недоступна' : 'Statistics unavailable'}</h1>
      <Button onClick={reset}>{ru ? 'Повторить' : 'Try again'}</Button>
    </section>
  )
}
