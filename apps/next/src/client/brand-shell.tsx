import type { ReactNode } from 'react'
import { GuestActions } from './guest-actions'
import { PageShell } from './page-shell'
import { Wordmark } from './wordmark'
import type { Locale } from '../server/locale'

/** Wordmark and preferences only; no member navigation. `actions` adds guest links. */
export function BrandShell({
  locale,
  actions,
  children,
}: {
  locale: Locale
  actions?: boolean
  children: ReactNode
}) {
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Wordmark />
          <GuestActions locale={locale} actions={actions} />
        </div>
      </header>
      <PageShell>{children}</PageShell>
    </>
  )
}
