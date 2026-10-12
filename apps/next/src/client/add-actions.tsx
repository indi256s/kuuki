'use client'

import { NavigationLink as Link } from './navigation-link'
import { useAwaiting } from './awaiting'
import { formatNumber } from '../lib/format'
import { QueueMenuItem } from './queue-summary'
import { ClipboardCheck, ClipboardPaste, PenLine, ScanLine, Upload } from '@keyline-icons/react'
import type { ReactNode } from 'react'
import { MenuItem } from './ui/menu'

type Action = {
  id: 'pass' | 'upload' | 'paste' | 'manual'
  href: string
  en: string
  ru: string
  icon: ReactNode
}

/** The capture entry points. One list feeds the desktop split-Add menu and the mobile action sheet. */
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

/** `menu` renders Radix menu items (inside a Menu); `sheet` renders a plain list of links for the action sheet. */
export function AddActions({
  variant,
  onNavigate,
  locale = 'en',
}: {
  variant: 'menu' | 'sheet'
  onNavigate?: () => void
  locale?: 'en' | 'ru'
}) {
  const { data } = useAwaiting()
  if (variant === 'menu') {
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
  const queueLink =
    data && data.actionableCount > 0 ? (
      <Link
        href="/journal?queue=awaiting"
        className="add-action"
        data-add-action="queue"
        onClick={onNavigate}
      >
        <ClipboardCheck size={20} strokeWidth={2} aria-hidden="true" />
        <span className="locale-en queue-label">To review</span>
        <span className="locale-ru queue-label" lang="ru">
          На проверку
        </span>
        <span className="queue-count">{formatNumber(locale, data.actionableCount)}</span>
      </Link>
    ) : null
  return (
    <ul className="add-actions">
      {ADD_ACTIONS.map((action) => (
        <li key={action.id}>
          <Link
            href={action.href}
            className="add-action"
            data-add-action={action.id}
            onClick={onNavigate}
          >
            {action.icon}
            <Label action={action} />
          </Link>
        </li>
      ))}
      {queueLink ? <li>{queueLink}</li> : null}
    </ul>
  )
}
