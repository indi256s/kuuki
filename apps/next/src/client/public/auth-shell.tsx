import type { ReactNode } from 'react'
import type { Locale } from '../../lib/format'
import './auth.css'

export function AuthBrand({ locale }: { locale: Locale }) {
  return <div className="auth-shell-brand"><span className="auth-kana" aria-hidden="true">くうき</span>
    <p>{locale === 'ru' ? 'Личный журнал перелётов.' : 'Your personal flight journal.'}</p></div>
}

/** A panel's heading and body. Inside the (auth) layout the card, brand and panel come from the layout. */
export function AuthPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <><h1>{title}</h1>{description ? <p className="auth-description">{description}</p> : null}{children}</>
}

/** A standalone entry page outside the (auth) layout. EntryLayout supplies the single wordmark and the shared language/theme controls. */
export function AuthShell({ locale, title, description, children }: { locale: Locale; title: string; description?: string; children: ReactNode }) {
  return <div className="auth-shell"><AuthBrand locale={locale} />
    <section className="auth-shell-panel"><AuthPanel title={title} description={description}>{children}</AuthPanel></section>
  </div>
}
