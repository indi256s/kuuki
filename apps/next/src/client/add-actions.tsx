'use client'

import { useLocale } from './preferences'

import { NavigationLink as Link } from './navigation-link'
import { QueueMenuItem } from './queue-summary'
import { ClipboardPaste, PenLine, ScanLine, Upload } from '@keyline-icons/react'
import type { ReactNode } from 'react'
import { MenuItem } from './ui/menu'

type Action = {
  id: 'pass' | 'upload' | 'paste' | 'manual'
  href: string
  en: string
  ru: string
  icon: ReactNode
}

/** The capture entry points. One list feeds the desktop Add menu and the mobile Add card. */
export const ADD_ACTIONS: readonly Action[] = [
  {
    id: 'pass',
    href: '/import?source=pass',
    en: 'Add boarding pass',
    ru: 'Добавить посадочный',
    icon: <ScanLine size={20} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'upload',
    href: '/import?source=file',
    en: 'Upload a booking or PDF',
    ru: 'Загрузить бронь или PDF',
    icon: <Upload size={20} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'paste',
    href: '/import?source=text',
    en: 'Paste text',
    ru: 'Вставить текст',
    icon: <ClipboardPaste size={20} strokeWidth={2} aria-hidden="true" />,
  },
  {
    id: 'manual',
    href: '/add',
    en: 'Enter manually',
    ru: 'Ввести вручную',
    icon: <PenLine size={20} strokeWidth={2} aria-hidden="true" />,
  },
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

/** Radix menu items for the desktop Add menu and the mobile Add card; the queue row comes last, only with work in it. */
export function AddActions({ locale: initialLocale = 'en' }: { locale?: 'en' | 'ru' }) {
  const locale = useLocale(initialLocale)
  return (
    <>
      {ADD_ACTIONS.map((action) => (
        <MenuItem key={action.id} asChild>
          <Link href={action.href} data-add-action={action.id}>
            {action.icon}
            <Label action={action} />
          </Link>
        </MenuItem>
      ))}
      <QueueMenuItem locale={locale} showUnavailable={false} />
    </>
  )
}
