'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const links = [
  { href: '/overview', label: 'Overview', ru: 'Обзор' },
  { href: '/journal', label: 'Journal', ru: 'Журнал' },
  { href: '/passport', label: 'Passport', ru: 'Паспорт' },
  { href: '/leaderboard', label: 'Leaderboard', ru: 'Рейтинг' },
]
function NavLabel({ en, ru }: { en: string; ru: string }) { return <><span className="locale-en">{en}</span><span className="locale-ru" lang="ru">{ru}</span></> }
export function PrimaryNav() {
  const pathname = usePathname()
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname
      const heading = document.querySelector<HTMLElement>('main h1')
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
    }
  }, [pathname])
  return <><nav aria-label="Primary" className="desktop-nav"><ul className="main-nav">{links.map(link => <li key={link.href}><Link href={link.href} aria-current={pathname === link.href ? 'page' : undefined}><NavLabel en={link.label} ru={link.ru} /></Link></li>)}</ul></nav>
    <nav aria-label="Mobile" className="mobile-nav"><ul>{links.slice(0, 2).map(link => <li key={link.href}><Link href={link.href} aria-current={pathname === link.href ? 'page' : undefined}><NavLabel en={link.label} ru={link.ru} /></Link></li>)}<li><a href="/add" aria-label="Add a flight / Добавить перелёт"><span aria-hidden>＋</span></a></li><li><Link href="/passport" aria-current={pathname === '/passport' ? 'page' : undefined}><NavLabel en="Passport" ru="Паспорт" /></Link></li><li><Link href="/me" aria-current={pathname === '/me' || pathname.startsWith('/fly/') ? 'page' : undefined}><NavLabel en="Me" ru="Я" /></Link></li></ul></nav>
  </>
}
