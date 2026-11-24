'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { Locale } from '../lib/format'
import { NavigationLink as Link } from './navigation-link'
import './journal-sections.css'

export type JournalSection = 'flights' | 'ground'

const SECTION_KEY = 'kuuki:journal-section'
const HREF: Record<JournalSection, string> = { flights: '/journal', ground: '/ground-travel' }

const copy = {
  en: { title: 'Journal', nav: 'Journal sections', flights: 'Flights', ground: 'Ground' },
  ru: { title: 'Журнал', nav: 'Разделы журнала', flights: 'Перелёты', ground: 'По земле' },
} as const

function readSection(): JournalSection {
  try {
    return window.sessionStorage.getItem(SECTION_KEY) === 'ground' ? 'ground' : 'flights'
  } catch {
    return 'flights'
  }
}

const noSubscription = () => () => {}

export function useJournalHref(pathname: string): string {
  const stored = useSyncExternalStore(noSubscription, readSection, () => 'flights' as const)
  if (pathname === HREF.ground || pathname.startsWith(`${HREF.ground}/`)) return HREF.ground
  if (pathname === HREF.flights || pathname.startsWith(`${HREF.flights}/`)) return HREF.flights
  return HREF[stored]
}

export function JournalHeading({ locale, section }: { locale: Locale; section: JournalSection }) {
  const t = copy[locale]
  return (
    <h1 tabIndex={-1} className="mobile-sr-only">
      {t.title} <span className="sr-only">· {t[section]}</span>
    </h1>
  )
}

export function JournalSections({ locale, section }: { locale: Locale; section: JournalSection }) {
  const t = copy[locale]
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SECTION_KEY, section)
    } catch {}
  }, [section])
  return (
    <nav aria-label={t.nav} className="journal-sections">
      {(['flights', 'ground'] as const).map((item) => (
        <Link
          key={item}
          href={HREF[item]}
          prefetch
          className="journal-section"
          aria-current={item === section ? 'page' : undefined}
        >
          {t[item]}
        </Link>
      ))}
    </nav>
  )
}
