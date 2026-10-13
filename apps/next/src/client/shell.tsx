import { NavigationLink as Link } from './navigation-link'
import type { ReactNode } from 'react'
import { AccentSync } from './appearance'
import { AwaitingProvider } from './awaiting'
import { AddMenu } from './add-menu'
import { AvatarMenu } from './avatar-menu'
import { MobilePageTitle, PrimaryNav, TabBar } from './nav'
import { Preferences } from './preferences'
import { PageShell } from './page-shell'
import { ShellNotices } from './shell-notices'
import { AddOriginTracker } from './capture/add-origin'
import { ImportDock } from './import/import-dock'
import { ImportRunsProvider } from './import/import-runs'
import { getGateProfile } from '../server/gates'
import { getRequestEnv } from '../server/identity'
import type { Locale } from '../server/locale'

function Wordmark({ label = 'Kuuki home' }: { label?: string }) {
  return (
    <Link href="/" className="wordmark" aria-label={label}>
      <span className="mark" aria-hidden>
        {['く', 'う', 'き'].map((glyph) => (
          <span className="mark-glyph" key={glyph}>
            {glyph}
          </span>
        ))}
      </span>
      <span>kuuki</span>
    </Link>
  )
}
/** Background reading needs the import job worker; without it imports are read inside the request on /import. */
function ImportRuns({
  jobs,
  ownerId,
  locale,
  children,
}: {
  jobs: boolean
  ownerId: string
  locale: Locale
  children: ReactNode
}) {
  if (!jobs) return children
  return (
    <ImportRunsProvider key={ownerId}>
      {children}
      <ImportDock locale={locale} />
    </ImportRunsProvider>
  )
}

/**
 * Member shell: sticky 64px desktop header (wordmark, nav, Add flight menu, avatar menu), or a 56px mobile header
 * (page title, avatar menu) that scrolls away above the fixed floating rail. The header and tab bar sit outside the single `<main>`. One owner-scoped toast host serves every page,
 * and, where the import job worker is bound, one import dock.
 */
export async function MemberShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const own = await getGateProfile()
  if (!own) return <PageShell>{children}</PageShell>
  const env = await getRequestEnv()
  const jobs = Boolean((env as { IMPORT_JOBS?: unknown }).IMPORT_JOBS)
  const username = own.profile.username ?? null
  return (
    <AwaitingProvider key={own.profile.id} ownerId={own.profile.id}>
      <AccentSync profileAccent={own.profile.theme_color} />
      <ShellNotices ownerId={own.profile.id} locale={locale}>
        <AddOriginTracker />
        <ImportRuns jobs={jobs} ownerId={own.profile.id} locale={locale}>
          <header className="site-header member-header">
            <div className="site-header-inner">
              <Wordmark />
              <MobilePageTitle />
              <PrimaryNav locale={locale} />
              <div className="header-end">
                <div className="header-desktop-only">
                  <AddMenu locale={locale} />
                </div>
                {username ? (
                  <AvatarMenu
                    id={own.profile.id}
                    avatarUrl={own.profile.avatar_url}
                    username={username}
                    displayName={own.profile.display_name}
                    isPublic={own.profile.is_public}
                    profileAccent={own.profile.theme_color}
                    locale={locale}
                  />
                ) : null}
              </div>
            </div>
          </header>
          <PageShell>{children}</PageShell>
          <TabBar locale={locale} />
        </ImportRuns>
      </ShellNotices>
    </AwaitingProvider>
  )
}

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
  const ru = locale === 'ru'
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Wordmark />
          <div className="guest-actions">
            {actions && (
              <nav aria-label={ru ? 'Аккаунт' : 'Account'}>
                <Link href="/signin">{ru ? 'Войти' : 'Sign in'}</Link>
                <Link href="/signup">{ru ? 'Создать аккаунт' : 'Sign up'}</Link>
              </nav>
            )}
            <Preferences initialLocale={locale} />
          </div>
        </div>
      </header>
      <PageShell>{children}</PageShell>
    </>
  )
}
