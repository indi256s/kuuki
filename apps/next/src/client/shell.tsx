import { NavigationLink as Link } from './navigation-link'
import type { ReactNode } from 'react'
import { AwaitingProvider } from './awaiting'
import { AvatarMenu } from './avatar-menu'
import { MobilePageTitle, PrimaryNav, TabBar } from './nav'
import { Preferences } from './preferences'
import { QueueSummarySlot } from './queue-summary'
import { SplitAdd } from './split-add'
import { ShellNotices } from './shell-notices'
import { getGateProfile } from '../server/gates'
import type { Locale } from '../server/locale'

function Wordmark({ label = 'Kuuki home' }: { label?: string }) {
  return <Link href="/" className="wordmark" aria-label={label}><span className="mark" aria-hidden>{['く', 'う', 'き'].map(glyph => <span className="mark-glyph" key={glyph}>{glyph}</span>)}</span><span>kuuki</span></Link>
}
function Main({ children }: { children: ReactNode }) { return <main id="main" className="page-shell">{children}</main> }

/**
 * Member shell: 56px desktop header (wordmark, nav, queue slot, split Add, avatar menu) or 48px mobile header
 * plus the bottom tab bar. The header and tab bar sit outside the single `<main>`. One owner-scoped toast host serves every page.
 */
export async function MemberShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const own = await getGateProfile()
  if (!own) return <Main>{children}</Main>
  const username = own.profile.username ?? null
  return <AwaitingProvider key={own.profile.id} ownerId={own.profile.id}><ShellNotices ownerId={own.profile.id} locale={locale}>
    <header className="site-header member-header"><div className="site-header-inner">
      <Wordmark />
      <MobilePageTitle />
      <PrimaryNav locale={locale} />
      <div className="header-end">
        <QueueSummarySlot locale={locale} />
        <div className="header-desktop-only">
          <SplitAdd locale={locale} />
          {username && own ? <AvatarMenu id={own.profile.id} avatarUrl={own.profile.avatar_url} username={username} displayName={own.profile.display_name} isPublic={own.profile.is_public} locale={locale} /> : null}
        </div>
      </div>
    </div></header>
    <Main>{children}</Main>
    <TabBar locale={locale} username={username} />
  </ShellNotices></AwaitingProvider>
}

/** Wordmark and preferences only; no member navigation. `actions` adds guest links. */
export function BrandShell({ locale, actions, children }: { locale: Locale; actions?: boolean; children: ReactNode }) {
  const ru = locale === 'ru'
  return <>
    <header className="site-header"><div className="site-header-inner">
      <Wordmark />
      <div className="guest-actions">
        {actions && <nav aria-label={ru ? 'Аккаунт' : 'Account'}><Link href="/signin">{ru ? 'Войти' : 'Sign in'}</Link><Link href="/signup">{ru ? 'Создать аккаунт' : 'Sign up'}</Link></nav>}
        <Preferences initialLocale={locale} />
      </div>
    </div></header>
    <Main>{children}</Main>
  </>
}
