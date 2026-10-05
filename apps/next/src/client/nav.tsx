'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { BookOpen, CircleUser, LayoutGrid, Plus, Stamp } from 'lucide-react'
import { AddActions } from './add-actions'
import { announceJournalLink } from './journal-links'
import { Sheet } from './ui/sheet'

type Locale = 'en' | 'ru'
export const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', ru: 'Обзор' },
  { href: '/journal', label: 'Journal', ru: 'Журнал' },
  { href: '/passport', label: 'Passport', ru: 'Паспорт' },
  { href: '/leaderboard', label: 'Leaderboard', ru: 'Рейтинг' },
] as const

/** Active for the route itself and anything nested under it (`/journal/<id>/edit`); the query string never matters (`/overview?year=`). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Me is `/me` or the viewer's own profile; another member's `/fly/<name>` is not "me". */
export function isMeActive(pathname: string, username?: string | null): boolean {
  if (pathname === '/me') return true
  if (!username) return false
  const own = `/fly/${username}`
  return pathname === own || pathname === `/fly/${encodeURIComponent(username)}`
}

/** True when the on-screen keyboard is clearly open: the visual viewport is well below the layout height and not merely pinch-zoomed. */
export function isKeyboardOpen({ innerHeight, viewportHeight, scale }: { innerHeight: number; viewportHeight: number; scale: number }): boolean {
  return scale <= 1.01 && innerHeight - viewportHeight > 120
}

function NavLabel({ en, ru }: { en: string; ru: string }) { return <><span className="locale-en">{en}</span><span className="locale-ru" lang="ru">{ru}</span></> }

export function PrimaryNav({ locale = 'en' }: { locale?: Locale }) {
  const pathname = usePathname()
  return <nav aria-label={locale === 'ru' ? 'Основная навигация' : 'Primary'} className="desktop-nav"><ul className="main-nav">{NAV_ITEMS.map(item => <li key={item.href}><Link href={item.href} onNavigate={announceJournalLink(item.href)} aria-current={isActive(pathname, item.href) ? 'page' : undefined}><NavLabel en={item.label} ru={item.ru} /></Link></li>)}</ul></nav>
}

/**
 * Keyboard choice: while the keyboard is open the bar is translated off-screen (`html[data-keyboard=true]`)
 * but stays in the DOM and focus order, so keyboard users are never trapped and nothing sits above the keyboard.
 * Limit: with `interactive-widget=resizes-content` (or Android Chrome's default resize in some PWAs) the layout viewport
 * shrinks together with the visual viewport, so innerHeight - viewport.height stays ~0 and the bar is not flagged.
 * The fixed bar then simply rides directly above the keyboard, still reachable and never covering the focused field.
 */
function useKeyboardFlag() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const update = () => { root.dataset.keyboard = String(isKeyboardOpen({ innerHeight: window.innerHeight, viewportHeight: viewport.height, scale: viewport.scale })) }
    update()
    viewport.addEventListener('resize', update)
    return () => { viewport.removeEventListener('resize', update); delete root.dataset.keyboard }
  }, [])
}

function Tab({ href, active, icon, en, ru }: { href: string; active: boolean; icon: ReactNode; en: string; ru: string }) {
  return <li><Link href={href} onNavigate={announceJournalLink(href)} className="tab" aria-current={active ? 'page' : undefined}>{icon}<span className="tab-label"><NavLabel en={en} ru={ru} /></span></Link></li>
}

export function TabBar({ locale = 'en', username }: { locale?: Locale; username?: string | null }) {
  const pathname = usePathname()
  const [addOpen, setAddOpen] = useState(false)
  const ru = locale === 'ru'
  useKeyboardFlag()
  // The sheet must not outlive a route change (back/forward, link taps).
  const [sheetPath, setSheetPath] = useState(pathname)
  if (sheetPath !== pathname) { setSheetPath(pathname); setAddOpen(false) }
  const icon = (Icon: typeof Plus) => <Icon size={22} strokeWidth={2} aria-hidden="true" />
  return <nav aria-label={ru ? 'Вкладки' : 'Tabs'} className="tab-bar"><ul>
    <Tab href="/overview" active={isActive(pathname, '/overview')} icon={icon(LayoutGrid)} en="Overview" ru="Обзор" />
    <Tab href="/journal" active={isActive(pathname, '/journal')} icon={icon(BookOpen)} en="Journal" ru="Журнал" />
    <li>
      <Sheet open={addOpen} onOpenChange={setAddOpen} side="bottom" closeLabel={ru ? 'Закрыть' : 'Close'}
        title={ru ? 'Добавить перелёт' : 'Add a flight'}
        trigger={<button type="button" className="tab tab-add" aria-haspopup="dialog">{icon(Plus)}<span className="tab-label"><NavLabel en="Add" ru="Добавить" /></span></button>}>
        <AddActions variant="sheet" onNavigate={() => setAddOpen(false)} />
      </Sheet>
    </li>
    <Tab href="/passport" active={isActive(pathname, '/passport')} icon={icon(Stamp)} en="Passport" ru="Паспорт" />
    <Tab href="/me" active={isMeActive(pathname, username)} icon={icon(CircleUser)} en="Me" ru="Я" />
  </ul></nav>
}
