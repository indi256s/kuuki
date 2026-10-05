import type { ReactNode } from 'react'
import type { Locale } from '../../lib/format'
import './auth.css'

/** EntryLayout supplies the single wordmark and the shared language/theme controls. */
export function AuthShell({ locale, title, description, children }: { locale: Locale; title: string; description?: string; children: ReactNode }) {
  return <div className="auth-shell">
    <div className="auth-shell-brand"><span className="auth-kana" aria-hidden="true">くうき</span>
      <p>{locale === 'ru' ? 'Личный журнал перелётов.' : 'Your personal flight journal.'}</p></div>
    <section className="auth-shell-panel"><h1>{title}</h1>{description ? <p className="auth-description">{description}</p> : null}{children}</section>
  </div>
}
