'use client'
// The Journal's two sections, flights (`/journal`) and ground travel (`/ground-travel`): one heading and one switch on
// both list pages, and the per-tab memory of the last section that the Journal tab links to.

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

/**
 * Where the Journal tab leads: the section in view, else the one last viewed in this browser tab. Server render and
 * hydration use `/journal`; the stored section applies after hydration. Every render rereads storage, so leaving the
 * Journal picks up what its page stored.
 */
export function useJournalHref(pathname: string): string {
  const stored = useSyncExternalStore(noSubscription, readSection, () => 'flights' as const)
  if (pathname === HREF.ground || pathname.startsWith(`${HREF.ground}/`)) return HREF.ground
  if (pathname === HREF.flights || pathname.startsWith(`${HREF.flights}/`)) return HREF.flights
  return HREF[stored]
}

/** The list page's `h1`: "Journal" on screen, the section added for assistive tech, since focus lands here on a switch. */
export function JournalHeading({ locale, section }: { locale: Locale; section: JournalSection }) {
  const t = copy[locale]
  return (
    <h1 tabIndex={-1}>
      {t.title} <span className="sr-only">· {t[section]}</span>
    </h1>
  )
}

/**
 * Flights · Ground: page links, not a radio group, so the current one is `aria-current="page"`. Mounting it records the
 * section for the Journal tab.
 */
export function JournalSections({ locale, section }: { locale: Locale; section: JournalSection }) {
  const t = copy[locale]
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SECTION_KEY, section)
    } catch {
      /* storage unavailable: the tab keeps linking to /journal */
    }
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
