'use client'

import { useLocale } from './preferences'

import { NavigationLink as Link } from './navigation-link'
import { usePathname } from 'next/navigation'
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react'
import { BookOpen, GridSquares, Route, Stamp } from '@keyline-icons/react'

type Locale = 'en' | 'ru'
export const NAV_ITEMS = [
  { href: '/overview', label: 'Overview', ru: 'Обзор' },
  { href: '/journal', label: 'Journal', ru: 'Журнал' },
  { href: '/ground-travel', label: 'Ground travel', ru: 'Наземные путешествия' },
  { href: '/passport', label: 'Passport', ru: 'Паспорт' },
] as const

/** Active for the route itself and anything nested under it (`/journal/<id>/edit`); the query string never matters (`/overview?year=`). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** True when the on-screen keyboard is clearly open: the visual viewport is well below the layout height and not merely pinch-zoomed. */
export function isKeyboardOpen({
  innerHeight,
  viewportHeight,
  scale,
}: {
  innerHeight: number
  viewportHeight: number
  scale: number
}): boolean {
  return scale <= 1.01 && innerHeight - viewportHeight > 120
}

function NavLabel({ en, ru }: { en: string; ru: string }) {
  return (
    <>
      <span className="locale-en">{en}</span>
      <span className="locale-ru" lang="ru">
        {ru}
      </span>
    </>
  )
}

export function MobilePageTitle() {
  const pathname = usePathname()
  const item = [
    ...NAV_ITEMS,
    { href: '/leaderboard', label: 'Leaderboard', ru: 'Рейтинг' },
    { href: '/settings', label: 'Settings', ru: 'Настройки' },
    { href: '/add', label: 'Add a flight', ru: 'Новый перелёт' },
    { href: '/import', label: 'Import', ru: 'Импорт' },
    { href: '/me', label: 'Me', ru: 'Я' },
    { href: '/fly', label: 'Profile', ru: 'Профиль' },
  ].find((item) => isActive(pathname, item.href))
  return (
    <p className="mobile-page-title">
      <NavLabel en={item?.label ?? 'Kuuki'} ru={item?.ru ?? 'Kuuki'} />
    </p>
  )
}

export function PrimaryNav({ locale: initialLocale = 'en' }: { locale?: Locale }) {
  const locale = useLocale(initialLocale)
  const pathname = usePathname()
  const nav = useRef<HTMLElement>(null)
  // The sticky header wraps on narrow desktops and long labels; sticky content below reads its real height.
  useEffect(() => {
    const header = nav.current?.closest('.site-header')
    if (!header || typeof ResizeObserver !== 'function') return
    const root = document.documentElement.style
    let height = 0
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.borderBoxSize[0]?.blockSize ?? 0
      if (next === height) return
      height = next
      root.setProperty('--header-block', `${next}px`)
    })
    observer.observe(header)
    return () => {
      observer.disconnect()
      root.removeProperty('--header-block')
    }
  }, [])
  return (
    <nav
      ref={nav}
      aria-label={locale === 'ru' ? 'Основная навигация' : 'Primary'}
      className="desktop-nav"
    >
      <ul className="main-nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            >
              <NavLabel en={item.label} ru={item.ru} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Keyboard choice: while the keyboard is open the bar is translated off-screen (`html[data-keyboard=true]`)
 * but stays in the DOM and focus order, so keyboard users are never trapped and nothing sits above the keyboard.
 * Limit: with `interactive-widget=resizes-content` (or Android Chrome's default resize in some PWAs) the layout viewport
 * shrinks together with the visual viewport, so innerHeight - viewport.height stays ~0 and the bar is not flagged.
 * The fixed bar then simply rides directly above the keyboard, still reachable and never covering the focused field.
 */
function useKeyboardFlag() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const update = () => {
      const next = isKeyboardOpen({
        innerHeight: window.innerHeight,
        viewportHeight: viewport.height,
        scale: viewport.scale,
      })
      root.dataset.keyboard = String(next)
      setOpen(next)
    }
    update()
    viewport.addEventListener('resize', update)
    return () => {
      viewport.removeEventListener('resize', update)
      delete root.dataset.keyboard
    }
  }, [])
  return open
}

function Tab({
  href,
  active,
  icon,
  en,
  ru,
  name,
}: {
  href: string
  active: boolean
  icon: ReactNode
  en: string
  ru: string
  /** Full accessible name when the visible label is short; it always contains the visible label (Label in Name). */
  name?: string
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch
        className="tab"
        aria-label={name}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        <span className="tab-label">
          <NavLabel en={en} ru={ru} />
        </span>
      </Link>
    </li>
  )
}

const TABS: readonly {
  href: string
  en: string
  ru: string
  /** Full accessible names, for a tab whose visible label is shortened to fit four across at 320px. */
  name?: { en: string; ru: string }
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
}[] = [
  { href: '/overview', en: 'Overview', ru: 'Обзор', Icon: GridSquares },
  { href: '/journal', en: 'Journal', ru: 'Журнал', Icon: BookOpen },
  {
    href: '/ground-travel',
    en: 'Ground',
    ru: 'Наземные',
    name: { en: 'Ground travel', ru: 'Наземные путешествия' },
    Icon: Route,
  },
  { href: '/passport', en: 'Passport', ru: 'Паспорт', Icon: Stamp },
]

/**
 * Floating rail: four labeled destinations. Adding lives inside the pages (Journal's Add flight, the ground-travel
 * Add chooser), so the rail has no action key. The rail slides off-screen while the keyboard is open (`useKeyboardFlag`).
 */
export function TabBar({ locale: initialLocale = 'en' }: { locale?: Locale }) {
  const locale = useLocale(initialLocale)
  const pathname = usePathname()
  const ru = locale === 'ru'
  useKeyboardFlag()
  return (
    <nav aria-label={ru ? 'Вкладки' : 'Tabs'} className="tab-bar">
      <ul>
        {TABS.map(({ Icon, ...tab }) => (
          <Tab
            key={tab.href}
            href={tab.href}
            active={isActive(pathname, tab.href)}
            icon={<Icon size={22} strokeWidth={2} aria-hidden="true" />}
            en={tab.en}
            ru={tab.ru}
            name={tab.name?.[locale]}
          />
        ))}
      </ul>
    </nav>
  )
}
