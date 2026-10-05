import type { Locale } from '../lib/format'

/** Route loading state: one stable logo mark (no spinner, no motion) and a localized status line. */
export function LoadingScreen({ locale }: { locale: Locale }) {
  return <div className="loading-screen" role="status"><span className="mark" aria-hidden>く</span><p>{locale === 'ru' ? 'Загрузка…' : 'Loading…'}</p></div>
}
