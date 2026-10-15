'use client'

import { useLocale } from './preferences'

import { NavigationLink as Link } from './navigation-link'
import { QueueMenuItem } from './queue-summary'
import { Car, PenLine, Train, Upload } from '@keyline-icons/react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { copy as groundCopy } from './ground/copy'
import { GROUND_PATH, parseGroundUrl, withReturn } from './ground/url'
import { MenuGroup, MenuItem } from './ui/menu'

type Action = {
  id: 'upload' | 'manual' | 'rail' | 'road'
  href: string
  en: string
  ru: string
  icon: ReactNode
}

/** Flights first, then ground travel; the fixed order never changes with the page. */
export const ADD_GROUPS: readonly (readonly Action[])[] = [
  [
    {
      id: 'upload',
      href: '/import',
      en: 'Flights from files',
      ru: 'Перелёты из файлов',
      icon: <Upload size={20} strokeWidth={2} aria-hidden="true" />,
    },
    {
      id: 'manual',
      href: '/add',
      en: 'Flight by hand',
      ru: 'Перелёт вручную',
      icon: <PenLine size={20} strokeWidth={2} aria-hidden="true" />,
    },
  ],
  [
    {
      id: 'rail',
      href: `${GROUND_PATH}/new?mode=rail`,
      en: groundCopy.en.addTrain,
      ru: groundCopy.ru.addTrain,
      icon: <Train size={20} strokeWidth={2} aria-hidden="true" />,
    },
    {
      id: 'road',
      href: `${GROUND_PATH}/new?mode=road`,
      en: groundCopy.en.addRoad,
      ru: groundCopy.ru.addRoad,
      icon: <Car size={20} strokeWidth={2} aria-hidden="true" />,
    },
  ],
]

function Label({ action }: { action: Action }) {
  return (
    <>
      <span className="locale-en">{action.en}</span>
      <span className="locale-ru" lang="ru">
        {action.ru}
      </span>
    </>
  )
}

/**
 * Radix menu items for the desktop Add menu and the mobile Add card: the flight pair and the ground pair, apart by space
 * (no divider, no group labels), then the queue row only with work in it. On the ground list the ground rows carry its
 * current view, so a cancelled form returns there. Menu content mounts only while open, so `location` is client-side.
 */
export function AddActions({ locale: initialLocale = 'en' }: { locale?: 'en' | 'ru' }) {
  const locale = useLocale(initialLocale)
  const pathname = usePathname()
  const href = (action: Action) =>
    (action.id === 'rail' || action.id === 'road') && pathname === GROUND_PATH
      ? withReturn(action.href, parseGroundUrl(window.location.search))
      : action.href
  return (
    <>
      {ADD_GROUPS.map((group) => (
        <MenuGroup key={group[0]!.id}>
          {group.map((action) => (
            <MenuItem key={action.id} asChild>
              <Link href={href(action)} data-add-action={action.id}>
                {action.icon}
                <Label action={action} />
              </Link>
            </MenuItem>
          ))}
        </MenuGroup>
      ))}
      <QueueMenuItem locale={locale} showUnavailable={false} />
    </>
  )
}
